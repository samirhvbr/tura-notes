import type { KeyBinding } from "@codemirror/view";
import {
  cursorDocEnd, cursorDocStart, indentLess, indentMore, selectDocEnd, selectDocStart,
} from "@codemirror/commands";

/**
 * The keys a writing surface is expected to have, and that CodeMirror leaves to
 * the application on purpose.
 *
 * **`Tab`.** `defaultKeymap` binds nothing to it, so the browser's own
 * behaviour stands and the key moves focus out of the editor — reported as the
 * editor "jumping to another screen". Indentation is not decoration in
 * Markdown: it is what nests a list item and what makes an indented code block,
 * so a Markdown editor that cannot indent is missing a syntax, not a
 * convenience. CodeMirror omits the binding because of what it costs, not
 * because it is wrong, and the cost is handled below.
 *
 * **`Ctrl-Home` / `Ctrl-End`.** `standardKeymap` binds `Mod-Home`, and `Mod` is
 * `Cmd` on macOS — so the document ends have always been reachable there by
 * `Cmd-Home`, and the `Ctrl-Home` that every Windows and Linux user has in
 * their hands did nothing at all. Both are bound now, on every platform: the
 * cost of honouring a second habit is one entry in a list, and the cost of
 * refusing it is a key that silently does nothing.
 */
export function writingKeymap(): KeyBinding[] {
  /**
   * What `Tab` costs, and the standard way of paying it.
   *
   * A `Tab` that indents is a `Tab` that cannot leave, and an editor a keyboard
   * user can enter and not exit is a trap — the one real argument against the
   * binding. `Escape` arms the next `Tab` to move focus instead, which is the
   * pattern CodeMirror's own documentation recommends, and it is per view
   * because this closure is called once per editor.
   *
   * `Escape` returns `false` on purpose: it arms, and then lets everything else
   * bound to `Escape` run — closing the search panel above all. Arming it
   * without using it costs nothing; the latch is spent by the `Tab` that reads
   * it, so the key goes back to indenting immediately afterwards.
   */
  const escape = { armed: false };
  const released = () => {
    if (!escape.armed) return false;
    escape.armed = false;
    return true;
  };
  return [
    { key: "Escape", run: () => { escape.armed = true; return false; } },
    { key: "Tab", run: view => released() ? false : indentMore(view), shift: view => released() ? false : indentLess(view) },
    { key: "Ctrl-Home", run: cursorDocStart, shift: selectDocStart, preventDefault: true },
    { key: "Ctrl-End", run: cursorDocEnd, shift: selectDocEnd, preventDefault: true },
  ];
}
