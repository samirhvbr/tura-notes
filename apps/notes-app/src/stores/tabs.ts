import { create } from "zustand";
import * as ipc from "../ipc";
import type { NoteId, RelPath, Session, Tab } from "../ipc";
import { type OpenDoc, useEditor } from "./editor";
// `workspace.ts` imports this module too. The cycle is safe because every use
// here is `getState()` inside an async action — by the time one runs, both
// modules have finished evaluating. A top-level read would not be.
import { useWorkspace } from "./workspace";
import { useUi } from "./ui";

/**
 * Tabs, milestone 0.1c.
 *
 * A **separate** store rather than a rewrite of the editor's, on purpose: the
 * editor holds exactly one loaded document and everything in 0.1a and 0.1b is
 * written against that. Making every consumer tab-aware to gain a tab strip
 * would put the whole write protocol back in play for a navigation feature.
 *
 * So this store owns the *list* and the editor owns the *document*. A tab
 * carries only what has to survive a restart — path, identity, cursor, scroll —
 * and the buffer lives where it always did.
 *
 * Switching away from a dirty note **flushes it** first, and a note in conflict
 * writes its draft instead of being saved. Neither is a special case invented
 * here: they are the two things `ARCHITECTURE.md` §5 already says happen when a
 * buffer stops being looked at. If the flush does not land or the draft cannot
 * be confirmed, the switch is refused and the tab stays open with its text.
 */
export interface TabEntry {
  noteId: NoteId;
  path: RelPath;
  line: number;
  col: number;
  scrollTop: number;
  pinned: boolean;
}

interface TabsState {
  tabs: TabEntry[];
  activeId: NoteId | null;
  /** Set while `restore` is applying a saved session, so the cursor coming from
   *  a freshly mounted editor does not overwrite the one being restored. */
  restoring: boolean;

  openPath: (path: RelPath) => Promise<void>;
  /** Open a note **at a position** — what clicking a search hit means. */
  openAt: (path: RelPath, line: number, col: number) => Promise<void>;
  /** Bumped when a jump is requested into a note that is already mounted, so
   *  the editor moves the caret instead of waiting for a rebuild that will not
   *  happen. */
  gotoRev: number;
  activate: (noteId: NoteId) => Promise<void>;
  close: (noteId: NoteId) => Promise<void>;
  closeActive: () => Promise<void>;
  noteCursor: (noteId: NoteId, line: number, col: number, scrollTop: number) => void;
  repath: (from: RelPath, to: RelPath, noteId?: NoteId) => void;
  forget: (noteIds: NoteId[]) => void;
  reset: () => void;

  persist: () => Promise<void>;
  restore: () => Promise<void>;
}

