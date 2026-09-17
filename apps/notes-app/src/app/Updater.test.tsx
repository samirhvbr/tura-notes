// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { UpdateButton, UpdaterShell } from "./Updater";
import { useUpdater } from "../stores/updater";
import * as ipc from "../ipc";
vi.mock("../ipc", async original=>({...await original<typeof import("../ipc")>(),envReport:vi.fn()}));
const env={version:"1.3.9",os:"macos",arch:"aarch64",tauriVersion:"2",session:"other",nvidia:false,nouveau:false,dmabufApplied:false,dmabufExplanation:"not applicable — linux only",dataDir:"/data"};
beforeEach(()=>{vi.mocked(ipc.envReport).mockResolvedValue(env);useUpdater.setState({phase:"idle",version:null,notes:null});});
afterEach(()=>{cleanup();vi.clearAllMocks();});

it("says which version is running, on the screen that offers a new one",async()=>{
  render(<UpdateButton/>);
  await waitFor(()=>expect(screen.getByText("You are running 1.3.9.")).toBeInTheDocument());
});
it("puts the running version beside the offered one in the banner",async()=>{
  // "Tura Notes update 1.3.6" over an app already on 1.3.6 reads as a loop
  // rather than as an offer; the sentence needs both halves.
  useUpdater.setState({phase:"available",version:"1.4.0",notes:"New release"});
  render(<UpdaterShell><p>app</p></UpdaterShell>);
  await waitFor(()=>expect(screen.getByText(/Tura Notes update 1\.4\.0/)).toBeInTheDocument());
  expect(screen.getByText("You are running 1.3.9.")).toBeInTheDocument();
});
it("renders without a version rather than failing when diagnostics cannot be read",async()=>{
  // One line missing beats a panel that does not come up.
  vi.mocked(ipc.envReport).mockRejectedValue(new Error("no"));
  render(<UpdateButton/>);
  expect(await screen.findByRole("button",{name:"Check for updates"})).toBeInTheDocument();
  expect(screen.queryByText(/You are running/)).toBeNull();
});
