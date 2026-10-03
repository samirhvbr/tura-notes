import { create } from "zustand";
import * as ipc from "../ipc";
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
 * What differs is that nothing here writes a draft. The only copy of an unsent
 * edit is this buffer, so it is never dropped:
 * - offline, it retries with backoff;
 * - a tab refuses to close over it without asking;
 * - the window refuses to close over it (`App.tsx`);
 * - the way out when the server will not take it is "save a copy to the local
 *   folder", as an ordinary note.
 */
export type RemoteStatus =
  | "saved"
  | "pending"
  | "writing"
  | "offline"
  | "conflict"
  | "gone"
  | "read_only"
  | "error";

export interface RemoteDoc {
  path: string;
  text: string;
  etag: string;
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
    readOnly: n.read_only,
    bufferVersion: 0,
    savedVersion: 0,
    status: n.read_only ? "read_only" : "saved",
    externalRev,
    conflict: null,
    lastError: null,
  };
}

/** Transient refusals: the edit stays and the save is tried again. */
function transient(e: ipc.CoreError) {
  return e.code === "sync" && (e.cause === "offline" || e.cause === "busy");
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
        savedVersion: sending,
        status: now.bufferVersion === sending ? "saved" : "pending",
        lastError: null,
      }));
      // Typed while it was on the wire: send the rest.
      const now = get().doc;
      if (now && now.path === d.path && now.bufferVersion !== sending) void get().save();
    } else if (r.outcome === "conflict") {
      update(d.path, () => ({ status: "conflict", conflict: r.current }));
    } else {
      update(d.path, () => ({ status: "gone" }));
    }
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
        throw { code: "unsupported", cap: "remote note has unsent changes" } as ipc.CoreError;
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
        update(d.path, () => ({ etag: theirs.etag, conflict: null, status: "pending" }));
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
  queue = Promise.resolve();
}
