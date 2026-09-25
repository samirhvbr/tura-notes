// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeviceList } from "./DeviceList";
import * as ipc from "../ipc";
vi.mock("../ipc", async original => ({ ...await original<typeof import("../ipc")>(), deviceList: vi.fn(), deviceRevoke: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const laptop: ipc.SyncDevice = { device: "11111111-1111-4111-8111-111111111111", label: "laptop", receipts: 4, revoked: false, yours: true };
const phone: ipc.SyncDevice = { device: "22222222-2222-4222-8222-222222222222", label: "phone", receipts: 2, revoked: false, yours: false };

it("shows nothing when this credential was not granted devices", async () => {
  vi.mocked(ipc.deviceList).mockResolvedValue(null);
  const { container } = render(<DeviceList />);
  await waitFor(() => expect(ipc.deviceList).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

it("never offers to revoke this device, and asks before revoking another", async () => {
  vi.mocked(ipc.deviceList).mockResolvedValue([laptop, phone]);
  vi.mocked(ipc.deviceRevoke).mockResolvedValue({ ...phone, revoked: true });
  render(<DeviceList />);
  await screen.findByText(/phone · active · 2 receipts/);
  expect(screen.getByText(/laptop · this device/)).toBeInTheDocument();
  // One Revoke button: the phone's. This device has none.
  const revoke = screen.getAllByRole("button", { name: "Revoke" });
  expect(revoke).toHaveLength(1);
  fireEvent.click(revoke[0]);
  expect(ipc.deviceRevoke).not.toHaveBeenCalled();
  expect(screen.getByText(/stops syncing until a new credential is issued/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Revoke it" }));
  await screen.findByText(/“phone” was revoked/);
  expect(ipc.deviceRevoke).toHaveBeenCalledWith(phone.device);
  expect(screen.getByText(/phone · revoked/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
});

it("says why when the server refuses", async () => {
  vi.mocked(ipc.deviceList).mockResolvedValue([laptop, phone]);
  vi.mocked(ipc.deviceRevoke).mockRejectedValue({ code: "sync", cause: "own_device" });
  render(<DeviceList />);
  fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
  fireEvent.click(screen.getByRole("button", { name: "Revoke it" }));
  await screen.findByText(/cannot revoke its own credential/);
});
