import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import * as ipc from "../ipc";
import { RenderedHtml } from "../preview/Preview";
import { useModalSurface } from "./modal";

/**
 * Help ▸ Markdown guide: every construct the preview understands, with what to
 * type and what the preview draws for it.
 *
 * A person who has never written Markdown has no way to find out that `#` in
 * front of a line makes a heading, and nothing in the interface says so. This is
 * where it says so.
 *
 * **The drawing is the preview's own.** The frontend has no Markdown parser
 * (docs/ARCHITECTURE.md §10), so what a construct becomes comes from
 * `markdown_guide`, which renders the examples with the renderer and the
 * sanitizer the preview uses. A cheat sheet typed by hand would promise things
 * the application does not do (raw HTML is shown as text, `www.` alone is not a
 * link), and a test in `notes-markdown` is what keeps each line true. The words
 * (a title and a note per construct) are the interface's and are keyed by the
 * entry's `id`.
 *
 * There is no "insert in the note" button on purpose: the editor can only insert
 * at the cursor, and a heading inserted in the middle of a line is wrong. Copy
 * is what is offered until the editor can place a block on a line of its own.
 */

/**
 * Open on the native Help ▸ Markdown Guide item.
 *
 * The same one-way channel as About: the menu lives on the other side and
 * nothing in the webview knows it was clicked. `listen` is rejected where there
 * is no Tauri bus — a browser, a test — and that is the catch, not an error.
 */
export function useMarkdownGuideMenu(open: (value: boolean) => void) {
  useEffect(() => {
    let live = true;
    let stop: (() => void) | undefined;
    listen("menu://markdown-guide", () => open(true))
      .then((off) => {
        if (live) stop = off;
        else off();
      })
      .catch(() => {});
    return () => {
      live = false;
      stop?.();
    };
  }, [open]);
}

/** Lower case and without accents, so "tabela" finds "Tabela" and "titulos" finds "Títulos". */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const title = (e: ipc.GuideEntry) => t(`guide.entry.${e.id}.title`);
const note = (e: ipc.GuideEntry) => t(`guide.entry.${e.id}.note`);

/** Whether an entry answers what was typed in the search box: its words, its syntax or its section. */
export function matches(e: ipc.GuideEntry, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return fold([title(e), note(e), e.source, t(`guide.group.${e.group}`)].join("\n")).includes(q);
}

/** The entries in sections, in the order they came; a section the search emptied is not shown. */
export function sections(entries: ipc.GuideEntry[], query: string): [string, ipc.GuideEntry[]][] {
  const out: [string, ipc.GuideEntry[]][] = [];
  for (const e of entries) {
    if (!matches(e, query)) continue;
    const last = out[out.length - 1];
    if (last && last[0] === e.group) last[1].push(e);
    else out.push([e.group, [e]]);
  }
  return out;
}

export function MarkdownGuideDialog({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<ipc.GuideEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    ipc
      .markdownGuide()
      .then(setEntries)
      .catch(() => setFailed(true));
    return () => window.clearTimeout(timer.current);
  }, []);
  const modal = useModalSurface(entries !== null || failed);

  const copy = async (e: ipc.GuideEntry) => {
    try {
      await navigator.clipboard.writeText(e.source);
      setCopied(e.id);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  };

  const shown = sections(entries ?? [], query);

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        {...modal}
        className="dialog guide"
        role="dialog"
        aria-modal="true"
        aria-label={t("guide.title")}
        onKeyDown={(e) => {
          modal.onKeyDown(e);
          if (e.key === "Escape") onClose();
        }}
      >
        <h2>{t("guide.title")}</h2>
        <p className="guide-intro">{t("guide.intro")}</p>
        <label htmlFor="guide-find">{t("guide.find")}</label>
        <input
          id="guide-find"
          type="search"
          autoComplete="off"
          value={query}
          placeholder={t("guide.findHint")}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="guide-body" tabIndex={0} role="region" aria-label={t("guide.title")}>
          {entries === null && !failed && <p>{t("guide.loading")}</p>}
          {failed && <p role="alert">{t("guide.failed")}</p>}
          {entries !== null && shown.length === 0 && <p>{t("guide.none", { query: query.trim() })}</p>}
          {shown.map(([group, list]) => (
            <section key={group} className="guide-group" aria-labelledby={`guide-group-${group}`}>
              <h3 id={`guide-group-${group}`}>{t(`guide.group.${group}`)}</h3>
              {list.map((e) => (
                <article key={e.id} className="guide-entry" aria-labelledby={`guide-entry-${e.id}`}>
                  <h4 id={`guide-entry-${e.id}`}>{title(e)}</h4>
                  <p className="guide-note">{note(e)}</p>
                  <div className="guide-cols">
                    <div>
                      <div className="guide-label">{t("guide.type")}</div>
                      <pre className="guide-source">
                        <code>{e.source}</code>
                      </pre>
                      <div className="guide-actions">
                        <button type="button" onClick={() => void copy(e)}>
                          {copied === e.id ? t("guide.copied") : t("guide.copy")}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="guide-label">{t("guide.see")}</div>
                      {e.html ? (
                        <RenderedHtml
                          className="preview guide-result"
                          html={e.html}
                          // A link in an example is an example: it never navigates.
                          onClick={(ev) => {
                            if ((ev.target as HTMLElement).closest("a")) ev.preventDefault();
                          }}
                        />
                      ) : (
                        <p className="guide-nopic">{t("guide.noPicture")}</p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
        <p role="status" className="guide-status">
          {copied ? t("guide.copied") : ""}
        </p>
        <div className="actions">
          <button type="button" className="primary" onClick={onClose}>
            {t("guide.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
