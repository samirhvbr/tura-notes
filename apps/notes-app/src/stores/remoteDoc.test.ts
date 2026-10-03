import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as ipc from "../ipc";
vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  remoteOpen: vi.fn(),
  remoteSave: vi.fn(),
  remoteCreate: vi.fn(),
  remoteRename: vi.fn(),
  remoteList: vi.fn(),
  pdfSave: vi.fn(),
}));
const { useRemoteDoc, resetRemoteDocTimers, backoff, dirty } = await import("./remoteDoc");
const { useUi } = await import("./ui");
const { useRemote } = await import("./remote");
const initial = useRemoteDoc.getState();

const note = (path: string, text: string, etag: string): ipc.RemoteNote => ({
  path,
  text,
  etag,
  read_only: null,
});

beforeEach(() => {
  vi.mocked(ipc.remoteList).mockResolvedValue([]);
});
afterEach(() => {
  resetRemoteDocTimers();
  useRemoteDoc.setState(initial, true);
  useUi.setState({ mainView: "local" });
  vi.clearAllMocks();
  vi.useRealTimers();
});

async function opened(text = "one\n") {
  vi.mocked(ipc.remoteOpen).mockResolvedValue(note("a.md", text, '"e1"'));
  await useRemoteDoc.getState().open("a.md");
}

it("opens a remote note in its own tab and in the main area", async () => {
  await opened();
  const s = useRemoteDoc.getState();
  expect(s.doc?.text).toBe("one\n");
  expect(s.tabs).toEqual(["a.md"]);
  expect(useUi.getState().mainView).toBe("remote");
});

it("saves on the tag it was read at, and only a save of the current text marks it clean", async () => {
  await opened();
  let answer!: (v: ipc.RemoteSave) => void;
  vi.mocked(ipc.remoteSave).mockReturnValueOnce(new Promise((r) => (answer = r)));
  useRemoteDoc.getState().edit("two\n");
  const saving = useRemoteDoc.getState().save();
  await vi.waitFor(() => expect(ipc.remoteSave).toHaveBeenCalledWith("a.md", "two\n", '"e1"'));
  // Typed while the save is on the wire.
  useRemoteDoc.getState().edit("three\n");
  vi.mocked(ipc.remoteSave).mockResolvedValueOnce({ outcome: "saved", etag: '"e3"' });
  answer({ outcome: "saved", etag: '"e2"' });
  await saving;
  await useRemoteDoc.getState().save();
  // The second save carried the newer text on the newer tag.
  expect(ipc.remoteSave).toHaveBeenLastCalledWith("a.md", "three\n", '"e2"');
  const d = useRemoteDoc.getState().doc!;
  expect(d.etag).toBe('"e3"');
  expect(dirty(d)).toBe(false);
  expect(d.status).toBe("saved");
});

it("a note changed on the server is a conflict, and nothing is overwritten until the user chooses", async () => {
  await opened();
  vi.mocked(ipc.remoteSave).mockResolvedValueOnce({
    outcome: "conflict",
    current: note("a.md", "theirs\n", '"s2"'),
  });
  useRemoteDoc.getState().edit("mine\n");
  await useRemoteDoc.getState().save();
  let d = useRemoteDoc.getState().doc!;
  expect(d.status).toBe("conflict");
  expect(d.conflict?.text).toBe("theirs\n");
  // Autosave does not retry over a conflict.
  await useRemoteDoc.getState().save();
  expect(ipc.remoteSave).toHaveBeenCalledTimes(1);
  // Keep mine: saved over the server version the user has now seen.
  vi.mocked(ipc.remoteSave).mockResolvedValueOnce({ outcome: "saved", etag: '"s3"' });
  await useRemoteDoc.getState().resolve("mine");
  expect(ipc.remoteSave).toHaveBeenLastCalledWith("a.md", "mine\n", '"s2"');
  d = useRemoteDoc.getState().doc!;
  expect(d.status).toBe("saved");
  expect(d.conflict).toBeNull();
});

