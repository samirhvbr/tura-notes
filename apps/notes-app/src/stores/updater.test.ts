import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./workspace", () => ({ useWorkspace: { getState: vi.fn(() => ({ info: null })) } }));
// The barrier is mocked here precisely so this suite can test everything
// around it; `updater.barrier.test.ts` runs the real one.
vi.mock("../ipc/barrier", () => ({ acquireSyncBarrier: vi.fn(async () => true), endSyncBarrier: vi.fn() }));
import { invoke } from "@tauri-apps/api/core";
import { useWorkspace } from "./workspace";
import { acquireSyncBarrier, endSyncBarrier } from "../ipc/barrier";
import { useUpdater } from "./updater";
const available = { supported: true, version: "9.0.0", notes: "New release" };
/** A workspace that is open, and that answers `leave()` by actually closing —
 *  the installation reads `info` again after the close to decide what to undo. */
function openWorkspace(root = "/notes") {
  const state = {
    info: { id: "workspace", root } as unknown,
    leave: vi.fn(async () => { state.info = null; return true; }),
    switchTo: vi.fn(async () => { state.info = { id: "workspace", root }; }),
  };
  vi.mocked(useWorkspace.getState).mockReturnValue(state as never);
  return state;
}
beforeEach(() => {
  vi.clearAllMocks();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  useUpdater.setState({ phase: "idle", version: null, notes: null });
  vi.mocked(acquireSyncBarrier).mockResolvedValue(true);
  vi.mocked(useWorkspace.getState).mockReturnValue({ info: null } as never);
});
describe("desktop updates", () => {
  it("checks automatically without installing", async () => {
    vi.mocked(invoke).mockResolvedValue(available);
    await useUpdater.getState().check();
    expect(useUpdater.getState().phase).toBe("available");
    expect(invoke).toHaveBeenCalledExactlyOnceWith("update_check");
  });
  it("coalesces checks while a request is pending", async () => {
    let finish!: (value: typeof available) => void;
    vi.mocked(invoke).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const check = useUpdater.getState().check();
    await useUpdater.getState().check(true);
    expect(invoke).toHaveBeenCalledOnce();
    finish(available); await check;
  });
  it("keeps automatic errors silent but answers a manual check", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("offline"));
    await useUpdater.getState().check(); expect(useUpdater.getState().phase).toBe("idle");
    await useUpdater.getState().check(true); expect(useUpdater.getState().phase).toBe("error");
  });
  it("remembers dismissal and lets manual checks show the version again", async () => {
    vi.mocked(invoke).mockResolvedValue(available);
    await useUpdater.getState().check(); useUpdater.getState().dismiss();
    await useUpdater.getState().check(); expect(useUpdater.getState().phase).toBe("idle");
    await useUpdater.getState().check(true); expect(useUpdater.getState().phase).toBe("available");
  });
  it("closes the workspace through the normal flow, then installs", async () => {
    // The button used to state the rule and leave the user to find the command
    // that obeys it, which is how "the update never installs" was reported.
    const workspace = openWorkspace();
    useUpdater.setState({ phase: "available", version: "9.0.0" });
    await useUpdater.getState().install();
    expect(workspace.leave).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith("update_install");
  });
  it("installs nothing when the close is declined", async () => {
    const workspace = openWorkspace();
    workspace.leave.mockImplementation(async () => false);
    useUpdater.setState({ phase: "available", version: "9.0.0" });
    await useUpdater.getState().install();
    expect(invoke).not.toHaveBeenCalled();
    expect(useUpdater.getState().phase).toBe("closeWorkspace");
    expect(workspace.info).not.toBeNull();
  });
  it("reopens the workspace it closed when the installation fails", async () => {
    const workspace = openWorkspace();
    vi.mocked(invoke).mockRejectedValue(new Error("signature mismatch"));
    useUpdater.setState({ phase: "available", version: "9.0.0" });
    await useUpdater.getState().install();
    expect(useUpdater.getState().phase).toBe("error");
    expect(workspace.switchTo).toHaveBeenCalledWith("/notes");
  });
  /**
   * The message is the whole point of the error state.
   *
   * `update_install` returns `Result<(), String>`, so what arrives here is the
   * updater plugin's own text — and on macOS that is the difference between
   * `EXDEV`, which means the application cannot replace itself where it is
   * running from, and a permission failure, which means it asked and was
   * refused. Both used to arrive as *"check your connection"*.
   */
  it("keeps the message the installation failed with", async () => {
    openWorkspace();
    vi.mocked(invoke).mockRejectedValue("Io Error: Invalid cross-device link (os error 18)");
    useUpdater.setState({ phase: "available", version: "9.0.0" });
    await useUpdater.getState().install();
    expect(useUpdater.getState().detail).toBe("Io Error: Invalid cross-device link (os error 18)");
  });
  it("keeps the message a manual check failed with, and clears it on the next attempt", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Could not fetch a valid release JSON"));
    await useUpdater.getState().check(true);
    expect(useUpdater.getState().phase).toBe("error");
    expect(useUpdater.getState().detail).toBe("Could not fetch a valid release JSON");
    vi.mocked(invoke).mockResolvedValueOnce({ supported: true, version: "9.0.0", notes: null });
    await useUpdater.getState().check(true);
    expect(useUpdater.getState().detail).toBeNull();
  });
  it("shows something rather than nothing when the rejection is not a string or an Error", async () => {
    openWorkspace();
    vi.mocked(invoke).mockRejectedValue({ code: 7 });
    useUpdater.setState({ phase: "available", version: "9.0.0" });
    await useUpdater.getState().install();
    expect(useUpdater.getState().detail).toBe('{"code":7}');
  });
  it("does not install across pending edits or another exclusive operation", async () => {
    // And says *that*, rather than the platform advice for an installation
    // that never started: nothing was downloaded, extracted or renamed.
    useUpdater.setState({ phase: "available", version: "9.0.0" });
    vi.mocked(acquireSyncBarrier).mockResolvedValue(false);
    await useUpdater.getState().install(); expect(invoke).not.toHaveBeenCalled();
    expect(useUpdater.getState().phase).toBe("busy");
  });
  it("releases the input barrier after installation fails", async () => {
    useUpdater.setState({ phase: "available", version: "9.0.0" });
    vi.mocked(invoke).mockRejectedValue(new Error("signature mismatch"));
    await useUpdater.getState().install();
    expect(invoke).toHaveBeenCalledWith("update_install");
    expect(endSyncBarrier).toHaveBeenCalledOnce();
    expect(useUpdater.getState().phase).toBe("error");
  });
});
