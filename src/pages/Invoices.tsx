import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  listInvoices, getInvoice, deleteInvoice, submitInvoice, downloadInvoicePdf,
  type InvoiceListItem, type Invoice, type InvoiceStatus,
} from "@/services/invoiceApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable, MobileCardList, MobileCard } from "@/components/ui/responsive-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, FileText, Download, Send, Trash2, Loader2, ChevronLeft, ChevronRight,
  Receipt, ExternalLink, QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import TaxSettingsCard from "@/components/invoices/TaxSettingsCard";

const PAGE_SIZE = 20;

export default function Invoices() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const invoicesQuery = useQuery({
    queryKey: ["invoices", storeId, currentPage, statusFilter],
    queryFn: () => listInvoices(storeId!, {
      page: currentPage,
      limit: PAGE_SIZE,
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    enabled: !!storeId,
    placeholderData: keepPreviousData,
  });

  const invoices = invoicesQuery.data?.items ?? [];
  const total = invoicesQuery.data?.total ?? 0;
  const totalPages = invoicesQuery.data?.total_pages ?? 1;

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
      year: "numeric", month: "short", day: "numeric",
    });

  const statusConfig: Record<string, { bg: string; dot: string }> = {
    draft: { bg: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200/60", dot: "bg-zinc-400" },
    pending: { bg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/60", dot: "bg-amber-500" },
    submitted: { bg: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200/60", dot: "bg-blue-500" },
    accepted: { bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/60", dot: "bg-emerald-500" },
    rejected: { bg: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200/60", dot: "bg-red-500" },
    cancelled: { bg: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200/60", dot: "bg-zinc-300" },
  };

  const typeLabels: Record<string, string> = {
    I: isAr ? "فاتورة" : "Invoice",
    C: isAr ? "إشعار دائن" : "Credit Note",
    D: isAr ? "إشعار مدين" : "Debit Note",
  };

  const openDetail = async (id: string) => {
    if (!storeId) return;
    setLoadingDetail(true);
    try {
      const inv = await getInvoice(storeId, id);
      setSelectedInvoice(inv);
    } catch (err) {
      showError(err, language);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = async () => {
    if (!storeId || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteInvoice(storeId, deleteTarget.id);
      toast.success(isAr ? "تم حذف الفاتورة" : "Invoice deleted");
      setDeleteTarget(null);
      invoicesQuery.refetch();
    } catch (err) {
      showError(err, language);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (invoiceId: string) => {
    if (!storeId) return;
    setSubmitting(true);
    try {
      const result = await submitInvoice(storeId, invoiceId);
      if (result.success) {
        toast.success(isAr ? "تم إرسال الفاتورة لمصلحة الضرائب" : "Invoice submitted to ETA");
        if (selectedInvoice?.id === invoiceId) {
          const updated = await getInvoice(storeId, invoiceId);
          setSelectedInvoice(updated);
        }
        invoicesQuery.refetch();
      } else {
        toast.error(result.error_message || "Submission failed");
      }
    } catch (err) {
      showError(err, language);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async (invoiceId: string) => {
    if (!storeId) return;
    try {
      await downloadInvoicePdf(storeId, invoiceId);
      toast.success(isAr ? "جارٍ تحميل الفاتورة" : "Downloading invoice");
    } catch (err) {
      showError(err, language);
    }
  };

  // Detail view
  if (selectedInvoice) {
    const inv = selectedInvoice;
    const cfg = statusConfig[inv.status] || statusConfig.draft;
    return (
      <div className="space-y-5 max-w-4xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => setSelectedInvoice(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight leading-tight tabular-nums">{inv.invoice_number}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{typeLabels[inv.invoice_type]} · {formatDate(inv.date_issued)}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] font-medium gap-1.5 rounded-md py-0.5 ${cfg.bg}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
            {inv.status}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg" onClick={() => handleDownloadPdf(inv.id)}>
            <Download className="h-3.5 w-3.5" />
            {isAr ? "تحميل PDF" : "Download PDF"}
          </Button>
          {inv.status === "draft" && (
            <Button size="sm" className="gap-1.5 h-8 rounded-lg" onClick={() => handleSubmit(inv.id)} disabled={submitting}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {isAr ? "إرسال لمصلحة الضرائب" : "Submit to ETA"}
            </Button>
          )}
          {inv.eta_portal_url && (
            <a href={inv.eta_portal_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 h-8 rounded-lg">
                <ExternalLink className="h-3.5 w-3.5" />
                {isAr ? "بوابة الضرائب" : "ETA Portal"}
              </Button>
            </a>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Line Items */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{isAr ? "بنود الفاتورة" : "Line Items"}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">{isAr ? "الوصف" : "Description"}</TableHead>
                    <TableHead className="text-[11px]">{isAr ? "الكمية" : "Qty"}</TableHead>
                    <TableHead className="text-[11px]">{isAr ? "السعر" : "Price"}</TableHead>
                    <TableHead className="text-[11px]">{isAr ? "الضريبة" : "Tax"}</TableHead>
                    <TableHead className="text-[11px]">{isAr ? "الإجمالي" : "Total"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.line_items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[13px]">
                        <p className="font-medium">{item.description}</p>
                        {item.description_ar && <p className="text-[11px] text-muted-foreground" dir="rtl">{item.description_ar}</p>}
                        {item.internal_code && <p className="text-[10px] text-muted-foreground font-mono">{item.internal_code}</p>}
                      </TableCell>
                      <TableCell className="text-[13px] tabular-nums">{item.quantity}</TableCell>
                      <TableCell className="text-[13px] tabular-nums">{item.unit_price}</TableCell>
                      <TableCell className="text-[13px] tabular-nums">
                        {item.taxes.map((tax, j) => (
                          <span key={j}>{tax.rate}%</span>
                        ))}
                      </TableCell>
                      <TableCell className="text-[13px] tabular-nums font-medium">{item.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 space-y-1.5 text-sm border-t pt-3">
                <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "المجموع" : "Subtotal"}</span><span className="tabular-nums">{formatCurrency(inv.subtotal)}</span></div>
                {inv.total_discount > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "الخصم" : "Discount"}</span><span className="tabular-nums text-primary">-{formatCurrency(inv.total_discount)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">{isAr ? "الضرائب" : "Taxes"}</span><span className="tabular-nums">{formatCurrency(inv.total_taxes)}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2"><span>{isAr ? "الإجمالي" : "Total"}</span><span className="tabular-nums">{formatCurrency(inv.total)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Seller */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{isAr ? "البائع" : "Seller"}</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-medium">{inv.seller.name}</p>
                {inv.seller.name_ar && <p className="text-muted-foreground" dir="rtl">{inv.seller.name_ar}</p>}
                <p className="text-muted-foreground">{isAr ? "رقم ضريبي:" : "Tax ID:"} {inv.seller.tax_id}</p>
                {inv.seller.city && <p className="text-muted-foreground">{inv.seller.city}{inv.seller.governorate ? `, ${inv.seller.governorate}` : ""}</p>}
              </CardContent>
            </Card>

            {/* Buyer */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{isAr ? "المشتري" : "Buyer"}</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-medium">{inv.buyer.name}</p>
                {inv.buyer.name_ar && <p className="text-muted-foreground" dir="rtl">{inv.buyer.name_ar}</p>}
                {inv.buyer.tax_id && <p className="text-muted-foreground">{isAr ? "رقم ضريبي:" : "Tax ID:"} {inv.buyer.tax_id}</p>}
                {inv.buyer.email && <p className="text-muted-foreground">{inv.buyer.email}</p>}
                {inv.buyer.phone && <p className="text-muted-foreground" dir="ltr">{inv.buyer.phone}</p>}
              </CardContent>
            </Card>

            {/* ETA Info */}
            {inv.eta_uuid && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{isAr ? "بيانات مصلحة الضرائب" : "ETA Details"}</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  {inv.eta_status_code && <p className="text-muted-foreground">{isAr ? "الحالة:" : "Status:"} {inv.eta_status_code}</p>}
                  {inv.eta_status_message && <p className="text-muted-foreground text-xs">{inv.eta_status_message}</p>}
                  <p className="text-[11px] text-muted-foreground font-mono break-all">UUID: {inv.eta_uuid}</p>
                </CardContent>
              </Card>
            )}

            {/* QR Code */}
            {inv.qr_code_image && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-1.5"><QrCode className="h-4 w-4" />{isAr ? "رمز QR" : "QR Code"}</CardTitle></CardHeader>
                <CardContent className="flex justify-center">
                  <img src={`data:image/png;base64,${inv.qr_code_image}`} alt="QR Code" className="h-32 w-32" />
                </CardContent>
              </Card>
            )}

            {inv.notes && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{isAr ? "ملاحظات" : "Notes"}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p>{inv.notes}</p>
                  {inv.notes_ar && <p dir="rtl">{inv.notes_ar}</p>}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "الفواتير" : "Invoices"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? "إدارة الفواتير الإلكترونية" : "Manage your electronic invoices"}
          </p>
        </div>
      </div>

      {storeId && (
        <TaxSettingsCard
          storeId={storeId}
          isAr={isAr}
          country={currentStore?.country || "EG"}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="h-9 p-0.5 bg-muted/60">
              <TabsTrigger value="all" className="text-xs h-8 rounded-md px-3">{isAr ? "الكل" : "All"}</TabsTrigger>
              <TabsTrigger value="draft" className="text-xs h-8 rounded-md px-3">{isAr ? "مسودة" : "Draft"}</TabsTrigger>
              <TabsTrigger value="submitted" className="text-xs h-8 rounded-md px-3">{isAr ? "مرسلة" : "Submitted"}</TabsTrigger>
              <TabsTrigger value="accepted" className="text-xs h-8 rounded-md px-3">{isAr ? "مقبولة" : "Accepted"}</TabsTrigger>
              <TabsTrigger value="rejected" className="text-xs h-8 rounded-md px-3">{isAr ? "مرفوضة" : "Rejected"}</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {invoicesQuery.isLoading && invoices.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="px-5 pb-8">
              <EmptyState
                icon={Receipt}
                title={isAr ? "لا توجد فواتير" : "No invoices yet"}
                description={isAr ? "سيتم إنشاء الفواتير تلقائياً مع الطلبات" : "Invoices will be created with orders"}
              />
            </div>
          ) : (
            <>
              <ResponsiveTable
                mobile={
                  <MobileCardList className="p-3">
                    {invoices.map((inv) => {
                      const cfg = statusConfig[inv.status] || statusConfig.draft;
                      return (
                        <MobileCard
                          key={inv.id}
                          onClick={() => openDetail(inv.id)}
                          title={<span className="tabular-nums">{inv.invoice_number}</span>}
                          subtitle={inv.buyer_name}
                          trailing={inv.total_formatted || formatCurrency(inv.total)}
                          badges={
                            <>
                              <Badge
                                variant="outline"
                                className={`gap-1.5 rounded-md py-0.5 text-[10px] font-medium ${cfg.bg}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                {inv.status}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px] font-normal">
                                {typeLabels[inv.invoice_type]}
                              </Badge>
                            </>
                          }
                          meta={<span className="tabular-nums">{formatDate(inv.date_issued)}</span>}
                          actions={
                            inv.status === "draft" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 w-10 rounded-lg p-0"
                                onClick={() => setDeleteTarget(inv)}
                                aria-label={isAr ? "حذف" : "Delete"}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            ) : null
                          }
                        />
                      );
                    })}
                  </MobileCardList>
                }
              >
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-y border-border/40">
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 ps-5">{isAr ? "رقم الفاتورة" : "Invoice #"}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "النوع" : "Type"}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "المشتري" : "Buyer"}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "التاريخ" : "Date"}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "الإجمالي" : "Total"}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{isAr ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const cfg = statusConfig[inv.status] || statusConfig.draft;
                    return (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => openDetail(inv.id)}
                      >
                        <TableCell className="font-semibold text-[13px] ps-5 tabular-nums">{inv.invoice_number}</TableCell>
                        <TableCell className="text-[13px]">
                          <Badge variant="secondary" className="text-[10px] font-normal">{typeLabels[inv.invoice_type]}</Badge>
                        </TableCell>
                        <TableCell className="text-[13px]">{inv.buyer_name}</TableCell>
                        <TableCell className="text-[13px] text-muted-foreground tabular-nums">{formatDate(inv.date_issued)}</TableCell>
                        <TableCell className="text-[13px] font-semibold tabular-nums">{inv.total_formatted || formatCurrency(inv.total)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-medium gap-1.5 rounded-md py-0.5 ${cfg.bg}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {inv.status === "draft" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(inv)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </ResponsiveTable>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border/40">
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {isAr ? `صفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? "حذف الفاتورة" : "Delete Invoice"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? `هل أنت متأكد من حذف الفاتورة "${deleteTarget?.invoice_number}"؟`
                : `Are you sure you want to delete invoice "${deleteTarget?.invoice_number}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg">
              {isDeleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {isAr ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