it("using the server's version replaces the buffer, from outside the editor, clean", async () => {
  await opened();
  vi.mocked(ipc.remoteSave).mockResolvedValueOnce({
    outcome: "conflict",
    current: note("a.md", "theirs\n", '"s2"'),
  });
  useRemoteDoc.getState().edit("mine\n");
  await useRemoteDoc.getState().save();
  const before = useRemoteDoc.getState().doc!.externalRev;
  await useRemoteDoc.getState().resolve("theirs");
  const d = useRemoteDoc.getState().doc!;
  expect(d.text).toBe("theirs\n");
  expect(d.etag).toBe('"s2"');
  expect(d.externalRev).toBe(before + 1);
  expect(dirty(d)).toBe(false);
});

it("saving mine as a copy finds a free name beside the note, then takes the server's", async () => {
  vi.mocked(ipc.remoteOpen).mockResolvedValue(note("work/a.md", "one\n", '"e1"'));
  await useRemoteDoc.getState().open("work/a.md");
  vi.mocked(ipc.remoteSave).mockResolvedValueOnce({
    outcome: "conflict",
    current: note("work/a.md", "theirs\n", '"s2"'),
  });
  useRemoteDoc.getState().edit("mine\n");
  await useRemoteDoc.getState().save();
  vi.mocked(ipc.remoteCreate)
    .mockRejectedValueOnce({ code: "already_exists", path: "work/a (conflict).md" })
    .mockResolvedValueOnce(note("work/a (conflict 2).md", "mine\n", '"c"'));
  await useRemoteDoc.getState().resolve("copy");
  expect(ipc.remoteCreate).toHaveBeenNthCalledWith(1, "work/a (conflict).md", "mine\n");
  expect(ipc.remoteCreate).toHaveBeenNthCalledWith(2, "work/a (conflict 2).md", "mine\n");
  expect(useRemoteDoc.getState().doc!.text).toBe("theirs\n");
});

it("offline keeps the edit and tries again later, backing off", async () => {
  vi.useFakeTimers();
  await opened();
  vi.mocked(ipc.remoteSave).mockRejectedValueOnce({ code: "sync", cause: "offline" });
  useRemoteDoc.getState().edit("two\n");
  await useRemoteDoc.getState().save();
  expect(useRemoteDoc.getState().doc!.status).toBe("offline");
  expect(dirty(useRemoteDoc.getState().doc)).toBe(true);
  vi.mocked(ipc.remoteSave).mockResolvedValueOnce({ outcome: "saved", etag: '"e2"' });
  await vi.advanceTimersByTimeAsync(backoff(1));
  expect(ipc.remoteSave).toHaveBeenCalledTimes(2);
  expect(useRemoteDoc.getState().doc!.status).toBe("saved");
  expect(backoff(1)).toBe(5000);
  expect(backoff(10)).toBe(60000);
});

it("a note deleted on the server keeps the text, and can be put back", async () => {
  await opened();
  vi.mocked(ipc.remoteSave).mockResolvedValueOnce({ outcome: "gone" });
  useRemoteDoc.getState().edit("two\n");
  await useRemoteDoc.getState().save();
  expect(useRemoteDoc.getState().doc!.status).toBe("gone");
  expect(useRemoteDoc.getState().doc!.text).toBe("two\n");
  vi.mocked(ipc.remoteCreate).mockResolvedValueOnce(note("a.md", "two\n", '"n"'));
  await useRemoteDoc.getState().recreate();
  expect(ipc.remoteCreate).toHaveBeenCalledWith("a.md", "two\n");
  expect(useRemoteDoc.getState().doc!.status).toBe("saved");
  expect(dirty(useRemoteDoc.getState().doc)).toBe(false);
});

it("a tab holding an unsent edit is not closed without being told to", async () => {
  await opened();
  vi.mocked(ipc.remoteSave).mockRejectedValue({ code: "sync", cause: "denied" });
  useRemoteDoc.getState().edit("two\n");
  expect(await useRemoteDoc.getState().close("a.md")).toBe(false);
  expect(useRemoteDoc.getState().tabs).toEqual(["a.md"]);
  expect(await useRemoteDoc.getState().close("a.md", true)).toBe(true);
  expect(useRemoteDoc.getState().tabs).toEqual([]);
  expect(useUi.getState().mainView).toBe("local");
});

