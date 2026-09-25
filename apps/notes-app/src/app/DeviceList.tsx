import { useCallback, useEffect, useState } from "react";
import * as ipc from "../ipc";
import { t } from "../i18n";
import { errorText } from "./StatusBar";

/**
 * The paired workspace's sync devices, with *Revoke* on each one that is not
 * this device (ADR-096).
 *
 * Shown only when this device's credential was granted `devices`. Without it
 * the server answers 403, the list resolves `null`, and the panel shows nothing
 * rather than an error: most credentials never get the permission, and a
 * refusal on every open would read as something broken.
 *
 * Revocation is confirmed in place, never in a blocking dialog, and the
 * confirmation says what it does: the other device stops syncing until the
 * operator issues it a new credential on the host. Nothing is deleted, and
 * retiring the device, which does delete its receipts, stays on the host.
 */
export function DeviceList() {
  const [devices, setDevices] = useState<ipc.SyncDevice[] | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try { setDevices(await ipc.deviceList()); }
    catch (e) { setMessage(errorText(ipc.asCoreError(e))); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!devices) return message ? <p role="status">{message}</p> : null;
  async function revoke(device: ipc.SyncDevice) {
    setBusy(true); setMessage("");
    try {
      const row = await ipc.deviceRevoke(device.device);
      setDevices(list => list?.map(d => d.device === row.device ? row : d) ?? null);
      setMessage(t("device.list.revoked", { label: device.label || t("device.list.unnamed") }));
    } catch (e) { setMessage(errorText(ipc.asCoreError(e))); }
    finally { setBusy(false); setAsking(null); }
  }
  const state = (d: ipc.SyncDevice) =>
    d.yours ? t("device.list.this") : d.revoked ? t("device.list.revokedState") : t("device.list.active");
  return <section className="device-list"><h3>{t("device.list.title")}</h3>
    <ul>{devices.map(d => <li key={d.device}>
      <span title={d.device}>{d.label || t("device.list.unnamed")} · {state(d)} · {t("device.list.receipts", { count: d.receipts })}</span>
      {!d.yours && !d.revoked && (asking === d.device
        ? <span className="device-confirm" role="group" aria-label={t("device.list.revoke")}>
            {t("device.list.confirm", { label: d.label || t("device.list.unnamed") })}
            <button disabled={busy} onClick={() => void revoke(d)}>{t("device.list.revokeConfirm")}</button>
            <button disabled={busy} onClick={() => setAsking(null)}>{t("device.list.cancel")}</button>
          </span>
        : <button disabled={busy} onClick={() => setAsking(d.device)}>{t("device.list.revoke")}</button>)}
    </li>)}</ul>
    <button disabled={busy} onClick={() => void load()}>{t("device.list.refresh")}</button>
    {!!message && <p role="status" aria-live="polite">{message}</p>}
  </section>;
}
