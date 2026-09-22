// The save queue.
//
// `ARCHITECTURE.md` §5: *"saves are queued per document inside the core; at
// most one save per document is in flight"*. The store used to hold a
// module-level `inFlight` boolean that **dropped** a save while another was
// running — the opposite of queueing, and global rather than per document.
//
// These tests are about what the dropped call was carrying. Each one fails
// against the boolean and passes against the queue.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as ipc from "../ipc";
import { useEditor } from "./editor";
import type { OpenDoc } from "./editor";

vi.mock("../ipc", () => ({
  noteSave: vi.fn(),
  noteFlush: vi.fn(),
  asCoreError: (e: unknown) => ({ code: "internal", message: String(e) }),
}));
vi.mock("../ipc/barrier", () => ({ isSyncLocked: () => false }));

const rev = { hash: "b3:abc", size: 4, mtime_ns: "1" } as ipc.BaseRev;

/** A promise this test resolves by hand, so a save can be held in flight. */
function held<T>() {
  let settle!: (v: T) => void;
  const promise = new Promise<T>(r => { settle = r; });
  return { promise, settle };
}

const savedAt = (buffer_version: number): ipc.SaveResult =>
  ({ result: "saved", base_rev: rev, buffer_version, unchanged: false });

function doc(over: Partial<OpenDoc> = {}): OpenDoc {
  return {
    noteId: "note" as ipc.NoteId, path: "note.md" as ipc.RelPath, text: "hello",
    baseRev: rev, readOnly: null, bufferVersion: 5, savedVersion: 0, externalRev: 0,
    status: "pending", conflict: null, draft: null, lastError: null, ...over,
  };
}

beforeEach(() => { useEditor.setState({ doc: doc() }); });
afterEach(() => { useEditor.setState({ doc: null }); vi.clearAllMocks(); });

it("a flush asked while an autosave is running still reaches the core", async () => {
  const first = held<ipc.SaveResult>();
  vi.mocked(ipc.noteSave).mockReturnValue(first.promise);
  vi.mocked(ipc.noteFlush).mockResolvedValue(savedAt(5));

  const auto = useEditor.getState().save();
  const flush = useEditor.getState().save(true);
  first.settle(savedAt(5));
  await auto; await flush;

  // The boolean returned here without calling anything, and `leaveCurrent`
  // read that as "the buffer is on disk" before replacing the document.
  expect(ipc.noteFlush).toHaveBeenCalledTimes(1);
});

it("an autosave asked while one is running is not forgotten, and sends the newer text", async () => {
  const first = held<ipc.SaveResult>();
  vi.mocked(ipc.noteSave).mockReturnValueOnce(first.promise).mockResolvedValue(savedAt(6));

  const one = useEditor.getState().save();
  // The user keeps typing while the first save is in flight.
  useEditor.setState({ doc: doc({ text: "hello, more", bufferVersion: 6 }) });
  const two = useEditor.getState().save();
  first.settle(savedAt(5));
  await one; await two;

  // Dropped, the buffer stayed `pending` with nothing left to re-arm the
  // one-shot debounce: with no further keystroke, forever.
  expect(useEditor.getState().doc?.savedVersion).toBe(6);
  expect(useEditor.getState().doc?.status).toBe("saved");
});

it("a queued save refuses when the tab moved on, instead of writing into the next note", async () => {
  const first = held<ipc.SaveResult>();
  vi.mocked(ipc.noteSave).mockReturnValue(first.promise);
  vi.mocked(ipc.noteFlush).mockResolvedValue(savedAt(1));

  const one = useEditor.getState().save();
  const flush = useEditor.getState().save(true);
  // The queued flush is overtaken by a tab switch before its turn comes.
  useEditor.setState({ doc: doc({ noteId: "other" as ipc.NoteId, path: "other.md" as ipc.RelPath }) });
  first.settle(savedAt(5));
  await one; await flush;

  expect(ipc.noteFlush).not.toHaveBeenCalled();
});

it("the queue survives a save that threw, and the next one still runs", async () => {
  vi.mocked(ipc.noteSave).mockRejectedValueOnce(new Error("disk went away"));
  vi.mocked(ipc.noteFlush).mockResolvedValue(savedAt(5));

  await useEditor.getState().save();
  expect(useEditor.getState().doc?.status).toBe("error");

  await useEditor.getState().save(true);
  expect(ipc.noteFlush).toHaveBeenCalledTimes(1);
});
