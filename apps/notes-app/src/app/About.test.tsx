// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AboutDialog, engine } from "./About";
import * as ipc from "../ipc";
import { useWorkspace } from "../stores/workspace";
vi.mock("../ipc", async original=>({...await original<typeof import("../ipc")>(),envReport:vi.fn()}));
vi.mock("@tauri-apps/api/event",()=>({listen:vi.fn(async()=>()=>{})}));
const env={version:"1.4.0",copyright:"Copyright © 2026 Samir Hanna Verza. MIT licensed.",os:"macos",arch:"aarch64",tauriVersion:"2.11.5",session:"other",nvidia:false,nouveau:false,dmabufApplied:false,dmabufExplanation:"not applicable — linux only",dataDir:"/data/notes"};
const old=useWorkspace.getState();
beforeEach(()=>{vi.mocked(ipc.envReport).mockResolvedValue(env);useWorkspace.setState({info:null});});
afterEach(()=>{cleanup();useWorkspace.setState(old);vi.clearAllMocks();});

it("states the version, the engine, the data directory and the open workspace",async()=>{
  useWorkspace.setState({info:{root:"/Users/samir/Documents/X"} as never});
  render(<AboutDialog onClose={()=>{}}/>);
  await waitFor(()=>expect(screen.getByText("1.4.0")).toBeInTheDocument());
  expect(screen.getByText("macos / aarch64")).toBeInTheDocument();
  expect(screen.getByText(/Tauri 2\.11\.5 · WKWebView/)).toBeInTheDocument();
  expect(screen.getByText("/data/notes")).toBeInTheDocument();
  expect(screen.getByText("/Users/samir/Documents/X")).toBeInTheDocument();
  // From `bundle.copyright`, so the dialog and the installers cannot disagree.
  expect(screen.getByText(/Copyright © 2026 Samir Hanna Verza/)).toBeInTheDocument();
});
it("says no workspace is open rather than leaving the row blank",async()=>{
  render(<AboutDialog onClose={()=>{}}/>);
  await waitFor(()=>expect(screen.getByText("none open")).toBeInTheDocument());
});
it("copies the same lines it shows",async()=>{
  // Built from the rendered rows, so the paste cannot drift from the screen.
  const writeText=vi.fn(async(_text:string)=>{});
  Object.assign(navigator,{clipboard:{writeText}});
  render(<AboutDialog onClose={()=>{}}/>);
  await waitFor(()=>expect(screen.getByRole("button",{name:"Copy"})).toBeEnabled());
  fireEvent.click(screen.getByRole("button",{name:"Copy"}));
  await waitFor(()=>expect(writeText).toHaveBeenCalledOnce());
  const text=writeText.mock.calls[0][0];
  expect(text).toContain("Version: 1.4.0");
  expect(text).toContain("Data: /data/notes");
  expect(text).toContain("Workspace: none open");
});
it("reads the engine from the user agent, and never calls WebView2 WebKit",()=>{
  // WebView2's user agent carries AppleWebKit too; matching that first would
  // report every Windows install as WebKit.
  const windows="Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";
  expect(engine("windows",windows)).toBe("WebView2 (Chromium 130.0.0.0)");
  expect(engine("macos","Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko)")).toBe("WKWebView (WebKit 605.1.15)");
  expect(engine("linux","Mozilla/5.0 (X11; Linux) AppleWebKit/605.1.15 (KHTML, like Gecko)")).toBe("WebKitGTK (WebKit 605.1.15)");
  expect(engine("macos","something else entirely")).toBe("WKWebView");
});
