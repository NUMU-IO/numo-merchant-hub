import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { codTransactions, codSummary, type CODStatus } from "@/data/mock-cod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const CODReconciliation = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<"all" | CODStatus>("all");

  const formatCurrency = (val: number) =>
    language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  const filtered = codTransactions.filter(
    (tx) => statusFilter === "all" || tx.status === statusFilter
  );

  const statusConfig: Record<CODStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
    settled: { icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", label: t("cod.settled") },
    collected: { icon: Banknote, color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: t("cod.collected") },
    in_transit: { icon: Truck, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", label: t("cod.inTransit") },
    pending: { icon: Clock, color: "bg-muted text-muted-foreground", label: t("cod.pending") },
    disputed: { icon: AlertTriangle, color: "bg-destructive/10 text-destructive", label: t("cod.disputed") },
  };

  const kpis = [
    {
      title: t("cod.totalCOD"),
      value: formatCurrency(codSummary.totalCOD),
      subtitle: `${codSummary.totalCount} ${t("cod.transactions")}`,
      icon: CircleDollarSign,
      iconBg: "bg-primary/10 text-primary",
    },
    {
      title: t("cod.settledAmount"),
      value: formatCurrency(codSummary.settled),
      subtitle: `${codSummary.settledCount} ${t("cod.transactions")}`,
      icon: CheckCircle2,
      iconBg: "bg-emerald-500/10 text-emerald-600",
      trend: "+12%",
      trendUp: true,
    },
    {
      title: t("cod.outstanding"),
      value: formatCurrency(codSummary.collected + codSummary.inTransit + codSummary.pending),
      subtitle: `${codSummary.collectedCount + codSummary.inTransitCount + codSummary.pendingCount} ${t("cod.transactions")}`,
      icon: Clock,
      iconBg: "bg-amber-500/10 text-amber-600",
    },
    {
      title: t("cod.disputed"),
      value: formatCurrency(codSummary.disputed),
      subtitle: `${codSummary.disputedCount} ${t("cod.transactions")}`,
      icon: AlertTriangle,
      iconBg: "bg-destructive/10 text-destructive",
      trend: "-2%",
      trendUp: false,
    },
  ];

  const settlementRate = Math.round((codSummary.settled / codSummary.totalCOD) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("cod.title")}</h1>
        <p className="text-muted-foreground">{t("cod.subtitle")}</p>
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
              {kpi.trend && (
                <div className="mt-2 flex items-center gap-1 text-xs">
                  {kpi.trendUp ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-destructive" />
                  )}
                  <span className={kpi.trendUp ? "text-emerald-600" : "text-destructive"}>
                    {kpi.trend}
                  </span>
                  <span className="text-muted-foreground">{t("cod.thisWeek")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Settlement Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("cod.settlementProgress")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("cod.settledVsTotal")}</span>
            <span className="font-medium">{settlementRate}%</span>
          </div>
          <Progress value={settlementRate} className="h-3" />
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>{t("cod.settled")}: {formatCurrency(codSummary.settled)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span>{t("cod.collected")}: {formatCurrency(codSummary.collected)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>{t("cod.inTransit")}: {formatCurrency(codSummary.inTransit)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
              <span>{t("cod.pending")}: {formatCurrency(codSummary.pending)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive" />
              <span>{t("cod.disputed")}: {formatCurrency(codSummary.disputed)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">{t("cod.transactionList")}</CardTitle>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | CODStatus)}>
              <TabsList>
                <TabsTrigger value="all">{t("cod.all")}</TabsTrigger>
                <TabsTrigger value="pending">{t("cod.pending")}</TabsTrigger>
                <TabsTrigger value="in_transit">{t("cod.inTransit")}</TabsTrigger>
                <TabsTrigger value="collected">{t("cod.collected")}</TabsTrigger>
                <TabsTrigger value="settled">{t("cod.settled")}</TabsTrigger>
                <TabsTrigger value="disputed">{t("cod.disputed")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t("cod.noTransactions")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("cod.codId")}</TableHead>
                    <TableHead>{t("cod.order")}</TableHead>
                    <TableHead>{t("cod.customer")}</TableHead>
                    <TableHead>{t("cod.amount")}</TableHead>
                    <TableHead>{t("cod.courier")}</TableHead>
                    <TableHead>{t("cod.zone")}</TableHead>
                    <TableHead>{t("cod.dispatchDate")}</TableHead>
                    <TableHead>{t("cod.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tx) => {
                    const cfg = statusConfig[tx.status];
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                        <TableCell className="font-mono text-xs">{tx.orderId}</TableCell>
                        <TableCell className="font-medium">
                          {language === "ar" ? tx.customerNameAr : tx.customerName}
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(tx.amount)}</TableCell>
                        <TableCell>{language === "ar" ? tx.courierNameAr : tx.courierName}</TableCell>
                        <TableCell>{language === "ar" ? tx.zoneAr : tx.zone}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(tx.dispatchDate).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: "short", day: "numeric" })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`gap-1 ${cfg.color}`}>
                            <cfg.icon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CODReconciliation;
