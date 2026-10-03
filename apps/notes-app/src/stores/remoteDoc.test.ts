import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as ipc from "../ipc";
vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  remoteOpen: vi.fn(),
  remoteSave: vi.fn(),
  remoteCreate: vi.fn(),
  remoteRename: vi.fn(),
  remoteMerge: vi.fn(),
  remoteList: vi.fn(),
  pdfSave: vi.fn(),
}));
const { useRemoteDoc, resetRemoteDocTimers, backoff, dirty, syncDelay, SYNC_MS } = await import("./remoteDoc");
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

// ---- staying in step with the server ----------------------------------------

const PLAN = "# Plan\n\none\ntwo\nthree\nfour\nfive\nsix\nseven\n";
async function planOpen() {
  vi.mocked(ipc.remoteOpen).mockResolvedValue(note("a.md", PLAN, '"e1"'));
  await useRemoteDoc.getState().open("a.md");
}
const serverNow = (text: string, etag: string) =>
  vi.mocked(ipc.remoteOpen).mockResolvedValue(note("a.md", text, etag));
const typeInto = (text: string) => useRemoteDoc.getState().edit(text);

it("a clean buffer takes the server's new text, keeps both versions equal, and says so", async () => {
  await planOpen();
  serverNow(PLAN.replace("one", "ONE"), '"e2"');
  const rev = useRemoteDoc.getState().doc!.externalRev;
  await useRemoteDoc.getState().sync();
  const d = useRemoteDoc.getState().doc!;
  expect(d.text).toBe(PLAN.replace("one", "ONE"));
  expect(d.etag).toBe('"e2"');
  expect(d.base).toBe(d.text);
  expect(d.externalRev).toBe(rev + 1);
  expect(dirty(d), "taking the server's text is not an edit").toBe(false);
  expect(d.status).toBe("saved");
  expect(d.synced?.kind).toBe("updated");
  expect(ipc.remoteSave).not.toHaveBeenCalled();
  expect(ipc.remoteMerge).not.toHaveBeenCalled();
});

it("nothing changes when the server's note is the one already held", async () => {
  await planOpen();
  const before = useRemoteDoc.getState().doc;
  await useRemoteDoc.getState().sync();
  expect(useRemoteDoc.getState().doc).toBe(before);
});

it("the same words under a new tag only take the tag, without a notice", async () => {
  await planOpen();
  serverNow(PLAN, '"e2"');
  await useRemoteDoc.getState().sync();
  const d = useRemoteDoc.getState().doc!;
  expect(d).toMatchObject({ etag: '"e2"', text: PLAN, synced: null });
});

it("unsent text and a change elsewhere in the note are joined, saved at the server's tag, and the cursor's note keeps its edit", async () => {
  await planOpen();
  const mine = PLAN.replace("seven", "SEVEN");
  typeInto(mine);
  const theirs = PLAN.replace("one", "ONE");
  serverNow(theirs, '"e2"');
  const joined = PLAN.replace("one", "ONE").replace("seven", "SEVEN");
  vi.mocked(ipc.remoteMerge).mockResolvedValue({ text: joined });
  vi.mocked(ipc.remoteSave).mockResolvedValue({ outcome: "saved", etag: '"e3"' } as ipc.RemoteSave);
  await useRemoteDoc.getState().sync();
  expect(ipc.remoteMerge).toHaveBeenCalledWith(PLAN, mine, theirs);
  await vi.waitFor(() => expect(ipc.remoteSave).toHaveBeenCalledWith("a.md", joined, '"e2"'));
  await vi.waitFor(() => expect(useRemoteDoc.getState().doc!.status).toBe("saved"));
  const d = useRemoteDoc.getState().doc!;
  expect(d).toMatchObject({ text: joined, etag: '"e3"', base: joined });
  expect(d.synced?.kind).toBe("merged");
});

it("unsent text over the same lines is a conflict with both versions, and nothing is overwritten", async () => {
  await planOpen();
  const mine = PLAN.replace("three", "mine");
  typeInto(mine);
  const theirs = PLAN.replace("three", "theirs");
  serverNow(theirs, '"e2"');
  vi.mocked(ipc.remoteMerge).mockResolvedValue({ text: null });
  await useRemoteDoc.getState().sync();
  const d = useRemoteDoc.getState().doc!;
  expect(d.status).toBe("conflict");
  expect(d.text).toBe(mine);
  expect(d.conflict).toMatchObject({ text: theirs, etag: '"e2"' });
  expect(ipc.remoteSave).not.toHaveBeenCalled();
});

it("a merge that fails is a conflict, never a lost edit", async () => {
  await planOpen();
  typeInto(PLAN.replace("three", "mine"));
  serverNow(PLAN.replace("four", "theirs"), '"e2"');
  vi.mocked(ipc.remoteMerge).mockRejectedValue({ code: "internal" });
  await useRemoteDoc.getState().sync();
  expect(useRemoteDoc.getState().doc!.status).toBe("conflict");
  expect(useRemoteDoc.getState().doc!.text).toBe(PLAN.replace("three", "mine"));
});

