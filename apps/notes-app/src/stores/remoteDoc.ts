import { create } from "zustand";
import * as ipc from "../ipc";
import { isComposing } from "../ipc/barrier";
import { useEditor } from "./editor";
import { useRemote } from "./remote";
import { useUi } from "./ui";

/**
 * The remote folder's open notes (ADR-099): their buffers, their tabs, and the
 * saves that carry them to the server.
 *
 * **A store of its own, on purpose.** The local editor's document is keyed by
 * a local note id and a local revision, and half the application reads it:
 * session restore, reconcile, drafts, received-sync application, backlinks.
 * A remote note put there would be handed to every one of them as a local
 * file. Here none of them can see it.
 *
 * The rules are the local editor's. `bufferVersion` is the stale-save guard:
 * a save marks the buffer clean only when the version it sent is still the
 * current one. Saves run one at a time. A note changed on the server in the
 * meantime is a **conflict** the user resolves, never an overwrite, because
 * every save carries the ETag the text was read at.
 *
 * **Two apps with the same note open stay in step** without a reload. The open
 * note is read again every ten seconds while the window can be seen
 * ([`sync`]), and a save the server refuses as stale goes through the same
 * reconciliation ([`reconcile`]):
 * - the buffer has nothing unsent: the server's text replaces it, keeping the
 *   cursor;
 * - it has unsent text and the two edits touched different lines: they are
 *   joined by a three-way merge against the text both started from (`base`),
 *   and the result is saved;
 * - they touched the same lines: the existing conflict, with both versions.
 * Nothing the person typed is ever replaced by a guess.
 *
 * What differs is that nothing here writes a draft. The only copy of an unsent
 * edit is this buffer, so it is never dropped:
 * - offline, it retries with backoff;
 * - a tab refuses to close over it without asking;
 * - the window refuses to close over it (`App.tsx`);
 * - the way out when the server will not take it is "save a copy to the local
 *   folder", as an ordinary note.
 */
/** The `cap` of the refusal to leave a note whose text the server has not taken.
 *  Named once because two places must agree on it: the throw below, and
 *  `errorText`, which turns it into a sentence. A string compared in two files
 *  is how a refusal ends up shown as "this storage does not support that". */
export const REMOTE_UNSENT = "remote note has unsent changes";

export type RemoteStatus =
  | "saved"
  | "pending"
  | "writing"
  | "offline"
  | "conflict"
  | "gone"
  | "read_only"
  | "error";

/** What the last reconciliation with the server did, for the status bar. */
export type SyncNote = { kind: "updated" | "merged"; at: number };

export interface RemoteDoc {
  path: string;
  text: string;
  etag: string;
  /** The server's text at `etag`: what an edit made here started from, and so
   *  the common ancestor of a merge. */
  base: string;
  readOnly: string | null;
  bufferVersion: number;
  savedVersion: number;
  status: RemoteStatus;
  /** Bumped when the text is replaced from outside the editor (taking the
   *  server's version), so the editor swaps it without losing the cursor. */
  externalRev: number;
  /** The server's current note, after a save was refused on a stale tag. */
  conflict: ipc.RemoteNote | null;
  lastError: ipc.CoreError | null;
  /** Set when the text changed because the server's did. */
  synced: SyncNote | null;
}

interface RemoteDocState {
  /** Open remote notes, by path, in tab order. */
  tabs: string[];
  doc: RemoteDoc | null;
  open(path: string): Promise<void>;
  activate(path: string): Promise<void>;
  /** Close a tab. Resolves `false`, and keeps it, when its buffer holds an
   *  edit the server does not have and `discard` was not given. */
  close(path: string, discard?: boolean): Promise<boolean>;
  edit(text: string): void;
  save(): Promise<void>;
  resolve(choice: "mine" | "theirs" | "copy"): Promise<void>;
  /** The note was deleted on the server: put it back with this buffer. */
  recreate(): Promise<void>;
  /** Write the buffer into the local folder as a new note; returns its path. */
  copyToLocal(): Promise<string>;
  create(path: string): Promise<void>;
  /** Read the open note from the server and bring the buffer up to date with
   *  it. Cheap when nothing changed; never throws. */
  sync(): Promise<void>;
  rename(to: string): Promise<void>;
  /**
   * Rename or move a note of the server's tree, open or not. The open note
   * goes through [`rename`], which leaves the buffer alone; any other is
   * renamed at the revision the listing showed, and a stale one is refused by
   * the server and says so. Returns false when nothing was done because the
   * note is open with text not yet sent: that text would be left behind.
   */
  renameNote(from: string, to: string, etag: string | null): Promise<boolean>;
  remove(): Promise<void>;
}

