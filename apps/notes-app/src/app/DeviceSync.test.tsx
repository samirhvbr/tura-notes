// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeviceSync, conditions } from "./DeviceSync";
import * as ipc from "../ipc";
import { useWorkspace } from "../stores/workspace";
vi.mock("../ipc", async original=>({...await original<typeof import("../ipc")>(),deviceStatus:vi.fn(),deviceConditions:vi.fn(async()=>{}),deviceConfigure:vi.fn(async()=>{}),devicePair:vi.fn(async()=>{}),devicePreview:vi.fn(),deviceConfirm:vi.fn(async()=>{}),deviceRun:vi.fn(async()=>{}),deviceApply:vi.fn(async()=>{}),deviceProbe:vi.fn()}));
vi.mock("@tauri-apps/plugin-dialog",()=>({open:vi.fn()}));
const empty:ipc.DeviceSnapshot={receive:false,connection:null,phase:"disabled",reason:null,pending:0,unapplied:0,history:[],conflicts:[]};
const old=useWorkspace.getState();
beforeEach(()=>{useWorkspace.setState({info:null});vi.mocked(ipc.deviceStatus).mockResolvedValue(empty);});
afterEach(()=>{cleanup();useWorkspace.setState(old);vi.clearAllMocks();});
function show(){render(<DeviceSync/>);fireEvent.click(screen.getByText(/Device sync/));}
it("treats unavailable network and power information as unknown",async()=>{
  expect(await conditions()).toEqual({online:true,metered:null,charging:null});
});
it("reconnects with scheduling disabled and preserves conservative limits",async()=>{
  show();
  fireEvent.change(screen.getByRole("textbox",{name:/Private sync queue folder/}),{target:{value:"/private/queue"}});
  fireEvent.change(screen.getByRole("textbox",{name:/Credential file/}),{target:{value:"/private/token"}});
  fireEvent.click(screen.getByRole("button",{name:"Reconnect existing queue"}));
  await waitFor(()=>expect(ipc.deviceConfigure).toHaveBeenCalledWith({state_dir:"/private/queue",token_file:"/private/token",enabled:false,interval_seconds:300,allow_metered:false,allow_battery:false,capture_saved:false,capture_new:false,capture_renames:false}));
  expect(ipc.deviceRun).not.toHaveBeenCalled();
});
it("names what is still missing instead of a grey button",async()=>{
  // Six preconditions, stated none of them: a filled-in field changed nothing
  // anyone could see, so the panel looked broken rather than incomplete.
  show();
  expect(screen.getByRole("button",{name:"Create pairing and review"})).toBeDisabled();
  expect(screen.getByText(/Still needed before pairing/)).toHaveTextContent("Local notes folder");
  expect(screen.getByText(/Still needed before pairing/)).toHaveTextContent("Server address");
  for(const [label,value] of [[/Local notes folder/,"/notes"],[/Private sync queue folder/,"/queue"],[/Credential file/,"/token"],[/Server address/,"https://tura.example"],[/^Server workspace$/,"personal"]] as const){
    fireEvent.change(screen.getByRole("textbox",{name:label}),{target:{value}});
  }
  expect(screen.queryByText(/Still needed before pairing/)).toBeNull();
  expect(screen.getByRole("button",{name:"Create pairing and review"})).toBeEnabled();
});
it("names the open workspace as the thing standing in the way",async()=>{
  useWorkspace.setState({info:{root:"/notes",name:"notes"} as never});
  show();
  for(const [label,value] of [[/Local notes folder/,"/notes"],[/Private sync queue folder/,"/queue"],[/Credential file/,"/token"],[/Server address/,"https://tura.example"],[/^Server workspace$/,"personal"]] as const){
    fireEvent.change(screen.getByRole("textbox",{name:label}),{target:{value}});
  }
  expect(screen.getByText(/Still needed before pairing/)).toHaveTextContent("close the workspace");
  expect(screen.getByRole("button",{name:"Create pairing and review"})).toBeDisabled();
});
const granted:ipc.SyncProbe={outcome:"granted",status:200,workspace:"personal",scope:null,permissions:["read","create"],review:false};
it("tests the connection with the workspace open and before a workspace name is known",async()=>{
  // The two questions the panel could not answer: is the server there, and what
  // is this credential for. Pairing answered both at once, in one of three
  // sentences, and only after the workspace had been closed.
  useWorkspace.setState({info:{root:"/notes",name:"notes"} as never});
  vi.mocked(ipc.deviceProbe).mockResolvedValue(granted);
  show();
  fireEvent.change(screen.getByRole("textbox",{name:/Server address/}),{target:{value:"https://tura.example"}});
  fireEvent.change(screen.getByRole("textbox",{name:/Credential file/}),{target:{value:"/token"}});
  const test=screen.getByRole("button",{name:"Test connection"});
  expect(test).toBeEnabled();
  fireEvent.click(test);
  await waitFor(()=>expect(screen.getByText(/Connected\./)).toBeInTheDocument());
  // The server named the workspace, so the owner does not have to guess it.
  expect(screen.getByRole("textbox",{name:/^Server workspace$/})).toHaveValue("personal");
});
it("reports a rejected credential as rejected, not as an unusable address",async()=>{
  vi.mocked(ipc.deviceProbe).mockResolvedValue({...granted,outcome:"refused",status:401,workspace:null,permissions:[]});
  show();
  fireEvent.change(screen.getByRole("textbox",{name:/Server address/}),{target:{value:"https://tura.example"}});
  fireEvent.change(screen.getByRole("textbox",{name:/Credential file/}),{target:{value:"/token"}});
  fireEvent.click(screen.getByRole("button",{name:"Test connection"}));
  await waitFor(()=>expect(screen.getByText(/rejected this credential/)).toBeInTheDocument());
  expect(screen.getByText(/rejected this credential/)).toHaveTextContent("HTTP 401");
});
it("says the verdict in a colour, not as one more grey sentence",async()=>{
  // It shipped without a rule in the stylesheet and rendered identically to the
  // advice above and below it — an answer indistinguishable from the question.
  vi.mocked(ipc.deviceProbe).mockResolvedValue(granted);
  show();
  fireEvent.change(screen.getByRole("textbox",{name:/Server address/}),{target:{value:"https://tura.example"}});
  fireEvent.change(screen.getByRole("textbox",{name:/Credential file/}),{target:{value:"/token"}});
  fireEvent.click(screen.getByRole("button",{name:"Test connection"}));
  await waitFor(()=>expect(screen.getByText(/Connected\./)).toHaveClass("device-probe","ok"));

  // A credential that works and needs review is not a pass: pairing refuses it.
  vi.mocked(ipc.deviceProbe).mockResolvedValue({...granted,review:true});
  fireEvent.click(screen.getByRole("button",{name:"Test connection"}));
  await waitFor(()=>expect(screen.getByText(/Connected\./)).toHaveClass("fix"));

  vi.mocked(ipc.deviceProbe).mockResolvedValue({...granted,outcome:"refused",status:401,workspace:null});
  fireEvent.click(screen.getByRole("button",{name:"Test connection"}));
  await waitFor(()=>expect(screen.getByText(/rejected this credential/)).toHaveClass("no"));
});
it("reports a workspace name that disagrees with the credential instead of replacing it",async()=>{
  vi.mocked(ipc.deviceProbe).mockResolvedValue(granted);
  show();
  fireEvent.change(screen.getByRole("textbox",{name:/Server address/}),{target:{value:"https://tura.example"}});
  fireEvent.change(screen.getByRole("textbox",{name:/Credential file/}),{target:{value:"/token"}});
  fireEvent.change(screen.getByRole("textbox",{name:/^Server workspace$/}),{target:{value:"work"}});
  fireEvent.click(screen.getByRole("button",{name:"Test connection"}));
  await waitFor(()=>expect(screen.getByText(/credential is for personal/)).toBeInTheDocument());
  expect(screen.getByRole("textbox",{name:/^Server workspace$/})).toHaveValue("work");
});
it("says so when a pairing succeeded",async()=>{
  // `task` clears the message and writes one only on failure, so a pairing that
  // worked was indistinguishable from a button that did nothing.
  vi.mocked(ipc.devicePreview).mockResolvedValue({confirmation:"c",rows:[],attachment_conflicts:[]});
  show();
  for(const [label,value] of [[/Local notes folder/,"/notes"],[/Private sync queue folder/,"/queue"],[/Credential file/,"/token"],[/Server address/,"https://tura.example"],[/^Server workspace$/,"personal"]] as const){
    fireEvent.change(screen.getByRole("textbox",{name:label}),{target:{value}});
  }
  fireEvent.click(screen.getByRole("button",{name:"Create pairing and review"}));
  await waitFor(()=>expect(screen.getByText(/Paired\./)).toBeInTheDocument());
});
it("requires review and refuses to confirm divergent pairing rows",async()=>{
  vi.mocked(ipc.devicePreview).mockResolvedValue({confirmation:"bound-snapshot",rows:[{action:"conflict",path:"a.md"}],attachment_conflicts:[]});
  show();
  for(const [label,value] of [[/Local notes folder/,"/notes"],[/Private sync queue folder/,"/queue"],[/Credential file/,"/token"],[/Server address/,"https://notes.example"],[/^Server workspace$/,"home"]] as const){fireEvent.change(screen.getByRole("textbox",{name:label}),{target:{value}});}
  fireEvent.click(screen.getByRole("button",{name:"Create pairing and review"}));
  const button=await screen.findByRole("button",{name:"Confirm this pairing"});
  expect(button).toBeDisabled();expect(ipc.deviceConfirm).not.toHaveBeenCalled();
  expect(ipc.devicePair).toHaveBeenCalledOnce();
});
it("does not apply received files while an editor workspace is open",async()=>{
  useWorkspace.setState({info:{id:"workspace",root:"/notes"} as ipc.WorkspaceInfo});
  vi.mocked(ipc.deviceStatus).mockResolvedValue({...empty,receive:true,phase:"pending",unapplied:2,connection:{state_dir:"/queue",token_file:"/token",enabled:false,interval_seconds:300,allow_metered:false,allow_battery:false,capture_saved:false,capture_new:false,capture_renames:false}});
  show();const apply=await screen.findByRole("button",{name:"Apply received files"});expect(apply).toBeDisabled();fireEvent.click(apply);expect(ipc.deviceApply).not.toHaveBeenCalled();
});

