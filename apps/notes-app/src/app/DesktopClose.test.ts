// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as ipc from "../ipc";
import { endSyncBarrier, isSyncLocked, setComposing, tracked } from "../ipc/barrier";
import { type OpenDoc, useEditor } from "../stores/editor";
import { resetRemoteDocTimers, type RemoteDoc, useRemoteDoc } from "../stores/remoteDoc";
import { useDesktopClose } from "./DesktopClose";
import { useDialog } from "./dialog";

const native = vi.hoisted(() => ({ listen: vi.fn(), destroy: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: native.listen }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ destroy: native.destroy }) }));
vi.mock("../ipc", () => ({
  noteFlush: vi.fn(),
  draftWrite: vi.fn(),
  remoteSave: vi.fn(),
  asCoreError: (error: unknown) => error,
}));

const rev = { hash: "b3:abc", size: 4, mtime_ns: "1" } as ipc.BaseRev;
const local: OpenDoc = {
  noteId: "local" as ipc.NoteId, path: "local.md" as ipc.RelPath, text: "latest local text",
  baseRev: rev, readOnly: null, bufferVersion: 1, savedVersion: 0, externalRev: 0,
  status: "pending", conflict: null, draft: null, lastError: null,
};
const remote: RemoteDoc = {
  path: "remote.md", text: "latest remote text", etag: "base", base: "disk", readOnly: null,
  bufferVersion: 1, savedVersion: 0, externalRev: 0, status: "pending", conflict: null,
  lastError: null, synced: null,
};
const draft: ipc.DraftInfo = {
  schema: 1, note_id: local.noteId, path: local.path, buffer_version: 1, base_rev: rev,
  reason: "exit", written_at: "now",
};
const writeError: ipc.CoreError = { code: "io", op: "write_draft", path: local.path, kind: "disk_full" };

function held<T>() {
  let finish!: (value: T) => void;
  const promise = new Promise<T>((resolve) => { finish = resolve; });
  return { promise, finish };
}

let requestClose: () => Promise<void>;

beforeEach(() => {
  native.listen.mockImplementation(async (_, close) => {
    requestClose = close;
    return () => {};
  });
  native.destroy.mockImplementation(async () => {
    expect(isSyncLocked()).toBe(true);
  });
});

afterEach(() => {
  cleanup();
  useDialog.getState().settle(false);
  endSyncBarrier();
  setComposing(false);
  useEditor.setState({ doc: null });
  useRemoteDoc.setState({ doc: null });
  resetRemoteDocTimers();
  vi.resetAllMocks();
});

it("flushes local text before the native window is destroyed", async () => {
  useEditor.setState({ doc: local });
  vi.mocked(ipc.noteFlush).mockResolvedValue({ result: "saved", base_rev: rev, buffer_version: 1, unchanged: false });
  renderHook(useDesktopClose);

  await act(requestClose);

  expect(native.listen).toHaveBeenCalledWith("notes://close-requested", expect.any(Function));
  expect(ipc.noteFlush).toHaveBeenCalledWith(local.noteId, local.text, 1, rev);
  expect(ipc.draftWrite).not.toHaveBeenCalled();
  expect(native.destroy).toHaveBeenCalledOnce();
});

it("waits for a confirmed draft when the local flush fails", async () => {
  const write = held<ipc.DraftInfo>();
  useEditor.setState({ doc: local });
  vi.mocked(ipc.noteFlush).mockResolvedValue({ result: "write_failed", kind: "disk_full", buffer_version: 1 });
  vi.mocked(ipc.draftWrite).mockReturnValue(write.promise);
  renderHook(useDesktopClose);

  const closing = requestClose();
  await waitFor(() => expect(ipc.draftWrite).toHaveBeenCalledWith(local.noteId, local.text, 1, rev, "exit"));
  expect(native.destroy).not.toHaveBeenCalled();
  await act(async () => { write.finish(draft); await closing; });

  // The exit draft is written for the next start. It is not attached to the
  // document on screen as a "recovered" draft, which would be wrong if the close
  // were cancelled after this point.
  expect(useEditor.getState().doc?.draft).toBeNull();
  expect(native.destroy).toHaveBeenCalledOnce();
});

