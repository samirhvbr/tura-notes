// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReceivedSyncShell } from "./ReceivedSync";
import * as ipc from "../ipc";
import { acquireSyncBarrier, endSyncBarrier, isSyncLocked, setComposing, tracked } from "../ipc/barrier";
import { useEditor } from "../stores/editor";
import { useWorkspace } from "../stores/workspace";
import { useSync } from "../stores/sync";
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(async () => "/receive-state") }));
vi.mock("../ipc", async original => ({ ...await original<typeof import("../ipc")>(), syncOpen: vi.fn(), syncApply: vi.fn(), syncReload: vi.fn(), syncRecoveryRestart: vi.fn() }));
vi.mock("./DeviceSync", () => ({ DeviceSync: () => null }));
const originals = { ws: useWorkspace.getState(), sync: useSync.getState() };
const rev = { hash: "b3:abc", size: 3, mtime_ns: "1" } as ipc.BaseRev;
const fresh = { note_id: "note", path: "test.md", text: "new", base_rev: rev, read_only: null, draft: null, profile: {} } as ipc.OpenedNote;
function doc() {
  useEditor.setState({ doc: { noteId: fresh.note_id, path: fresh.path, text: "old", baseRev: rev, readOnly: null, bufferVersion: 0, savedVersion: 0, status: "saved", externalRev: 0, conflict: null, draft: null, lastError: null } });
}
async function connected() {
  useWorkspace.setState({ info: null, adopt: async info => { useWorkspace.setState({ info }); }, refresh: vi.fn(async () => {}) });
  useSync.setState({ start: vi.fn(async () => {}), stop: vi.fn() });
  vi.mocked(ipc.syncOpen).mockResolvedValue({ id: "workspace", root: "/target" } as ipc.WorkspaceInfo);
  const navigate = vi.fn();
  render(<ReceivedSyncShell><button onClick={navigate}>Navigate</button></ReceivedSyncShell>);
  fireEvent.click(screen.getByRole("button", { name: "Open received workspace" }));
  const apply = await screen.findByRole<HTMLButtonElement>("button", { name: "Apply received revisions" });
  await waitFor(() => expect(apply.disabled).toBe(false));
  doc();
  return navigate;
}
afterEach(() => {
  cleanup(); endSyncBarrier(); setComposing(false);
  useWorkspace.setState(originals.ws); useSync.setState(originals.sync);
  useEditor.setState({ doc: null }); vi.clearAllMocks();
});
it("holds input and IPC until a verified reload, including partial failure", async () => {
  const navigate = await connected();
  let resolve!: (r: ipc.SyncApplyResult) => void;
  vi.mocked(ipc.syncApply).mockImplementation(() => new Promise(r => { resolve = r; }));
  fireEvent.click(screen.getByRole("button", { name: "Apply received revisions" }));
  expect(isSyncLocked()).toBe(true);
  useEditor.getState().edit("typing during apply");
  fireEvent.click(screen.getByRole("button", { name: "Navigate", hidden: true }));
  expect(navigate).not.toHaveBeenCalled();
  expect(useEditor.getState().doc?.text).toBe("old");
  const unrelated = vi.fn(async () => 1);
  await expect(tracked(unrelated)).rejects.toMatchObject({ code: "unsupported" });
  expect(unrelated).not.toHaveBeenCalled();
  await act(async () => { resolve({ applied: null, error: { code: "unsupported", cap: "rename" }, refreshed: [fresh], reload_failed: false }); });
  expect(isSyncLocked()).toBe(false);
  expect(useEditor.getState().doc?.text).toBe("new");
  expect(useEditor.getState().doc?.externalRev).toBe(1);
});
it("keeps the old document frozen after an unknown outcome until recovery succeeds", async () => {
  await connected();
  vi.mocked(ipc.syncApply).mockRejectedValue(new Error("lost response"));
  vi.mocked(ipc.syncReload)
    .mockResolvedValueOnce({ applied: null, error: { code: "unsupported", cap: "reload unavailable" }, refreshed: [], reload_failed: true })
    .mockResolvedValueOnce({ applied: null, error: null, refreshed: [], reload_failed: false })
    .mockResolvedValue({ applied: null, error: null, refreshed: [fresh], reload_failed: false });
  fireEvent.click(screen.getByRole("button", { name: "Apply received revisions" }));
  const retry = await screen.findByRole("button", { name: "Retry safe reload" });
  expect(isSyncLocked()).toBe(true);
  expect(useEditor.getState().doc?.text).toBe("old");
  for (let attempts = 1; attempts <= 2; attempts++) {
    await act(async () => { fireEvent.click(retry); });
    expect(ipc.syncReload).toHaveBeenCalledTimes(attempts);
    expect(isSyncLocked()).toBe(true);
    expect(useEditor.getState().doc?.text).toBe("old");
  }
  fireEvent.click(retry);
  await waitFor(() => expect(isSyncLocked()).toBe(false));
  expect(useEditor.getState().doc?.text).toBe("new");
});
it("refuses dirty buffers without sending, saving or replacing them", async () => {
  await connected();
  useEditor.setState(s => ({ doc: s.doc && { ...s.doc, text: "my changes", bufferVersion: 1 } }));
  fireEvent.click(screen.getByRole("button", { name: "Apply received revisions" }));
  expect(ipc.syncApply).not.toHaveBeenCalled(); expect(isSyncLocked()).toBe(false);
  expect(useEditor.getState().doc?.text).toBe("my changes");
});
it("waits for the calls in flight instead of losing a race to them", async () => {
  // This is the contract that changed. The old gate asked `pending === 0` and
  // took the lock in one instant, so it could never *become* true — only
  // happen to be, against an index poll that fires every 500 ms. Waiting is
  // what makes it reachable.
  let resolve!: () => void;
  const inFlight = tracked(() => new Promise<void>(r => { resolve = r; }));
  const taking = acquireSyncBarrier();
  let settled = false;
  void taking.then(() => { settled = true; });
  await new Promise(r => setTimeout(r, 25));
  expect(settled).toBe(false);          // still waiting, which is the point
  resolve(); await inFlight;
  expect(await taking).toBe(true);
  endSyncBarrier();
});

