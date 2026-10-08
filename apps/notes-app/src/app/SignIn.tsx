import { useState } from "react";
import * as ipc from "../ipc";
import { t } from "../i18n";
import { remoteErrorText } from "../remote/errorText";

const SITE_KEY = "tura-site";

/**
 * Signing in to the owner's site to get this device's connection (ADR-105,
 * `docs/PAIRING.md`), instead of typing an address and finding a credential file.
 *
 * Shared by the remote folder's panel and by Device sync, which differ only in
 * what they do with the answer: this component opens the site, takes the address
 * the browser comes back to, finishes the sign-in, and hands the `Paired` it got to
 * `onPaired`. The credential itself was put in the system keychain inside Rust and
 * is never here: `Paired` is where to connect and a `keychain:` name.
 */
export function SignIn({
  allowPrivate,
  signedIn,
  onPaired,
  onSignedOut,
}: {
  allowPrivate: boolean;
  /** This device already has the site's credential. */
  signedIn: boolean;
  /** Use the answer. It may fail; the sign-in then reports it and is over. */
  onPaired: (paired: ipc.Paired) => Promise<void> | void;
  /** The key was forgotten on this device; undo whatever depended on it. */
  onSignedOut: () => Promise<void> | void;
}) {
  const [site, setSite] = useState(() => {
    try {
      return localStorage.getItem(SITE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [label, setLabel] = useState(() => t("remote.signin.thisDevice"));
  const [waiting, setWaiting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      const error = ipc.asCoreError(e);
      // A code is single-use: whatever went wrong, this sign-in is over and the
      // next one is a new request.
      setWaiting(false);
      setPasted("");
      setMessage(
        error.code === "sync" && error.cause === "denied"
          ? t("remote.signin.denied")
          : error.code === "sync" && error.cause === "invalid"
            ? t("remote.signin.invalid")
            : remoteErrorText(error),
      );
    } finally {
      setBusy(false);
    }
  }
  const start = () =>
    run(async () => {
      const url = await ipc.pairBegin(site.trim(), label.trim(), allowPrivate);
      try {
        localStorage.setItem(SITE_KEY, site.trim());
      } catch {
        /* Only a convenience for next time. */
      }
      setWaiting(true);
      await ipc.shellOpen(url);
    });
  const finish = () =>
    run(async () => {
      const paired = await ipc.pairFinish(pasted.trim());
      await onPaired(paired);
      setWaiting(false);
      setPasted("");
      setMessage(t("remote.signin.done", { label: paired.label }));
    });
  const signOut = () =>
    run(async () => {
      await ipc.pairSignOut();
      await onSignedOut();
      setMessage(t("remote.signin.signedOut"));
    });

  return (
    <fieldset className="remote-connect" disabled={busy}>
      <legend>{t("remote.signin.title")}</legend>
      <p className="muted">{t("remote.signin.explain")}</p>
      {!waiting ? (
        <>
          <label>
            {t("remote.signin.site")}
            <input
              type="url"
              placeholder="https://example.com"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            />
          </label>
          <label>
            {t("remote.signin.label")}
            <input value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <div className="device-actions">
            <button type="button" disabled={!site.trim() || !label.trim()} onClick={() => void start()}>
              {t("remote.signin.go")}
            </button>
            {signedIn && (
              <button type="button" onClick={() => void signOut()}>
                {t("remote.signin.out")}
              </button>
            )}
          </div>
          {signedIn && <p className="muted">{t("remote.signin.outNote")}</p>}
        </>
      ) : (
        <>
          <p>{t("remote.signin.waiting")}</p>
          <label>
            {t("remote.signin.paste")}
            <input
              value={pasted}
              placeholder="tura://pair?code=…&state=…"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setPasted(e.target.value)}
            />
          </label>
          <div className="device-actions">
            <button type="button" disabled={!pasted.trim()} onClick={() => void finish()}>
              {t("remote.signin.finish")}
            </button>
            <button
              type="button"
              onClick={() => {
                setWaiting(false);
                setPasted("");
              }}
            >
              {t("remote.cancel")}
            </button>
          </div>
        </>
      )}
      {!!message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
    </fieldset>
  );
}