/** Session writes are debounced: a cursor moves on every keystroke. */
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: null,
  restoring: false,
  gotoRev: 0,

  reset() {
    if (persistTimer) clearTimeout(persistTimer);
    void import("./history").then((m) => m.useHistoryStore.getState().reset());
    set({ tabs: [], activeId: null, restoring: false });
  },

  async openPath(path) {
    // A local note goes in the main area, over any remote one (ADR-099).
    useUi.setState({ mainView: "local" });
    const existing = get().tabs.find((t) => t.path === path);
    if (existing) return get().activate(existing.noteId);

    if ((await preserveLocalBuffer()) === false || !(await useEditor.getState().open(path))) return;
    const doc = useEditor.getState().doc;
    if (!doc) return;
    // Opening from the palette, a search hit or the history is the same act as
    // opening from the tree, so the tree ends up in the same state either way.
    void useWorkspace.getState().reveal(path);

    set((s) => ({
      tabs: s.tabs.some((t) => t.noteId === doc.noteId)
        ? s.tabs
        : [...s.tabs, { noteId: doc.noteId, path: doc.path, line: 1, col: 1, scrollTop: 0, pinned: false }],
      activeId: doc.noteId,
    }));
    visited(doc.path);
    schedulePersist(get);
  },

  async openAt(path, line, col) {
    const existing = get().tabs.find((t) => t.path === path);
    if (existing) {
      // Set the target first: if the editor rebuilds it reads this, and if it
      // does not, `gotoRev` tells it to move.
      set((s) => ({
        tabs: s.tabs.map((t) => (t.noteId === existing.noteId ? { ...t, line, col } : t)),
      }));
      await get().activate(existing.noteId);
      set((s) => ({ gotoRev: s.gotoRev + 1 }));
      return;
    }
    await get().openPath(path);
    const doc = useEditor.getState().doc;
    if (!doc || doc.path !== path) return;
    set((s) => ({
      tabs: s.tabs.map((t) => (t.noteId === doc.noteId ? { ...t, line, col } : t)),
      gotoRev: s.gotoRev + 1,
    }));
  },

  async activate(noteId) {
    useUi.setState({ mainView: "local" });
    if (get().activeId === noteId && useEditor.getState().doc?.noteId === noteId) return;
    const tab = get().tabs.find((t) => t.noteId === noteId);
    if (!tab) return;

    if ((await preserveLocalBuffer()) === false || !(await useEditor.getState().open(tab.path))) return;
    set({ activeId: noteId });
    // Every route that shows a note lands here - the tree, the palette, search,
    // a link - so the drawer is handed back to the note in one place instead of
    // in each of them.
    useUi.getState().collapseOnNarrow();
    visited(tab.path);
    schedulePersist(get);
  },

  async close(noteId) {
    const { tabs, activeId } = get();
    if (!tabs.some((t) => t.noteId === noteId)) return;

    if (activeId !== noteId) {
      set({ tabs: tabs.filter((t) => t.noteId !== noteId) });
      schedulePersist(get);
      return;
    }
    if ((await preserveLocalBuffer()) === false || get().activeId !== noteId) return;
    const current = get().tabs;
    const i = current.findIndex((t) => t.noteId === noteId);
    // Closing the active tab activates its neighbour — the one to the right,
    // then the one to the left, which is what every editor does.
    const next = current[i + 1] ?? current[i - 1] ?? null;
    if (next) {
      const neighborStillOpen = () => get().activeId === noteId &&
        get().tabs.some((tab) => tab.noteId === next.noteId && tab.path === next.path);
      if (!(await useEditor.getState().open(next.path, neighborStillOpen))) return;
    } else {
      useEditor.getState().close();
    }
    set((s) => ({
      tabs: s.tabs.filter((t) => t.noteId !== noteId),
      activeId: next?.noteId ?? null,
    }));
    schedulePersist(get);
  },

  async closeActive() {
    const id = get().activeId;
    if (id) await get().close(id);
  },

  noteCursor(noteId, line, col, scrollTop) {
    if (get().restoring) return;
    let changed = false;
    const tabs = get().tabs.map((t) => {
      if (t.noteId !== noteId) return t;
      if (t.line === line && t.col === col && t.scrollTop === scrollTop) return t;
      changed = true;
      return { ...t, line, col, scrollTop };
    });
    if (!changed) return;
    set({ tabs });
    schedulePersist(get);
  },

  repath(from, to, noteId) {
    const previous = get().tabs;
    const tabs = previous.map((tab) => {
      if (noteId && tab.noteId !== noteId) return tab;
      const path = noteId ? to : ipc.pathAfterMove(tab.path, from, to);
      return path === tab.path ? tab : { ...tab, path };
    });
    if (tabs.every((tab, i) => tab === previous[i])) return;
    set({ tabs });
    schedulePersist(get);
  },

  /** A note that no longer exists loses its tab — deletion, or an external
   *  removal reconciliation reported. */
  forget(noteIds) {
    if (noteIds.length === 0) return;
    set((s) => {
      const tabs = s.tabs.filter((t) => !noteIds.includes(t.noteId));
      const activeGone = s.activeId !== null && noteIds.includes(s.activeId);
      return { tabs, activeId: activeGone ? (tabs[0]?.noteId ?? null) : s.activeId };
    });
    schedulePersist(get);
  },

  async persist() {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    const { tabs, activeId } = get();
    try {
      const previous = await ipc.sessionGet();
      const session: Session = {
        ...previous,
        tabs: tabs.map(
          (t): Tab => ({
            note_id: t.noteId,
            path: t.path,
            line: t.line,
            col: t.col,
            scroll_top: t.scrollTop,
            pinned: t.pinned,
          }),
        ),
        active_tab: activeId,
      };
      await ipc.sessionSave(session);
    } catch {
      // A session that cannot be written is not worth interrupting the work
      // for; it is UI state, and the core treats an unreadable one as empty.
    }
  },

  /**
   * Reopen what was open. The 0.1c criterion is *"reabrir o app restaura
   * workspace, abas, aba ativa e cursor"*, and the cursor is the part that is
   * easy to lose: it has to be applied **after** the editor has mounted the
   * document, which is why `restoring` exists.
   */
  async restore() {
    let session: Session;
    try {
      session = await ipc.sessionGet();
    } catch {
      return;
    }
    if (session.tabs.length === 0) {
      set({ tabs: [], activeId: null });
      return;
    }

    const tabs: TabEntry[] = session.tabs.map((t) => ({
      noteId: t.note_id,
      path: t.path,
      line: t.line,
      col: t.col,
      scrollTop: t.scroll_top,
      pinned: t.pinned,
    }));
    const active = session.active_tab ?? tabs[0]?.noteId ?? null;
    set({ tabs, activeId: active, restoring: true });

    const tab = tabs.find((t) => t.noteId === active) ?? tabs[0];
    if (tab) {
      try {
        if (await useEditor.getState().open(tab.path)) {
          // Show the restored note's location in the tree.
          await useWorkspace.getState().reveal(tab.path);
        }
      } catch {
        // The note is gone. Its tab goes with it rather than sitting there
        // failing to open every time it is clicked.
        set((s) => ({
          tabs: s.tabs.filter((t) => t.noteId !== tab.noteId),
          activeId: null,
        }));
      }
    }
    set({ restoring: false });
  },
}));

/** The cursor the editor should place after mounting, if any. */
export function pendingCursor(noteId: NoteId | undefined): { line: number; col: number } | null {
  if (!noteId) return null;
  const t = useTabs.getState().tabs.find((x) => x.noteId === noteId);
  return t ? { line: t.line, col: t.col } : null;
}

/**
 * Tell the back/forward history a note is now on screen.
 *
 * Imported lazily so the two stores do not import each other at module load —
 * `history.ts` needs `openPath` to navigate, and this needs `visited` to
 * record. The cycle is real and it is fine at call time; at import time it is
 * an undefined function.
 */
function visited(path: RelPath) {
  void import("./history").then((m) => m.useHistoryStore.getState().visited(path));
}

/** The buffer that may be left behind, or false if its text is still at risk. */
export async function preserveLocalBuffer(): Promise<OpenDoc | null | false> {
  const { doc, save, keepDraft } = useEditor.getState();
  if (!doc || doc.bufferVersion === doc.savedVersion) return doc;
  if (!doc.conflict) await save(true);

  // A flush can fail or land stale. Require a confirmed draft of the latest
  // text before dropping the buffer in either case.
  const current = useEditor.getState().doc;
  if (!current || current.noteId !== doc.noteId) return false;
  if (current.bufferVersion !== current.savedVersion &&
      !(await keepDraft(current.conflict ? "conflict" : "exit"))) return false;
  return current;
}

function schedulePersist(get: () => TabsState) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void get().persist();
  }, 1000);
}
