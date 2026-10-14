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
  remoteCreateFolder: vi.fn(),
  remoteProbe: vi.fn(),
  remoteRename: vi.fn(),
  remoteDelete: vi.fn(),
  pairBegin: vi.fn(),
  pairFinish: vi.fn(),
  pairSignOut: vi.fn(),
  shellOpen: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../app/dialog", async (original) => ({
  ...(await original<typeof import("../app/dialog")>()),
  askText: vi.fn(),
  askConfirm: vi.fn(),
}));
const { RemoteBrowser } = await import("./RemoteBrowser");
const { useRemote } = await import("../stores/remote");
const { useRemoteDoc } = await import("../stores/remoteDoc");
const { askText, askConfirm } = await import("../app/dialog");
const initial = useRemote.getState();
afterEach(() => {
  cleanup();
  useRemote.setState(initial, true);
  useRemoteDoc.setState({ doc: null, tabs: [] });
  vi.clearAllMocks();
});

/** What the command answers: the notes, and the folders when the server lists them. */
const tree = (entries: ipc.RemoteEntry[], folders?: string[]): ipc.RemoteTree => ({
  entries,
  folders: folders ?? [],
  folders_supported: folders !== undefined,
  folders_truncated: false,
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
  // By its label: the sign-in section above the form has fields of its own.
  fireEvent.change(screen.getAllByLabelText(/Credential file/)[0], { target: { value: config.token_file } });
  fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
  // The credential names the workspace, and an empty field takes it.
  await waitFor(() => expect(screen.getByDisplayValue("home")).toBeInTheDocument());
  vi.mocked(ipc.remoteConfigSet).mockResolvedValue(undefined);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree([]));
  fireEvent.click(screen.getByRole("button", { name: "Connect" }));
  await waitFor(() => expect(ipc.remoteConfigSet).toHaveBeenCalledWith(config));
  await screen.findByText("No notes on the server yet.");
});

it("shows the tree with each note's mark in words, and counts them", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree([
    { path: "only.md", size: 1, etag: '"a"', local: "absent" },
    { path: "same.md", size: 1, etag: '"b"', local: "same" },
    { path: "work/changed.md", size: 1, etag: '"c"', local: "differs" },
  ]));
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
  vi.mocked(ipc.remoteList).mockResolvedValue(tree([]));
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
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
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
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
  render(<RemoteBrowser onOpen={() => {}} />);
  await screen.findByText("only.md");
  fireEvent.click(screen.getByRole("button", { name: /only\.md/, expanded: false, haspopup: "menu" } as never));
  expect(await screen.findByRole("menuitem", { name: "Rename or move on the server" })).toBeInTheDocument();
});

it("cancelling the prompt, or keeping the same name, renames nothing", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
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
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
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
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
  useRemoteDoc.setState({
    doc: { path: "only.md", text: "x", etag: '"a"', bufferVersion: 2, savedVersion: 1 } as never,
  });
  render(<RemoteBrowser onOpen={() => {}} />);
  fireEvent.contextMenu(await screen.findByText("only.md"));
  expect(await screen.findByRole("menuitem", { name: "Rename or move on the server" })).toHaveAttribute("aria-disabled", "true");
});

it("a right-click on a note offers Delete, asks first, and deletes without opening the note", async () => {
  // The note's row offered only Rename, so a note had to be opened to be removed.
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
  vi.mocked(askConfirm).mockResolvedValue(true);
  vi.mocked(ipc.remoteDelete).mockResolvedValue(undefined);
  const opened: string[] = [];
  render(<RemoteBrowser onOpen={(e) => opened.push(e.path)} />);
  fireEvent.contextMenu(await screen.findByText("only.md"));
  const items = (await screen.findAllByRole("menuitem")).map((i) => i.textContent);
  expect(items).toEqual(["Rename or move on the server", "Delete from the server"]);
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete from the server" }));
  await waitFor(() => expect(ipc.remoteDelete).toHaveBeenCalledWith("only.md", '"a"'));
  expect(vi.mocked(askConfirm).mock.calls[0][0]).toMatchObject({ title: "Delete “only.md” from the server?", danger: true });
  expect(opened).toEqual([]);
  await waitFor(() => expect(ipc.remoteList).toHaveBeenCalledTimes(2));
});

