import { afterEach, expect, it, vi } from "vitest";
import * as ipc from "../ipc";
vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  remoteConfigGet: vi.fn(),
  remoteConfigSet: vi.fn(),
  remoteList: vi.fn(),
  remoteCreateFolder: vi.fn(),
  deviceStatus: vi.fn(),
}));
const { buildTree, useRemote } = await import("./remote");
const initial = useRemote.getState();
afterEach(() => {
  useRemote.setState(initial, true);
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

/** What the command answers: the notes, and the folders when the server lists them. */
const tree = (entries: ipc.RemoteEntry[], folders?: string[]): ipc.RemoteTree => ({
  entries,
  folders: folders ?? [],
  folders_supported: folders !== undefined,
  folders_truncated: false,
});

const entry = (path: string, local: ipc.LocalMark = "absent"): ipc.RemoteEntry => ({
  path,
  size: 1,
  etag: '"x"',
  local,
});

it("builds folders from note paths, folders first and by name", () => {
  const root = buildTree([entry("b.md"), entry("z/one.md"), entry("a/deep/two.md"), entry("a/c.md")]);
  expect(root.dirs.map((d) => d.path)).toEqual(["a", "z"]);
  expect(root.notes.map((n) => n.path)).toEqual(["b.md"]);
  expect(root.dirs[0].dirs[0].path).toBe("a/deep");
  expect(root.dirs[0].notes.map((n) => n.path)).toEqual(["a/c.md"]);
});

it("asks the server once however many times refresh is pressed", async () => {
  let answer!: (v: ipc.RemoteTree) => void;
  vi.mocked(ipc.remoteList).mockReturnValue(new Promise((r) => (answer = r)));
  const first = useRemote.getState().refresh();
  const second = useRemote.getState().refresh();
  expect(useRemote.getState().loading).toBe(true);
  answer(tree([entry("a.md")]));
  await Promise.all([first, second]);
  expect(ipc.remoteList).toHaveBeenCalledTimes(1);
  expect(useRemote.getState().entries).toHaveLength(1);
  expect(useRemote.getState().loading).toBe(false);
});

it("keeps the refusal to show it, and the previous list is not invented", async () => {
  vi.mocked(ipc.remoteList).mockRejectedValue({ code: "sync", cause: "offline" });
  await useRemote.getState().refresh();
  expect(useRemote.getState().error).toEqual({ code: "sync", cause: "offline" });
  expect(useRemote.getState().entries).toBeNull();
});

it("saves a configuration and lists at once; forgetting it clears the list", async () => {
  vi.mocked(ipc.remoteConfigSet).mockResolvedValue(undefined);
  vi.mocked(ipc.remoteList).mockResolvedValue(tree([entry("a.md")]));
  const config = { origin: "https://n.example", workspace: "home", token_file: "/t", allow_private: false };
  await useRemote.getState().configure(config);
  expect(ipc.remoteConfigSet).toHaveBeenCalledWith(config);
  expect(useRemote.getState().entries).toHaveLength(1);
  await useRemote.getState().configure(null);
  expect(useRemote.getState().config).toBeNull();
  expect(useRemote.getState().entries).toBeNull();
});

const config = { origin: "https://tura.example", workspace: "personal", token_file: "/home/me/t.secret", allow_private: true };
const pairedSnapshot = {
  paired: { source: "/notes", mode: "reconcile", origin: config.origin, workspace: "personal", scope: null, allow_private: true },
  connection: { token_file: config.token_file },
} as unknown as ipc.DeviceSnapshot;

it("a saved configuration wins, and Device sync is not even asked", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(config);
  await useRemote.getState().hydrate();
  expect(useRemote.getState().config).toEqual(config);
  expect(ipc.deviceStatus).not.toHaveBeenCalled();
});

it("with nothing saved, it takes Device sync's paired server and credential, and says so", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(null);
  vi.mocked(ipc.deviceStatus).mockResolvedValue(pairedSnapshot);
  vi.mocked(ipc.remoteConfigSet).mockResolvedValue(undefined);
  await useRemote.getState().hydrate();
  expect(ipc.remoteConfigSet).toHaveBeenCalledWith(config);
  expect(useRemote.getState().config).toEqual(config);
  expect(useRemote.getState().adopted).toBe(true);
});

