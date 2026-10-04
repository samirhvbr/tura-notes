// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import stylesheet from "../styles.css?raw";
vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  remoteSave: vi.fn(),
  remoteOpen: vi.fn(),
  remoteMerge: vi.fn(),
  remoteRender: vi.fn(async () => ({ html: "", blocked_remote: [], shown_remote: [] })),
  remoteList: vi.fn(async () => []),
  remoteRename: vi.fn(),
}));
const ipcMod = await import("../ipc");
const { RemoteEditor } = await import("./RemoteEditor");
const { useRemoteDoc, resetRemoteDocTimers } = await import("../stores/remoteDoc");
const { useEditor } = await import("../stores/editor");
const { useUi } = await import("../stores/ui");
const initial = useRemoteDoc.getState();
afterEach(() => {
  cleanup();
  resetRemoteDocTimers();
  useRemoteDoc.setState(initial, true);
  vi.clearAllMocks();
});

const base = {
  path: "work/plan.md",
  text: "remote text\n",
  etag: '"e1"',
  base: "remote text\n",
  synced: null,
  readOnly: null,
  bufferVersion: 0,
  savedVersion: 0,
  status: "saved" as const,
  externalRev: 0,
  conflict: null,
  lastError: null,
};

function shown(): string {
  const dom = document.querySelector(".cm-editor") as HTMLElement;
  return EditorView.findFromDOM(dom)!.state.doc.toString();
}

it("edits the remote note in the same editor, and never the local one", () => {
  useEditor.setState({ doc: null });
  useRemoteDoc.setState({ doc: base, tabs: [base.path] });
  render(<RemoteEditor />);
  expect(screen.getByRole("heading", { name: "plan" })).toBeInTheDocument();
  expect(shown()).toBe("remote text\n");
  const view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
  act(() => view.dispatch({ changes: { from: 0, insert: "more " } }));
  expect(useRemoteDoc.getState().doc!.text).toBe("more remote text\n");
  expect(useRemoteDoc.getState().doc!.status).toBe("pending");
  expect(useEditor.getState().doc).toBeNull();
});

it("says a note changed on the server and offers the three ways out", () => {
  useRemoteDoc.setState({
    doc: {
      ...base,
      bufferVersion: 1,
      status: "conflict",
      conflict: { path: base.path, text: "theirs\n", etag: '"s2"', read_only: null },
    },
    tabs: [base.path],
  });
  render(<RemoteEditor />);
  expect(screen.getByText("“plan.md” changed on the server")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Compare" }));
  expect(screen.getByText("On the server")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Keep mine" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save mine as a copy" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Use the server's" }));
  expect(useRemoteDoc.getState().doc!.text).toBe("theirs\n");
});

it("a note gone from the server keeps its text, read-only, with a way back", () => {
  useRemoteDoc.setState({ doc: { ...base, bufferVersion: 1, status: "gone" }, tabs: [base.path] });
  render(<RemoteEditor />);
  expect(screen.getByText("“plan.md” is no longer on the server")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Put it back on the server" })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Save a copy to the local folder" }).length).toBeGreaterThan(0);
  expect(shown()).toBe("remote text\n");
});

it("a note changed on the server shows the new text on screen without a reload, and the other app's words join the ones typed here", async () => {
  useEditor.setState({ doc: null });
  useRemoteDoc.setState({ doc: { ...base, text: "a\nb\nc\nd\ne\nf\ng\n", base: "a\nb\nc\nd\ne\nf\ng\n" }, tabs: [base.path] });
  vi.mocked(ipcMod.remoteOpen).mockResolvedValue({
    path: base.path,
    text: "A\nb\nc\nd\ne\nf\ng\n",
    etag: '"s2"',
    read_only: null,
  });
  render(<RemoteEditor />);
  // Mounting reads the note at once; the text on screen follows the server's.
  await vi.waitFor(() => expect(shown()).toBe("A\nb\nc\nd\ne\nf\ng\n"));
  expect(useRemoteDoc.getState().doc!.synced?.kind).toBe("updated");
  expect(ipcMod.remoteSave).not.toHaveBeenCalled();

  // Now something typed here and not sent, and another change over there.
  const view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
  act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: "h\n" } }));
  vi.mocked(ipcMod.remoteOpen).mockResolvedValue({
    path: base.path,
    text: "A\nB\nc\nd\ne\nf\ng\n",
    etag: '"s3"',
    read_only: null,
  });
  vi.mocked(ipcMod.remoteMerge).mockResolvedValue({ text: "A\nB\nc\nd\ne\nf\ng\nh\n" });
  vi.mocked(ipcMod.remoteSave).mockResolvedValue({ outcome: "saved", etag: '"s4"' } as never);
  await act(async () => {
    await useRemoteDoc.getState().sync();
  });
  await vi.waitFor(() => expect(shown()).toBe("A\nB\nc\nd\ne\nf\ng\nh\n"));
  await vi.waitFor(() => expect(ipcMod.remoteSave).toHaveBeenCalledWith(base.path, "A\nB\nc\nd\ne\nf\ng\nh\n", '"s3"'));
});

