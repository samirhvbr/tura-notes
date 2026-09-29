import { afterEach, expect, it, vi } from "vitest";
import * as ipc from "../ipc";
vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  remoteConfigGet: vi.fn(),
  remoteConfigSet: vi.fn(),
  remoteList: vi.fn(),
}));
const { buildTree, useRemote } = await import("./remote");
const initial = useRemote.getState();
afterEach(() => {
  useRemote.setState(initial, true);
  vi.clearAllMocks();
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
  let answer!: (v: ipc.RemoteEntry[]) => void;
  vi.mocked(ipc.remoteList).mockReturnValue(new Promise((r) => (answer = r)));
  const first = useRemote.getState().refresh();
  const second = useRemote.getState().refresh();
  expect(useRemote.getState().loading).toBe(true);
  answer([entry("a.md")]);
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
  vi.mocked(ipc.remoteList).mockResolvedValue([entry("a.md")]);
  const config = { origin: "https://n.example", workspace: "home", token_file: "/t", allow_private: false };
  await useRemote.getState().configure(config);
  expect(ipc.remoteConfigSet).toHaveBeenCalledWith(config);
  expect(useRemote.getState().entries).toHaveLength(1);
  await useRemote.getState().configure(null);
  expect(useRemote.getState().config).toBeNull();
  expect(useRemote.getState().entries).toBeNull();
});
