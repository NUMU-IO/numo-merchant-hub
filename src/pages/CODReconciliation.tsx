import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { formatMoney } from "@/lib/format-money";
import { useTranslation } from "react-i18next";
import { StatTile } from "@/components/ui/stat-tile";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable, MobileCardList, MobileCard } from "@/components/ui/responsive-table";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Clock, AlertTriangle, Banknote, Loader2,
  ChevronDown, ChevronUp, FileSearch, Hourglass, Play,
} from "lucide-react";
import {
  listReconciliationRuns,
  listRunMismatches,
  triggerReconciliation,
  type ReconciliationRun,
  type ReconciliationMismatch,
} from "@/services/reconciliationApi";
import { useToast } from "@/hooks/use-toast";

type RunStatus = "all" | "completed" | "failed" | "running" | "pending";

const CODReconciliation = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const { toast } = useToast();
  const isAr = language === "ar";
  const storeId = currentStore?.id;

  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RunStatus>("all");
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [mismatches, setMismatches] = useState<Record<string, ReconciliationMismatch[]>>({});
  const [loadingMismatches, setLoadingMismatches] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  });

  const fetchRuns = () => {
    if (!storeId) return;
    setLoading(true);
    listReconciliationRuns(storeId).then(setRuns).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchRuns(); }, [storeId]);

  const handleTrigger = async () => {
    if (!storeId || triggering) return;
    setTriggering(true);
    try {
      const result = await triggerReconciliation(storeId, targetDate);
      toast({
        title: isAr ? "تمت التسوية" : "Reconciliation Complete",
        description: result.message,
      });
      fetchRuns();
    } catch (err) {
      toast({
        title: isAr ? "فشل التشغيل" : "Failed to Run",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTriggering(false);
    }
  };

  const toggleRun = async (runId: string) => {
    if (expandedRun === runId) { setExpandedRun(null); return; }
    setExpandedRun(runId);
    if (!mismatches[runId] && storeId) {
      setLoadingMismatches(runId);
      try {
        const data = await listRunMismatches(storeId, runId);
        setMismatches(prev => ({ ...prev, [runId]: data }));
      } catch {
        setMismatches(prev => ({ ...prev, [runId]: [] }));
      } finally {
        setLoadingMismatches(null);
      }
    }
  };

  const fmt = (cents: number) => formatMoney(cents, { fromCents: true, locale: isAr ? "ar" : "en" });
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" });

  const filtered = runs.filter(r => statusFilter === "all" || r.status === statusFilter);

  // KPIs are derived from the runs FEED (the most recent `runs.length`
  // runs, not all history) — so every tile says which window it covers.
  // They used to sit side by side with no window at all ("Collected this
  // month EGP 0" next to "Reconciled EGP 148"), which read as a
  // contradiction rather than two different time spans.
  const monthStart = (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; })();
  const thisMonthRuns = runs.filter(r => new Date(r.period_start) >= monthStart);
  const collectedThisMonth = thisMonthRuns.reduce((s, r) => s + r.actual_amount_cents, 0);
  // Open variance = unexplained gaps on completed runs. The sign is kept
  // per run (see the pill); the tile sums magnitudes.
  const completedRuns = runs.filter(r => r.status === "completed");
  const totalVariance = completedRuns.reduce((s, r) => s + Math.abs(r.expected_amount_cents - r.actual_amount_cents), 0);
  const reconciledTotal = completedRuns.reduce((s, r) => s + r.actual_amount_cents, 0);
  const monthLabel = new Date().toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", year: "numeric" });

  // variance_cents = expected − actual. Positive → the courier remitted
  // LESS than the paid orders say (short); negative → more (over).
  const variancePill = (cents: number) => {
    if (cents === 0) {
      return (
        <span className="souq-pill bg-emerald-500/14 text-emerald-700 dark:text-emerald-400">
          <span className="dot" />
          {t("cod.matched")}
        </span>
      );
    }
    const short = cents > 0;
    return (
      <span className={`souq-pill ${short ? "bg-destructive/14 text-destructive" : "bg-blue-500/14 text-blue-700 dark:text-blue-400"}`}>
        <span className="dot" />
        {t(short ? "cod.short" : "cod.over", { amount: fmt(Math.abs(cents)) })}
      </span>
    );
  };

  // Souq status pill (soft 14% tint + colored dot/icon)
  const statusPill = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="souq-pill bg-emerald-500/14 text-emerald-700 dark:text-emerald-400">
            <span className="dot" />
            {isAr ? "اتسوّى" : "Completed"}
          </span>
        );
      case "failed":
        return (
          <span className="souq-pill bg-destructive/14 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.2} />
            {isAr ? "فشل" : "Failed"}
          </span>
        );
      case "running":
        return (
          <span className="souq-pill bg-blue-500/14 text-blue-700 dark:text-blue-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
            {isAr ? "بيشتغل" : "Running"}
          </span>
        );
      default:
        return (
          <span className="souq-pill bg-amber-500/14 text-amber-700 dark:text-amber-400">
            <Clock className="h-3.5 w-3.5" strokeWidth={2.2} />
            {isAr ? "مستني" : "Pending"}
          </span>
        );
    }
  };

  const mismatchTypePill = (type: string) => {
    const map: Record<string, { bg: string; color: string; en: string; ar: string }> = {
      amount_mismatch:          { bg: "bg-amber-500/14",     color: "text-amber-700 dark:text-amber-400", en: "Amount mismatch", ar: "فرق مبلغ" },
      paid_order_no_transaction:{ bg: "bg-destructive/14",   color: "text-destructive",                   en: "Order no txn",    ar: "طلب بدون معاملة" },
      transaction_no_order:     { bg: "bg-purple-500/14",    color: "text-purple-700 dark:text-purple-400", en: "Txn no order",  ar: "معاملة بدون طلب" },
      // (no `duplicate_transaction` — the reconciliation service never emits it)
    };
    const t = map[type];
    if (!t) {
      return <span className="souq-pill bg-muted text-muted-foreground">{type}</span>;
    }
    return (
      <span className={`souq-pill ${t.bg} ${t.color}`}>
        <span className="dot" />
        {isAr ? t.ar : t.en}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const tabs: { v: RunStatus; en: string; ar: string }[] = [
    { v: "all", en: "All", ar: "الكل" },
    { v: "completed", en: "Completed", ar: "مكتمل" },
    { v: "running", en: "Running", ar: "بيشتغل" },
    { v: "failed", en: "Failed", ar: "فشل" },
    { v: "pending", en: "Pending", ar: "مستني" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAr ? "تسوية الدفع عند الاستلام" : "COD reconciliation"}
        subtitle={isAr ? "طابق الفلوس المحصّلة مع شركة الشحن" : "Match collected cash with your courier"}
        actions={<>
          <label className="sr-only" htmlFor="cod-target-date">{isAr ? "تاريخ التسوية" : "Reconciliation date"}</label>
          <input
            id="cod-target-date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <Button onClick={handleTrigger} disabled={triggering} variant="accent" size="sm" className="gap-1.5 h-9">
            {triggering
              ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              : <Play className="h-4 w-4" strokeWidth={2.4} />}
            {isAr ? "سوّي الكل" : "Reconcile all"}
          </Button>
        </>}
      />

      {/* ─── 3 stat tiles — each labelled with the window it covers ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={Banknote}
          tone="navy"
          label={t("cod.collectedMonth", { month: monthLabel })}
          value={fmt(collectedThisMonth)}
          sub={t("cod.thisMonthRuns", { count: thisMonthRuns.length })}
        />
        <StatTile
          icon={Hourglass}
          tone="saffron"
          label={t("cod.openVariance")}
          value={fmt(totalVariance)}
          sub={t("cod.lastRuns", { count: completedRuns.length })}
        />
        <StatTile
          icon={CheckCircle2}
          tone="sage"
          label={t("cod.reconciledTotal")}
          value={fmt(reconciledTotal)}
          sub={t("cod.lastRuns", { count: completedRuns.length })}
        />
      </div>

      {/* ─── Reconciliation runs ─────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="souq-section-head px-5 pt-5">
          <h2 className="text-[17px] font-bold tracking-tight">
            {isAr ? "عمليات التسوية" : "Reconciliation runs"}
          </h2>
          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {tabs.map(t => (
              <button
                key={t.v}
                type="button"
                data-active={statusFilter === t.v}
                onClick={() => setStatusFilter(t.v)}
                className="souq-chip h-8 text-xs"
              >
                {isAr ? t.ar : t.en}
              </button>
            ))}
          </div>
        </div>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title={runs.length === 0 ? t("cod.noRunsTitle") : t("cod.noMatchTitle")}
              description={runs.length === 0 ? t("cod.noRunsBody") : undefined}
              className="py-12"
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((run) => (
                <div key={run.id} className="rounded-xl border bg-card">
                  <button
                    className="w-full flex items-center justify-between p-4 text-start hover:bg-muted/30 transition-colors rounded-xl"
                    onClick={() => toggleRun(run.id)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="shrink-0">{statusPill(run.status)}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold flex items-center gap-2 flex-wrap">
                          <span>{fmtDate(run.period_start)} — {fmtDate(run.period_end)}</span>
                          {/* Which rail — several gateways mean several runs per day. */}
                          {run.gateway && (
                            <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              {run.gateway}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                          {run.total_orders_checked === 0 ? (
                            <span>{t("cod.noCodOrders")}</span>
                          ) : (
                            <>
                              {run.total_orders_checked} {isAr ? "طلب" : "orders"}
                              {" · "}
                              {run.total_transactions_checked} {isAr ? "معاملة" : "txns"}
                            </>
                          )}
                          {run.mismatches_found > 0 && (
                            <span className="text-destructive font-bold">
                              {" · "}{run.mismatches_found} {isAr ? "اختلاف" : "mismatches"}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {/* Was a "VARIANCE" label over the word "Matched" — a
                          metric name with a status for a value. One pill now
                          carries the state AND the signed gap. */}
                      {run.status === "completed" && (
                        <div className="hidden sm:block">{variancePill(run.variance_cents)}</div>
                      )}
                      {expandedRun === run.id
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground" strokeWidth={2.2} />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" strokeWidth={2.2} />}
                    </div>
                  </button>

                  {expandedRun === run.id && (
                    <div className="border-t px-4 pb-4 pt-3">
                      {/* Run detail strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        {[
                          { l: isAr ? "المتوقع" : "Expected", v: fmt(run.expected_amount_cents) },
                          { l: isAr ? "الفعلي" : "Actual", v: fmt(run.actual_amount_cents) },
                          { l: isAr ? "الطلبات" : "Orders", v: String(run.total_orders_checked) },
                          { l: isAr ? "المعاملات" : "Txns", v: String(run.total_transactions_checked) },
                        ].map(s => (
                          <div key={s.l} className="rounded-xl bg-muted/40 p-3">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">{s.l}</p>
                            <p className="text-sm font-extrabold tabular-nums mt-0.5">{s.v}</p>
                          </div>
                        ))}
                      </div>

                      {loadingMismatches === run.id ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (mismatches[run.id]?.length ?? 0) === 0 ? (
                        <div className="text-center py-6">
                          <CheckCircle2 className="h-7 w-7 text-sage mx-auto mb-1.5" strokeWidth={2} />
                          <p className="text-sm font-bold">{isAr ? "كل حاجة متطابقة" : "Everything matches"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isAr ? "مفيش اختلافات في الفترة دي" : "No mismatches in this run"}
                          </p>
                        </div>
                      ) : (
                        <ResponsiveTable
                          mobile={
                            <MobileCardList>
                              {mismatches[run.id]?.map((m) => (
                                <MobileCard
                                  key={m.id}
                                  title={
                                    <span className="font-mono">{m.order_number || "—"}</span>
                                  }
                                  subtitle={m.gateway || "—"}
                                  /* Expected vs actual is the entire point of a
                                     mismatch row, so both stay visible rather
                                     than being demoted to a detail view. */
                                  trailing={
                                    m.actual_amount_cents != null
                                      ? fmt(m.actual_amount_cents)
                                      : m.gateway?.toLowerCase() === "cod"
                                        ? isAr
                                          ? "نقدي"
                                          : "Cash"
                                        : "—"
                                  }
                                  trailingMeta={
                                    <span className="tabular-nums">
                                      {isAr ? "المتوقع" : "expected"}{" "}
                                      {m.expected_amount_cents != null
                                        ? fmt(m.expected_amount_cents)
                                        : "—"}
                                    </span>
                                  }
                                  badges={
                                    <>
                                      {mismatchTypePill(m.mismatch_type)}
                                      {m.resolved ? (
                                        <span className="souq-pill bg-emerald-500/14 text-emerald-700 dark:text-emerald-400">
                                          <span className="dot" />
                                          {isAr ? "اتحلّ" : "Resolved"}
                                        </span>
                                      ) : (
                                        <span className="souq-pill bg-amber-500/14 text-amber-700 dark:text-amber-400">
                                          <span className="dot" />
                                          {isAr ? "مفتوح" : "Open"}
                                        </span>
                                      )}
                                    </>
                                  }
                                />
                              ))}
                            </MobileCardList>
                          }
                        >
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-[11px] font-semibold">{isAr ? "النوع" : "Type"}</TableHead>
                                <TableHead className="text-[11px] font-semibold">{isAr ? "رقم الطلب" : "Order"}</TableHead>
                                <TableHead className="text-[11px] font-semibold">{isAr ? "البوابة" : "Gateway"}</TableHead>
                                <TableHead className="text-[11px] font-semibold">{isAr ? "المتوقع" : "Expected"}</TableHead>
                                <TableHead className="text-[11px] font-semibold">{isAr ? "الفعلي" : "Actual"}</TableHead>
                                <TableHead className="text-[11px] font-semibold">{isAr ? "الحالة" : "Status"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {mismatches[run.id]?.map((m) => (
                                <TableRow key={m.id}>
                                  <TableCell>{mismatchTypePill(m.mismatch_type)}</TableCell>
                                  <TableCell className="font-mono text-xs font-bold">{m.order_number || "—"}</TableCell>
                                  <TableCell className="text-xs">{m.gateway || "—"}</TableCell>
                                  <TableCell className="text-xs font-extrabold tabular-nums">
                                    {m.expected_amount_cents != null ? fmt(m.expected_amount_cents) : "—"}
                                  </TableCell>
                                  <TableCell className="text-xs font-extrabold tabular-nums">
                                    {m.actual_amount_cents != null
                                      ? fmt(m.actual_amount_cents)
                                      : m.gateway?.toLowerCase() === "cod"
                                        ? (isAr ? "نقدي" : "Cash")
                                        : "—"}
                                  </TableCell>
                                  <TableCell>
                                    {m.resolved ? (
                                      <span className="souq-pill bg-emerald-500/14 text-emerald-700 dark:text-emerald-400">
                                        <span className="dot" />
                                        {isAr ? "اتحلّ" : "Resolved"}
                                      </span>
                                    ) : (
                                      <span className="souq-pill bg-amber-500/14 text-amber-700 dark:text-amber-400">
                                        <span className="dot" />
                                        {isAr ? "مفتوح" : "Open"}
                                      </span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        </ResponsiveTable>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CODReconciliation;
