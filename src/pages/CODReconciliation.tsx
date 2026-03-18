import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  CircleDollarSign,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Scale,
  Play,
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

  const fetchRuns = () => {
    if (!storeId) return;
    setLoading(true);
    listReconciliationRuns(storeId)
      .then(setRuns)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRuns();
  }, [storeId]);

  const handleTrigger = async () => {
    if (!storeId || triggering) return;
    setTriggering(true);
    try {
      const result = await triggerReconciliation(storeId);
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
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
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

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const filtered = runs.filter(r => statusFilter === "all" || r.status === statusFilter);

  const totalExpected = runs.reduce((s, r) => s + r.expected_amount_cents, 0);
  const totalActual = runs.reduce((s, r) => s + r.actual_amount_cents, 0);
  const totalMismatches = runs.reduce((s, r) => s + r.mismatches_found, 0);
  const completedRuns = runs.filter(r => r.status === "completed").length;

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-3 w-3" />{isAr ? "مكتمل" : "Completed"}</Badge>;
      case "failed":
        return <Badge variant="secondary" className="gap-1 bg-destructive/10 text-destructive"><AlertTriangle className="h-3 w-3" />{isAr ? "فشل" : "Failed"}</Badge>;
      case "running":
        return <Badge variant="secondary" className="gap-1 bg-blue-500/10 text-blue-600"><Loader2 className="h-3 w-3 animate-spin" />{isAr ? "قيد التشغيل" : "Running"}</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1 bg-muted text-muted-foreground"><Clock className="h-3 w-3" />{isAr ? "معلق" : "Pending"}</Badge>;
    }
  };

  const mismatchTypeBadge = (type: string) => {
    switch (type) {
      case "amount_mismatch":
        return <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200">{isAr ? "فرق مبلغ" : "Amount Mismatch"}</Badge>;
      case "paid_order_no_transaction":
        return <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-200">{isAr ? "طلب بدون معاملة" : "Order No Transaction"}</Badge>;
      case "transaction_no_order":
        return <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-200">{isAr ? "معاملة بدون طلب" : "Transaction No Order"}</Badge>;
      case "duplicate_transaction":
        return <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-200">{isAr ? "معاملة مكررة" : "Duplicate"}</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{isAr ? "تسوية المدفوعات" : "Payment Reconciliation"}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{isAr ? "مراجعة تسويات المدفوعات اليومية وأي اختلافات" : "Review daily payment reconciliation runs and mismatches"}</p>
        </div>
        <Button onClick={handleTrigger} disabled={triggering} size="sm" className="gap-1.5 shrink-0">
          {triggering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {isAr ? "تشغيل الآن" : "Run Now"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{isAr ? "إجمالي المتوقع" : "Total Expected"}</p>
                <p className="text-2xl font-bold">{formatCurrency(totalExpected)}</p>
                <p className="text-xs text-muted-foreground">{runs.length} {isAr ? "عملية تسوية" : "runs"}</p>
              </div>
              <div className="rounded-lg p-2.5 bg-primary/10 text-primary">
                <CircleDollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{isAr ? "إجمالي الفعلي" : "Total Actual"}</p>
                <p className="text-2xl font-bold">{formatCurrency(totalActual)}</p>
                <p className="text-xs text-muted-foreground">{completedRuns} {isAr ? "مكتمل" : "completed"}</p>
              </div>
              <div className="rounded-lg p-2.5 bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{isAr ? "الفرق" : "Variance"}</p>
                <p className="text-2xl font-bold">{formatCurrency(Math.abs(totalExpected - totalActual))}</p>
                <p className="text-xs text-muted-foreground">{totalExpected > totalActual ? (isAr ? "نقص" : "Under") : (isAr ? "زيادة" : "Over")}</p>
              </div>
              <div className="rounded-lg p-2.5 bg-amber-500/10 text-amber-600">
                <Scale className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{isAr ? "الاختلافات" : "Mismatches"}</p>
                <p className="text-2xl font-bold">{totalMismatches}</p>
                <p className="text-xs text-muted-foreground">{isAr ? "تحتاج مراجعة" : "need review"}</p>
              </div>
              <div className="rounded-lg p-2.5 bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Runs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">{isAr ? "عمليات التسوية" : "Reconciliation Runs"}</CardTitle>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as RunStatus)}>
              <TabsList>
                <TabsTrigger value="all">{isAr ? "الكل" : "All"}</TabsTrigger>
                <TabsTrigger value="completed">{isAr ? "مكتمل" : "Completed"}</TabsTrigger>
                <TabsTrigger value="failed">{isAr ? "فشل" : "Failed"}</TabsTrigger>
                <TabsTrigger value="pending">{isAr ? "معلق" : "Pending"}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <FileSearch className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {runs.length === 0
                  ? (isAr ? "لا توجد عمليات تسوية بعد. تتم التسوية تلقائياً يومياً." : "No reconciliation runs yet. Runs happen automatically every day.")
                  : (isAr ? "لا توجد نتائج لهذا الفلتر" : "No runs match this filter")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((run) => (
                <div key={run.id} className="rounded-lg border">
                  <button
                    className="w-full flex items-center justify-between p-4 text-start hover:bg-muted/30 transition-colors"
                    onClick={() => toggleRun(run.id)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="shrink-0">
                        {statusBadge(run.status)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {formatDate(run.period_start)} — {formatDate(run.period_end)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {run.total_orders_checked} {isAr ? "طلب" : "orders"} · {run.total_transactions_checked} {isAr ? "معاملة" : "transactions"}
                          {run.mismatches_found > 0 && (
                            <span className="text-destructive font-medium"> · {run.mismatches_found} {isAr ? "اختلاف" : "mismatches"}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-end hidden sm:block">
                        <p className="text-xs text-muted-foreground">{isAr ? "الفرق" : "Variance"}</p>
                        <p className={`text-sm font-medium ${run.variance_cents === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                          {run.variance_cents === 0 ? (isAr ? "متطابق" : "Matched") : formatCurrency(Math.abs(run.variance_cents))}
                        </p>
                      </div>
                      {expandedRun === run.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {expandedRun === run.id && (
                    <div className="border-t px-4 pb-4 pt-3">
                      {/* Run details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <div className="rounded-lg bg-muted/40 p-2.5">
                          <p className="text-[10px] text-muted-foreground">{isAr ? "المتوقع" : "Expected"}</p>
                          <p className="text-sm font-medium">{formatCurrency(run.expected_amount_cents)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2.5">
                          <p className="text-[10px] text-muted-foreground">{isAr ? "الفعلي" : "Actual"}</p>
                          <p className="text-sm font-medium">{formatCurrency(run.actual_amount_cents)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2.5">
                          <p className="text-[10px] text-muted-foreground">{isAr ? "الطلبات" : "Orders"}</p>
                          <p className="text-sm font-medium">{run.total_orders_checked}</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2.5">
                          <p className="text-[10px] text-muted-foreground">{isAr ? "المعاملات" : "Transactions"}</p>
                          <p className="text-sm font-medium">{run.total_transactions_checked}</p>
                        </div>
                      </div>

                      {/* Mismatches */}
                      {loadingMismatches === run.id ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (mismatches[run.id]?.length ?? 0) === 0 ? (
                        <div className="text-center py-4">
                          <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                          <p className="text-xs text-muted-foreground">{isAr ? "لا توجد اختلافات — كل شيء متطابق" : "No mismatches — everything matches"}</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">{isAr ? "النوع" : "Type"}</TableHead>
                                <TableHead className="text-xs">{isAr ? "رقم الطلب" : "Order"}</TableHead>
                                <TableHead className="text-xs">{isAr ? "البوابة" : "Gateway"}</TableHead>
                                <TableHead className="text-xs">{isAr ? "المتوقع" : "Expected"}</TableHead>
                                <TableHead className="text-xs">{isAr ? "الفعلي" : "Actual"}</TableHead>
                                <TableHead className="text-xs">{isAr ? "الحالة" : "Status"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {mismatches[run.id]?.map((m) => (
                                <TableRow key={m.id}>
                                  <TableCell>{mismatchTypeBadge(m.mismatch_type)}</TableCell>
                                  <TableCell className="font-mono text-xs">{m.order_number || "—"}</TableCell>
                                  <TableCell className="text-xs">{m.gateway || "—"}</TableCell>
                                  <TableCell className="text-xs font-medium">{m.expected_amount_cents != null ? formatCurrency(m.expected_amount_cents) : "—"}</TableCell>
                                  <TableCell className="text-xs font-medium">{m.actual_amount_cents != null ? formatCurrency(m.actual_amount_cents) : "—"}</TableCell>
                                  <TableCell>
                                    {m.resolved ? (
                                      <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 gap-1">
                                        <CheckCircle2 className="h-2.5 w-2.5" />{isAr ? "تم الحل" : "Resolved"}
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 gap-1">
                                        <Clock className="h-2.5 w-2.5" />{isAr ? "مفتوح" : "Open"}
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
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
