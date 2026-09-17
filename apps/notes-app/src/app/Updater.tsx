import { useEffect, useState, type ReactNode } from "react";
import { useUpdater } from "../stores/updater";
import * as ipc from "../ipc";
import { t } from "../i18n";

/**
 * The version this process is running.
 *
 * Read once, because it cannot change while the process lives — installing an
 * update replaces the process. Never fatal: an update screen with one line
 * missing is better than one that fails to render, and a version nobody can
 * read is the whole complaint this answers.
 */
function useRunning(): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => { ipc.envReport().then(r => setVersion(r.version)).catch(() => {}); }, []);
  return version;
}

export function UpdateButton() {
  const { phase, check } = useUpdater();
  const running = useRunning();
  return <div className="update-manual">
    {running && <p className="update-running">{t("update.running", { version: running })}</p>}
    <button type="button" disabled={phase === "checking" || phase === "installing"} onClick={() => void check(true)}>{t("update.check")}</button>
    {["checking", "current", "unsupported", "error"].includes(phase) && <p role="status">{t(`update.${phase}`)}</p>}
  </div>;
}

export function UpdaterShell({ children }: { children: ReactNode }) {
  const { phase, version, notes, check, dismiss, install } = useUpdater();
  const running = useRunning();
  useEffect(() => {
    const initial = setTimeout(() => void check(), 20_000);
    const periodic = setInterval(() => void check(), 6 * 60 * 60 * 1000);
    return () => { clearTimeout(initial); clearInterval(periodic); };
  }, [check]);
  const visible = version && ["available", "closeWorkspace", "error", "installing"].includes(phase);
  return <>{children}{visible && <aside className="update-banner" aria-label={t("update.title")}>
    <strong>{t("update.title")} {version}</strong>
    {/* Which version is being offered is only half the sentence. Without the
        one you are on, "Tura Notes update 1.3.6" over an app that is already
        1.3.6 reads as a loop rather than as an offer. */}
    {running && <p className="update-running">{t("update.running", { version: running })}</p>}
    {notes && <p>{notes}</p>}
    <p role="status">{t(`update.${phase === "available" ? "confirm" : phase}`)}</p>
    {phase !== "installing" && <div className="actions">
      <button type="button" onClick={() => void install()}>{t("update.install")}</button>
      <button type="button" onClick={dismiss}>{t("update.later")}</button>
    </div>}
  </aside>}</>;
}
