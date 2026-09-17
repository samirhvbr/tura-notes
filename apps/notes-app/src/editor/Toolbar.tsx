import type { EditorView } from "@codemirror/view";
import { t } from "../i18n";
import { apply, type Action } from "./markdown-actions";

/**
 * The Markdown row a virtual keyboard has no keys for.
 *
 * `**`, `` ` `` and `[` are two or three taps deep on a phone keyboard, and the
 * last line of the interface bullet in `ACCEPTANCE-0.4.md` is exactly that.
 * Hidden above the drawer breakpoint by CSS rather than by a second check here:
 * one number decides where this application is narrow, and it lives in
 * `stores/ui.ts` beside the query the stylesheet opens with.
 *
 * The work is in `markdown-actions.ts`, which is pure and tested. What is left
 * here is reading the selection out of CodeMirror and writing the result back,
 * in one transaction so a press is one undo.
 */
const BUTTONS: { action: Action; label: string; glyph: string }[] = [
  { action: "bold", label: "toolbar.bold", glyph: "B" },
  { action: "italic", label: "toolbar.italic", glyph: "I" },
  { action: "heading", label: "toolbar.heading", glyph: "H" },
  { action: "list", label: "toolbar.list", glyph: "•" },
  { action: "link", label: "toolbar.link", glyph: "🔗" },
  { action: "code", label: "toolbar.code", glyph: "<>" },
];

export function Toolbar({ view }: { view: () => EditorView | null }) {
  function run(action: Action) {
    const editor = view();
    if (!editor) return;
    const { from, to } = editor.state.selection.main;
    const before = editor.state.doc.toString();
    const after = apply(action, { text: before, from, to });

    // One transaction for the whole change, so one press is one undo rather
    // than a rewrite the user has to back out of character by character.
    editor.dispatch({
      changes: { from: 0, to: before.length, insert: after.text },
      selection: { anchor: after.from, head: after.to },
      scrollIntoView: true,
    });
    // The keyboard must not close: the point of the row is to keep typing.
    editor.focus();
  }

  return (
    <div className="mdbar" role="toolbar" aria-label={t("toolbar.label")}>
      {BUTTONS.map(({ action, label, glyph }) => (
        <button
          key={action}
          type="button"
          className="mdbar-btn"
          title={t(label)}
          aria-label={t(label)}
          // `mousedown` would take focus off the editor and dismiss the
          // keyboard before the press ever lands.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run(action)}
        >
          <span aria-hidden="true">{glyph}</span>
        </button>
      ))}
    </div>
  );
}
