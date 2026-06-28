import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowRightCircle,
  ChevronRight,
  FileEdit,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  cancelOrder,
  convertDraftOrder,
  listOrders,
  type OrderListItem,
} from "@/services/orderApi";
import { showError } from "@/lib/show-error";

const DraftOrders = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAr = language === "ar";

  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<OrderListItem | null>(null);

  const draftsQuery = useQuery({
    queryKey: ["orders", storeId, "drafts", page],
    queryFn: () =>
      listOrders(storeId!, { page, limit: 20, status: "draft" }),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const drafts = draftsQuery.data?.items ?? [];
  const total = draftsQuery.data?.total ?? 0;

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["orders", storeId, "drafts"],
    });
    queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
  };

  const convert = useMutation({
    mutationFn: (orderId: string) => convertDraftOrder(storeId!, orderId),
    onSuccess: (order) => {
      toast.success(isAr ? "تم تحويل المسودة إلى طلب" : "Draft converted to order");
      invalidate();
      navigate(`/orders/${order.id}`);
    },
    onError: (err) => showError(err, language),
  });

  const remove = useMutation({
    mutationFn: (orderId: string) =>
      cancelOrder(storeId!, orderId, "Draft discarded"),
    onSuccess: () => {
      toast.success(isAr ? "تم حذف المسودة" : "Draft deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err) => showError(err, language),
  });

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return isAr
      ? `${val.toLocaleString("ar-EG")} ج.م`
      : `EGP ${val.toLocaleString()}`;
  };

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(isAr ? "ar-EG" : "en-US");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{t("drafts.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("drafts.subtitle")}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => navigate("/orders/create?draft=1")}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("drafts.newDraft")}
        </Button>
      </div>

      {draftsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : drafts.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileEdit}
            title={t("drafts.emptyTitle")}
            description={t("drafts.emptyDescription")}
            action={
              <Button
                size="sm"
                onClick={() => navigate("/orders/create?draft=1")}
              >
                <Plus className="h-3.5 w-3.5 me-1.5" />
                {t("drafts.newDraft")}
              </Button>
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "رقم المسودة" : "Draft #"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "العميل" : "Customer"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "المجموع" : "Total"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    {isAr ? "تاريخ الحفظ" : "Saved"}
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((d) => (
                  <TableRow
                    key={d.id}
                    className="group cursor-pointer"
                    onClick={() => navigate(`/orders/${d.id}`)}
                  >
                    <TableCell className="font-mono text-xs font-medium">
                      <div className="flex items-center gap-2">
                        {d.order_number}
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 bg-muted text-muted-foreground"
                        >
                          {t("orders.draft")}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium truncate max-w-[160px]">
                        {d.customer_name || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-semibold tabular-nums">
                        {formatCurrency(d.total)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(d.created_at)}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1"
                          disabled={
                            convert.isPending && convert.variables === d.id
                          }
                          onClick={() => convert.mutate(d.id)}
                        >
                          {convert.isPending && convert.variables === d.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ArrowRightCircle className="h-3 w-3" />
                          )}
                          {t("drafts.convert")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(d)}
                          aria-label={t("drafts.delete")}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 rtl:rotate-180" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {total > 20 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {isAr ? "السابق" : "Previous"}
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {page} / {Math.ceil(total / 20)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            {isAr ? "التالي" : "Next"}
          </Button>
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("drafts.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("drafts.deleteConfirm", {
                draft: deleteTarget?.order_number,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {isAr ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) remove.mutate(deleteTarget.id);
              }}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending && (
                <Loader2 className="h-3 w-3 animate-spin me-1.5" />
              )}
              {t("drafts.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DraftOrders;
