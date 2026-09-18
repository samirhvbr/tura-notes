import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./workspace", () => ({ useWorkspace: { getState: vi.fn() } }));
import { invoke } from "@tauri-apps/api/core";
import { useWorkspace } from "./workspace";
import { isSyncLocked, tracked } from "../ipc/barrier";
import { useUpdater } from "./updater";

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

it("says the application was busy rather than blaming the installation", async () => {
  // A refused barrier is not a failed install: nothing was extracted, nothing
  // was renamed, and "move it to Applications" is advice about a step that
  // never ran. The one real refusal left is a call still in flight.
  const state = openWorkspace();
  let release!: () => void;
  const inFlight = tracked(() => new Promise<void>(r => { release = r; }));
  await useUpdater.getState().install();
  expect(invoke).not.toHaveBeenCalledWith("update_install");
  expect(useUpdater.getState().phase).toBe("busy");
  expect(state.switchTo).toHaveBeenCalled();
  release(); await inFlight;
});
