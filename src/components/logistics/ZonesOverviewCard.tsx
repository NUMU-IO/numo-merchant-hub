import { Link, useNavigate } from "react-router-dom";
import { MapPin, Plus, ArrowUpRight, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { rateConfigOf, type ShippingZone, type Coverage } from "@/services/shippingApi";
import { formatMoney } from "@/lib/format-money";
import { cn } from "@/lib/utils";

const MAX_ROWS = 5;

/** Cheapest active rate of a zone, as a short label ("from 50 EGP" / "Free over 500"). */
function rateSummary(zone: ShippingZone, isAr: boolean, currency: string): string {
  const active = zone.rates.filter((r) => r.is_active);
  if (active.length === 0) return isAr ? "مفيش أسعار" : "No rates";
  const amounts: number[] = [];
  let freeOver: number | null = null;
  for (const r of active) {
    const c = rateConfigOf(r) as { type: string; amount_cents?: number; bands?: { amount_cents: number }[]; free_when_subtotal_gte_cents?: number };
    if (c.type === "weight_band" && c.bands?.length) amounts.push(Math.min(...c.bands.map((b) => b.amount_cents)));
    else if (typeof c.amount_cents === "number") amounts.push(c.amount_cents);
    if (c.type === "free_over" && typeof c.free_when_subtotal_gte_cents === "number") freeOver = c.free_when_subtotal_gte_cents;
  }
  const money = (cents: number) => formatMoney(cents, { fromCents: true, locale: isAr ? "ar" : "en", currency });
  const from = amounts.length ? (isAr ? `من ${money(Math.min(...amounts))}` : `from ${money(Math.min(...amounts))}`) : "";
  const free = freeOver !== null ? (isAr ? ` · مجاني فوق ${money(freeOver)}` : ` · free over ${money(freeOver)}`) : "";
  return `${from}${free}`;
}

/**
 * "Zones & rates" card on the Logistics landing: coverage line, first few
 * zones with their governorate count, ETA and cheapest rate, and a link
 * into the full zones page.
 */
export function ZonesOverviewCard({
  zones,
  coverage,
  totalGovernorates,
  loading,
  isAr,
  currency,
}: {
  zones: ShippingZone[];
  coverage: Coverage | undefined;
  totalGovernorates: number;
  loading: boolean;
  isAr: boolean;
  currency: string;
}) {
  const navigate = useNavigate();
  const n = (v: number) => (isAr ? v.toLocaleString("ar-EG") : v.toLocaleString());
  const covered = coverage?.covered.length ?? 0;
  const conflicts = coverage?.conflicts.length ?? 0;
  const active = zones.filter((z) => z.is_active);
  const shown = active.slice(0, MAX_ROWS);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {isAr ? "المناطق والأسعار" : "Zones & rates"}
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {loading ? (
              <Skeleton className="mt-1 h-3 w-40" />
            ) : totalGovernorates > 0 ? (
              isAr
                ? `${n(covered)} من ${n(totalGovernorates)} محافظة مغطاة بـ ${n(active.length)} منطقة`
                : `${n(covered)} of ${n(totalGovernorates)} governorates covered by ${n(active.length)} zone${active.length === 1 ? "" : "s"}`
            ) : null}
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg" onClick={() => navigate("/shipping/zones/new")}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          {isAr ? "منطقة" : "Zone"}
        </Button>
      </div>

      {!loading && totalGovernorates > 0 && (
        <div className="mx-5 mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", covered === totalGovernorates ? "bg-sage" : "bg-saffron")}
            style={{ width: `${Math.min((covered / totalGovernorates) * 100, 100)}%` }}
          />
        </div>
      )}
      {conflicts > 0 && (
        <p className="mx-5 mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          {isAr ? `${n(conflicts)} محافظة في أكتر من منطقة` : `${n(conflicts)} governorate${conflicts === 1 ? "" : "s"} in more than one zone`}
        </p>
      )}

      {loading ? (
        <div className="space-y-2 px-5 pb-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="px-5 pb-5 pt-2 text-center">
          <p className="text-[13px] font-bold">{isAr ? "لسه مفيش مناطق شحن" : "No shipping zones yet"}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {isAr ? "العميل مش هيقدر يكمل الدفع لحد ما تضيف منطقة بسعر." : "Customers can't check out until a zone with a rate exists."}
          </p>
          <Button size="sm" className="mt-3 rounded-lg" onClick={() => navigate("/shipping/zones")}>
            {isAr ? "ابدأ بقالب مصر (٤ مناطق)" : "Start with the Egypt 4-zone preset"}
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 border-t border-border/60">
          {shown.map((z) => (
            <li key={z.id}>
              <Link to={`/shipping/zones/${z.id}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-muted/40">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{isAr ? z.name_ar || z.name : z.name}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {isAr ? `${n(z.governorate_codes.length)} محافظة` : `${n(z.governorate_codes.length)} governorate${z.governorate_codes.length === 1 ? "" : "s"}`}
                    {" · "}
                    {isAr ? `${n(z.estimated_days_min)}–${n(z.estimated_days_max)} يوم` : `${n(z.estimated_days_min)}–${n(z.estimated_days_max)} days`}
                    {z.cod_enabled ? (isAr ? " · دفع عند الاستلام" : " · COD") : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-semibold tabular-nums">{rateSummary(z, isAr, currency)}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {active.length > 0 && (
        <Link
          to="/shipping/zones"
          className="block border-t border-border/60 bg-muted/30 py-2.5 text-center text-[12px] font-bold text-navy hover:bg-muted/60 dark:text-saffron"
        >
          {active.length > MAX_ROWS
            ? (isAr ? `كل المناطق (${n(active.length)})` : `All zones (${n(active.length)})`)
            : (isAr ? "إدارة المناطق والأسعار" : "Manage zones & rates")}
        </Link>
      )}
    </div>
  );
}

export default ZonesOverviewCard;