/**
 * Switching from one remote note to another.
 *
 * Every test above opens ONE note, and that is how this shipped. The editor's
 * view is rebuilt when a dependency list changes, and its first entry was
 * `key.split(":")[0]` — the document id with the version suffix cut off. A
 * local id is a UUID, so that left the whole id. A remote id is
 * `remote:<path>`, so it left the word `remote`: the same for every note, and
 * the view was never rebuilt on a switch. The second note opened on the first
 * one's text.
 */
function open(note: { path: string; text: string }) {
  vi.mocked(ipcMod.remoteOpen).mockResolvedValue({ ...note, etag: '"e"', read_only: null });
  return act(async () => {
    await useRemoteDoc.getState().open(note.path);
  });
}

it("opening a second remote note shows ITS text, not the first one's", async () => {
  useEditor.setState({ doc: null });
  useRemoteDoc.setState({ doc: null, tabs: [] });
  render(<RemoteEditor />);
  await open({ path: "IP-Server.md", text: "# IP\n\nhttps://100.64.65.25/\n" });
  await vi.waitFor(() => expect(shown()).toBe("# IP\n\nhttps://100.64.65.25/\n"));

  await open({ path: "teste.md", text: "" });
  // What the store holds, and what the preview and the status bar are built
  // from, is the empty note...
  expect(useRemoteDoc.getState().doc!.path).toBe("teste.md");
  expect(useRemoteDoc.getState().doc!.text).toBe("");
  // ...and the editor has to say the same thing.
  await vi.waitFor(() => expect(shown()).toBe(""));
});

it("a keystroke in the second note is saved to the second note, with only its own text", async () => {
  // The consequence that makes this more than cosmetic. With the first note's
  // text still in the view, the first keystroke sent *that text plus the
  // character* as the new content of the second note — overwriting it on the
  // server, carrying a valid tag, with nobody asked and nothing refused.
  useEditor.setState({ doc: null });
  useRemoteDoc.setState({ doc: null, tabs: [] });
  render(<RemoteEditor />);
  await open({ path: "IP-Server.md", text: "# IP\n\nhttps://100.64.65.25/\n" });
  await vi.waitFor(() => expect(shown()).toBe("# IP\n\nhttps://100.64.65.25/\n"));
  await open({ path: "teste.md", text: "my own words\n" });
  await vi.waitFor(() => expect(shown()).toBe("my own words\n"));

  const view = EditorView.findFromDOM(document.querySelector(".cm-editor") as HTMLElement)!;
  act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: "!" } }));
  expect(useRemoteDoc.getState().doc!.path).toBe("teste.md");
  expect(useRemoteDoc.getState().doc!.text).toBe("my own words\n!");
});

it("going back to the first note shows the first note again", async () => {
  useEditor.setState({ doc: null });
  useRemoteDoc.setState({ doc: null, tabs: [] });
  render(<RemoteEditor />);
  await open({ path: "a.md", text: "AAA\n" });
  await vi.waitFor(() => expect(shown()).toBe("AAA\n"));
  await open({ path: "b.md", text: "BBB\n" });
  await vi.waitFor(() => expect(shown()).toBe("BBB\n"));
  await open({ path: "a.md", text: "AAA\n" });
  await vi.waitFor(() => expect(shown()).toBe("AAA\n"));
});

