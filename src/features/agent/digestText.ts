/**
 * One copy source for a digest block, shared by the slide-over's DigestCard and
 * the Assistant page's suggestion rows so the two can never word it differently.
 *
 * The digest endpoint returns a plain major-unit number for the money fields;
 * it is formatted here rather than interpolated raw, which is what used to
 * print "12 order(s) worth 8430.5".
 */
import { formatMoney } from "@/lib/format-money";

import type { DigestBlock } from "./api";

export function blockText(
  t: (k: string, o?: Record<string, unknown>) => string,
  b: DigestBlock,
  locale: "ar" | "en" = "en",
) {
  if (b.kind === "orders")
    return t("agent.digest.orders", {
      count: b.count,
      revenue: formatMoney(b.revenue, { locale }),
    });
  if (b.kind === "abandoned_carts")
    return t("agent.digest.carts", {
      count: b.count,
      value: formatMoney(b.value_at_stake, { locale }),
    });
  return t("agent.digest.lowStock", { count: b.count });
}