it("declining the question deletes nothing", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
  vi.mocked(askConfirm).mockResolvedValue(false);
  render(<RemoteBrowser onOpen={() => {}} />);
  fireEvent.contextMenu(await screen.findByText("only.md"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Delete from the server" }));
  await waitFor(() => expect(askConfirm).toHaveBeenCalled());
  expect(ipc.remoteDelete).not.toHaveBeenCalled();
  expect(ipc.remoteList).toHaveBeenCalledTimes(1);
});

it("a delete refused because the note changed says that, in words about the note, and refreshes the list", async () => {
  // `conflict` was worded for device sync — "review the conflicts" — which says
  // nothing about a note that someone changed while a list sat on screen.
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
  vi.mocked(askConfirm).mockResolvedValue(true);
  vi.mocked(ipc.remoteDelete).mockRejectedValue({ code: "sync", cause: "conflict" });
  render(<RemoteBrowser onOpen={() => {}} />);
  fireEvent.contextMenu(await screen.findByText("only.md"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Delete from the server" }));
  expect(await screen.findByText(/changed on the server after this list was loaded/)).toBeInTheDocument();
  expect(screen.queryByText(/review the conflicts/)).toBeNull();
  // So that trying again carries the tag the note has now.
  await waitFor(() => expect(ipc.remoteList).toHaveBeenCalledTimes(2));
});

it("a note open with unsent text can be deleted from the tree after the question, and its tab goes", async () => {
  // Rename is greyed there because the text would be left at the old path. Delete
  // takes the note and its text together, which is what the question says.
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
  vi.mocked(askConfirm).mockResolvedValue(true);
  vi.mocked(ipc.remoteDelete).mockResolvedValue(undefined);
  useRemoteDoc.setState({
    tabs: ["only.md"],
    doc: { path: "only.md", text: "x", etag: '"saved"', bufferVersion: 2, savedVersion: 1 } as never,
  });
  render(<RemoteBrowser onOpen={() => {}} />);
  fireEvent.contextMenu(await screen.findByText("only.md"));
  const item = await screen.findByRole("menuitem", { name: "Delete from the server" });
  expect(item).not.toHaveAttribute("aria-disabled", "true");
  fireEvent.click(item);
  await waitFor(() => expect(ipc.remoteDelete).toHaveBeenCalledWith("only.md", '"saved"'));
  await waitFor(() => expect(useRemoteDoc.getState().doc).toBeNull());
});

// ---- folders -----------------------------------------------------------------

it("a new folder appears at once, empty and marked as only here, and opens so it is seen", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
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
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
  vi.mocked(askText).mockResolvedValue(null);
  render(<RemoteBrowser onOpen={() => {}} />);
  fireEvent.contextMenu(await screen.findByTitle("work"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "New folder here" }));
  await waitFor(() => expect(askText).toHaveBeenCalledWith(expect.objectContaining({ initial: "work/", caret: "end" })));
  fireEvent.contextMenu(screen.getByTitle("work"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "New note here" }));
  await waitFor(() => expect(askText).toHaveBeenLastCalledWith(expect.objectContaining({ initial: "work/", caret: "end" })));
});

it("only a prefix keeps its caret at the end: a rename replaces the whole name, so it keeps the selection", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
  vi.mocked(askText).mockResolvedValue(null);
  render(<RemoteBrowser onOpen={() => {}} />);
  fireEvent.contextMenu(await screen.findByText("only.md"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Rename or move on the server" }));
  await waitFor(() => expect(askText).toHaveBeenCalled());
  expect(vi.mocked(askText).mock.lastCall![0]).not.toHaveProperty("caret", "end");
});

it("a folder that only exists here can be forgotten, and one the server has cannot", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed));
  render(<RemoteBrowser onOpen={() => {}} />);
  await screen.findByText("only.md");
  await act(async () => useRemote.getState().addFolder("draft"));
  fireEvent.contextMenu(await screen.findByTitle("draft: only in this window until a note is created in it"));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Remove this empty folder" }));
  await waitFor(() => expect(screen.queryByText("draft")).toBeNull());
  fireEvent.contextMenu(screen.getByTitle("work"));
  expect(await screen.findByRole("menuitem", { name: "New note here" })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "Remove this empty folder" })).toBeNull();
});