it("requires a separate opt-in to capture saved receiver edits",async()=>{
  vi.mocked(ipc.deviceStatus).mockResolvedValue({...empty,receive:true,connection:{state_dir:"/queue",token_file:"/token",enabled:false,interval_seconds:300,allow_metered:false,allow_battery:false,capture_saved:false,capture_new:false,capture_renames:false}});
  show();
  const capture=await screen.findByRole("checkbox",{name:/Publish saved edits/});
  expect(capture).not.toBeChecked();
  fireEvent.click(capture);
  fireEvent.click(screen.getByRole("button",{name:"Save transfer settings"}));
  await waitFor(()=>expect(ipc.deviceConfigure).toHaveBeenCalledWith(expect.objectContaining({capture_saved:true,enabled:false})));
  expect(ipc.deviceRun).not.toHaveBeenCalled();
});

it("keeps new-note and rename capture independent from saved edits",async()=>{
  vi.mocked(ipc.deviceStatus).mockResolvedValue({...empty,receive:true,connection:{state_dir:"/queue",token_file:"/token",enabled:false,interval_seconds:300,allow_metered:false,allow_battery:false,capture_saved:false,capture_new:false,capture_renames:false}});
  show();
  const newNotes=await screen.findByRole("checkbox",{name:/Publish new local notes/});
  const renames=screen.getByRole("checkbox",{name:/Publish recognized local renames/});
  expect(newNotes).not.toBeChecked();expect(renames).not.toBeChecked();
  fireEvent.click(newNotes);fireEvent.click(renames);
  fireEvent.click(screen.getByRole("button",{name:"Save transfer settings"}));
  await waitFor(()=>expect(ipc.deviceConfigure).toHaveBeenCalledWith(expect.objectContaining({capture_saved:false,capture_new:true,capture_renames:true,enabled:false})));
});
