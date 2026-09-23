import { t } from "../i18n";
import type { WorkspaceReadOnly } from "../ipc/generated/WorkspaceReadOnly";

/**
 * A workspace opened read-only says so, and why, before the first save fails
 * (R6-42). The core has carried the reason since the `TooNew` case was handled,
 * and a second one (`identity_lost`) since R6-05; nothing in the interface read
 * either, so the workspace behaved as writable until a write was refused.
 */
export function ReadOnlyBanner({ readOnly }: { readOnly: WorkspaceReadOnly | null }) {
  if (!readOnly) return null;
  return (
    <div className="banner warn" role="status">
      <span>
        {readOnly.reason === "schema_ahead"
          ? t("workspace.readOnly.schemaAhead", { found: readOnly.found })
          : t("workspace.readOnly.identityLost")}
      </span>
    </div>
  );
}