it("an unpaired Device sync form only pre-fills, because nobody confirmed it", async () => {
  vi.mocked(ipc.remoteConfigGet).mockResolvedValue(null);
  vi.mocked(ipc.deviceStatus).mockResolvedValue({ paired: null, connection: null } as unknown as ipc.DeviceSnapshot);
  const store = new Map([["tura-pair-draft", JSON.stringify({ origin: config.origin, workspace: "personal", token_file: config.token_file, allow_private: true, source: "/x" })]]);
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: () => {} });
  await useRemote.getState().hydrate();
  expect(ipc.remoteConfigSet).not.toHaveBeenCalled();
  expect(useRemote.getState().config).toBeNull();
  expect(useRemote.getState().suggestion).toEqual(config);
});

// ---- folders made here -------------------------------------------------------

it("a folder made here is in the tree, empty and marked, and a real folder is not marked", () => {
  const root = buildTree([entry("work/a.md")], ["work", "ideas/2026"]);
  const work = root.dirs.find((d) => d.name === "work")!;
  expect(work.virtual, "the server's notes make this folder, so it is not only here").toBeUndefined();
  const ideas = root.dirs.find((d) => d.name === "ideas")!;
  expect(ideas.virtual).toBe(true);
  expect(ideas.dirs.map((d) => [d.name, d.path, d.virtual])).toEqual([["2026", "ideas/2026", true]]);
});

it("adding a folder opens every level of it, and refreshing drops it once a note is inside", async () => {
  useRemote.setState({ pending: [], expanded: {} });
  await useRemote.getState().addFolder("a/b");
  expect(useRemote.getState().pending).toEqual(["a/b"]);
  expect(useRemote.getState().expanded).toMatchObject({ a: true, "a/b": true });
  await useRemote.getState().addFolder("a/b");
  expect(useRemote.getState().pending, "twice is once").toEqual(["a/b"]);

  vi.mocked(ipc.remoteList).mockResolvedValue(tree([entry("a/b/note.md")]));
  await useRemote.getState().refresh();
  expect(useRemote.getState().pending, "the server has it now").toEqual([]);
});

it("a folder the server lists is a real one, empty or not, and not marked as only here", () => {
  const root = buildTree([entry("work/a.md")], [], ["work", "ideas/2026"]);
  const ideas = root.dirs.find((d) => d.name === "ideas")!;
  expect(ideas.virtual).toBeUndefined();
  expect(ideas.dirs.map((d) => [d.path, d.virtual])).toEqual([["ideas/2026", undefined]]);
});

it("on a server that knows folders, adding one asks the server and keeps nothing to forget", async () => {
  vi.mocked(ipc.remoteCreateFolder).mockResolvedValue(true);
  useRemote.setState({ pending: [], expanded: {}, folders: ["x"], foldersSupported: true });
  await useRemote.getState().addFolder("a/b");
  expect(ipc.remoteCreateFolder).toHaveBeenCalledWith("a/b");
  const s = useRemote.getState();
  expect(s.pending, "it is the server's, not this window's").toEqual([]);
  expect(s.folders).toEqual(["x", "a", "a/b"]);
  expect(s.expanded).toMatchObject({ a: true, "a/b": true });
});

it("a refusal from the server leaves no folder behind and is thrown to the caller", async () => {
  vi.mocked(ipc.remoteCreateFolder).mockRejectedValue({ code: "sync", cause: "invalid" });
  useRemote.setState({ pending: [], expanded: {}, folders: [], foldersSupported: true });
  await expect(useRemote.getState().addFolder("con")).rejects.toBeTruthy();
  const s = useRemote.getState();
  expect([s.pending, s.folders, s.expanded]).toEqual([[], [], {}]);
});

it("a listing that now holds the folder drops the one remembered here", async () => {
  useRemote.setState({ pending: ["a", "b"] });
  vi.mocked(ipc.remoteList).mockResolvedValue(tree([], ["a/deep"]));
  await useRemote.getState().refresh();
  const s = useRemote.getState();
  expect(s.pending, "a is a parent of a listed folder, b is still only here").toEqual(["b"]);
  expect(s.foldersSupported).toBe(true);
});

it("forgetting a folder takes its subfolders with it and leaves the others", () => {
  useRemote.setState({ pending: ["a", "a/b", "c"] });
  useRemote.getState().forgetFolder("a");
  expect(useRemote.getState().pending).toEqual(["c"]);
});