it("an empty folder the server lists is shown as a real folder, and the list is not called empty", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree([], ["ideas"]));
  render(<RemoteBrowser onOpen={() => {}} />);
  await screen.findByTitle("ideas");
  expect(screen.queryByText("No notes on the server yet.")).toBeNull();
  expect(screen.queryByText("empty"), "the server holds it: it is not only here").toBeNull();
});

it("a new folder on a server that knows folders is made there, and a refusal is said", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree(listed, []));
  vi.mocked(askText).mockResolvedValueOnce("ideas/2026").mockResolvedValueOnce("again");
  vi.mocked(ipc.remoteCreateFolder).mockResolvedValueOnce(true).mockRejectedValueOnce({ code: "sync", cause: "invalid" });
  render(<RemoteBrowser onOpen={() => {}} />);
  await screen.findByText("only.md");
  fireEvent.click(screen.getByRole("button", { name: "New folder on the server" }));
  await screen.findByTitle("ideas/2026");
  expect(ipc.remoteCreateFolder).toHaveBeenCalledWith("ideas/2026");
  expect(useRemote.getState().pending).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "New folder on the server" }));
  await waitFor(() => expect(ipc.remoteCreateFolder).toHaveBeenCalledTimes(2));
  expect(screen.queryByTitle("again")).toBeNull();
});

it("a folder with no notes is shown even when the server has none at all", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree([]));
  render(<RemoteBrowser onOpen={() => {}} />);
  await screen.findByText("No notes on the server yet.");
  await act(async () => useRemote.getState().addFolder("first"));
  expect(await screen.findByText("first")).toBeInTheDocument();
  expect(screen.queryByText("No notes on the server yet.")).toBeNull();
});

// ---- signing in with the site (ADR-105) ---------------------------------------

const paired: ipc.Paired = {
  origin: "https://tura.example.com",
  workspace: "personal",
  label: "This computer",
  token_file: "keychain:site",
};
const REDIRECT = "tura://pair?code=abc&state=xyz";

async function openSignIn() {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(null);
  render(<RemoteBrowser />);
  return screen.findByRole("button", { name: "Sign in in the browser" });
}