export const dirty = (d: RemoteDoc | null) => !!d && d.bufferVersion !== d.savedVersion;

function fromNote(n: ipc.RemoteNote, externalRev = 0): RemoteDoc {
  return {
    path: n.path,
    text: n.text,
    etag: n.etag,
    base: n.text,
    readOnly: n.read_only,
    bufferVersion: 0,
    savedVersion: 0,
    status: n.read_only ? "read_only" : "saved",
    externalRev,
    conflict: null,
    lastError: null,
    synced: null,
  };
}

/** Transient refusals: the edit stays and the save is tried again. */
function transient(e: ipc.CoreError) {
  return e.code === "sync" && (e.cause === "offline" || e.cause === "busy");
}

/** A failed save stays unresolved while typing or retrying. Transport states
 *  (pending/writing) describe activity, not recovery: hiding the warning on
 *  those transitions removes a row above the editor on every keystroke. */
export function saveWarning(d: RemoteDoc | null): "offline" | "error" | null {
  if (!d?.lastError || !dirty(d) || d.conflict || d.status === "gone" || d.readOnly) return null;
  return transient(d.lastError) ? "offline" : "error";
}

let debounce: ReturnType<typeof setTimeout> | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let queue: Promise<void> = Promise.resolve();

/** Five seconds, doubling, at most a minute: the server allows a credential
 *  60 requests a minute, and a retry loop must not be what spends them. */
export function backoff(n: number) {
  return Math.min(5000 * 2 ** Math.max(n - 1, 0), 60000);
}

/** How often the open note is read: the person who asked for this wanted ten
 *  seconds. A credential has 60 requests a minute, so one open note costs six. */
export const SYNC_MS = 10_000;
let syncFailures = 0;
let syncing = false;

/** The wait before the next read: the interval, doubling after each failure up
 *  to a minute, so a server that is down is not asked every ten seconds. */
export function syncDelay(failures = syncFailures) {
  return Math.min(SYNC_MS * 2 ** failures, 60_000);
}

function stem(path: string) {
  return path.replace(/\.(md|markdown)$/i, "");
}

