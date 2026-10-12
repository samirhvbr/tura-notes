import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./workspace", () => ({ useWorkspace: { getState: vi.fn() } }));
import { invoke } from "@tauri-apps/api/core";
import { useWorkspace } from "./workspace";
import { isSyncLocked, tracked } from "../ipc/barrier";
import { useUpdater } from "./updater";
import { resetRemoteDocTimers, useRemoteDoc } from "./remoteDoc";

/**
 * The barrier is **real** in this file, and that is the whole point.
 *
 * `updater.test.ts` mocks `beginSyncBarrier` to `() => true` and gives `leave()`
 * a plain `async` body. Both are reasonable in isolation and together they hide
 * the one thing that made the update unusable: in the real application the
 * close is an IPC call, every IPC call goes through `tracked()`, and `tracked()`
 * gives its slot back in a **macrotask** while `await` resumes in a microtask.
 * So `install()` asked for the barrier while `pending` was still counting the
 * close it had just awaited — and was refused by its own completed work.
 */
function openWorkspace(root = "/notes") {
  const state = {
    info: { id: "workspace", root } as unknown,
    leave: vi.fn(async () => { await tracked(async () => {}); state.info = null; return true; }),
    switchTo: vi.fn(async () => { state.info = { id: "workspace", root }; }),
  };
  vi.mocked(useWorkspace.getState).mockReturnValue(state as never);
  return state;
}

afterEach(() => {
  // A refused remote save schedules its own retry; none may outlive its test.
  resetRemoteDocTimers();
  useRemoteDoc.setState({ doc: null, tabs: [] });
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  useUpdater.setState({ phase: "available", version: "9.0.0", notes: null, detail: null });
});

it("installs after a close that went through the IPC barrier", async () => {
  // Reported from use, twice, on two different versions: "Install and restart"
  // answered that nothing was installed. Nothing was — the plugin was never
  // reached. This is the regression that says so.
  openWorkspace();
  await useUpdater.getState().install();
  expect(invoke).toHaveBeenCalledWith("update_install");
});

it("does not hold the barrier after the attempt", async () => {
  openWorkspace();
  await useUpdater.getState().install();
  expect(isSyncLocked()).toBe(false);
});

it("installs while the application keeps polling, which is the reported case", async () => {
  // The index status is polled every 500 ms, the knowledge panel every 3 s and
  // the device status every 15 s, and each goes through `tracked()`. Against
  // that a synchronous "is `pending` zero right now" is a coin toss, and this
  // is the toss the update kept losing — for weeks, through two fixes that
  // widened the window instead of making the attempt able to wait.
  openWorkspace();
  const poll = setInterval(() => { void tracked(async () => "status").catch(() => {}); }, 5);
  try {
    await useUpdater.getState().install();
    expect(invoke).toHaveBeenCalledWith("update_install");
    expect(useUpdater.getState().phase).not.toBe("busy");
  } finally { clearInterval(poll); }
});

it("refuses to install over a remote note the server will not take, with the real remote store and the real barrier", async () => {
  // The stubbed-store tests in `updater.test.ts` say what the install does with
  // the answer; this one says the answer is the right one when the pieces are
  // the real ones — `save()`'s own handling of an unreachable server, `dirty()`'s
  // own rule, and a barrier that is actually shut while the install runs.
  const ws = openWorkspace();
  useRemoteDoc.setState({
    tabs: ["IP-Server.md"],
    doc: {
      path: "IP-Server.md", text: "typed here\n", etag: '"e1"', base: "old\n", readOnly: null,
      bufferVersion: 2, savedVersion: 1, status: "pending", externalRev: 0,
      conflict: null, lastError: null, synced: null,
    },
  });
  vi.mocked(invoke).mockImplementation(async (command: string) => {
    if (command === "remote_save") throw { code: "sync", cause: "offline" };
  });
  await useUpdater.getState().install();
  expect(invoke).toHaveBeenCalledWith("remote_save", expect.anything());   // it tried to send it
  expect(invoke).not.toHaveBeenCalledWith("update_install");
  expect(useUpdater.getState().phase).toBe("remoteUnsent");
  expect(useRemoteDoc.getState().doc?.text).toBe("typed here\n");          // and the text is still here
  expect(ws.leave).not.toHaveBeenCalled();                                  // and nothing was closed
  expect(isSyncLocked()).toBe(false);
});
