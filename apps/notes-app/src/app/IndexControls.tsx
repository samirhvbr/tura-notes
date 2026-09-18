import { useEffect, useState } from "react";
import * as ipc from "../ipc";
import { t } from "../i18n";

/**
 * How long a run has to last before the panel says it is running.
 *
 * Saving a note makes the index stale, and the poll below starts a new run
 * within half a second. On a workspace of four notes that run is over in
 * milliseconds — but it was still long enough to swap this line's text and turn
 * *Rebuild index* into *Cancel*, which is a block at the bottom of the sidebar
 * changing size and a button moving under the pointer. Every time you saved.
 *
 * So a short run is not announced at all: the timer is cleared when `running`
 * goes back to `false`, and a rebuild that actually takes time still reports
 * itself, one beat later. This is the delay the owner asked for, moved off the
 * save — where it would only have postponed the movement — and onto the
 * decision to mention a state that is about to stop being true.
 */
const ANNOUNCE_AFTER = 500;

export function IndexControls({ workspace }: { workspace:string }) {
  const [status,setStatus]=useState<ipc.IndexStatus|null>(null);
  const [failed,setFailed]=useState(false);
  const [paused,setPaused]=useState(false);
  useEffect(()=>{
    let active=true, busy=false;
    const refresh=async(start:boolean)=>{
      if(busy)return;busy=true;
      try { const s=start ? await ipc.indexStart() : await ipc.indexStatus();if(active){setStatus(s);setFailed(false);if(s.stale&&!s.running&&!paused)void ipc.indexStart().catch(()=>setFailed(true));} }
      catch {if(active)setFailed(true);} finally {busy=false;}
    };
    if(!paused)void refresh(true);
    const poll=setInterval(()=>void refresh(false),500);
    const scan=setInterval(()=>{if(!paused)void refresh(true);},10000);
    return ()=>{active=false;clearInterval(poll);clearInterval(scan);};
  },[workspace,paused]);

  // `status.running` is a boolean, so this runs when it *flips* rather than on
  // every poll — otherwise each new reading would restart the timer and a long
  // rebuild would never be announced at all.
  const [announce,setAnnounce]=useState(false);
  useEffect(()=>{
    if(!status?.running){setAnnounce(false);return;}
    const id=setTimeout(()=>setAnnounce(true),ANNOUNCE_AFTER);
    return ()=>clearTimeout(id);
  },[status?.running]);

  /* What the panel shows, which is not always the latest reading: while a run
     is younger than `ANNOUNCE_AFTER` the previous settled one stays on screen,
     so neither the sentence nor the count moves. Once announced it tracks live
     again, which is the whole point of a progress count. */
  const [shown,setShown]=useState<ipc.IndexStatus|null>(null);
  useEffect(()=>{
    if(!status)return;
    if(!status.running||announce)setShown(status);
  },[status,announce]);

  const running=!!status?.running&&announce;
  return <div className="index-controls" aria-live="polite">
    <span className="index-status">{failed||shown?.error ? t("index.failed") : running ? t("index.running",{count:shown?.scanned??0}) : paused ? t("index.paused") : t("index.ready",{count:shown?.scanned??0})}</span>
    {!!shown?.skipped && <span className="index-status">{t("index.partial",{count:shown.skipped})}</span>}
    {running ? <button onClick={()=>{setPaused(true);void ipc.indexCancel().catch(()=>setFailed(true));}}>{t("search.cancel")}</button> : <button onClick={()=>{setPaused(false);void ipc.indexStart(true).then(setStatus).catch(()=>setFailed(true));}}>{t("index.rebuild")}</button>}
  </div>;
}
