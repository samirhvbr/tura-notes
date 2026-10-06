// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as ipc from "../ipc";
vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  remoteConfigGet: vi.fn(),
  remoteConfigSet: vi.fn(),
  remoteList: vi.fn(),
  remoteProbe: vi.fn(),
  remoteRename: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../app/dialog", async (original) => ({
  ...(await original<typeof import("../app/dialog")>()),
  askText: vi.fn(),
}));
const { RemoteBrowser } = await import("./RemoteBrowser");
const { useRemote } = await import("../stores/remote");
const { useRemoteDoc } = await import("../stores/remoteDoc");
const { askText } = await import("../app/dialog");
const initial = useRemote.getState();
afterEach(() => {
  cleanup();
  useRemote.setState(initial, true);
  useRemoteDoc.setState({ doc: null, tabs: [] });
  vi.clearAllMocks();
});

const config: ipc.RemoteConfig = {
  origin: "https://notes.example.com",
  workspace: "home",
  token_file: "/home/me/.config/tura/token",
  allow_private: false,
};

it("asks where the server is when nothing is configured", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(null);
  render(<RemoteBrowser />);
  const connect = await screen.findByRole("button", { name: "Connect" });
  expect(connect).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText("https://notes.example.com"), {
    target: { value: config.origin },
  });
  vi.mocked(ipc.remoteProbe).mockResolvedValue({
    outcome: "granted",
    status: 200,
    workspace: "home",
    scope: null,
    permissions: ["read"],
    review: false,
  } as ipc.SyncProbe);
  const inputs = screen.getAllByRole("textbox");
  fireEvent.change(inputs[1], { target: { value: config.token_file } });
  fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
  // The credential names the workspace, and an empty field takes it.
  await waitFor(() => expect(screen.getByDisplayValue("home")).toBeInTheDocument());
  vi.mocked(ipc.remoteConfigSet).mockResolvedValue(undefined);
  vi.mocked(ipc.remoteList).mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Connect" }));
  await waitFor(() => expect(ipc.remoteConfigSet).toHaveBeenCalledWith(config));
  await screen.findByText("No notes on the server yet.");
});

it("shows the tree with each note's mark in words, and counts them", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue([
    { path: "only.md", size: 1, etag: '"a"', local: "absent" },
    { path: "same.md", size: 1, etag: '"b"', local: "same" },
    { path: "work/changed.md", size: 1, etag: '"c"', local: "differs" },
  ]);
  const opened: string[] = [];
  render(<RemoteBrowser onOpen={(e) => opened.push(e.path)} />);
  await screen.findByText("3 notes · 1 only on the server · 1 different from local");
  expect(screen.getByText("home on notes.example.com")).toBeInTheDocument();
  expect(screen.getByText("Only on the server")).toBeInTheDocument();
  expect(screen.getByText("Same as the local copy")).toBeInTheDocument();
  // Folders start closed; opening one shows its note and its mark.
  expect(screen.queryByText("changed.md")).toBeNull();
  fireEvent.click(screen.getByTitle("work"));
  fireEvent.click(await screen.findByText("changed.md"));
  expect(screen.getByText("Different from the local copy")).toBeInTheDocument();
  expect(opened).toEqual(["work/changed.md"]);
});

it("says what is wrong in the remote folder's own words", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockRejectedValue({ code: "sync", cause: "offline" });
  render(<RemoteBrowser />);
  expect(await screen.findByRole("alert")).toHaveTextContent("The server could not be reached");
});

it("a new note typed without .md is created with it", async () => {
  const { askText } = await import("../app/dialog");
  const { useRemoteDoc } = await import("../stores/remoteDoc");
  const create = vi.fn(async () => {});
  const old = useRemoteDoc.getState().create;
  useRemoteDoc.setState({ create });
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue([]);
  vi.mocked(askText).mockResolvedValue("ideas/today");
  render(<RemoteBrowser />);
  fireEvent.click(await screen.findByRole("button", { name: "New note on the server" }));
  await waitFor(() => expect(create).toHaveBeenCalledWith("ideas/today.md"));
  useRemoteDoc.setState({ create: old });
});

// ---- right-click on a note ---------------------------------------------------

const listed = [
  { path: "only.md", size: 1, etag: '"a"', local: "absent" },
  { path: "work/other.md", size: 1, etag: '"b"', local: "same" },
] as ipc.RemoteEntry[];

it("a right-click on a note offers Rename, and renaming works without opening the note", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(listed);
  vi.mocked(askText).mockResolvedValue("ideas/first");
  vi.mocked(ipc.remoteRename).mockResolvedValue({ path: "ideas/first.md", text: "", etag: '"z"', read_only: null });
  const opened: string[] = [];
  render(<RemoteBrowser onOpen={(e) => opened.push(e.path)} />);
  fireEvent.contextMenu(await screen.findByText("only.md"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Rename or move on the server" }));
  // The name is completed the way the new-note prompt completes it.
  await waitFor(() => expect(ipc.remoteRename).toHaveBeenCalledWith("only.md", "ideas/first.md", '"a"'));
  expect(opened).toEqual([]);
  await waitFor(() => expect(ipc.remoteList).toHaveBeenCalledTimes(2));
});

it("the ⋮ button opens the same menu for whoever has no right button", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(listed);
  render(<RemoteBrowser onOpen={() => {}} />);
  await screen.findByText("only.md");
  fireEvent.click(screen.getByRole("button", { name: /only\.md/, expanded: false, haspopup: "menu" } as never));
  expect(await screen.findByRole("menuitem", { name: "Rename or move on the server" })).toBeInTheDocument();
});