it("a copy goes to the local folder as an ordinary note, under a free name", async () => {
  await opened("keep me\n");
  vi.mocked(ipc.pdfSave)
    .mockRejectedValueOnce({ code: "already_exists", path: "a (remote).md" })
    .mockResolvedValueOnce({ path: "a (remote 2).md", name: "a (remote 2).md", kind: "File", size: 8, is_note: true });
  expect(await useRemoteDoc.getState().copyToLocal()).toBe("a (remote 2).md");
  expect(ipc.pdfSave).toHaveBeenLastCalledWith("a (remote 2).md", "keep me\n");
});

it("switching to another remote note flushes this one first, and stays when it cannot", async () => {
  await opened();
  vi.mocked(ipc.remoteSave).mockRejectedValue({ code: "sync", cause: "denied" });
  useRemoteDoc.getState().edit("two\n");
  vi.mocked(ipc.remoteOpen).mockResolvedValue(note("b.md", "b\n", '"b"'));
  await expect(useRemoteDoc.getState().open("b.md")).rejects.toBeTruthy();
  expect(useRemoteDoc.getState().doc!.path).toBe("a.md");
  expect(useRemote.getState()).toBeTruthy();
});

// ---- renaming from the tree --------------------------------------------------

it("renames a note that is not open, at the tag the listing showed, and follows it in the tabs", async () => {
  await opened();
  useRemoteDoc.setState({ tabs: ["a.md", "b.md"] });
  vi.mocked(ipc.remoteRename).mockResolvedValue(note("ideas/b.md", "two\n", '"e9"'));
  expect(await useRemoteDoc.getState().renameNote("b.md", "ideas/b.md", '"e2"')).toBe(true);
  expect(ipc.remoteRename).toHaveBeenCalledWith("b.md", "ideas/b.md", '"e2"');
  expect(ipc.remoteOpen).toHaveBeenCalledTimes(1); // only the open of a.md
  expect(useRemoteDoc.getState().tabs).toEqual(["a.md", "ideas/b.md"]);
  expect(useRemoteDoc.getState().doc?.path, "the open note was not touched").toBe("a.md");
  expect(ipc.remoteList).toHaveBeenCalled();
});

it("asks the note for its tag when the listing carried none", async () => {
  vi.mocked(ipc.remoteOpen).mockResolvedValue(note("b.md", "x", '"fresh"'));
  vi.mocked(ipc.remoteRename).mockResolvedValue(note("c.md", "x", '"e3"'));
  await useRemoteDoc.getState().renameNote("b.md", "c.md", null);
  expect(ipc.remoteRename).toHaveBeenCalledWith("b.md", "c.md", '"fresh"');
});

it("renaming the open note keeps its buffer, and refuses while text is unsent", async () => {
  await opened();
  vi.mocked(ipc.remoteRename).mockResolvedValue(note("renamed.md", "one\n", '"e5"'));
  expect(await useRemoteDoc.getState().renameNote("a.md", "renamed.md", '"stale"')).toBe(true);
  // The open note is renamed at the tag it was saved at, not the listing's.
  expect(ipc.remoteRename).toHaveBeenCalledWith("a.md", "renamed.md", '"e1"');
  expect(useRemoteDoc.getState().doc?.path).toBe("renamed.md");

  vi.clearAllMocks();
  vi.mocked(ipc.remoteList).mockResolvedValue([]);
  useRemoteDoc.setState((s) => ({ doc: s.doc && { ...s.doc, bufferVersion: s.doc.savedVersion + 1 } }));
  expect(await useRemoteDoc.getState().renameNote("renamed.md", "again.md", null)).toBe(false);
  expect(ipc.remoteRename).not.toHaveBeenCalled();
});

it("a refusal from the server reaches the caller and leaves the tabs as they were", async () => {
  vi.mocked(ipc.remoteRename).mockRejectedValue({ code: "sync", cause: "invalid" });
  useRemoteDoc.setState({ tabs: ["b.md"] });
  await expect(useRemoteDoc.getState().renameNote("b.md", "c.md", '"e2"')).rejects.toBeTruthy();
  expect(useRemoteDoc.getState().tabs).toEqual(["b.md"]);
});