it("shuts the door before it waits, so pending can actually reach zero", async () => {
  let resolve!: () => void;
  const inFlight = tracked(() => new Promise<void>(r => { resolve = r; }));
  const taking = acquireSyncBarrier();
  await new Promise(r => setTimeout(r, 10));
  // Without this refusal the next poll tops `pending` back up and the wait
  // chases a number that never falls.
  await expect(tracked(async () => "late")).rejects.toMatchObject({ code: "unsupported" });
  resolve(); await inFlight;
  expect(await taking).toBe(true);
  endSyncBarrier();
});

it("reports rather than hangs when a call never finishes", async () => {
  let resolve!: () => void;
  const stuck = tracked(() => new Promise<void>(r => { resolve = r; }));
  expect(await acquireSyncBarrier(30)).toBe(false);
  resolve(); await stuck;
  await new Promise(r => setTimeout(r, 5));
  expect(await acquireSyncBarrier()).toBe(true);   // and the door is open again
  endSyncBarrier();
});

it("refuses while an IME composition is active", async () => {
  setComposing(true);
  expect(await acquireSyncBarrier()).toBe(false);
  setComposing(false);
  expect(await acquireSyncBarrier()).toBe(true);
  endSyncBarrier();
});

// ADR-094. The document is read again once the barrier holds: during the drain
// input is still admitted, so the copy read before it was no longer the one on
// screen, and the reload that must match it could never succeed.
it("a keystroke during the drain refuses the apply instead of freezing a stale document", async () => {
  await connected();
  let finishCall!: () => void;
  const inFlight = tracked(() => new Promise<void>(r => { finishCall = r; }));
  fireEvent.click(screen.getByRole("button", { name: "Apply received revisions" }));
  // Draining: the door is shut to new calls, but the editor is not locked yet.
  expect(isSyncLocked()).toBe(false);
  useEditor.getState().edit("typed during the drain");
  finishCall(); await inFlight;
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Save your edits"));
  expect(ipc.syncApply).not.toHaveBeenCalled();
  expect(isSyncLocked()).toBe(false);
  expect(useEditor.getState().doc?.text).toBe("typed during the drain");
});

it("recovery offers a restart, and a clean buffer sends no draft", async () => {
  await connected();
  vi.mocked(ipc.syncApply).mockRejectedValue(new Error("lost response"));
  vi.mocked(ipc.syncRecoveryRestart).mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: "Apply received revisions" }));
  const restart = await screen.findByRole("button", { name: "Restart the app and keep my text as a draft" });
  expect(isSyncLocked()).toBe(true);
  await act(async () => { fireEvent.click(restart); });
  expect(ipc.syncRecoveryRestart).toHaveBeenCalledWith(null);
  // A restart that succeeded ends the process; the button stays disabled
  // rather than inviting a second one.
  expect((restart as HTMLButtonElement).disabled).toBe(true);
});

it("a dirty buffer that reaches recovery is what the restart saves", async () => {
  await connected();
  vi.mocked(ipc.syncApply).mockRejectedValue(new Error("lost response"));
  vi.mocked(ipc.syncRecoveryRestart).mockResolvedValue(undefined);
  fireEvent.click(screen.getByRole("button", { name: "Apply received revisions" }));
  const restart = await screen.findByRole("button", { name: "Restart the app and keep my text as a draft" });
  // Defensive: re-reading under the barrier should keep this from happening,
  // and if it ever does, the unsaved text is what gets kept.
  useEditor.setState(st => ({ doc: st.doc && { ...st.doc, text: "unsaved", bufferVersion: 3 } }));
  await act(async () => { fireEvent.click(restart); });
  expect(ipc.syncRecoveryRestart).toHaveBeenCalledWith(
    expect.objectContaining({ noteId: fresh.note_id, text: "unsaved", bufferVersion: 3 }));
});

it("a restart whose draft cannot be written leaves the barrier up and says so", async () => {
  await connected();
  vi.mocked(ipc.syncApply).mockRejectedValue(new Error("lost response"));
  vi.mocked(ipc.syncRecoveryRestart).mockRejectedValue({ code: "io", op: "write_draft", path: "d", kind: "disk_full" });
  fireEvent.click(screen.getByRole("button", { name: "Apply received revisions" }));
  const restart = await screen.findByRole("button", { name: "Restart the app and keep my text as a draft" });
  await act(async () => { fireEvent.click(restart); });
  expect(isSyncLocked()).toBe(true);
  expect(screen.getByRole("status").textContent).not.toBe("");
});
