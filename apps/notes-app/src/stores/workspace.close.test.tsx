// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { Editor } from "../editor/Editor";
import * as ipc from "../ipc";
import { acquireSyncBarrier, endSyncBarrier, isSyncLocked, setComposing } from "../ipc/barrier";
import { useDialog } from "../app/dialog";
import { useEditor } from "./editor";
import { useSettings } from "./settings";
import { useTabs } from "./tabs";
import { useWorkspace } from "./workspace";
import { resetRemoteDocTimers, useRemoteDoc } from "./remoteDoc";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const noteId = "note-a" as ipc.NoteId;
const path = "a.md" as ipc.RelPath;
const rev = { hash: "b3:abc", size: 4, mtime_ns: "1" } as ipc.BaseRev;
const info = { id: "workspace-a", root: "/notes" } as ipc.WorkspaceInfo;
const dirtyError: ipc.CoreError = { code: "dirty_buffers", note_ids: [noteId], count: 1 };
const closeError: ipc.CoreError = { code: "io", op: "write", path: "registry.db", kind: "disk_full" };

function held<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function editor() {
  const element = document.querySelector(".cm-editor") as HTMLElement;
  return EditorView.findFromDOM(element)!;
}

function type(text: string) {
  const view = editor();
  act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: text } }));
}

beforeEach(() => {
  vi.clearAllMocks();
  // These assertions exercise text transactions and IPC, not browser layout.
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
  setComposing(false);
  useSettings.setState({ settings: null } as never);
  useEditor.setState({
    autosaveMs: 60_000,
    doc: {
      noteId, path, text: "disk", baseRev: rev, readOnly: null,
      bufferVersion: 0, savedVersion: 0, externalRev: 0,
      status: "saved", conflict: null, draft: null, lastError: null,
    },
  });
  useWorkspace.setState({ info, error: null });
  useRemoteDoc.setState({ doc: null, tabs: [] });
  useTabs.setState({
    tabs: [{ noteId, path, line: 1, col: 1, scrollTop: 0, pinned: false }],
    activeId: noteId,
  });
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    if (command === "note_save" || command === "note_flush") {
      return { result: "saved", base_rev: rev, buffer_version: (args as { bufferVersion: number }).bufferVersion, unchanged: false };
    }
    return undefined;
  });
});

afterEach(async () => {
  cleanup();
  useDialog.getState().settle(false);
  useEditor.getState().close();
  useTabs.getState().reset();
  resetRemoteDocTimers();
  useRemoteDoc.setState({ doc: null, tabs: [] });
  endSyncBarrier();
  if (vi.isFakeTimers()) {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  }
  // Ordinary IPC returns its barrier slot in a macrotask.
  await new Promise(resolve => setTimeout(resolve, 0));
  vi.restoreAllMocks();
});

it("freezes a clean editor through native close and local cleanup", async () => {
  const close = held<void>();
  vi.mocked(invoke).mockImplementation(command => command === "workspace_close" ? close.promise : Promise.resolve());
  render(<Editor />);

  const leaving = useWorkspace.getState().leave();
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("workspace_close", { dirty: [] }));
  expect(isSyncLocked()).toBe(true);
  type(" typed during close");
  expect(editor().state.doc.toString()).toBe("disk");
  expect(useEditor.getState().doc?.bufferVersion).toBe(0);

  await act(async () => { close.resolve(); expect(await leaving).toBe(true); });
  expect(useEditor.getState().doc).toBeNull();
  expect(useTabs.getState().tabs).toEqual([]);
  expect(useWorkspace.getState().info).toBeNull();
  expect(isSyncLocked()).toBe(false);
  expect(invoke).not.toHaveBeenCalledWith("note_save", expect.anything());
  expect(invoke).not.toHaveBeenCalledWith("draft_write", expect.anything());
});

it("releases the dirty confirmation and flush, then freezes the second close", async () => {
  const close = held<void>();
  let attempts = 0;
  const ordinary = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation((command, args, options) => {
    if (command === "workspace_close") return ++attempts === 1 ? Promise.reject(dirtyError) : close.promise;
    return ordinary(command, args, options);
  });
  render(<Editor />);
  type(" edited");

  const leaving = useWorkspace.getState().leave();
  await waitFor(() => expect(useDialog.getState().current?.kind).toBe("confirm"));
  expect(isSyncLocked()).toBe(false);
  await act(async () => { useDialog.getState().settle(true); });
  await waitFor(() => expect(attempts).toBe(2));
  expect(invoke).toHaveBeenCalledWith("note_flush", { noteId, text: "disk edited", bufferVersion: 1, baseRev: rev });
  expect(isSyncLocked()).toBe(true);
  type(" typed after flush");
  expect(editor().state.doc.toString()).toBe("disk edited");

  await act(async () => { close.resolve(); expect(await leaving).toBe(true); });
  expect(useEditor.getState().doc).toBeNull();
  expect(isSyncLocked()).toBe(false);
});

