/**
 * CampaignPerformanceTab — per-campaign attribution rollup.
 *
 * Wraps the backend's GET /campaigns/{id}/performance endpoint with:
 *   - Date-range picker (default last 30 days)
 *   - KPI cards (sessions / ATC / checkouts / orders / revenue / AOV)
 *   - Funnel-conversion bars + rates
 *   - Top products by revenue
 *
 * Empty state when the campaign has zero attributed sessions in the
 * window — distinguishes a brand-new campaign from a broken one.
 *
 * SEC-009 (no dangerouslySetInnerHTML): every campaign-derived string
 * (campaign_name, product names) renders via standard JSX text
 * interpolation. No template helpers.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart3,
  Loader2,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import {
  getCampaignPerformance,
  type CampaignPerformanceResponse,
} from "@/services/campaignApi";

interface CampaignPerformanceTabProps {
  storeId: string;
  campaignId: string;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIsoDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatCents(cents: number, isAr: boolean): string {
  const egp = (cents / 100).toFixed(0);
  return isAr ? `${egp} ج.م` : `EGP ${egp}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${(value * 100).toFixed(1)}%`;
}

export function CampaignPerformanceTab({
  storeId,
  campaignId,
}: CampaignPerformanceTabProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [dateFrom, setDateFrom] = useState<string>(daysAgoIsoDate(30));
  const [dateTo, setDateTo] = useState<string>(todayIsoDate());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CampaignPerformanceResponse | null>(null);

  const load = useCallback(async () => {
    if (!storeId || !campaignId) return;
    setLoading(true);
    try {
      const res = await getCampaignPerformance(
        storeId,
        campaignId,
        // Date-only inputs → expand to ISO datetime bounds covering
        // the whole day in UTC. Backend's date_to is inclusive.
        new Date(`${dateFrom}T00:00:00Z`).toISOString(),
        new Date(`${dateTo}T23:59:59Z`).toISOString(),
      );
      setData(res);
    } catch (err) {
      showError(err);
    } finally {
      setLoading(false);
    }
  }, [storeId, campaignId, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = data?.totals;
  const isEmpty = !!totals && totals.sessions === 0 && totals.orders === 0;

  const kpis = useMemo(() => {
    if (!totals) return null;
    return [
      {
        key: "sessions",
        label: isAr ? "الجلسات" : "Sessions",
        value: totals.sessions.toLocaleString(),
        icon: Users,
      },
      {
        key: "atc",
        label: isAr ? "إضافة للسلة" : "Add to cart",
        value: totals.add_to_cart.toLocaleString(),
        icon: ShoppingCart,
      },
      {
        key: "checkouts",
        label: isAr ? "بدأ الدفع" : "Checkouts started",
        value: totals.checkout_started.toLocaleString(),
        icon: BarChart3,
      },
      {
        key: "orders",
        label: isAr ? "الطلبات" : "Orders",
        value: totals.orders.toLocaleString(),
        icon: TrendingUp,
      },
      {
        key: "revenue",
        label: isAr ? "الإيرادات" : "Revenue",
        value: formatCents(totals.revenue_cents, isAr),
        icon: TrendingUp,
      },
      {
        key: "aov",
        label: isAr ? "متوسط قيمة الطلب" : "AOV",
        value: formatCents(totals.average_order_value_cents, isAr),
        icon: TrendingUp,
      },
    ];
  }, [totals, isAr]);

  return (
    <div className="space-y-4">
      {/* Date range + refresh */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="perf-from">{isAr ? "من" : "From"}</Label>
            <Input
              id="perf-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="perf-to">{isAr ? "إلى" : "To"}</Label>
            <Input
              id="perf-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isAr ? "تحديث" : "Refresh"}
          </Button>
        </CardContent>
      </Card>

      {loading && !totals && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!loading && isEmpty && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm space-y-2">
            <p className="font-medium text-foreground">
              {isAr
                ? "لا توجد بيانات أداء بعد"
                : "No performance data yet"}
            </p>
            <p>
              {isAr
                ? "بمجرد أن يبدأ الزوار في استخدام الرابط القابل للتتبع لهذه الحملة، ستظهر الأرقام هنا."
                : "Once visitors start using this campaign's trackable link, numbers will appear here."}
            </p>
          </CardContent>
        </Card>
      )}

      {!isEmpty && totals && kpis && (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {kpis.map((k) => (
              <Card key={k.key}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {k.label}
                    </span>
                    <k.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {k.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Conversion rates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isAr ? "معدلات التحويل" : "Conversion rates"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <FunnelRow
                label={
                  isAr
                    ? "جلسة → إضافة للسلة"
                    : "Session → Add to cart"
                }
                value={totals.conversion_rates.session_to_atc}
              />
              <FunnelRow
                label={
                  isAr
                    ? "إضافة للسلة → بدء الدفع"
                    : "ATC → Checkout"
                }
                value={totals.conversion_rates.atc_to_checkout}
              />
              <FunnelRow
                label={
                  isAr ? "بدء الدفع → طلب" : "Checkout → Order"
                }
                value={totals.conversion_rates.checkout_to_order}
              />
              <FunnelRow
                label={isAr ? "جلسة → طلب" : "Session → Order"}
                value={totals.conversion_rates.session_to_order}
                emphasised
              />
            </CardContent>
          </Card>

          {/* Top products */}
          {totals.top_products.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isAr ? "أعلى المنتجات" : "Top products"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {isAr ? "المنتج" : "Product"}
                      </TableHead>
                      <TableHead>
                        {isAr ? "الوحدات" : "Units"}
                      </TableHead>
                      <TableHead>
                        {isAr ? "الإيرادات" : "Revenue"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {totals.top_products.map((p) => (
                      <TableRow key={p.product_id || `${p.name}-row`}>
                        <TableCell className="font-medium">
                          {p.name || "—"}
                        </TableCell>
                        <TableCell>{p.orders}</TableCell>
                        <TableCell className="tabular-nums">
                          {formatCents(p.revenue_cents, isAr)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function FunnelRow({
  label,
  value,
  emphasised,
}: {
  label: string;
  value: number;
  emphasised?: boolean;
}) {
  const pct = Math.min(Math.max(value, 0), 1);
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className={emphasised ? "font-medium" : "text-muted-foreground"}>
          {label}
        </span>
        <span className="tabular-nums font-medium">{formatPercent(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${
            emphasised ? "bg-primary" : "bg-primary/60"
          }`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
