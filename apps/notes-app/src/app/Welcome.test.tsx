// @vitest-environment jsdom
import {cleanup,render,screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach,expect,it,vi} from "vitest";
import {Welcome} from "./Welcome";
import * as ipc from "../ipc";
import {useWorkspace} from "../stores/workspace";
import {useDialog} from "./dialog";
vi.mock("@tauri-apps/plugin-dialog",()=>({open:vi.fn(async()=>"/chosen")}));
vi.mock("../ipc",async importOriginal=>({...await importOriginal<typeof import("../ipc")>(),workspaceRecent:vi.fn(async()=>[]),sandboxRoot:vi.fn(async()=>null as string|null),workspaceCreate:vi.fn(async()=>({id:"workspace"})),workspaceOpen:vi.fn(),workspaceForget:vi.fn(async()=>{}),appDataRemove:vi.fn(async()=>{})}));
const home={id:"w1",root:"/home/me/notes",display_name:"notes",last_opened:"0"} as unknown as ipc.WorkspaceEntry;
afterEach(()=>{cleanup();useDialog.getState().settle(null);vi.clearAllMocks();});
it("creates a workspace through the initial screen's visible naming dialog",async()=>{
 const adopt=vi.fn(async()=>{});useWorkspace.setState({adopt,error:null});
 const user=userEvent.setup();render(<Welcome/>);
 await user.click(screen.getByRole("button",{name:/Create Workspace/}));
 const input=await screen.findByRole("textbox");await user.clear(input);await user.type(input,"my notes");
 await user.click(screen.getByRole("button",{name:"Create"}));
 expect(ipc.workspaceCreate).toHaveBeenCalledWith("/chosen","my notes");expect(adopt).toHaveBeenCalled();
});
it("cancelling creation leaves the filesystem operation uncalled",async()=>{
 const user=userEvent.setup();render(<Welcome/>);await user.click(screen.getByRole("button",{name:/Create Workspace/}));
 await screen.findByRole("textbox");await user.keyboard("{Escape}");expect(ipc.workspaceCreate).not.toHaveBeenCalled();
});
// ADR-091: forgetting a workspace happens only after confirming, and the list follows.
it("forgets a recent workspace only after confirmation",async()=>{
 vi.mocked(ipc.workspaceRecent).mockResolvedValueOnce([home]).mockResolvedValue([]);
 const user=userEvent.setup();render(<Welcome/>);
 await user.click(await screen.findByRole("button",{name:"Forget notes?"}));
 expect(ipc.workspaceForget).not.toHaveBeenCalled();
 await user.click(await screen.findByRole("button",{name:"Forget"}));
 expect(ipc.workspaceForget).toHaveBeenCalledWith("w1");
 expect(screen.queryByRole("button",{name:"Forget notes?"})).toBeNull();
});
it("says why the app data was not removed when a draft is unsaved",async()=>{
 vi.mocked(ipc.appDataRemove).mockRejectedValueOnce({code:"drafts_pending",count:2});
 const user=userEvent.setup();render(<Welcome/>);
 await user.click(screen.getByRole("button",{name:"Remove Tura's data…"}));
 await user.click(await screen.findByRole("button",{name:"Remove and restart"}));
 expect(ipc.appDataRemove).toHaveBeenCalled();
 expect((await screen.findByRole("alert")).textContent).toContain("2 note(s) have unsaved drafts");
});
// Mobile has no folder chooser: the dialog plugin refuses a directory pick there,
// so the sandbox is the folder and the picker must not be consulted at all.
it("creates and opens inside the sandbox where no folder chooser exists",async()=>{
 const{open}=await import("@tauri-apps/plugin-dialog");
 const docs="/var/mobile/Containers/Data/Application/X/Documents";
 vi.mocked(ipc.sandboxRoot).mockResolvedValueOnce(docs).mockResolvedValueOnce(docs);
 vi.mocked(ipc.workspaceOpen).mockResolvedValue({id:"w2"} as unknown as ipc.WorkspaceInfo);
 const adopt=vi.fn(async()=>{});useWorkspace.setState({adopt,error:null});
 const user=userEvent.setup();render(<Welcome/>);
 await user.click(screen.getByRole("button",{name:/Create Workspace/}));
 await user.click(await screen.findByRole("button",{name:"Create"}));
 expect(ipc.workspaceCreate).toHaveBeenCalledWith(docs,"notes");
 await user.click(screen.getByRole("button",{name:/Open Folder/}));
 expect(ipc.workspaceOpen).toHaveBeenCalledWith(docs);
 expect(open).not.toHaveBeenCalled();
});
