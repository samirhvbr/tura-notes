import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import * as ipc from "../ipc";
import { changeRemoteConnection, useRemote } from "./remote";
import { resetRemoteDocTimers, useRemoteDoc } from "./remoteDoc";
import { useEditor, type OpenDoc } from "./editor";
import { acquireSyncBarrier, endSyncBarrier, isSyncBarrierBusy, isSyncLocked } from "../ipc/barrier";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const initial = useRemote.getState();
const docInitial = useRemoteDoc.getState();
const localInitial = useEditor.getState();
const config: ipc.RemoteConfig = {
  origin:"https://notes.example",workspace:"first",token_file:"/private/first",allow_private:false,
};
const note: ipc.RemoteNote = {path:"case.md",text:"saved",etag:'"same"',read_only:null};
const empty: ipc.RemoteTree = {entries:[],folders:[],folders_supported:true,folders_truncated:false};
const localRev: ipc.BaseRev = {hash:"b3:base",mtime_ns:"1",size:5};
let snapshot = {config:config as ipc.RemoteConfig | null,session:"first-session"};

function editLocal(conflict = false) {
  const doc: OpenDoc = {
    noteId:"local" as ipc.NoteId,path:"local.md" as ipc.RelPath,text:"saved",
    baseRev:localRev,readOnly:null,bufferVersion:0,savedVersion:0,status:conflict ? "conflict" : "saved",
    externalRev:0,conflict:conflict ? localRev : null,draft:null,lastError:null,
  };
  useEditor.setState({doc,autosaveMs:750});
  useEditor.getState().edit("pending local text");
}

beforeEach(() => {
  snapshot = {config,session:"first-session"};
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "remote_config_get") return snapshot;
    if (command === "remote_open") return note;
    if (command === "remote_list") return empty;
    throw new Error(`Unexpected command ${command}`);
  });
});
afterEach(async () => {
  resetRemoteDocTimers();
  endSyncBarrier();
  useRemote.setState(initial,true);
  useRemoteDoc.setState(docInitial,true);
  useEditor.setState(localInitial,true);
  if (vi.isFakeTimers()) {
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  }
  vi.clearAllMocks();
  await new Promise(resolve=>setTimeout(resolve,0));
});

it.each([
  { outcome: "success", conflict: false },
  { outcome: "failure", conflict: false },
  { outcome: "success", conflict: true },
  { outcome: "failure", conflict: true },
])("resumes local persistence after transition $outcome with conflict=$conflict", async ({outcome,conflict}) => {
  vi.useFakeTimers();
  const rev = localRev;
  vi.mocked(invoke).mockImplementation(async (command,args) => {
    const fields = args as Record<string,unknown> | undefined;
    if (command === "remote_config_get") return {config:null,session:"local-transition"};
    if (command === "note_save") {
      return {result:"saved",base_rev:rev,buffer_version:fields?.bufferVersion,unchanged:false};
    }
    if (command === "draft_write") {
      return {
        schema:1,note_id:fields?.noteId,path:"local.md",buffer_version:fields?.bufferVersion,
        base_rev:rev,reason:fields?.reason,written_at:"2026-11-12T00:00:00Z",
      };
    }
    throw new Error(`Unexpected command ${command}`);
  });
  useRemote.setState({config:null,entries:[],changing:false});
  editLocal(conflict);
  let release!: () => void;
  let started = false;
  const hold = new Promise<void>(resolve => {release=resolve;});
  const refusal: ipc.CoreError = {code:"sync",cause:"denied"};
  const transition = changeRemoteConnection(async () => {
    started=true;
    await hold;
    if (outcome === "failure") throw refusal;
  }).catch(error => error);
  await vi.waitFor(() => expect(started).toBe(true));
  expect(isSyncLocked()).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  const writes = () => vi.mocked(invoke).mock.calls.filter(([command]) =>
    command === "note_save" || command === "draft_write");
  expect(writes()).toHaveLength(0);
  release();
  const result = await transition;
  expect(result).toEqual(outcome === "failure" ? refusal : undefined);
  expect(isSyncLocked()).toBe(false);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(writes()).toHaveLength(1);
  expect(writes()[0][0]).toBe(conflict ? "draft_write" : "note_save");
  expect(useEditor.getState().doc).toMatchObject({path:"local.md",text:"pending local text",bufferVersion:1});
  if (conflict) expect(useEditor.getState().doc?.draft?.buffer_version).toBe(1);
  else expect(useEditor.getState().doc?.savedVersion).toBe(1);
});