it("signing in opens the site in the browser and waits for the address it comes back to", async () => {
  vi.mocked(ipc.pairBegin).mockResolvedValue("https://site.example/tura/pair?client=tura&challenge=c");
  const go = await openSignIn();
  expect(go).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Your site's address"), { target: { value: " https://site.example " } });
  fireEvent.change(screen.getByLabelText("Name for this device"), { target: { value: "Pixel 8" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in in the browser" }));
  await waitFor(() => expect(ipc.pairBegin).toHaveBeenCalledWith("https://site.example", "Pixel 8", false));
  await waitFor(() => expect(ipc.shellOpen).toHaveBeenCalledWith("https://site.example/tura/pair?client=tura&challenge=c"));
  expect(await screen.findByText(/Sign in there and allow this device/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Finish signing in" })).toBeDisabled();
});

it("pasting the address finishes it: the connection is configured from the answer, with a keychain name where the file's path goes", async () => {
  vi.mocked(ipc.pairBegin).mockResolvedValue("https://site.example/tura/pair?x=1");
  vi.mocked(ipc.pairFinish).mockResolvedValue(paired);
  vi.mocked(ipc.remoteConfigSet).mockResolvedValue(undefined);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree([]));
  await openSignIn();
  fireEvent.change(screen.getByLabelText("Your site's address"), { target: { value: "https://site.example" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in in the browser" }));
  fireEvent.change(await screen.findByLabelText("Address the browser came back to"), { target: { value: `  ${REDIRECT}\n` } });
  fireEvent.click(screen.getByRole("button", { name: "Finish signing in" }));
  await waitFor(() => expect(ipc.pairFinish).toHaveBeenCalledWith(REDIRECT));
  await waitFor(() =>
    expect(ipc.remoteConfigSet).toHaveBeenCalledWith({
      origin: "https://tura.example.com",
      workspace: "personal",
      token_file: "keychain:site",
      allow_private: false,
    }),
  );
  // The page never held a secret: nothing it was given or sent looks like one.
  expect(JSON.stringify(vi.mocked(ipc.pairFinish).mock.results)).not.toMatch(/nt_/);
});

it("a sign-in the site refuses says why in words and is over: the next one is a new request", async () => {
  vi.mocked(ipc.pairBegin).mockResolvedValue("https://site.example/tura/pair");
  vi.mocked(ipc.pairFinish).mockRejectedValue({ code: "sync", cause: "denied" });
  await openSignIn();
  fireEvent.change(screen.getByLabelText("Your site's address"), { target: { value: "https://site.example" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in in the browser" }));
  fireEvent.change(await screen.findByLabelText("Address the browser came back to"), { target: { value: REDIRECT } });
  fireEvent.click(screen.getByRole("button", { name: "Finish signing in" }));
  expect(await screen.findByText(/it was declined, or the code had expired or been used/)).toBeInTheDocument();
  // Back at the start, with nothing waiting and no connection saved.
  expect(await screen.findByRole("button", { name: "Sign in in the browser" })).toBeInTheDocument();
  expect(ipc.remoteConfigSet).not.toHaveBeenCalled();
});

it("an address that is not the one this sign-in started is named as that", async () => {
  vi.mocked(ipc.pairBegin).mockResolvedValue("https://site.example/tura/pair");
  vi.mocked(ipc.pairFinish).mockRejectedValue({ code: "sync", cause: "invalid" });
  await openSignIn();
  fireEvent.change(screen.getByLabelText("Your site's address"), { target: { value: "https://site.example" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in in the browser" }));
  fireEvent.change(await screen.findByLabelText("Address the browser came back to"), { target: { value: "garbage" } });
  fireEvent.click(screen.getByRole("button", { name: "Finish signing in" }));
  expect(await screen.findByText(/That is not the address this sign-in started/)).toBeInTheDocument();
});

it("cancelling while waiting goes back without asking the server anything", async () => {
  vi.mocked(ipc.pairBegin).mockResolvedValue("https://site.example/tura/pair");
  await openSignIn();
  fireEvent.change(screen.getByLabelText("Your site's address"), { target: { value: "https://site.example" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in in the browser" }));
  await screen.findByLabelText("Address the browser came back to");
  fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]);
  expect(await screen.findByRole("button", { name: "Sign in in the browser" })).toBeInTheDocument();
  expect(ipc.pairFinish).not.toHaveBeenCalled();
});

it("a connection whose credential is in the keychain offers to sign out, and says what that does and does not do", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue({ ...config, token_file: "keychain:site" });
  vi.mocked(ipc.remoteList).mockResolvedValue(tree([]));
  vi.mocked(ipc.pairSignOut).mockResolvedValue(undefined);
  vi.mocked(ipc.remoteConfigSet).mockResolvedValue(undefined);
  render(<RemoteBrowser />);
  fireEvent.click(await screen.findByRole("button", { name: "Connection" }));
  fireEvent.click(await screen.findByRole("button", { name: "Sign out of this device" }));
  await waitFor(() => expect(ipc.pairSignOut).toHaveBeenCalled());
  await waitFor(() => expect(ipc.remoteConfigSet).toHaveBeenCalledWith(null));
  expect(screen.getByText(/it still works for anyone who has it/)).toBeInTheDocument();
});
