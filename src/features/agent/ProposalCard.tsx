/**
 * ProposalCard — renders a gated write Action Proposal (US2 / Pillar 2).
 *
 * The body is tailored per action via the `diff.action` discriminator:
 *   - create_coupon   → coupon summary (code, discount, conditions)
 *   - update_product  → per-field before → after rows
 *   - theme edits     → section-order / setting before/after (original)
 * Nothing is applied until Confirm (calls /agent/confirm). After apply, Undo.
 */
import { ArrowRight, Check, Loader2, Undo2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useAgentStore, type AgentProposal } from "./store";

function currentStoreId(): string | null {
  return localStorage.getItem("numu-current-store");
}

type AnyDiff = {
  action?: string;
  // coupon
  code?: string;
  discount_type?: "percentage" | "fixed";
  value?: number;
  min_order_amount?: number;
  usage_limit?: number;
  // product
  product?: { id?: string; name?: string };
  before?: Record<string, unknown> | unknown;
  after?: Record<string, unknown> | unknown;
  // theme
  section_order_before?: string[];
  section_order_after?: string[];
  new_section?: { type?: string };
  setting_path?: string;
};

function num(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : String(v);
}

/** before → after row with an RTL-agnostic arrow. */
function Delta({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1.5 font-medium">
        <span className="text-muted-foreground line-through">{before}</span>
        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground rtl:rotate-180" />
        <span className="text-foreground">{after}</span>
      </span>
    </div>
  );
}

function CouponDiff({ diff }: { diff: AnyDiff }) {
  const { t } = useTranslation();
  const amount =
    diff.discount_type === "percentage" ? `${num(diff.value)}%` : num(diff.value);
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold tracking-wide">
          {diff.code}
        </span>
        <span className="text-sm font-medium">
          {amount} {t("agent.card.off")}
        </span>
      </div>
      {diff.min_order_amount != null && (
        <div className="text-xs text-muted-foreground">
          {t("agent.card.minOrder")}: {num(diff.min_order_amount)}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        {t("agent.card.limit")}:{" "}
        {diff.usage_limit != null ? num(diff.usage_limit) : t("agent.card.unlimited")}
      </div>
    </div>
  );
}

function ProductDiff({ diff }: { diff: AnyDiff }) {
  const { t } = useTranslation();
  const before = (diff.before || {}) as Record<string, unknown>;
  const after = (diff.after || {}) as Record<string, unknown>;
  const labels: Record<string, string> = {
    price: t("agent.card.price"),
    compare_at_price: t("agent.card.compareAt"),
    quantity: t("agent.card.stock"),
  };
  const changed = Object.keys(after).filter((k) => k in labels);
  return (
    <div className="mt-2 space-y-1">
      {diff.product?.name && (
        <div className="text-xs font-medium">{diff.product.name}</div>
      )}
      {changed.map((k) => (
        <Delta key={k} label={labels[k]} before={num(before[k])} after={num(after[k])} />
      ))}
    </div>
  );
}

function ThemeDiff({ diff }: { diff: AnyDiff }) {
  const { t } = useTranslation();
  if (typeof diff.setting_path === "string") {
    return (
      <div className="mt-2 space-y-0.5 text-xs">
        <div className="font-mono text-muted-foreground">{diff.setting_path}</div>
        <div className="text-muted-foreground">
          {t("agent.before")}: {String(diff.before ?? "—")}
        </div>
        <div className="text-foreground">
          {t("agent.after")}: {String(diff.after ?? "—")}
        </div>
      </div>
    );
  }
  return (
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
  );
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

  const diff = (proposal.diff || {}) as AnyDiff;

  return (
    <div className="mt-1 rounded-lg border bg-background p-3 text-sm">
      <div className="font-medium">{proposal.summary || t("agent.previewTitle")}</div>

      {diff.action === "create_coupon" ? (
        <CouponDiff diff={diff} />
      ) : diff.action === "update_product" ? (
        <ProductDiff diff={diff} />
      ) : (
        <ThemeDiff diff={diff} />
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
