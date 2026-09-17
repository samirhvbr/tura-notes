import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { t } from "../i18n";
import * as ipc from "../ipc";
import { useModalSurface } from "./modal";
import { useWorkspace } from "../stores/workspace";

/**
 * What the application is and what it is running, in one place you can copy.
 *
 * The platform's own About panel says the name and the version and stops there,
 * which is enough to answer *which version am I on* and nothing else. The
 * questions that actually arrive with a problem — which engine is rendering
 * this, where is the data, which folder is open — have no surface at all, and
 * a person reading them off four different screens transcribes one of them
 * wrong. So: our dialog, and a Copy button, because the point of these lines is
 * that they end up in a message to somebody else ([[ADR-079]]).
 */

/**
 * The engine actually drawing this window, read from its own user agent.
 *
 * Reported because a rendering fault is an engine fault, and "macOS 26" does
 * not say which WebKit shipped inside it — the same application on two Macs
 * can be two renderers. Windows is checked first: WebView2's user agent
 * carries `AppleWebKit` as well, and matching that first would report every
 * Windows install as WebKit.
 */
export function engine(os: string, ua: string = navigator.userAgent): string {
  const chromium = ua.match(/(?:Chrome|Chromium)\/([\d.]+)/)?.[1];
  if (os === "windows") return chromium ? `WebView2 (Chromium ${chromium})` : "WebView2";
  const webkit = ua.match(/AppleWebKit\/([\d.]+)/)?.[1];
  const name = os === "macos" || os === "ios" ? "WKWebView" : "WebKitGTK";
  return webkit ? `${name} (WebKit ${webkit})` : name;
}

/**
 * Open on the native Help ▸ About item.
 *
 * The only place the shell speaks to the frontend instead of answering it. No
 * command can do this: the menu lives on the other side and nothing in the
 * webview knows it was clicked. `listen` is rejected where there is no Tauri
 * bus — a browser, a test — and that is the catch, not an error worth showing.
 */
export function useAboutMenu(open: (value: boolean) => void) {
  useEffect(() => {
    let live = true;
    let stop: (() => void) | undefined;
    listen("menu://about", () => open(true))
      .then(off => { if (live) stop = off; else off(); })
      .catch(() => {});
    return () => { live = false; stop?.(); };
  }, [open]);
}

export function AboutDialog({ onClose }: { onClose: () => void }) {
  const [env, setEnv] = useState<ipc.EnvReport | null>(null);
  const [copied, setCopied] = useState(false);
  const workspace = useWorkspace(s => s.info);
  useEffect(() => { ipc.envReport().then(setEnv).catch(() => {}); }, []);
  const modal = useModalSurface(!!env);

  const rows: [string, string][] = env ? [
    [t("about.version"), env.version],
    [t("about.platform"), `${env.os} / ${env.arch}`],
    [t("about.engine"), `Tauri ${env.tauriVersion} · ${engine(env.os)}`],
    [t("about.data"), env.dataDir],
    [t("about.workspace"), workspace?.root ?? t("about.none")],
  ] : [];

  // The same lines, as the text somebody pastes into a message. Built from the
  // rendered rows rather than beside them, so the copy cannot drift from what
  // is on screen.
  const copy = async () => {
    const text = [`Tura Notes`, ...rows.map(([label, value]) => `${label}: ${value}`)].join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setCopied(false); }
  };

  return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div {...modal} className="dialog about" role="dialog" aria-modal="true" aria-label={t("about.title")}
      onKeyDown={e => { modal.onKeyDown(e); if (e.key === "Escape") onClose(); }}>
      <h2>Tura Notes</h2>
      <p className="about-tagline">{t("about.tagline")}</p>
      <dl className="about-rows">
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      {/* From `bundle.copyright`, not from here: the installers carry that
          string already, and a second copy is a second year to forget. */}
      {env?.copyright && <p className="about-legal">{env.copyright}</p>}
      <p role="status">{copied ? t("about.copied") : ""}</p>
      <div className="actions">
        <button type="button" disabled={!env} onClick={() => void copy()}>{t("about.copy")}</button>
        <button type="button" className="primary" onClick={onClose}>{t("about.close")}</button>
      </div>
    </div>
  </div>;
}
