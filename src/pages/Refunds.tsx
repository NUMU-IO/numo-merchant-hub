import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, RotateCcw, CheckCircle2, XCircle, ArrowRightLeft, ChevronLeft, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import {
  listStoreRefunds, approveRefund, rejectRefund, processRefund,
  RefundListItem, RefundStatus,
} from "@/services/refundApi";

// ── Helpers ──

const STATUS_LABELS: Record<RefundStatus, { en: string; ar: string; color: string }> = {
  requested:  { en: "Requested",  ar: "مطلوب",     color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  approved:   { en: "Approved",   ar: "موافق عليه", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  processing: { en: "Processing", ar: "جاري المعالجة", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  processed:  { en: "Processed",  ar: "تمت المعالجة", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400" },
  completed:  { en: "Completed",  ar: "مكتمل",     color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  rejected:   { en: "Rejected",   ar: "مرفوض",     color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  failed:     { en: "Failed",     ar: "فشل",       color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
};

const REASON_LABELS: Record<string, { en: string; ar: string }> = {
  defective:        { en: "Defective item",      ar: "منتج معيب" },
  wrong_item:       { en: "Wrong item",          ar: "منتج خاطئ" },
  not_as_described: { en: "Not as described",    ar: "لا يطابق الوصف" },
  customer_request: { en: "Customer request",    ar: "طلب العميل" },
  duplicate_order:  { en: "Duplicate order",     ar: "طلب مكرر" },
  other:            { en: "Other",               ar: "أخرى" },
};

const ALL_STATUSES: Array<RefundStatus | "all"> = [
  "all", "requested", "approved", "processing", "processed", "completed", "rejected", "failed",
];

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("en-EG", { style: "currency", currency }).format(cents / 100);
}

// ── Main Component ──

const Refunds = () => {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const qc = useQueryClient();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const [activeTab, setActiveTab] = useState<RefundStatus | "all">("all");
  const [page, setPage] = useState(1);

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<RefundListItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Action loading states
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["store-refunds", storeId, activeTab, page],
    queryFn: () =>
      listStoreRefunds(storeId!, {
        status: activeTab === "all" ? undefined : activeTab,
        page,
        page_size: 20,
      }),
    enabled: !!storeId,
    placeholderData: (prev) => prev,
  });

  const refunds = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["store-refunds", storeId] });

  const handleApprove = async (r: RefundListItem) => {
    setLoadingId(r.id);
    try {
      await approveRefund(storeId!, r.order_id, r.id);
      toast.success(isAr ? "تمت الموافقة على الاسترداد" : "Refund approved");
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : (isAr ? "فشل في الموافقة" : "Approval failed"));
    } finally {
      setLoadingId(null);
    }
  };

  const handleProcess = async (r: RefundListItem) => {
    setLoadingId(r.id);
    try {
      await processRefund(storeId!, r.order_id, r.id);
      toast.success(isAr ? "جاري معالجة الاسترداد" : "Refund processing started");
      invalidate();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : (isAr ? "فشل في المعالجة" : "Processing failed"));
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setIsRejecting(true);
    try {
      await rejectRefund(storeId!, rejectTarget.order_id, rejectTarget.id, rejectReason || undefined);
      toast.success(isAr ? "تم رفض الاسترداد" : "Refund rejected");
      invalidate();
      setRejectTarget(null);
      setRejectReason("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : (isAr ? "فشل في الرفض" : "Rejection failed"));
    } finally {
      setIsRejecting(false);
    }
  };

  const tabLabel = (s: RefundStatus | "all") =>
    s === "all" ? (isAr ? "الكل" : "All") : (isAr ? STATUS_LABELS[s].ar : STATUS_LABELS[s].en);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">
            {isAr ? "إدارة المستردات" : "Refund Management"}
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={invalidate}
          disabled={isFetching}
          className="gap-1.5"
        >
          <RotateCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          {isAr ? "تحديث" : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{isAr ? "سجل المستردات" : "Refund History"}</CardTitle>
          <CardDescription>
            {isAr
              ? "عرض جميع طلبات الاسترداد مع إمكانية الموافقة أو الرفض"
              : "View all refund requests and approve or reject them"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as RefundStatus | "all"); setPage(1); }}>
            <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
              {ALL_STATUSES.map((s) => (
                <TabsTrigger key={s} value={s} className="text-xs h-7 px-2.5">
                  {tabLabel(s)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : refunds.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
              <ArrowRightLeft className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                {isAr ? "لا توجد مستردات" : "No refunds found"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isAr ? "رقم الاسترداد" : "Refund #"}</TableHead>
                    <TableHead>{isAr ? "رقم الطلب" : "Order #"}</TableHead>
                    <TableHead>{isAr ? "النوع" : "Type"}</TableHead>
                    <TableHead>{isAr ? "السبب" : "Reason"}</TableHead>
                    <TableHead>{isAr ? "المبلغ" : "Amount"}</TableHead>
                    <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{isAr ? "التاريخ" : "Date"}</TableHead>
                    <TableHead className="text-right">{isAr ? "إجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.map((r) => {
                    const statusMeta = STATUS_LABELS[r.status];
                    const reasonMeta = REASON_LABELS[r.reason];
                    const isThisLoading = loadingId === r.id;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">
                          {r.refund_number}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.order_number ?? r.order_id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs capitalize">{r.refund_type}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {isAr ? reasonMeta?.ar : reasonMeta?.en}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {formatAmount(r.amount, r.currency)}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.color}`}>
                            {isAr ? statusMeta.ar : statusMeta.en}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(r.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1.5">
                            {r.status === "requested" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-900 dark:hover:bg-green-950 gap-1"
                                  onClick={() => handleApprove(r)}
                                  disabled={isThisLoading}
                                >
                                  {isThisLoading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3" />
                                  )}
                                  <span className="text-xs">{isAr ? "موافقة" : "Approve"}</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-950 gap-1"
                                  onClick={() => setRejectTarget(r)}
                                  disabled={isThisLoading}
                                >
                                  <XCircle className="h-3 w-3" />
                                  <span className="text-xs">{isAr ? "رفض" : "Reject"}</span>
                                </Button>
                              </>
                            )}
                            {r.status === "approved" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 gap-1"
                                onClick={() => handleProcess(r)}
                                disabled={isThisLoading}
                              >
                                {isThisLoading ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ArrowRightLeft className="h-3 w-3" />
                                )}
                                <span className="text-xs">{isAr ? "معالجة" : "Process"}</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isFetching}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isAr ? "رفض الاسترداد" : "Reject Refund"}</DialogTitle>
            <DialogDescription>
              {isAr
                ? `رقم الاسترداد: ${rejectTarget?.refund_number}`
                : `Refund: ${rejectTarget?.refund_number}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid gap-1.5">
              <Label>{isAr ? "سبب الرفض (اختياري)" : "Rejection reason (optional)"}</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={isAr ? "اكتب سبب الرفض..." : "Enter rejection reason..."}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isRejecting} className="gap-2">
              {isRejecting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAr ? "تأكيد الرفض" : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Refunds;
