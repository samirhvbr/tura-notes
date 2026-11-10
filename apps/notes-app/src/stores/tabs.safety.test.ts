import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as ipc from "../ipc";
import { useEditor } from "./editor";
import { useTabs } from "./tabs";

vi.mock("../ipc", () => ({
  noteOpen: vi.fn(),
  noteFlush: vi.fn(),
  noteClose: vi.fn(async () => {}),
  draftWrite: vi.fn(),
  asCoreError: (e: unknown) => e,
}));

const rev = { hash: "b3:abc", size: 4, mtime_ns: "1" } as ipc.BaseRev;
const first = "first.md" as ipc.RelPath;
const second = "second.md" as ipc.RelPath;
const id = (path: ipc.RelPath) => `id:${path}` as ipc.NoteId;
const writeError: ipc.CoreError = { code: "io", op: "write_draft", path: first, kind: "disk_full" };

function opened(path: ipc.RelPath): ipc.OpenedNote {
  return { path, note_id: id(path), text: "disk", base_rev: rev, draft: null, read_only: null, profile: {} } as ipc.OpenedNote;
}

function held<T>() {
  let finish!: (value: T) => void;
  const promise = new Promise<T>((resolve) => { finish = resolve; });
  return { promise, finish };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.mocked(ipc.noteOpen).mockImplementation(async (path) => opened(path));
  await useTabs.getState().openPath(first);
});

afterEach(() => {
  useEditor.setState({ doc: null });
  useTabs.getState().reset();
  vi.useRealTimers();
  vi.resetAllMocks();
});

it("keeps the active tab when neither the flush nor the draft can be written", async () => {
  useEditor.getState().edit("unsaved");
  vi.mocked(ipc.noteFlush).mockResolvedValue({ result: "write_failed", kind: "disk_full", buffer_version: 1 });
  vi.mocked(ipc.draftWrite).mockRejectedValue(writeError);

  await useTabs.getState().openPath(second);

  expect(ipc.noteOpen).toHaveBeenCalledTimes(1);
  expect(useTabs.getState().activeId).toBe(id(first));
  expect(useEditor.getState().doc).toMatchObject({ text: "unsaved", lastError: writeError });
});

it("keeps a conflicted tab open when writing its draft fails", async () => {
  useEditor.getState().edit("unsaved");
  vi.mocked(ipc.draftWrite).mockRejectedValue(writeError);
  await useEditor.getState().enterConflict();

  await useTabs.getState().closeActive();

  expect(useTabs.getState().activeId).toBe(id(first));
  expect(useEditor.getState().doc).toMatchObject({ text: "unsaved", lastError: writeError });
});

it("keeps text typed while opening another tab", async () => {
  const next = held<ipc.OpenedNote>();
  vi.mocked(ipc.noteOpen).mockReturnValueOnce(next.promise);
  const switching = useTabs.getState().openPath(second);
  await Promise.resolve();
  expect(ipc.noteOpen).toHaveBeenLastCalledWith(second);

  useEditor.getState().edit("typed while opening");
  next.finish(opened(second));
  await switching;

  expect(useTabs.getState().activeId).toBe(id(first));
  expect(useEditor.getState().doc?.text).toBe("typed while opening");
});

it("does not reopen the next tab if it is closed while its read is pending", async () => {
  await useTabs.getState().openPath(second);
  await useTabs.getState().activate(id(first));
  const next = held<ipc.OpenedNote>();
  vi.mocked(ipc.noteOpen).mockReturnValueOnce(next.promise);

  const closing = useTabs.getState().closeActive();
  await Promise.resolve();
  expect(ipc.noteOpen).toHaveBeenLastCalledWith(second);
  await useTabs.getState().close(id(second));
  next.finish(opened(second));
  await closing;

  expect(useTabs.getState().tabs.map((tab) => tab.noteId)).toEqual([id(first)]);
  expect(useTabs.getState().activeId).toBe(id(first));
  expect(useEditor.getState().doc?.noteId).toBe(id(first));
});

it("keeps text typed while an older exit draft is being written", async () => {
  const draft = held<ipc.DraftInfo>();
  vi.mocked(ipc.noteFlush).mockResolvedValue({ result: "write_failed", kind: "disk_full", buffer_version: 1 });
  vi.mocked(ipc.draftWrite).mockReturnValueOnce(draft.promise);
  useEditor.getState().edit("first edit");
  const switching = useTabs.getState().openPath(second);
  await vi.advanceTimersByTimeAsync(0);
  expect(ipc.draftWrite).toHaveBeenCalledWith(id(first), "first edit", 1, rev, "exit");

  useEditor.getState().edit("newer edit");
  draft.finish({ schema: 1, note_id: id(first), path: first, buffer_version: 1, base_rev: rev, reason: "exit", written_at: "now" });
  await switching;

  expect(useTabs.getState().activeId).toBe(id(first));
  expect(useEditor.getState().doc?.text).toBe("newer edit");
});
