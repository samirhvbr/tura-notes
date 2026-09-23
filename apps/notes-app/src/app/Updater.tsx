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

/**
 * Which platform's advice to give when an installation fails.
 *
 * The hint has to be platform-specific or it is wrong somewhere: *"move it to
 * Applications"* means nothing on Linux, and *"a package install needs your
 * password"* means nothing on macOS. `1.6.69` shipped one sentence carrying the
 * macOS advice to everybody, which was an improvement over blaming the
 * connection and still wrong on the platform this is developed on.
 *
 * `env_report` already answers this — `std::env::consts::OS`, so `"macos"` or
 * `"linux"` — and the banner already calls it. Unknown or unreachable falls
 * back to the neutral sentence, and the verbatim error is shown either way:
 * it is the part that does not depend on guessing right.
 */
function useErrorKey(): string {
  const [os, setOs] = useState<string | null>(null);
  useEffect(() => { ipc.envReport().then(r => setOs(r.os)).catch(() => {}); }, []);
  return os === "macos" || os === "linux" ? `update.error.${os}` : "update.error";
}

/**
 * The message the failure actually carried.
 *
 * Shown verbatim and untranslated, under the sentence that is translated. It
 * comes from the updater plugin through `update_install`, so it names the real
 * cause — `EXDEV` on a rename, or *"Failed to move the new app into place"* —
 * and it is the half of the report that makes the difference between retrying
 * forever and moving the application to `/Applications`. Not translated because
 * it is not ours to translate, and a paraphrase of an error is a second error.
 */
/**
 * The refusals the Rust half answers with are **tokens**, not sentences.
 *
 * `updater.rs` returns `update_workspace_open`, `update_unavailable`,
 * `update_unsupported` and `update_busy` as bare strings, and `1.6.69` printed
 * whatever arrived verbatim — which for these four means a reader gets an
 * identifier where a reason belongs. Verbatim is right for the *plugin's* own
 * errors, which are not ours to paraphrase; it is not right for our own.
 *
 * So a token we wrote gets the sentence we meant, and the token stays
 * underneath: it is still the string somebody pastes into a report.
 */
const explained: Record<string, string> = {
  update_workspace_open: "update.detail.update_workspace_open",
  update_unavailable: "update.detail.update_unavailable",
  update_unsupported: "update.detail.update_unsupported",
  update_busy: "update.detail.update_busy",
};

function Detail({ detail }: { detail: string | null }) {
  if (!detail) return null;
  const key = explained[detail.trim()];
  return <>
    {key && <p role="status">{t(key)}</p>}
    <p className="update-detail"><code>{detail}</code></p>
  </>;
}

export function UpdateButton() {
  const { phase, detail, check } = useUpdater();
  const running = useRunning();
  const errorKey = useErrorKey();
  return <div className="update-manual">
    {running && <p className="update-running">{t("update.running", { version: running })}</p>}
    <button type="button" disabled={phase === "checking" || phase === "installing"} onClick={() => void check(true)}>{t("update.check")}</button>
    {["checking", "current", "unsupported", "relocate", "busy"].includes(phase) && <p role="status">{t(`update.${phase}`)}</p>}
    {phase === "error" && <><p role="status">{t(errorKey)}</p><Detail detail={detail} /></>}
  </div>;
}

export function UpdaterShell({ children }: { children: ReactNode }) {
  const { phase, version, notes, detail, check, dismiss, install } = useUpdater();
  const running = useRunning();
  const errorKey = useErrorKey();
  useEffect(() => {
    const initial = setTimeout(() => void check(), 20_000);
    const periodic = setInterval(() => void check(), 6 * 60 * 60 * 1000);
    return () => { clearTimeout(initial); clearInterval(periodic); };
  }, [check]);
  const visible = version && ["available", "closeWorkspace", "error", "busy", "installing"].includes(phase);
  return <>{children}{visible && <aside className="update-banner" aria-label={t("update.title")}>
    <strong>{t("update.title")} {version}</strong>
    {/* Which version is being offered is only half the sentence. Without the
        one you are on, "Tura Notes update 1.3.6" over an app that is already
        1.3.6 reads as a loop rather than as an offer. */}
    {running && <p className="update-running">{t("update.running", { version: running })}</p>}
    {notes && <p>{notes}</p>}
    <p role="status">{t(phase === "available" ? "update.confirm" : phase === "error" ? errorKey : `update.${phase}`)}</p>
    {phase === "error" && <Detail detail={detail} />}
    {phase !== "installing" && <div className="actions">
      <button type="button" onClick={() => void install()}>{t("update.install")}</button>
      <button type="button" onClick={dismiss}>{t("update.later")}</button>
    </div>}
  </aside>}</>;
}
