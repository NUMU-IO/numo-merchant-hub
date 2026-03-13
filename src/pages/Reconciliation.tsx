import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listReconciliationRuns,
  listRunMismatches,
  type ReconciliationRun,
  type MismatchType,
} from "@/services/reconciliationApi";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Activity,
  Scale,
  TrendingDown,
} from "lucide-react";

// ── Helpers ──

function formatCents(cents: number): string {
  return `EGP ${(Math.abs(cents) / 100).toLocaleString("en-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Status badge ──

function RunStatusBadge({ run }: { run: ReconciliationRun }) {
  if (run.status === "failed") {
    return (
      <Badge variant="secondary" className="gap-1 bg-destructive/10 text-destructive">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  }
  if (run.status === "running") {
    return (
      <Badge variant="secondary" className="gap-1 bg-blue-500/10 text-blue-600">
        <Activity className="h-3 w-3" />
        Running
      </Badge>
    );
  }
  if (run.mismatches_found === 0) {
    return (
      <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600">
        <CheckCircle2 className="h-3 w-3" />
        Clean
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-600">
      <AlertTriangle className="h-3 w-3" />
      {run.mismatches_found} mismatch{run.mismatches_found !== 1 ? "es" : ""}
    </Badge>
  );
}

// ── Mismatch type label ──

const MISMATCH_LABELS: Record<MismatchType, { label: string; color: string }> = {
  amount_mismatch: {
    label: "Amount Mismatch",
    color: "bg-amber-500/10 text-amber-700",
  },
  missing_transaction: {
    label: "Missing Transaction",
    color: "bg-red-500/10 text-red-700",
  },
  missing_order: {
    label: "Missing Order",
    color: "bg-orange-500/10 text-orange-700",
  },
  duplicate_transaction: {
    label: "Duplicate",
    color: "bg-purple-500/10 text-purple-700",
  },
};

function MismatchTypeBadge({ type }: { type: string }) {
  const cfg = MISMATCH_LABELS[type as MismatchType];
  if (!cfg) {
    return (
      <Badge variant="secondary" className="text-xs">
        {type}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={`text-xs ${cfg.color}`}>
      {cfg.label}
    </Badge>
  );
}

// ── Mismatch rows (lazy-loaded per run) ──

function MismatchTable({
  storeId,
  runId,
}: {
  storeId: string;
  runId: string;
}) {
  const { data: mismatches = [], isLoading } = useQuery({
    queryKey: ["reconciliation-mismatches", storeId, runId],
    queryFn: () => listRunMismatches(storeId, runId),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        Loading mismatches…
      </div>
    );
  }

  if (mismatches.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No mismatches recorded for this run.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs">Order #</TableHead>
            <TableHead className="text-xs">Gateway</TableHead>
            <TableHead className="text-xs">Transaction ID</TableHead>
            <TableHead className="text-xs text-right">Expected</TableHead>
            <TableHead className="text-xs text-right">Actual</TableHead>
            <TableHead className="text-xs">Notes</TableHead>
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mismatches.map((m) => (
            <TableRow key={m.id} className="bg-muted/20">
              <TableCell>
                <MismatchTypeBadge type={m.mismatch_type} />
              </TableCell>
              <TableCell className="font-mono text-xs">
                {m.order_number ?? "—"}
              </TableCell>
              <TableCell className="text-xs capitalize">
                {m.gateway ?? "—"}
              </TableCell>
              <TableCell className="font-mono text-xs max-w-[140px] truncate">
                {m.gateway_transaction_id ?? "—"}
              </TableCell>
              <TableCell className="text-right text-xs">
                {m.expected_amount_cents != null
                  ? formatCents(m.expected_amount_cents)
                  : "—"}
              </TableCell>
              <TableCell className="text-right text-xs">
                {m.actual_amount_cents != null
                  ? formatCents(m.actual_amount_cents)
                  : "—"}
              </TableCell>
              <TableCell className="text-xs max-w-[180px] truncate text-muted-foreground">
                {m.notes ?? "—"}
              </TableCell>
              <TableCell>
                {m.resolved ? (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-emerald-500/10 text-emerald-600"
                  >
                    Resolved
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-amber-500/10 text-amber-600"
                  >
                    Open
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Expandable run row ──

function RunRow({
  run,
  storeId,
}: {
  run: ReconciliationRun;
  storeId: string;
}) {
  const [open, setOpen] = useState(false);
  const hasMismatches = run.mismatches_found > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow
          className={`cursor-pointer hover:bg-muted/40 transition-colors ${
            hasMismatches ? "border-l-2 border-l-amber-400" : ""
          }`}
        >
          <TableCell className="w-8 pr-0">
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </TableCell>
          <TableCell className="text-sm font-medium">
            {formatDate(run.period_start)}
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {formatDate(run.period_end)}
          </TableCell>
          <TableCell>
            <RunStatusBadge run={run} />
          </TableCell>
          <TableCell className="text-sm text-right tabular-nums">
            {run.total_orders_checked.toLocaleString()}
          </TableCell>
          <TableCell className="text-sm text-right tabular-nums">
            {formatCents(run.expected_amount_cents)}
          </TableCell>
          <TableCell className="text-sm text-right tabular-nums">
            {formatCents(run.actual_amount_cents)}
          </TableCell>
          <TableCell
            className={`text-sm text-right tabular-nums font-medium ${
              run.variance_cents !== 0 ? "text-destructive" : "text-emerald-600"
            }`}
          >
            {run.variance_cents === 0
              ? "—"
              : `${run.variance_cents > 0 ? "+" : "-"}${formatCents(run.variance_cents)}`}
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">
            {run.completed_at ? formatDateTime(run.completed_at) : "—"}
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>

      <CollapsibleContent asChild>
        <TableRow>
          <TableCell colSpan={9} className="p-0 bg-muted/10">
            <div className="px-6 py-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Mismatches for {formatDate(run.period_start)}
              </p>
              <MismatchTable storeId={storeId} runId={run.id} />
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Main page ──

const Reconciliation = () => {
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? "";

  const {
    data: runs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["reconciliation-runs", storeId],
    queryFn: () => listReconciliationRuns(storeId, { limit: 30 }),
    enabled: Boolean(storeId),
    staleTime: 2 * 60 * 1000,
  });

  // KPI derivation
  const totalRuns = runs.length;
  const cleanRuns = runs.filter(
    (r) => r.status === "completed" && r.mismatches_found === 0,
  ).length;
  const runsWithMismatches = runs.filter(
    (r) => r.mismatches_found > 0,
  ).length;
  const totalVariance = runs.reduce((acc, r) => acc + Math.abs(r.variance_cents), 0);

  const kpis = [
    {
      title: "Total Runs",
      value: totalRuns.toString(),
      subtitle: "Last 30 reconciliation cycles",
      icon: Activity,
      iconBg: "bg-primary/10 text-primary",
    },
    {
      title: "Clean Runs",
      value: cleanRuns.toString(),
      subtitle: "No mismatches detected",
      icon: CheckCircle2,
      iconBg: "bg-emerald-500/10 text-emerald-600",
    },
    {
      title: "Runs with Mismatches",
      value: runsWithMismatches.toString(),
      subtitle: "Require attention",
      icon: AlertTriangle,
      iconBg:
        runsWithMismatches > 0
          ? "bg-amber-500/10 text-amber-600"
          : "bg-muted text-muted-foreground",
    },
    {
      title: "Total Variance",
      value: formatCents(totalVariance),
      subtitle: "Absolute sum across all runs",
      icon: TrendingDown,
      iconBg:
        totalVariance > 0
          ? "bg-destructive/10 text-destructive"
          : "bg-emerald-500/10 text-emerald-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Payment Reconciliation
          </h1>
          <p className="text-muted-foreground">
            Daily comparison of orders vs payment transactions. Runs automatically
            at 2 AM UTC.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                </div>
                <div className={`rounded-lg p-2.5 ${kpi.iconBg}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Run history table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Reconciliation History
            </CardTitle>
            {runsWithMismatches > 0 && (
              <Badge
                variant="secondary"
                className="gap-1 bg-amber-500/10 text-amber-600"
              >
                <AlertTriangle className="h-3 w-3" />
                {runsWithMismatches} run
                {runsWithMismatches !== 1 ? "s" : ""} need attention
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm">Failed to load reconciliation data.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              Loading runs…
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Activity className="h-8 w-8 opacity-30" />
              <p className="text-sm">No reconciliation runs yet.</p>
              <p className="text-xs">
                Runs are scheduled daily at 2 AM UTC automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Period Start</TableHead>
                    <TableHead>Period End</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <RunRow key={run.id} run={run} storeId={storeId} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          Clean — zero mismatches
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          Mismatches found — click row to expand
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-destructive" />
          Run failed
        </div>
      </div>
    </div>
  );
};

export default Reconciliation;
