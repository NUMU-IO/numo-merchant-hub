/**
 * ProposalCard — renders a gated write Action Proposal (US2).
 *
 * Shows the section-order before/after diff and Confirm / Decline. Nothing is
 * applied until Confirm (calls /agent/confirm). After apply, offers Undo.
 */
import { Check, Loader2, Undo2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useAgentStore, type AgentProposal } from "./store";

function currentStoreId(): string | null {
  return localStorage.getItem("numu-current-store");
}

export function ProposalCard({
  messageId,
  proposal,
}: {
  messageId: string;
  proposal: AgentProposal;
}) {
  const { t } = useTranslation();
  const { confirmProposal, declineProposal, undo } = useAgentStore();
  const storeId = currentStoreId();
  if (!storeId) return null;

  const diff = (proposal.diff || {}) as {
    section_order_before?: string[];
    section_order_after?: string[];
    new_section?: { type?: string };
    setting_path?: string;
    before?: unknown;
    after?: unknown;
  };
  const isSettingEdit = typeof diff.setting_path === "string";

  return (
    <div className="mt-1 rounded-lg border bg-background p-3 text-sm">
      <div className="font-medium">{proposal.summary || t("agent.previewTitle")}</div>
      {isSettingEdit ? (
        <div className="mt-2 space-y-0.5 text-xs">
          <div className="font-mono text-muted-foreground">{diff.setting_path}</div>
          <div className="text-muted-foreground">
            {t("agent.before")}: {String(diff.before ?? "—")}
          </div>
          <div className="text-foreground">
            {t("agent.after")}: {String(diff.after ?? "—")}
          </div>
        </div>
      ) : (
        <>
          {diff.new_section?.type && (
            <div className="mt-1 text-xs text-muted-foreground">
              + <span className="font-mono">{diff.new_section.type}</span>
            </div>
          )}
          <div className="mt-2 space-y-0.5 text-xs">
            <div className="text-muted-foreground">
              {t("agent.before")}: {(diff.section_order_before ?? []).join(" → ") || "—"}
            </div>
            <div className="text-foreground">
              {t("agent.after")}: {(diff.section_order_after ?? []).join(" → ") || "—"}
            </div>
          </div>
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {proposal.status === "pending" && (
          <>
            <Button size="sm" className="gap-1" onClick={() => confirmProposal(storeId, messageId)}>
              <Check className="h-3.5 w-3.5" /> {t("agent.confirm")}
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => declineProposal(storeId, messageId)}>
              <X className="h-3.5 w-3.5" /> {t("agent.decline")}
            </Button>
          </>
        )}
        {proposal.status === "applying" && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("agent.applying")}
          </span>
        )}
        {proposal.status === "applied" && (
          <>
            <span className="text-green-600 dark:text-green-400">{t("agent.applied")}</span>
            <Button size="sm" variant="ghost" className="gap-1" onClick={() => undo(storeId)}>
              <Undo2 className="h-3.5 w-3.5" /> {t("agent.undo")}
            </Button>
          </>
        )}
        {proposal.status === "declined" && (
          <span className="text-muted-foreground">{t("agent.declined")}</span>
        )}
        {proposal.status === "error" && <span className="text-red-600">{t("agent.error")}</span>}
      </div>
    </div>
  );
}

export default ProposalCard;
