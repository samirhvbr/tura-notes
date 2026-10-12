import * as ipc from "../ipc";
import { t } from "../i18n";
import { errorText } from "../app/StatusBar";

/** A sentence for what the server, or the way to it, answered. */
export function remoteErrorText(e: ipc.CoreError): string {
  if (e.code === "sync") {
    const said: Partial<Record<ipc.SyncCause, string>> = {
      offline: t("remote.error.offline"),
      denied: t("remote.error.denied"),
      busy: t("remote.error.busy"),
      limit: t("remote.error.limit"),
      protocol: t("remote.error.protocol"),
      invalid: t("remote.error.invalid"),
      // `conflict` is worded for device sync ("review the conflicts"). Here it is
      // a stale tag: the note changed after the list on screen was loaded.
      conflict: t("remote.error.conflict"),
    };
    return said[e.cause] ?? errorText(e);
  }
  return errorText(e);
}
