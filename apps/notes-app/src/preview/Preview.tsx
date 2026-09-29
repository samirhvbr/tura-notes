import {openWiki} from "../app/Knowledge";
import { useCallback, useEffect, useRef, useState } from "react";
import * as ipc from "../ipc";
import { t } from "../i18n";
import { useEditor } from "../stores/editor";
import { useTabs } from "../stores/tabs";
import { useUi } from "../stores/ui";
import { useWorkspace } from "../stores/workspace";

/**
 * The preview pane.
 *
 * `innerHTML` is assigned here, and there is exactly one reason that is
 * allowed: the string came from `markdown_render`, which is `notes-markdown`
 * behind `ammonia` (docs/ARCHITECTURE.md §10). **Nothing else in this
 * application may assign `innerHTML`**, and this component must never render a
 * string it did not get from that command.
 *
 * Rendering is debounced 300 ms and **skipped while the pane is hidden**, so
 * typing in Source mode costs nothing (§13).
 */
/**
 * `remote` renders a note of the remote folder (ADR-099) through
 * `remote_render` instead: no raw HTML, no local images, and a relative link
 * opens the remote note it names. It is this component rather than a second
 * one because this is the one place allowed to assign `innerHTML`.
 */
export function Preview({
  remote,
}: { remote?: { path: string; text: string; openNote: (path: string) => void } } = {}) {
  const local = useEditor((s) => s.doc);
  const doc = remote ?? local;
  const view = useUi((s) => s.view);
  const fail = useWorkspace((s) => s.fail);
  const host = useRef<HTMLDivElement | null>(null);
  const [html, setHtml] = useState("");
  const [blocked, setBlocked] = useState<string[]>([]);
  const [shown, setShown] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  const visible = view !== "source";
  const text = doc?.text ?? "";
  const path = doc?.path;
  const render = remote ? ipc.remoteRender : ipc.markdownRender;
  const openNote = remote?.openNote;

  useEffect(() => {
    if (!visible || !path) return;
    let live = true;
    const id = setTimeout(() => {
      render(path, text)
        .then((r) => {
          if (!live) return;
          setHtml(r.html);
          setBlocked(r.blocked_remote);
          setShown(r.shown_remote);
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    }, 300);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [visible, path, text, render]);

  // The rendered HTML is trusted because of where it came from, and for no
  // other reason. See the note on this component.
  useEffect(() => {
    if (host.current) host.current.innerHTML = html;
  }, [html]);

  /**
   * A click inside the preview never navigates.
   *
   * A relative link opens the note in-app; an `http(s)` link goes to the
   * operating system's browser through a command that checks the scheme again.
   * Everything else was already dropped by the renderer, so there is nothing
   * left to decide here.
   */
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      e.preventDefault();

      const wiki=anchor.getAttribute("data-wiki-target");
      // Wiki links resolve through the local index, which knows nothing of
      // the server's notes.
      if(wiki){if(!openNote)void openWiki(wiki);return;}
      const notePath = anchor.getAttribute("data-note-path");
      if (notePath) {
        // Through the tabs, not the editor directly: a direct open skipped the
        // flush of a dirty buffer, its tab and the history.
        if (openNote) openNote(notePath);
        else void useTabs.getState().openPath(notePath as ipc.RelPath).catch(fail);
        return;
      }
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("#")) {
        host.current?.querySelector(`[id="${CSS.escape(href.slice(1))}"]`)
          ?.scrollIntoView({ block: "start" });
        return;
      }
      if (/^https?:/i.test(href)) void ipc.shellOpen(href).catch(fail);
    },
    [openNote, fail],
  );

  // Both directions are offered where the images are, because that is the
  // only place the choice means anything: turning remote images on is what
  // lets a note tell its author it was opened (ADR-089), and a switch that can
  // only be flipped one way is a promise the interface does not keep.
  const setRemote = useCallback(
    async (allow: boolean) => {
      try {
        await ipc.markdownRemoteImagesSet(allow);
        if (path) {
          const r = await render(path, text);
          setHtml(r.html);
          setBlocked(r.blocked_remote);
          setShown(r.shown_remote);
        }
      } catch (e) {
        fail(e);
      }
    },
    [path, text, fail, render],
  );

  if (!doc) return null;

  return (
    <div className="preview-pane">
      {!remote && blocked.length > 0 && (
        <div className="banner">
          <span>{t("preview.blocked", { count: blocked.length })}</span>
          <button onClick={() => void setRemote(true)}>
            {t("preview.blocked.allow")}
          </button>
        </div>
      )}
      {!remote && shown.length > 0 && (
        <div className="banner">
          <span>{t("preview.remote", { count: shown.length })}</span>
          <button onClick={() => void setRemote(false)}>
            {t("preview.remote.block")}
          </button>
        </div>
      )}
      {failed && <div className="banner warn">{t("preview.failed")}</div>}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className="preview" ref={host} onClick={onClick} />
    </div>
  );
}
