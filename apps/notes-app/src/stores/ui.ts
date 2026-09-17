import { create } from "zustand";
import * as ipc from "../ipc";

/** Source · Preview · Split (scope §9). Live Preview and WYSIWYG are out of the MVP. */
export type ViewMode = "source" | "preview" | "split";

const MODES: ViewMode[] = ["source", "preview", "split"];

/**
 * Which panel the sidebar is showing, or `null` for a collapsed sidebar.
 *
 * The rail's icons toggle this, and clicking the icon of the panel already
 * showing collapses the sidebar (`.continue/0.1d-interface.md` §4.1). Graph
 * uses the main area and shares the knowledge index with backlinks.
 */
export type Panel = "files" | "search" | "graph";

/**
 * The one width at which the sidebar stops being a column and becomes a drawer.
 *
 * Written once and read by both sides: `styles.css` opens its mobile block with
 * this exact query, and `collapseOnNarrow` asks `matchMedia` for the same
 * string. Two copies of a breakpoint drift, and the shape that drift takes is a
 * drawer that closes at one width and overlays at another.
 */
export const NARROW = "(max-width: 720px)";

interface UiState {
  view: ViewMode;
  /** `null` means the sidebar is collapsed. */
  panel: Panel | null;
  /** The conflict comparison screen. Not a command — it changes nothing on
   *  disk and reads two strings this frontend already holds
   *  (docs/ARCHITECTURE.md §17.1). */
  comparing: boolean;

  setView: (v: ViewMode) => void;
  /** Show a panel; showing the one already shown collapses the sidebar. */
  togglePanel: (p: Panel) => void;
  /** `Ctrl+E`, per scope §9's shortcut table. */
  cycleView: () => void;
  /**
   * Collapse the sidebar when the window is too narrow to show it beside the
   * editor, and do nothing otherwise.
   *
   * On a phone the sidebar is an overlay, not a column: opening a note from it
   * has to hand the screen over, or the note the user just asked for is behind
   * the drawer that asked. On a desktop the sidebar is a column and closing it
   * on every open would be the app fighting the user.
   *
   * The width lives in CSS and is read back through `matchMedia` rather than
   * being written twice: the query here and the one in `styles.css` are the
   * same string, and a layout that disagrees with its own breakpoint is the
   * bug this shape avoids.
   */
  collapseOnNarrow: () => void;
  setComparing: (b: boolean) => void;
  hydrate: () => Promise<void>;
}

function isMode(v: string): v is ViewMode {
  return (MODES as string[]).includes(v);
}

/** Persisted through `session_save`, debounced, exactly like every other piece
 *  of UI state (docs/ARCHITECTURE.md §4.4). A failure to persist is never
 *  allowed to break the toggle itself. */
let persist: ReturnType<typeof setTimeout> | null = null;
function remember(view: ViewMode) {
  if (persist) clearTimeout(persist);
  persist = setTimeout(() => {
    void ipc
      .sessionGet()
      .then((s) => ipc.sessionSave({ ...s, view_mode: view }))
      .catch(() => {});
  }, 1000);
}

export const useUi = create<UiState>((set, get) => ({
  view: "source",
  panel: "files",
  comparing: false,

  togglePanel(p) {
    set((s) => ({ panel: s.panel === p ? null : p }));
  },

  setView(view) {
    set({ view });
    remember(view);
  },

  collapseOnNarrow() {
    // No `matchMedia` at all is a environment that is not a browser window —
    // a test runner, a prerender. Neither is narrow, and neither should have
    // its sidebar closed underneath it.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia(NARROW).matches) return;
    set({ panel: null });
  },

  cycleView() {
    const next = MODES[(MODES.indexOf(get().view) + 1) % MODES.length];
    get().setView(next);
  },

  setComparing: (comparing) => set({ comparing }),

  async hydrate() {
    try {
      const session = await ipc.sessionGet();
      if (isMode(session.view_mode)) set({ view: session.view_mode });
    } catch {
      // An unreadable session starts an empty one and never stops the app
      // opening (docs/ARCHITECTURE.md §4.4).
    }
  },
}));