it("shows the write error and leaves the current text open when both writes fail", async () => {
  useEditor.setState({ doc: local });
  vi.mocked(ipc.noteFlush).mockResolvedValue({ result: "write_failed", kind: "disk_full", buffer_version: 1 });
  vi.mocked(ipc.draftWrite).mockRejectedValue(writeError);
  const { result } = renderHook(useDesktopClose);

  await act(requestClose);

  expect(native.destroy).not.toHaveBeenCalled();
  expect(useEditor.getState().doc?.text).toBe(local.text);
  expect(result.current).toMatch(/could not save your note or keep a draft.*no space left/i);
  expect(isSyncLocked()).toBe(false);
});

it("keeps the local buffer safe even after saving a separate remote note", async () => {
  useEditor.setState({ doc: local });
  useRemoteDoc.setState({ doc: remote });
  vi.mocked(ipc.remoteSave).mockResolvedValue({ outcome: "saved", etag: "saved" });
  vi.mocked(ipc.noteFlush).mockResolvedValue({ result: "write_failed", kind: "disk_full", buffer_version: 1 });
  vi.mocked(ipc.draftWrite).mockRejectedValue(writeError);
  renderHook(useDesktopClose);

  await act(requestClose);

  expect(ipc.remoteSave).toHaveBeenCalledWith(remote.path, remote.text, remote.etag);
  expect(useRemoteDoc.getState().doc?.savedVersion).toBe(1);
  expect(useEditor.getState().doc?.text).toBe(local.text);
  expect(useDialog.getState().current).toBeNull();
  expect(native.destroy).not.toHaveBeenCalled();
});

it("keeps a newer local edit typed while the close barrier is draining", async () => {
  const ipcCall = held<void>();
  const draining = tracked(() => ipcCall.promise);
  const { result } = renderHook(useDesktopClose);

  const closing = requestClose();
  await Promise.resolve();
  useEditor.setState({ doc: local });
  await act(async () => { ipcCall.finish(); await draining; await closing; });

  expect(native.destroy).not.toHaveBeenCalled();
  expect(useEditor.getState().doc?.text).toBe(local.text);
  expect(result.current).toMatch(/edits changed/);
  expect(isSyncLocked()).toBe(false);
});

it("saves the remote note or waits for confirmation before discarding its text", async () => {
  useRemoteDoc.setState({ doc: remote });
  vi.mocked(ipc.remoteSave).mockRejectedValue({ code: "sync", cause: "denied" });
  renderHook(useDesktopClose);

  const canceled = requestClose();
  await waitFor(() => expect(useDialog.getState().current?.title).toContain(remote.path));
  await requestClose();
  expect(ipc.remoteSave).toHaveBeenCalledOnce();
  useDialog.getState().settle(false);
  await act(async () => { await canceled; });
  expect(native.destroy).not.toHaveBeenCalled();
  expect(useRemoteDoc.getState().doc?.text).toBe(remote.text);

  const accepted = requestClose();
  await waitFor(() => expect(useDialog.getState().current?.title).toContain(remote.path));
  await act(async () => { useDialog.getState().settle(true); await accepted; });
  expect(native.destroy).toHaveBeenCalledOnce();
});

it("does not discard a remote edit outside the confirmed buffer", async () => {
  useRemoteDoc.setState({ doc: remote });
  vi.mocked(ipc.remoteSave).mockRejectedValue({ code: "sync", cause: "denied" });
  const { result } = renderHook(useDesktopClose);

  const closing = requestClose();
  await waitFor(() => expect(useDialog.getState().current?.title).toContain(remote.path));
  useRemoteDoc.setState({ doc: { ...remote, text: "new remote text", bufferVersion: 2 } });
  await act(async () => { useDialog.getState().settle(true); await closing; });

  expect(native.destroy).not.toHaveBeenCalled();
  expect(useRemoteDoc.getState().doc?.text).toBe("new remote text");
  expect(result.current).toMatch(/edits changed/);
});

it("keeps composition open and releases its own barrier if native destroy fails", async () => {
  const { result } = renderHook(useDesktopClose);
  setComposing(true);
  await act(requestClose);
  expect(native.destroy).not.toHaveBeenCalled();
  expect(result.current).toMatch(/finish composing/i);

  setComposing(false);
  native.destroy.mockRejectedValueOnce(new Error("IPC failed"));
  await act(requestClose);
  expect(result.current).toMatch(/could not close the window/);
  expect(isSyncLocked()).toBe(false);
});