it("a note renamed on the server keeps its text on screen", async () => {
  // A path is the remote id, so a rename changes it. The view is rebuilt on
  // the new id; what has to survive is the text.
  useEditor.setState({ doc: null });
  useRemoteDoc.setState({ doc: { ...base, path: "old.md", text: "kept\n", base: "kept\n" }, tabs: ["old.md"] });
  vi.mocked(ipcMod.remoteOpen).mockResolvedValue({ path: "old.md", text: "kept\n", etag: '"e1"', read_only: null });
  render(<RemoteEditor />);
  await vi.waitFor(() => expect(shown()).toBe("kept\n"));
  vi.mocked(ipcMod.remoteRename).mockResolvedValue({ path: "new.md", text: "kept\n", etag: '"e2"', read_only: null } as never);
  await act(async () => {
    await useRemoteDoc.getState().rename("new.md");
  });
  await vi.waitFor(() => expect(shown()).toBe("kept\n"));
  expect(useRemoteDoc.getState().doc!.path).toBe("new.md");
});

/**
 * The split, as the stylesheet reads it.
 *
 * The divider writes `--split` on `.panes`, and a rule in `styles.css` turns it
 * into a width. That rule named `.editor`, which sat directly under `.panes`
 * until 1.6.15 wrapped it in `.editor-wrap` for the Markdown row. From then on
 * the rule pointed at a grandchild, did nothing, and the divider wrote a
 * variable no rule read. Every test passed throughout: the divider's own tests
 * check the variable, and nothing checked that the stylesheet *uses* it on an
 * element the layout will honour.
 *
 * jsdom has no layout, so this does not measure a width. It checks the thing
 * that went wrong and can be checked here: every rule that reads `--split` must
 * select an element that exists in the rendered panes and is a direct child of
 * `.panes`, because only a flex child is sized by `flex`.
 */
it("every rule that reads --split sizes a direct child of .panes", () => {
  useEditor.setState({ doc: null });
  useUi.setState({ view: "split" });
  useRemoteDoc.setState({ doc: base, tabs: [base.path] });
  render(<RemoteEditor />);
  const panes = document.querySelector(".panes.pane-split");
  expect(panes, "the split view renders .panes.pane-split").not.toBeNull();

  const css = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*var\(--split[^{}]*)\}/g)];
  expect(rules.length, "something reads --split at all").toBeGreaterThan(0);
  for (const [, selectors] of rules) {
    for (const selector of selectors.split(",").map((x) => x.trim()).filter(Boolean)) {
      const el = document.querySelector(selector);
      expect(el, `"${selector}" matches an element in the rendered split`).not.toBeNull();
      expect(
        el!.parentElement,
        `"${selector}" is a direct child of .panes, so flex sizes it`,
      ).toBe(panes);
    }
  }
});

/**
 * A note the server will not take.
 *
 * The status bar said "Not saved" and, beside it, a sentence about the sync
 * settings; the note itself said nothing, and the way out was in a menu. The
 * app also refuses to leave such a note (its text is the only copy), and that
 * refusal reached the screen as "This storage does not support that" — the
 * generic sentence for `unsupported`, which has no idea what was refused.
 */
it("the refusal to leave a note with unsent changes is explained, not blamed on the storage", async () => {
  const { errorText } = await import("../app/StatusBar");
  const said = errorText({ code: "unsupported", cap: "remote note has unsent changes" } as never);
  expect(said).not.toMatch(/storage/i);
  expect(said).toMatch(/server did not take/);
  expect(said).toMatch(/Save a copy to the local folder/);
  // Any other refusal keeps the sentence it always had.
  expect(errorText({ code: "unsupported", cap: "something else" } as never)).toBe("This storage does not support that.");
});

it("a note the server will not take says so, keeps its text, and offers the two ways out", async () => {
  useEditor.setState({ doc: null });
  useRemoteDoc.setState({
    doc: { ...base, bufferVersion: 1, status: "error", lastError: { code: "sync", cause: "invalid" } as never },
    tabs: [base.path],
  });
  render(<RemoteEditor />);
  expect(screen.getByText("“plan.md” was not saved to the server")).toBeInTheDocument();
  expect(screen.getByText(/kept here until it is saved or discarded/)).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Save a copy to the local folder" }).length).toBeGreaterThan(0);
  expect(shown()).toBe("remote text\n");
  // And trying again is one click, not a menu.
  vi.mocked(ipcMod.remoteSave).mockResolvedValue({ outcome: "saved", etag: '"e2"' } as never);
  fireEvent.click(screen.getByRole("button", { name: "Try now" }));
  await vi.waitFor(() => expect(ipcMod.remoteSave).toHaveBeenCalledWith(base.path, "remote text\n", base.etag));
});