it("cancelling the prompt, or keeping the same name, renames nothing", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(listed);
  render(<RemoteBrowser onOpen={() => {}} />);
  const row = await screen.findByText("only.md");
  for (const answer of [null, "only"]) {
    vi.mocked(askText).mockResolvedValue(answer);
    fireEvent.contextMenu(row);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename or move on the server" }));
    await waitFor(() => expect(askText).toHaveBeenCalled());
    vi.mocked(askText).mockClear();
  }
  expect(ipc.remoteRename).not.toHaveBeenCalled();
});

it("a refusal is said in words under the title bar, and the tree is left as it was", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(listed);
  vi.mocked(askText).mockResolvedValue("taken");
  vi.mocked(ipc.remoteRename).mockRejectedValue({ code: "sync", cause: "invalid" });
  render(<RemoteBrowser onOpen={() => {}} />);
  fireEvent.contextMenu(await screen.findByText("only.md"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Rename or move on the server" }));
  expect(await screen.findByText("The connection settings are not valid, or the server refused that name.")).toBeInTheDocument();
  expect(ipc.remoteList).toHaveBeenCalledTimes(1);
});

it("the note that is open with unsent text cannot be renamed from the tree", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(listed);
  useRemoteDoc.setState({
    doc: { path: "only.md", text: "x", etag: '"a"', bufferVersion: 2, savedVersion: 1 } as never,
  });
  render(<RemoteBrowser onOpen={() => {}} />);
  fireEvent.contextMenu(await screen.findByText("only.md"));
  expect(await screen.findByRole("menuitem", { name: "Rename or move on the server" })).toHaveAttribute("aria-disabled", "true");
});

// ---- folders -----------------------------------------------------------------

it("a new folder appears at once, empty and marked as only here, and opens so it is seen", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(listed);
  vi.mocked(askText).mockResolvedValue("ideas/2026");
  render(<RemoteBrowser onOpen={() => {}} />);
  await screen.findByText("only.md");
  fireEvent.click(screen.getByRole("button", { name: "New folder on the server" }));
  expect(await screen.findByText("ideas")).toBeInTheDocument();
  expect(await screen.findByText("2026")).toBeInTheDocument();
  expect(screen.getAllByText("empty")).toHaveLength(2);
  expect(screen.getByTitle("ideas/2026: only in this window until a note is created in it")).toBeInTheDocument();
  // Nothing was sent to the server: a folder there is a prefix of a note.
  expect(ipc.remoteRename).not.toHaveBeenCalled();
});

it("a folder is a name or a path, and what is not one is refused before it is made", async () => {
  const { remoteFolderPath } = await import("./names");
  expect(remoteFolderPath("ideas")).toBe("ideas");
  expect(remoteFolderPath("/ideas/2026/")).toBe("ideas/2026");
  expect(remoteFolderPath("  a / b ")).toBe("a/b");
  for (const bad of ["", "   ", "/", "a//b", "../x", "a/./b", "a/.."]) expect(remoteFolderPath(bad), bad).toBeNull();
});

it("a right-click on a folder offers a note or a subfolder in it, starting from its path", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(listed);
  vi.mocked(askText).mockResolvedValue(null);
  render(<RemoteBrowser onOpen={() => {}} />);
  fireEvent.contextMenu(await screen.findByTitle("work"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "New folder here" }));
  await waitFor(() => expect(askText).toHaveBeenCalledWith(expect.objectContaining({ initial: "work/" })));
  fireEvent.contextMenu(screen.getByTitle("work"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "New note here" }));
  await waitFor(() => expect(askText).toHaveBeenLastCalledWith(expect.objectContaining({ initial: "work/" })));
});

it("a folder that only exists here can be forgotten, and one the server has cannot", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(listed);
  render(<RemoteBrowser onOpen={() => {}} />);
  await screen.findByText("only.md");
  act(() => useRemote.getState().addFolder("draft"));
  fireEvent.contextMenu(await screen.findByTitle("draft: only in this window until a note is created in it"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Remove this empty folder" }));
  await waitFor(() => expect(screen.queryByText("draft")).toBeNull());
  fireEvent.contextMenu(screen.getByTitle("work"));
  expect(await screen.findByRole("menuitem", { name: "New note here" })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Remove this empty folder" })).toBeNull();
});

it("a folder with no notes is shown even when the server has none at all", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue([]);
  render(<RemoteBrowser onOpen={() => {}} />);
  await screen.findByText("No notes on the server yet.");
  act(() => useRemote.getState().addFolder("first"));
  expect(await screen.findByText("first")).toBeInTheDocument();
  expect(screen.queryByText("No notes on the server yet.")).toBeNull();
});
