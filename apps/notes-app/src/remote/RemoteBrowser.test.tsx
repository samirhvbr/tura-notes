// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as ipc from "../ipc";
vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  remoteConfigGet: vi.fn(),
  remoteConfigSet: vi.fn(),
  remoteList: vi.fn(),
  remoteProbe: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../app/dialog", async (original) => ({
  ...(await original<typeof import("../app/dialog")>()),
  askText: vi.fn(),
}));
const { RemoteBrowser } = await import("./RemoteBrowser");
const { useRemote } = await import("../stores/remote");
const initial = useRemote.getState();
afterEach(() => {
  cleanup();
  useRemote.setState(initial, true);
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
  fireEvent.click(screen.getByRole("button", { name: /work/ }));
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
