import { expect, it } from "vitest";
import { minimalChange, simulate, type EditOp } from "./aiEdits";

const at = (from: number, to = from) => ({ from, to });
const op = (name: EditOp["op"], text: string): EditOp => ({ op: name, text });

it("replace_all makes the text the whole note and puts the cursor after it", () => {
  const r = simulate("velho", at(2), [op("replace_all", "novo texto")], null);
  expect(r).toEqual({ text: "novo texto", sel: at(10), applied: 1, skipped: [] });
});

it("insert_at_cursor writes after the selection's end, or at the caret", () => {
  expect(simulate("abcdef", at(3), [op("insert_at_cursor", "X")], null).text).toBe("abcXdef");
  const r = simulate("abcdef", at(1, 3), [op("insert_at_cursor", "X")], null);
  expect(r.text).toBe("abcXdef");
  expect(r.sel).toEqual(at(4));
});

it("replace_selection replaces exactly what was shared, and only while it is still selected", () => {
  const r = simulate("um dois três", at(3, 7), [op("replace_selection", "2")], "dois");
  expect(r).toEqual({ text: "um 2 três", sel: at(4), applied: 1, skipped: [] });
});

it("replace_selection does not guess: nothing selected, nothing shared, or a different selection", () => {
  expect(simulate("abc", at(1), [op("replace_selection", "X")], "b").skipped).toEqual(["no_selection"]);
  expect(simulate("abc", at(1, 2), [op("replace_selection", "X")], null).skipped).toEqual(["no_selection"]);
  const moved = simulate("abc", at(0, 1), [op("replace_selection", "X")], "b");
  expect(moved).toMatchObject({ text: "abc", applied: 0, skipped: ["selection_changed"] });
});

it("a turn's operations run in order, and a second replace_selection has nothing left to act on", () => {
  const r = simulate(
    "aaa bbb",
    at(0, 3),
    [op("replace_selection", "A"), op("replace_selection", "B"), op("insert_at_cursor", "!")],
    "aaa",
  );
  expect(r.text).toBe("A! bbb");
  expect(r.applied).toBe(2);
  expect(r.skipped).toEqual(["no_selection"]);
});

it("a reversed selection is read the right way round", () => {
  expect(simulate("abcdef", { from: 4, to: 1 }, [op("replace_selection", "-")], "bcd").text).toBe("a-ef");
});

it("minimalChange is the smallest single replacement, and never splits a surrogate pair", () => {
  expect(minimalChange("abcdef", "abXdef")).toEqual({ from: 2, to: 3, insert: "X" });
  expect(minimalChange("abc", "abc")).toEqual({ from: 3, to: 3, insert: "" });
  expect(minimalChange("", "novo")).toEqual({ from: 0, to: 0, insert: "novo" });
  expect(minimalChange("abc", "")).toEqual({ from: 0, to: 3, insert: "" });
  expect(minimalChange("aaa", "aaaa")).toEqual({ from: 3, to: 3, insert: "a" });
  // 😀 and 😁 share their high surrogate: the change must take both halves.
  const change = minimalChange("x😀y", "x😁y");
  expect(change).toEqual({ from: 1, to: 3, insert: "😁" });
  // Applying any change reproduces the target.
  for (const [a, b] of [["abcabc", "abc"], ["abc", "abcabc"], ["one two", "one 2 two"], ["x😀y", "xy"]]) {
    const c = minimalChange(a, b);
    expect(a.slice(0, c.from) + c.insert + a.slice(c.to)).toBe(b);
  }
});