it("text typed while the merge runs is not replaced by its result", async () => {
  await planOpen();
  typeInto(PLAN.replace("seven", "SEVEN"));
  serverNow(PLAN.replace("one", "ONE"), '"e2"');
  let finish!: (m: { text: string | null }) => void;
  vi.mocked(ipc.remoteMerge).mockReturnValue(new Promise((r) => (finish = r)));
  const running = useRemoteDoc.getState().sync();
  await vi.waitFor(() => expect(ipc.remoteMerge).toHaveBeenCalled());
  const typed = PLAN.replace("seven", "SEVEN") + "more\n";
  typeInto(typed);
  finish({ text: "a merge of the text from before the last keystroke" });
  await running;
  expect(useRemoteDoc.getState().doc!.text).toBe(typed);
  expect(useRemoteDoc.getState().doc!.etag).toBe('"e1"');
});

it("an answer older than a save that finished meanwhile is dropped, not taken as a change", async () => {
  await planOpen();
  let answer!: (n: ipc.RemoteNote) => void;
  vi.mocked(ipc.remoteOpen).mockReturnValue(new Promise((r) => (answer = r)));
  const reading = useRemoteDoc.getState().sync();
  // Our own save lands while the read is on the wire.
  typeInto(PLAN + "x\n");
  vi.mocked(ipc.remoteSave).mockResolvedValue({ outcome: "saved", etag: '"e2"' } as ipc.RemoteSave);
  await useRemoteDoc.getState().save();
  answer(note("a.md", PLAN, '"e1"')); // the read began before the save
  await reading;
  expect(useRemoteDoc.getState().doc).toMatchObject({ text: PLAN + "x\n", etag: '"e2"', status: "saved" });
});

it("does not read over a save in flight, a conflict being decided, or a note that is gone", async () => {
  await planOpen();
  for (const status of ["writing", "conflict", "gone"] as const) {
    useRemoteDoc.setState((s) => ({ doc: s.doc && { ...s.doc, status } }));
    await useRemoteDoc.getState().sync();
  }
  expect(ipc.remoteOpen).toHaveBeenCalledTimes(1); // the open of a.md, and no more
});

it("a note deleted on the server is marked gone and keeps its text", async () => {
  await planOpen();
  typeInto(PLAN + "x\n");
  vi.mocked(ipc.remoteOpen).mockRejectedValue({ code: "not_found", path: "a.md" });
  await useRemoteDoc.getState().sync();
  expect(useRemoteDoc.getState().doc).toMatchObject({ status: "gone", text: PLAN + "x\n" });
});

it("failures stretch the wait, up to a minute, and a good read brings it back to ten seconds", async () => {
  await planOpen();
  expect(syncDelay()).toBe(SYNC_MS);
  vi.mocked(ipc.remoteOpen).mockRejectedValue({ code: "sync", cause: "offline" });
  const waits: number[] = [];
  for (let i = 0; i < 5; i++) {
    await useRemoteDoc.getState().sync();
    waits.push(syncDelay());
  }
  expect(waits).toEqual([20000, 40000, 60000, 60000, 60000]);
  vi.mocked(ipc.remoteOpen).mockResolvedValue(note("a.md", PLAN, '"e1"'));
  await useRemoteDoc.getState().sync();
  expect(syncDelay()).toBe(SYNC_MS);
});

it("a save the server refuses as stale is joined when it can be, and only then saved again", async () => {
  await planOpen();
  typeInto(PLAN.replace("seven", "SEVEN"));
  const current = note("a.md", PLAN.replace("one", "ONE"), '"e2"');
  const joined = PLAN.replace("one", "ONE").replace("seven", "SEVEN");
  vi.mocked(ipc.remoteSave)
    .mockResolvedValueOnce({ outcome: "conflict", current } as ipc.RemoteSave)
    .mockResolvedValueOnce({ outcome: "saved", etag: '"e3"' } as ipc.RemoteSave);
  vi.mocked(ipc.remoteMerge).mockResolvedValue({ text: joined });
  await useRemoteDoc.getState().save();
  await vi.waitFor(() => expect(ipc.remoteSave).toHaveBeenCalledTimes(2));
  expect(ipc.remoteSave).toHaveBeenLastCalledWith("a.md", joined, '"e2"');
  await vi.waitFor(() => expect(useRemoteDoc.getState().doc!.status).toBe("saved"));
});

it("a save refused over the same lines still shows the conflict screen, as before", async () => {
  await planOpen();
  typeInto(PLAN.replace("three", "mine"));
  const current = note("a.md", PLAN.replace("three", "theirs"), '"e2"');
  vi.mocked(ipc.remoteSave).mockResolvedValue({ outcome: "conflict", current } as ipc.RemoteSave);
  vi.mocked(ipc.remoteMerge).mockResolvedValue({ text: null });
  await useRemoteDoc.getState().save();
  expect(useRemoteDoc.getState().doc).toMatchObject({ status: "conflict", conflict: current });
});

it("keeping mine after a conflict starts the next merge from the server's text", async () => {
  await planOpen();
  typeInto(PLAN.replace("three", "mine"));
  const theirs = note("a.md", PLAN.replace("three", "theirs"), '"e2"');
  useRemoteDoc.setState((s) => ({ doc: s.doc && { ...s.doc, status: "conflict", conflict: theirs } }));
  vi.mocked(ipc.remoteSave).mockResolvedValue({ outcome: "saved", etag: '"e3"' } as ipc.RemoteSave);
  await useRemoteDoc.getState().resolve("mine");
  expect(useRemoteDoc.getState().doc).toMatchObject({ base: PLAN.replace("three", "mine"), etag: '"e3"' });
});