it("resumes local autosave when a remote transition times out while claiming the barrier", async () => {
  vi.useFakeTimers();
  let answer!: (note: ipc.RemoteNote) => void;
  const pendingRead = new Promise<ipc.RemoteNote>(resolve => {answer=resolve;});
  vi.mocked(invoke).mockImplementation(async (command,args) => {
    const fields = args as Record<string,unknown> | undefined;
    if (command === "remote_open") return pendingRead;
    if (command === "note_save") {
      return {result:"saved",base_rev:localRev,buffer_version:fields?.bufferVersion,unchanged:false};
    }
    throw new Error(`Unexpected command ${command}`);
  });
  useRemote.setState({config:null,entries:[],changing:false});
  editLocal();
  const reading = ipc.remoteOpen("slow.md");
  const work = vi.fn(async () => {});
  const transition = changeRemoteConnection(work).catch(error => error);
  expect(isSyncBarrierBusy()).toBe(true);
  expect(isSyncLocked()).toBe(false);
  await vi.advanceTimersByTimeAsync(5005);
  expect(await transition).toEqual({code:"sync",cause:"busy"});
  expect(work).not.toHaveBeenCalled();
  answer(note);
  await reading;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(isSyncBarrierBusy()).toBe(false);
  expect(vi.mocked(invoke).mock.calls.filter(([command]) => command === "note_save")).toHaveLength(1);
  expect(useEditor.getState().doc).toMatchObject({text:"pending local text",bufferVersion:1,savedVersion:1});
});

it("leaves local persistence to an existing barrier claimant", async () => {
  vi.useFakeTimers();
  let answer!: (note: ipc.RemoteNote) => void;
  const pendingRead = new Promise<ipc.RemoteNote>(resolve => {answer=resolve;});
  vi.mocked(invoke).mockImplementation(async command => {
    if (command === "remote_open") return pendingRead;
    throw new Error(`Unexpected command ${command}`);
  });
  useRemote.setState({config:null,entries:[],changing:false});
  editLocal();
  const reading = ipc.remoteOpen("slow.md");
  const claimant = acquireSyncBarrier();
  expect(isSyncBarrierBusy()).toBe(true);
  expect(isSyncLocked()).toBe(false);
  await expect(changeRemoteConnection(async () => {})).rejects.toEqual({code:"sync",cause:"busy"});
  expect(vi.mocked(invoke).mock.calls.filter(([command]) => command === "note_save")).toHaveLength(0);
  answer(note);
  await reading;
  await vi.advanceTimersByTimeAsync(10);
  expect(await claimant).toBe(true);
  endSyncBarrier();
});

it("refuses a remote transition owner before the input barrier is held",async()=>{
  await expect(Promise.resolve().then(()=>ipc.beginRemoteChange()))
    .rejects.toEqual({code:"sync",cause:"busy"});
});

it("drains an old read and freezes remote edits before installing the new session",async()=>{
  await useRemote.getState().hydrate();
  await useRemoteDoc.getState().open(note.path);
  const before=useRemoteDoc.getState().doc;
  let answer!: (tree:ipc.RemoteTree)=>void;
  const outstanding=new Promise<ipc.RemoteTree>(resolve=>{answer=resolve;});
  const next={...config,workspace:"second"};
  vi.mocked(invoke).mockImplementation(async (command,args) => {
    if (command === "remote_config_get") return snapshot;
    if (command === "remote_config_set") {
      expect(args).toEqual({config:next,session:"first-session"});
      snapshot={config:next,session:"second-session"};
      return snapshot;
    }
    if (command === "remote_list") {
      if (snapshot.session === "first-session") return outstanding;
      return empty;
    }
    throw new Error(`Unexpected command ${command}`);
  });
  const read=useRemote.getState().refresh();
  const switching=useRemote.getState().configure(next);
  useRemoteDoc.getState().edit("typing while changing");
  expect(useRemoteDoc.getState().doc).toBe(before);
  expect(invoke).not.toHaveBeenCalledWith("remote_config_set",expect.anything());
  answer({...empty,entries:[{path:"old.md",size:1,etag:'"old"',local:"unknown"}]});
  await read;
  await switching;
  expect(useRemote.getState()).toMatchObject({config:next,entries:[],changing:false});
  expect(useRemoteDoc.getState()).toMatchObject({doc:null,tabs:[]});
  expect(ipc.remoteSessionId()).toBe("second-session");
});

it("keeps the original clean editor and connection after a refused configuration change",async()=>{
  await useRemote.getState().hydrate();
  await useRemoteDoc.getState().open(note.path);
  const before=useRemoteDoc.getState().doc;
  const refusal:ipc.CoreError={code:"sync",cause:"invalid"};
  vi.mocked(invoke).mockImplementation(async (command,args) => {
    if (command === "remote_config_get") return snapshot;
    if (command === "remote_config_set") throw refusal;
    if (command === "remote_save") {
      expect(args).toEqual({path:note.path,text:"new",etag:note.etag,session:"first-session"});
      return {outcome:"saved",etag:'"new"'};
    }
    throw new Error(`Unexpected command ${command}`);
  });
  await expect(useRemote.getState().configure({...config,workspace:"invalid"})).rejects.toEqual(refusal);
  expect(useRemote.getState().config).toBe(config);
  expect(useRemoteDoc.getState().doc).toBe(before);
  useRemoteDoc.getState().edit("new");
  await useRemoteDoc.getState().save();
  expect(useRemoteDoc.getState().doc?.savedVersion).toBe(1);
});
