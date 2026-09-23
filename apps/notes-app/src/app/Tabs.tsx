import type { KeyboardEvent } from "react";
import { Columns2, Plus, X } from "lucide-react";
import { t } from "../i18n";
import { useEditor } from "../stores/editor";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";

/**
 * The tab strip.
 *
 * A tab shows the file name; the path is the title, because two notes called
 * `notas.md` in different folders are the case where a name alone stops being
 * an identifier. The dirty marker is a dot rather than a colour, for the same
 * reason the status bar carries a word and a glyph: state never rides on colour
 * alone. From 0.1d the active tab also carries a **background**, because a
 * difference in text weight alone is not one on a bad screen.
 */
export function Tabs({ onNew }: { onNew: () => void }) {
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const activate = useTabs((s) => s.activate);
  const close = useTabs((s) => s.close);
  const doc = useEditor((s) => s.doc);
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);

  const split = view === "split";

  // The keyboard half of the pattern `role="tablist"` announces (R6-40): one
  // stop in the Tab order, the arrows and Home/End move between tabs and open
  // the one they land on, Delete closes the focused one. The close buttons are
  // left out of the Tab order for that reason; they stay one click away.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const ids = tabs.map((tab) => tab.noteId);
    const focused = (e.target as HTMLElement).closest<HTMLElement>("[data-note-id]")?.dataset.noteId;
    const at = ids.indexOf(focused as (typeof ids)[number]);
    if (at < 0) return;
    const to =
      e.key === "ArrowRight" ? (at + 1) % ids.length
      : e.key === "ArrowLeft" ? (at - 1 + ids.length) % ids.length
      : e.key === "Home" ? 0
      : e.key === "End" ? ids.length - 1
      : null;
    if (e.key === "Delete") {
      e.preventDefault();
      void close(ids[at]);
      return;
    }
    if (to === null) return;
    e.preventDefault();
    e.currentTarget.querySelector<HTMLElement>(`[data-note-id="${ids[to]}"]`)?.focus();
    void activate(ids[to]);
  };

  return (
    <div className="tabbar">
      {/* The wrappers are presentational so that each tab belongs to the
          tablist: with them in between, a screen reader heard a lone
          "tab, selected" instead of "tab 2 of 4". */}
      <div className="tabs" role="tablist" aria-label={t("tabs.label")} onKeyDown={onKeyDown}>
        {tabs.map((tab) => {
          const active = tab.noteId === activeId;
          const dirty = active && doc ? doc.bufferVersion !== doc.savedVersion : false;
          const name = tab.path.split("/").pop() ?? tab.path;
          return (
            <div key={tab.noteId} role="presentation" className={active ? "tab on" : "tab"} title={tab.path}>
              <button
                role="tab"
                aria-selected={active}
                aria-controls="note-panel"
                tabIndex={active || (!activeId && tab === tabs[0]) ? 0 : -1}
                data-note-id={tab.noteId}
                className="tab-label"
                onClick={() => void activate(tab.noteId)}
              >
                <span className="tab-dirty" aria-hidden="true">
                  {dirty ? "●" : ""}
                </span>
                {name}
              </button>
              <button
                className="tab-close"
                tabIndex={-1}
                aria-label={t("tabs.close", { name })}
                onClick={(e) => {
                  e.stopPropagation();
                  void close(tab.noteId);
                }}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="icon-btn tab-new"
        aria-label={t("tabs.new")}
        title={t("tabs.new")}
        onClick={onNew}
      >
        <Plus size={14} aria-hidden="true" />
      </button>

      <span className="spacer" />

      <button
        type="button"
        className={split ? "icon-btn on" : "icon-btn"}
        aria-pressed={split}
        aria-label={t("tabs.split")}
        title={t("tabs.split")}
        onClick={() => setView(split ? "source" : "split")}
      >
        <Columns2 size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
