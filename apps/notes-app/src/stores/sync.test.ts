// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as ipc from "../ipc";
import { useEditor, type OpenDoc } from "./editor";
import { useSync } from "./sync";
import { useUi } from "./ui";
import { useWorkspace } from "./workspace";

vi.mock("../ipc", async (original) => ({
  ...await original<typeof import("../ipc")>(),
  watchStart: vi.fn(async () => null),
  watchStatus: vi.fn(async () => ({ walking: false, degraded: null })),
  reconcileAll: vi.fn(),
  reconcileTick: vi.fn(),
  noteOpen: vi.fn(),
  noteClose: vi.fn(async () => {}),
  draftWrite: vi.fn(),
  noteSave: vi.fn(),
}));

const id = "note" as ipc.NoteId;
const path = "case.md" as ipc.RelPath;
const baseRev = { hash: "original", size: 8, mtime_ns: "1" } as ipc.BaseRev;
const doc: OpenDoc = {
  noteId: id, path, baseRev, text: "original", readOnly: null, bufferVersion: 0, savedVersion: 0,
  status: "saved", externalRev: 0, conflict: null, draft: null, lastError: null,
};
const removed: ipc.Reconciled = { events: [{ event: "fs_changed", kind: "removed", note_id: id, path }], queued: 0 };

function pendingReconciliation() {
  let resolve!: (value: ipc.Reconciled) => void;
  const promise = new Promise<ipc.Reconciled>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
  useEditor.setState({ doc });
  useUi.setState({ mainView: "local" });
  vi.spyOn(useWorkspace.getState(), "refresh").mockResolvedValue();
});
afterEach(() => {
  useSync.getState().stop();
  useEditor.setState({ doc: null });
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("preserves edits made while a displayed note's removal is in flight", async () => {
  const held = pendingReconciliation();
  vi.mocked(ipc.reconcileTick).mockReturnValueOnce(held.promise);
  vi.mocked(ipc.draftWrite).mockResolvedValue({ reason: "conflict", buffer_version: 1 } as ipc.DraftInfo);
  await useSync.getState().start();
  await vi.advanceTimersByTimeAsync(300);
  expect(ipc.reconcileTick).toHaveBeenCalledWith([], id, true);

  useEditor.getState().edit("unsaved argument");
  held.resolve(removed);
  await vi.advanceTimersByTimeAsync(0);

  expect(useEditor.getState().doc).toMatchObject({ text: "unsaved argument", status: "conflict" });
  expect(ipc.draftWrite).toHaveBeenCalledWith(id, "unsaved argument", 1, baseRev, "conflict");
  expect(ipc.noteSave).not.toHaveBeenCalled();
  expect(ipc.noteClose).not.toHaveBeenCalled();
});

it("keeps a reopened note when a removal from an earlier scan arrives", async () => {
  const held = pendingReconciliation();
  vi.mocked(ipc.reconcileAll).mockReturnValueOnce(held.promise);
  const scan = useSync.getState().scan();
  expect(ipc.reconcileAll).toHaveBeenCalledWith([], id);
  vi.mocked(ipc.noteOpen).mockResolvedValue({
    note_id: id, path, text: "back on disk", base_rev: { ...baseRev }, read_only: null, draft: null,
  } as ipc.OpenedNote);
  expect(await useEditor.getState().open(path)).toBe(true);
  held.resolve(removed);
  await scan;

  expect(useEditor.getState().doc?.text).toBe("back on disk");
  expect(ipc.noteClose).not.toHaveBeenCalled();
});

it("retains the local buffer identity in the remote view without polling its metadata", async () => {
  vi.mocked(ipc.reconcileTick).mockResolvedValue({ events: [], queued: 0 });
  useUi.setState({ mainView: "remote" });
  await useSync.getState().start();
  await vi.advanceTimersByTimeAsync(300);
  expect(ipc.reconcileTick).toHaveBeenCalledWith([], id, false);
});

it("closes a removed note if the editor still holds the same clean buffer", async () => {
  vi.mocked(ipc.reconcileAll).mockResolvedValueOnce(removed);
  await useSync.getState().scan();
  expect(ipc.noteClose).toHaveBeenCalledWith(id);
  expect(useEditor.getState().doc).toBeNull();
});
