// @vitest-environment jsdom
import { expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { writingKeymap } from "./keys";

function view(doc: string, head = 0) {
  return new EditorView({ state: EditorState.create({ doc, selection: { anchor: head } }) });
}
const binding = (keys: ReturnType<typeof writingKeymap>, key: string) => keys.find(b => b.key === key)!;

it("Tab indents instead of leaving the editor", () => {
  // `defaultKeymap` binds nothing to Tab, so the key moved focus out — reported
  // as the editor jumping to another screen. Indentation nests a list item and
  // opens a code block: in Markdown it is syntax, not decoration.
  const keys = writingKeymap();
  const v = view("- item");
  expect(binding(keys, "Tab").run!(v)).toBe(true);
  expect(v.state.doc.toString()).toBe("  - item");
  v.destroy();
});

it("Shift-Tab takes the indentation back out", () => {
  const keys = writingKeymap();
  const v = view("    - item", 6);
  expect(binding(keys, "Tab").shift!(v)).toBe(true);
  expect(v.state.doc.toString()).toBe("  - item");
  v.destroy();
});

it("Escape releases the next Tab, and only the next one", () => {
  // A Tab that indents is a Tab that cannot leave, and an editor a keyboard
  // user can enter and not exit is a trap.
  const keys = writingKeymap();
  const v = view("- item");
  expect(binding(keys, "Escape").run!(v)).toBe(false); // arms, and still lets the panel close
  expect(binding(keys, "Tab").run!(v)).toBe(false);    // this one moves focus
  expect(v.state.doc.toString()).toBe("- item");
  expect(binding(keys, "Tab").run!(v)).toBe(true);     // the latch is spent
  expect(v.state.doc.toString()).toBe("  - item");
  v.destroy();
});

it("each editor has its own latch", () => {
  const a = writingKeymap(), b = writingKeymap();
  const v = view("x");
  binding(a, "Escape").run!(v);
  expect(binding(b, "Tab").run!(v)).toBe(true);
  v.destroy();
});

it("Ctrl-Home and Ctrl-End reach the ends of the document on every platform", () => {
  // `standardKeymap` binds `Mod-Home`, and `Mod` is `Cmd` on macOS — so
  // `Ctrl-Home` did nothing there, which is where it was reported.
  const keys = writingKeymap();
  const v = view("one\ntwo\nthree", 5);
  expect(binding(keys, "Ctrl-End").run!(v)).toBe(true);
  expect(v.state.selection.main.head).toBe(v.state.doc.length);
  expect(binding(keys, "Ctrl-Home").run!(v)).toBe(true);
  expect(v.state.selection.main.head).toBe(0);
  v.destroy();
});

it("shifted, they select to the end of the document rather than moving", () => {
  const keys = writingKeymap();
  const v = view("one\ntwo\nthree", 4);
  expect(binding(keys, "Ctrl-End").shift!(v)).toBe(true);
  expect(v.state.selection.main.anchor).toBe(4);
  expect(v.state.selection.main.head).toBe(v.state.doc.length);
  v.destroy();
});
