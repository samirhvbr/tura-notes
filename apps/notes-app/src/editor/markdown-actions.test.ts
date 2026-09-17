import { describe, expect, it } from "vitest";
import { apply, type Action, type Selection } from "./markdown-actions";

/** `a|bc|d` reads as the document `abcd` with `bc` selected. */
function sel(marked: string): Selection {
  const from = marked.indexOf("|");
  const to = marked.indexOf("|", from + 1) - 1;
  return { text: marked.replace(/\|/g, ""), from, to };
}
function show(s: Selection): string {
  return s.text.slice(0, s.from) + "|" + s.text.slice(s.from, s.to) + "|" + s.text.slice(s.to);
}
function run(action: Action, marked: string): string {
  return show(apply(action, sel(marked)));
}

describe("wrapping actions", () => {
  it("wraps the selection and keeps it on the text, not the marks", () => {
    expect(run("bold", "a |word| b")).toBe("a **|word|** b");
    expect(run("italic", "a |word| b")).toBe("a *|word|* b");
    expect(run("code", "a |word| b")).toBe("a `|word|` b");
  });

  it("unwraps on a second press, which is where the selection was left", () => {
    // Exactly the state the first press produces: marks outside the selection.
    expect(run("bold", "a **|word|** b")).toBe("a |word| b");
    expect(run("code", "a `|word|` b")).toBe("a |word| b");
  });

  it("unwraps when the marks are inside the selection instead", () => {
    expect(run("bold", "a |**word**| b")).toBe("a |word| b");
  });

  it("wraps an empty selection so the caret types between the marks", () => {
    expect(run("bold", "a || b")).toBe("a **||** b");
  });

  it("does not mistake a single mark for a pair", () => {
    // `*word` is not italic; wrapping it must add marks rather than strip one.
    expect(run("italic", "|*word|")).toBe("*|*word|*");
  });
});

describe("line prefixes", () => {
  it("prefixes every line the selection touches", () => {
    expect(run("list", "|one\ntwo|")).toBe("- |one\n- two|");
  });

  it("prefixes the line a collapsed caret sits on", () => {
    // `on||e` is the caret between `on` and `e`, with nothing selected.
    expect(run("heading", "on||e")).toBe("# on||e");
  });

  it("removes the prefix when every touched line already carries it", () => {
    expect(run("list", "- |one\n- two|")).toBe("|one\ntwo|");
  });

  it("finishes the job on a mixed block rather than undoing half of it", () => {
    expect(run("list", "- |one\ntwo|")).toBe("- - |one\n- two|");
  });

  it("never slides the caret behind the prefix it just added", () => {
    const after = apply("list", sel("|one"));
    expect(after.text.slice(0, after.from)).toBe("- ");
  });
});

describe("link", () => {
  it("puts the caret on url so the next keystroke types it", () => {
    expect(run("link", "see |docs| here")).toBe("see [docs](|url|) here");
  });

  it("still produces a link from an empty selection", () => {
    // The user pressed the button because they want a link; an empty label is
    // one keystroke from correct, and no output is a button that looked broken.
    expect(run("link", "see || here")).toBe("see [](|url|) here");
  });
});

describe("what the document keeps", () => {
  it("touches nothing outside the lines the selection is on", () => {
    const before = "keep me\n\nalpha\nbeta\n\nkeep me too\n";
    const marked = before.replace("alpha\nbeta", "|alpha\nbeta|");
    const after = apply("list", sel(marked));
    expect(after.text.startsWith("keep me\n\n")).toBe(true);
    expect(after.text.endsWith("\n\nkeep me too\n")).toBe(true);
  });

  it("leaves CRLF alone, because the core owns line endings", () => {
    const after = apply("bold", sel("a\r\n|word|\r\nb"));
    expect(after.text).toBe("a\r\n**word**\r\nb");
  });
});
