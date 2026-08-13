import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
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

  const fmt = (cents: number) => {
    const v = cents / 100;
    return isAr ? `${v.toLocaleString("ar-EG")} ج.م` : `EGP ${v.toLocaleString()}`;
  };
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" });

  const filtered = runs.filter(r => statusFilter === "all" || r.status === statusFilter);

  // Spec-aligned KPIs: "Collected this month" / "To reconcile" / "Reconciled".
  // Derived from the runs feed — matched portion vs variance, calendar-month
  // bucket. Best-effort directional figures.
  const monthStart = (() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; })();
  const thisMonthRuns = runs.filter(r => new Date(r.period_start) >= monthStart);
  const collectedThisMonth = thisMonthRuns.reduce((s, r) => s + r.actual_amount_cents, 0);
  const totalVariance = runs.reduce((s, r) => s + Math.abs(r.expected_amount_cents - r.actual_amount_cents), 0);
  const reconciledTotal = runs.filter(r => r.status === "completed").reduce((s, r) => s + r.actual_amount_cents, 0);

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
      duplicate_transaction:    { bg: "bg-orange-500/14",    color: "text-orange-700 dark:text-orange-400", en: "Duplicate",     ar: "معاملة مكررة" },
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
    { v: "failed", en: "Failed", ar: "فشل" },
    { v: "pending", en: "Pending", ar: "مستني" },
  ];

  return (
    <div className="space-y-6">
      {/* ─── Page head ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
            {isAr ? "تسوية الدفع عند الاستلام" : "COD reconciliation"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr
              ? "طابق الفلوس المحصّلة مع شركة الشحن"
              : "Match collected cash with your courier"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          />
          <Button onClick={handleTrigger} disabled={triggering} variant="accent" size="sm" className="gap-1.5">
            {triggering
              ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              : <Play className="h-4 w-4" strokeWidth={2.4} />}
            {isAr ? "سوّي الكل" : "Reconcile all"}
          </Button>
        </div>
      </div>

      {/* ─── 3 stat tiles (Souq spec) ───────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="ichip ichip-navy">
              <Banknote className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[12.5px] font-semibold text-muted-foreground">
                {isAr ? "اتحصّل الشهر ده" : "Collected this month"}
              </p>
              <p className="text-[23px] font-extrabold tabular-nums leading-none mt-1">
                {fmt(collectedThisMonth)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="ichip ichip-saffron">
              <Hourglass className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[12.5px] font-semibold text-muted-foreground">
                {isAr ? "محتاج تسوية" : "To reconcile"}
              </p>
              <p className="text-[23px] font-extrabold tabular-nums leading-none mt-1">
                {fmt(totalVariance)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex flex-col gap-3">
            <div className="ichip ichip-sage">
              <CheckCircle2 className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[12.5px] font-semibold text-muted-foreground">
                {isAr ? "اتسوّى" : "Reconciled"}
              </p>
              <p className="text-[23px] font-extrabold tabular-nums leading-none mt-1">
                {fmt(reconciledTotal)}
              </p>
            </div>
          </CardContent>
        </Card>
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
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="ichip ichip-saffron ichip-lg">
                <FileSearch className="h-6 w-6" strokeWidth={2} />
              </div>
              <p className="text-sm font-bold">
                {runs.length === 0
                  ? (isAr ? "لا توجد عمليات تسوية لسه" : "No reconciliation runs yet")
                  : (isAr ? "لا توجد نتائج لهذا الفلتر" : "No runs match this filter")}
              </p>
              <p className="text-xs text-muted-foreground max-w-sm text-center">
                {runs.length === 0
                  ? (isAr ? "التسوية بتشتغل تلقائياً كل يوم — أو شغّلها يدوياً" : "Runs happen automatically each day — or trigger one manually")
                  : ""}
              </p>
            </div>
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
                        <p className="text-sm font-bold">
                          {fmtDate(run.period_start)} — {fmtDate(run.period_end)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                          {run.total_orders_checked} {isAr ? "طلب" : "orders"}
                          {" · "}
                          {run.total_transactions_checked} {isAr ? "معاملة" : "txns"}
                          {run.mismatches_found > 0 && (
                            <span className="text-destructive font-bold">
                              {" · "}{run.mismatches_found} {isAr ? "اختلاف" : "mismatches"}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-end hidden sm:block">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">
                          {isAr ? "الفرق" : "Variance"}
                        </p>
                        <p className={`text-sm font-extrabold tabular-nums ${run.variance_cents === 0 ? "text-sage" : "text-amber-600"}`}>
                          {run.variance_cents === 0
                            ? (isAr ? "متطابق" : "Matched")
                            : fmt(Math.abs(run.variance_cents))}
                        </p>
                      </div>
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