export const useRemoteDoc = create<RemoteDocState>((set, get) => {
  function update(path: string, patch: (d: RemoteDoc) => Partial<RemoteDoc>) {
    set((s) => (s.doc && s.doc.path === path ? { doc: { ...s.doc, ...patch(s.doc) } } : s));
  }

  async function runSave(): Promise<void> {
    const d = get().doc;
    if (!d || d.readOnly || d.conflict || d.status === "gone") return;
    if (d.bufferVersion === d.savedVersion) return;
    const sending = d.bufferVersion;
    update(d.path, () => ({ status: "writing" }));
    let r: ipc.RemoteSave;
    try {
      r = await ipc.remoteSave(d.path, d.text, d.etag);
    } catch (e) {
      const error = ipc.asCoreError(e);
      if (transient(error)) {
        failures += 1;
        update(d.path, () => ({ status: "offline", lastError: error }));
        if (retry) clearTimeout(retry);
        retry = setTimeout(() => void get().save(), backoff(failures));
      } else {
        update(d.path, () => ({ status: "error", lastError: error }));
      }
      return;
    }
    failures = 0;
    if (r.outcome === "saved") {
      update(d.path, (now) => ({
        etag: r.etag,
        // What the server holds now is what was sent.
        base: d.text,
        savedVersion: sending,
        status: now.bufferVersion === sending ? "saved" : "pending",
        // An acknowledgement for older text does not settle the current edit.
        lastError: now.bufferVersion === sending ? null : now.lastError,
      }));
      // Typed while it was on the wire: send the rest.
      const now = get().doc;
      if (now && now.path === d.path && now.bufferVersion !== sending) void get().save();
    } else if (r.outcome === "conflict") {
      await reconcile(r.current);
    } else {
      update(d.path, () => ({ status: "gone" }));
    }
  }

  /**
   * The server's copy of the open note is not the one this buffer was read at.
   * Bring the two together, without ever replacing what the person typed with a
   * guess. Called with the server's current note, from a save it refused and
   * from the periodic read.
   */
  async function reconcile(theirs: ipc.RemoteNote): Promise<void> {
    const d = get().doc;
    if (!d || d.path !== theirs.path || theirs.etag === d.etag) return;
    const now = Date.now();
    const adopt = (text: string, kind: SyncNote["kind"] | null) => {
      // The buffer is now the server's note. Both versions move together so
      // the swap is not mistaken for an edit and is not sent back.
      const version = d.bufferVersion + 1;
      set({
        doc: {
          ...fromNote(theirs, d.externalRev + 1),
          text,
          bufferVersion: version,
          savedVersion: version,
          synced: kind ? { kind, at: now } : d.synced,
        },
      });
    };

    if (theirs.text === d.text) {
      // The same words under a new tag (the other app saved what was here, or
      // touched the note): nothing to show, only the tag to take.
      adopt(d.text, null);
      return;
    }
    if (!dirty(d)) {
      adopt(theirs.text, "updated");
      return;
    }

    // Unsent text of ours, and a newer note on the server.
    let joined: string | null = null;
    try {
      joined = (await ipc.remoteMerge(d.base, d.text, theirs.text)).text;
    } catch {
      joined = null;
    }
    const after = get().doc;
    if (!after || after.path !== d.path || after.etag !== d.etag || after.bufferVersion !== d.bufferVersion) {
      // Typed, or saved, while the merge ran. Whatever was typed has its own
      // save scheduled, and it will meet this again with the newer text.
      return;
    }
    if (joined === null) {
      update(d.path, () => ({ status: "conflict", conflict: theirs }));
      return;
    }
    if (joined === theirs.text) {
      adopt(theirs.text, "updated");
      return;
    }
    set({
      doc: {
        ...after,
        text: joined,
        etag: theirs.etag,
        base: theirs.text,
        readOnly: theirs.read_only,
        bufferVersion: after.bufferVersion + 1,
        externalRev: after.externalRev + 1,
        status: "pending",
        conflict: null,
        // The joined text still needs a successful save of its own.
        synced: { kind: "merged", at: now },
      },
    });
    // Not awaited: this may be running inside a save, and a save queued behind
    // itself would wait for itself.
    void get().save();
  }

  /** Leave the open note: flush it, and refuse when it will not flush. */
  async function leave(): Promise<boolean> {
    if (debounce) clearTimeout(debounce);
    await get().save();
    return !dirty(get().doc);
  }

  return {
    tabs: [],
    doc: null,

    async open(path) {
      const current = get().doc;
      useUi.setState({ mainView: "remote" });
      if (current?.path === path) return;
      if (current && !(await leave())) {
        // Stay on the note whose edit has not reached the server.
        throw { code: "unsupported", cap: REMOTE_UNSENT } as ipc.CoreError;
      }
      const note = await ipc.remoteOpen(path);
      set((s) => ({
        doc: fromNote(note),
        tabs: s.tabs.includes(path) ? s.tabs : [...s.tabs, path],
      }));
    },

    activate(path) {
      return get().open(path);
    },

    async close(path, discard = false) {
      const d = get().doc;
      if (d?.path === path && dirty(d) && !discard) {
        if (!(await leave())) return false;
      }
      const tabs = get().tabs.filter((p) => p !== path);
      set({ tabs, doc: get().doc?.path === path ? null : get().doc });
      if (get().doc === null) {
        const next = tabs[tabs.length - 1];
        if (next) await get().open(next).catch(() => {});
        else useUi.setState({ mainView: "local" });
      }
      return true;
    },

    edit(text) {
      const d = get().doc;
      if (!d || d.readOnly || d.status === "gone") return;
      set({
        doc: {
          ...d,
          text,
          bufferVersion: d.bufferVersion + 1,
          status: d.conflict ? "conflict" : d.status === "offline" ? "offline" : "pending",
        },
      });
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void get().save(), useEditor.getState().autosaveMs);
    },

    save() {
      queue = queue.then(runSave, runSave);
      return queue;
    },

    async resolve(choice) {
      const d = get().doc;
      if (!d?.conflict) return;
      const theirs = d.conflict;
      if (choice === "mine") {
        // Keep this text, over the server's version the user has now seen.
        update(d.path, () => ({ etag: theirs.etag, base: theirs.text, conflict: null, status: "pending" }));
        await get().save();
        return;
      }
      if (choice === "copy") {
        const folder = d.path.includes("/") ? d.path.slice(0, d.path.lastIndexOf("/") + 1) : "";
        const base = stem(d.path.slice(folder.length));
        for (let n = 1; n <= 20; n++) {
          const name = `${folder}${base} (${n === 1 ? "conflict" : `conflict ${n}`}).md`;
          try {
            await ipc.remoteCreate(name, d.text);
            break;
          } catch (e) {
            if (ipc.asCoreError(e).code !== "already_exists" || n === 20) throw e;
          }
        }
        void useRemote.getState().refresh();
      }
      // Take the server's version into the buffer ("theirs", and "copy" once
      // this text is safe in its own note).
      set({
        doc: {
          ...fromNote(theirs, d.externalRev + 1),
          bufferVersion: d.bufferVersion + 1,
          savedVersion: d.bufferVersion + 1,
        },
      });
    },

    async recreate() {
      const d = get().doc;
      if (!d || d.status !== "gone") return;
      const note = await ipc.remoteCreate(d.path, d.text);
      update(d.path, () => ({
        etag: note.etag,
        base: d.text,
        savedVersion: d.bufferVersion,
        status: "saved",
        lastError: null,
      }));
      void useRemote.getState().refresh();
    },

    async copyToLocal() {
      const d = get().doc;
      if (!d) throw { code: "not_found", path: "" } as ipc.CoreError;
      const base = stem(d.path.split("/").pop() ?? d.path);
      for (let n = 1; ; n++) {
        const name = `${base} (${n === 1 ? "remote" : `remote ${n}`}).md`;
        try {
          // A new note with this text at the root of the local folder: the
          // same command a PDF import uses to save its text as a note.
          const entry = await ipc.pdfSave(name, d.text);
          return entry.path;
        } catch (e) {
          if (ipc.asCoreError(e).code !== "already_exists" || n >= 20) throw e;
        }
      }
    },

    async create(path) {
      const note = await ipc.remoteCreate(path, "");
      void useRemote.getState().refresh();
      await get().open(note.path);
    },

    async sync() {
      const d = get().doc;
      // A save in flight, a conflict being decided, or a note that is not on
      // the server are not states to read over; nor is a word being composed.
      if (syncing || !d || d.status === "writing" || d.status === "conflict" || d.status === "gone") return;
      syncing = true;
      try {
        const theirs = await ipc.remoteOpen(d.path);
        const now = get().doc;
        // The note, its tag and the save state are what they were when the read
        // began, or this answer is older than something that already happened
        // (a save of ours that finished meanwhile would look like a change).
        if (!now || now.path !== d.path || now.etag !== d.etag || now.status === "writing") return;
        syncFailures = 0;
        if (isComposing() && !dirty(now)) return;
        await reconcile(theirs);
      } catch (e) {
        const error = ipc.asCoreError(e);
        if (error.code === "not_found") {
          const now = get().doc;
          if (now && now.path === d.path && now.etag === d.etag) update(d.path, () => ({ status: "gone" }));
          return;
        }
        syncFailures += 1;
      } finally {
        syncing = false;
      }
    },

    async rename(to) {
      const d = get().doc;
      if (!d || dirty(d)) return;
      const note = await ipc.remoteRename(d.path, to, d.etag);
      set((s) => ({
        doc: fromNote(note, d.externalRev + 1),
        tabs: s.tabs.map((p) => (p === d.path ? note.path : p)),
      }));
      void useRemote.getState().refresh();
    },

    async renameNote(from, to, etag) {
      const d = get().doc;
      if (d && d.path === from) {
        if (dirty(d)) return false;
        await get().rename(to);
        return true;
      }
      // A listing from an older server carries no tag; the note then says
      // which revision it is.
      const tag = etag ?? (await ipc.remoteOpen(from)).etag;
      const note = await ipc.remoteRename(from, to, tag);
      set((s) => ({ tabs: s.tabs.map((p) => (p === from ? note.path : p)) }));
      void useRemote.getState().refresh();
      return true;
    },

    async remove() {
      const d = get().doc;
      if (!d) return;
      await ipc.remoteDelete(d.path, d.etag);
      await get().close(d.path, true);
      void useRemote.getState().refresh();
    },
  };
});

/** For tests: forget the timers and the queue between cases. */
export function resetRemoteDocTimers() {
  if (debounce) clearTimeout(debounce);
  if (retry) clearTimeout(retry);
  debounce = retry = null;
  failures = 0;
  syncFailures = 0;
  syncing = false;
  queue = Promise.resolve();
}
