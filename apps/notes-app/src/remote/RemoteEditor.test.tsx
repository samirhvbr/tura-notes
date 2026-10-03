// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  remoteSave: vi.fn(),
  remoteOpen: vi.fn(),
  remoteMerge: vi.fn(),
  remoteRender: vi.fn(async () => ({ html: "", blocked_remote: [], shown_remote: [] })),
  remoteList: vi.fn(async () => []),
}));
const ipcMod = await import("../ipc");
const { RemoteEditor } = await import("./RemoteEditor");
const { useRemoteDoc, resetRemoteDocTimers } = await import("../stores/remoteDoc");
const { useEditor } = await import("../stores/editor");
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