it("captures edits made during the IPC drain in the dirty refusal", async () => {
  const listing = held<ipc.Entry[]>();
  const ordinary = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation((command, args, options) => {
    if (command === "tree_list") return listing.promise;
    if (command === "workspace_close") return Promise.reject(dirtyError);
    return ordinary(command, args, options);
  });
  render(<Editor />);
  const pending = ipc.treeList(ipc.ROOT);
  const leaving = useWorkspace.getState().leave();
  expect(isSyncLocked()).toBe(false);
  type(" typed during drain");
  expect(invoke).not.toHaveBeenCalledWith("workspace_close", expect.anything());

  await act(async () => { listing.resolve([]); await pending; });
  await waitFor(() => expect(useDialog.getState().current?.kind).toBe("confirm"));
  expect(invoke).toHaveBeenCalledWith("workspace_close", { dirty: [noteId] });
  await act(async () => { useDialog.getState().settle(false); expect(await leaving).toBe(false); });
  expect(useEditor.getState().doc?.text).toBe("disk typed during drain");
  expect(useWorkspace.getState().info).toBe(info);
  expect(isSyncLocked()).toBe(false);
});

it("restores input and persistence after a failed native close", async () => {
  const close = held<void>();
  const ordinary = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation((command, args, options) =>
    command === "workspace_close" ? close.promise : ordinary(command, args, options));
  render(<Editor />);
  const leaving = useWorkspace.getState().leave();
  await waitFor(() => expect(isSyncLocked()).toBe(true));
  await act(async () => { close.reject(closeError); expect(await leaving).toBe(false); });

  expect(isSyncLocked()).toBe(false);
  expect(useWorkspace.getState().info).toBe(info);
  expect(useWorkspace.getState().error).toEqual(closeError);
  type(" after refusal");
  await act(async () => { await useEditor.getState().save(); });
  expect(useEditor.getState().doc).toMatchObject({ text: "disk after refusal", status: "saved" });
  expect(invoke).toHaveBeenCalledWith("note_save", { noteId, text: "disk after refusal", bufferVersion: 1, baseRev: rev });
});

it("does not release a barrier owned by receive or another close flow", async () => {
  expect(await acquireSyncBarrier()).toBe(true);
  expect(await useWorkspace.getState().leave()).toBe(false);
  expect(isSyncLocked()).toBe(true);
  expect(invoke).not.toHaveBeenCalledWith("workspace_close", expect.anything());
  expect(useWorkspace.getState().info).toBe(info);
});

it("resumes a remote save gated while the local workspace was closing", async () => {
  const close = held<void>();
  vi.mocked(invoke).mockImplementation(async command => {
    if (command === "workspace_close") return close.promise;
    if (command === "remote_save") return { outcome: "saved", etag: '"new"' };
  });
  useRemoteDoc.setState({
    tabs: ["remote.md"],
    doc: {
      path: "remote.md", text: "remote edit", base: "remote", etag: '"old"',
      readOnly: null, bufferVersion: 1, savedVersion: 0, status: "pending",
      externalRev: 0, conflict: null, lastError: null, synced: null,
    },
  });
  const leaving = useWorkspace.getState().leave();
  await waitFor(() => expect(isSyncLocked()).toBe(true));
  // The remote debounce uses this same save path if it expires under the gate.
  await useRemoteDoc.getState().save();
  expect(invoke).not.toHaveBeenCalledWith("remote_save", expect.anything());
  close.resolve();
  expect(await leaving).toBe(true);
  await waitFor(() => expect(useRemoteDoc.getState().doc?.status).toBe("saved"));
  expect(useRemoteDoc.getState().doc?.text).toBe("remote edit");
});

it("resumes local and Remote autosaves after the IPC drain times out", async () => {
  vi.useFakeTimers();
  useEditor.getState().setAutosave(10);
  const listing = held<ipc.Entry[]>();
  const ordinary = vi.mocked(invoke).getMockImplementation()!;
  vi.mocked(invoke).mockImplementation((command, args, options) => {
    if (command === "tree_list") return listing.promise;
    if (command === "remote_save") return Promise.resolve({ outcome: "saved", etag: '"new"' });
    return ordinary(command, args, options);
  });
  useRemoteDoc.setState({
    tabs: ["remote.md"],
    doc: {
      path: "remote.md", text: "remote", base: "remote", etag: '"old"',
      readOnly: null, bufferVersion: 0, savedVersion: 0, status: "saved",
      externalRev: 0, conflict: null, lastError: null, synced: null,
    },
  });
  render(<Editor />);
  type(" local edit");
  useRemoteDoc.getState().edit("remote edit");
  const pending = ipc.treeList(ipc.ROOT);
  const leaving = useWorkspace.getState().leave();
  try {
    // Both real debounce timers expire during the claim. New tracked IPC is
    // refused even though the barrier is still waiting for the old tree read.
    await act(async () => { await vi.advanceTimersByTimeAsync(20); });
    expect(useEditor.getState().doc?.status).toBe("error");
    expect(useRemoteDoc.getState().doc?.status).toBe("error");
    expect(invoke).not.toHaveBeenCalledWith("note_save", expect.anything());
    expect(invoke).not.toHaveBeenCalledWith("remote_save", expect.anything());

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(await leaving).toBe(false);
    expect(isSyncLocked()).toBe(false);
    expect(useWorkspace.getState().info).toBe(info);
    expect(invoke).not.toHaveBeenCalledWith("workspace_close", expect.anything());
    expect(useEditor.getState().doc).toMatchObject({ text: "disk local edit", status: "saved" });
    expect(useRemoteDoc.getState().doc).toMatchObject({ text: "remote edit", status: "saved" });
  } finally {
    listing.resolve([]);
    await pending;
  }
});
