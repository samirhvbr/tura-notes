// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  remoteSave: vi.fn(),
  remoteRender: vi.fn(async () => ({ html: "", blocked_remote: [], shown_remote: [] })),
  remoteList: vi.fn(async () => []),
}));
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
