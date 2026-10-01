// @vitest-environment jsdom
//
// What the editor SHOWS, not what the store holds.
//
// Every other test of this area asserts on `useEditor.getState().doc`, and that
// is exactly the gap that let "Restore" ship broken: the store held the draft
// text and CodeMirror kept the text from disk, so every store assertion passed
// while the screen was wrong. These tests read `view.state.doc` through the
// rendered component, which is the only place the two can disagree.
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Editor } from "./Editor";
import * as ipc from "../ipc";
import { useEditor } from "../stores/editor";
import { useSettings } from "../stores/settings";

vi.mock("../ipc", async original => ({
  ...await original<typeof import("../ipc")>(),
  draftResolve: vi.fn(),
  conflictResolve: vi.fn(),
  noteConvertEol: vi.fn(),
}));

const rev = { hash: "b3:abc", size: 8, mtime_ns: "1" } as ipc.BaseRev;
const draft = { reason: "stale", buffer_version: 4 } as unknown as ipc.DraftInfo;

/** The note as the core answers for it — the text the user asked to see. */
function opened(text: string): ipc.OpenedNote {
  return {
    note_id: "note", path: "note.md", text, base_rev: rev, read_only: null, draft: null, profile: {},
  } as ipc.OpenedNote;
}

/** A note already on screen, with `externalRev` where a fresh open leaves it. */
function onScreen(text: string, over: Partial<ReturnType<typeof useEditor.getState>["doc"] & object> = {}) {
  useEditor.setState({
    doc: {
      noteId: "note" as ipc.NoteId, path: "note.md" as ipc.RelPath, text, baseRev: rev,
      readOnly: null, bufferVersion: 0, savedVersion: 0, externalRev: 0,
      status: "saved", conflict: null, draft: null, lastError: null, ...over,
    },
  });
}

// CodeMirror puts every line in its own element, so the content node's
// `textContent` concatenates them with nothing between: "a\nb" reads back as
// "ab". Joining the lines is what makes a multi-line assertion mean anything.
// The zero-width space is what an empty line renders as.
function shown(): string {
  const cm = document.querySelector(".cm-content");
  if (!cm) throw new Error("CodeMirror never mounted");
  return Array.from(cm.querySelectorAll(".cm-line"))
    .map(l => (l.textContent ?? "").replace(/​/g, ""))
    .join("\n");
}

afterEach(() => {
  cleanup();
  useEditor.setState({ doc: null });
  vi.clearAllMocks();
});

useSettings.setState({ settings: null } as never);

it("restoring a draft puts the recovered text on the screen, not only in the store", async () => {
  onScreen("from disk", { draft });
  render(<Editor />);
  expect(shown()).toBe("from disk");

  vi.mocked(ipc.draftResolve).mockResolvedValue(opened("what the user typed"));
  await act(async () => { await useEditor.getState().resolveDraft(true); });

  // The store was never the problem. The screen was.
  expect(useEditor.getState().doc?.text).toBe("what the user typed");
  expect(shown()).toBe("what the user typed");
});

it("discarding a draft also reaches the screen", async () => {
  onScreen("stale buffer", { draft });
  render(<Editor />);

  vi.mocked(ipc.draftResolve).mockResolvedValue(opened("from disk"));
  await act(async () => { await useEditor.getState().resolveDraft(false); });

  expect(shown()).toBe("from disk");
});

it("resolving a conflict reaches the screen", async () => {
  onScreen("mine", { conflict: rev, status: "conflict" });
  render(<Editor />);

  vi.mocked(ipc.conflictResolve).mockResolvedValue(opened("the disk's"));
  await act(async () => { await useEditor.getState().resolveConflict("use_disk" as ipc.ConflictChoice); });

  expect(shown()).toBe("the disk's");
});

it("converting line endings reaches the screen", async () => {
  onScreen("a\nb");
  render(<Editor />);

  vi.mocked(ipc.noteConvertEol).mockResolvedValue(opened("a\nb\n"));
  await act(async () => { await useEditor.getState().convertEol("crlf" as ipc.Eol); });

  expect(shown()).toBe("a\nb\n");
});

// The counter is what carries a replacement across to the view, and a
// replacement that does not move it is invisible by construction — so the
// invariant is asserted directly, where a future call site would break it.
it("every buffer replacement moves externalRev forward", async () => {
  onScreen("from disk", { externalRev: 7, draft });
  render(<Editor />);

  vi.mocked(ipc.draftResolve).mockResolvedValue(opened("restored"));
  await act(async () => { await useEditor.getState().resolveDraft(true); });

  expect(useEditor.getState().doc?.externalRev).toBe(8);
});

// ---- the assistant's edits go in as one undoable step -----------------------

it("the assistant's edits are one transaction: one undo takes back the whole turn and nothing typed before it", async () => {
  const { editorBridge } = await import("./selection");
  onScreen("um dois três");
  render(<Editor />);
  const bridge = editorBridge();
  expect(bridge?.noteId).toBe("note");

  const done = bridge!.apply(
    [
      { op: "replace_all", text: "novo texto" },
      { op: "insert_at_cursor", text: "!" },
    ],
    null,
  );
  expect(done).toMatchObject({ applied: 2, readOnly: false });
  expect(shown()).toBe("novo texto!");
  // It reached the store as a keystroke would: the ordinary save path will see it.
  expect(useEditor.getState().doc?.text).toBe("novo texto!");

  expect(bridge!.undo(done.token as number)).toBe(true);
  expect(shown()).toBe("um dois três");
  expect(useEditor.getState().doc?.text).toBe("um dois três");
});

it("an undo that would take back something other than the assistant's turn is refused", async () => {
  const { editorBridge } = await import("./selection");
  onScreen("abc");
  render(<Editor />);
  const bridge = editorBridge()!;
  const first = bridge.apply([{ op: "insert_at_cursor", text: "X" }], null);
  const second = bridge.apply([{ op: "insert_at_cursor", text: "Y" }], null);
  // The first turn's step is no longer the last one done.
  expect(bridge.undo(first.token as number)).toBe(false);
  expect(shown()).toBe("XYabc");
  expect(bridge.undo(second.token as number)).toBe(true);
  expect(shown()).toBe("Xabc");
});

it("a read-only note is never edited by the assistant", async () => {
  const { editorBridge } = await import("./selection");
  onScreen("fixo", { readOnly: { reason: "x" } as never });
  render(<Editor />);
  const result = editorBridge()!.apply([{ op: "replace_all", text: "outro" }], null);
  expect(result).toMatchObject({ applied: 0, readOnly: true, token: null });
  expect(shown()).toBe("fixo");
});

it("replace_selection replaces the selected text when it is still what was shared", async () => {
  const { editorBridge } = await import("./selection");
  onScreen("um dois três");
  render(<Editor />);
  const { EditorView } = await import("@codemirror/view");
  const view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
  view.dispatch({ selection: { anchor: 3, head: 7 } });
  const ok = editorBridge()!.apply([{ op: "replace_selection", text: "2" }], "dois");
  expect(ok.applied).toBe(1);
  expect(shown()).toBe("um 2 três");
});
