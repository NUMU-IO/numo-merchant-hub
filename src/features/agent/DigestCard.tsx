/**
 * DigestCard — the agent's proactive "since yesterday" greeting (Pillar 4).
 *
 * Shown above the empty-state prompt when the panel opens on a fresh thread.
 * Each block is a grounded store signal with a one-tap chip that sends its
 * follow-up prompt into the chat. Silent (renders nothing) when the store is
 * quiet or the digest can't load — proactivity should never nag.
 */
import { PackageX, ShoppingCart, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { getDigest, type Digest, type DigestBlock } from "./api";

const ICONS = {
  orders: TrendingUp,
  abandoned_carts: ShoppingCart,
  low_stock: PackageX,
} as const;

function useDigest(storeId: string | null, isOpen: boolean): Digest | null {
  const [digest, setDigest] = useState<Digest | null>(null);
  useEffect(() => {
    if (!isOpen || !storeId) return;
    let alive = true;
    getDigest(storeId)
      .then((d) => alive && setDigest(d))
      .catch(() => alive && setDigest(null));
    return () => {
      alive = false;
    };
  }, [storeId, isOpen]);
  return digest;
}

function blockText(t: (k: string, o?: Record<string, unknown>) => string, b: DigestBlock) {
  if (b.kind === "orders")
    return t("agent.digest.orders", { count: b.count, revenue: b.revenue });
  if (b.kind === "abandoned_carts")
    return t("agent.digest.carts", { count: b.count, value: b.value_at_stake });
  return t("agent.digest.lowStock", { count: b.count });
}

export function DigestCard({
  storeId,
  isOpen,
  onPrompt,
}: {
  storeId: string | null;
  isOpen: boolean;
  onPrompt: (prompt: string) => void;
}) {
  const { t } = useTranslation();
  const digest = useDigest(storeId, isOpen);

  if (!digest || digest.quiet || digest.blocks.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl border bg-muted/40 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("agent.digest.title")}
      </div>
      <ul className="space-y-2">
        {digest.blocks.map((b) => {
          const Icon = ICONS[b.kind];
          return (
            <li key={b.kind} className="flex items-start gap-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{blockText(t, b)}</p>
                {b.prompt && (
                  <button
                    type="button"
                    onClick={() => onPrompt(b.prompt as string)}
                    className="mt-1 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium hover:bg-muted"
                  >
                    {t(`agent.digest.cta.${b.kind}`)}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default DigestCard;
