// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { UpdateButton, UpdaterShell } from "./Updater";
import { useUpdater } from "../stores/updater";
import * as ipc from "../ipc";
vi.mock("../ipc", async original=>({...await original<typeof import("../ipc")>(),envReport:vi.fn()}));
const env={version:"1.3.9",copyright:"",os:"macos",arch:"aarch64",tauriVersion:"2",session:"other",nvidia:false,nouveau:false,dmabufApplied:false,dmabufExplanation:"not applicable — linux only",dataDir:"/data"};
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

/**
 * The failure hint has to be platform-specific or it is wrong somewhere.
 *
 * "Move it to Applications" means nothing on Linux; "installing a package needs
 * your password" means nothing on macOS. `1.6.69` shipped the macOS sentence to
 * everybody, which was wrong on the platform this is developed on — the kind of
 * wrong that survives review because the author never sees it. These three
 * assert the branch rather than the wording.
 */
it("gives macOS the advice that applies on macOS when an install fails",async()=>{
  useUpdater.setState({phase:"error",version:"1.4.0",detail:"Io Error: Invalid cross-device link (os error 18)"});
  render(<UpdaterShell><p>app</p></UpdaterShell>);
  await waitFor(()=>expect(screen.getByText(/move it to Applications/)).toBeInTheDocument());
  expect(screen.getByText("Io Error: Invalid cross-device link (os error 18)")).toBeInTheDocument();
});
it("gives Linux the advice that applies on Linux",async()=>{
  vi.mocked(ipc.envReport).mockResolvedValue({...env,os:"linux"});
  useUpdater.setState({phase:"error",version:"1.4.0",detail:"PackageInstallFailed"});
  render(<UpdaterShell><p>app</p></UpdaterShell>);
  await waitFor(()=>expect(screen.getByText(/needs your password/)).toBeInTheDocument());
  expect(screen.queryByText(/move it to Applications/)).toBeNull();
});
it("falls back to the neutral sentence when the platform cannot be read, and still shows the error",async()=>{
  vi.mocked(ipc.envReport).mockRejectedValue(new Error("no"));
  useUpdater.setState({phase:"error",version:"1.4.0",detail:"something specific"});
  render(<UpdaterShell><p>app</p></UpdaterShell>);
  expect(await screen.findByText("Nothing was installed. The error is below.")).toBeInTheDocument();
  expect(screen.getByText("something specific")).toBeInTheDocument();
});

it("turns our own refusal tokens into sentences, and keeps the token",async()=>{
  // `updater.rs` answers `update_workspace_open` and three others as bare
  // strings. Verbatim is right for the plugin's errors, which are not ours to
  // paraphrase; an identifier we wrote ourselves is not a reason.
  useUpdater.setState({phase:"error",version:"1.4.0",detail:"update_workspace_open"});
  render(<UpdateButton/>);
  await waitFor(()=>expect(screen.getByText(/A workspace was still open/)).toBeInTheDocument());
  expect(screen.getByText("update_workspace_open")).toBeInTheDocument();
});
it("still shows a plugin error it has no sentence for",async()=>{
  useUpdater.setState({phase:"error",version:"1.4.0",detail:"Invalid cross-device link (os error 18)"});
  render(<UpdateButton/>);
  await waitFor(()=>expect(screen.getByText("Invalid cross-device link (os error 18)")).toBeInTheDocument());
});
