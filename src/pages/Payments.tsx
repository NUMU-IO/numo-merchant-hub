import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { apiClient } from "@/services/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Check, ChevronLeft, ChevronRight,
  Banknote, AlertCircle, Wallet, ArrowLeftRight,
  Settings2, Info, CreditCard,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */

interface Transaction {
  id: string;
  order_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  payment_method: string;
  gateway: string;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
  reference_id: string | null;
}

interface Invoice {
  id: string;
  service: string;
  amount_cents: number;
  currency: string;
  payment_status: string;
  approved_at: string | null;
  created_at: string;
}

const NUMU_PRIMARY = "hsl(222.2, 47.4%, 11.2%)";

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

const Payments = () => {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const storeId = currentStore?.id;
  const navigate = useNavigate();

  const [walletBalance, setWalletBalance] = useState(0);
  const [storeBalance, setStoreBalance] = useState(0);
  const [deposits, setDeposits] = useState<Transaction[]>([]);
  const [loadingDeposits, setLoadingDeposits] = useState(true);
  const [depositPage, setDepositPage] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  const fmtBig = (cents: number) => (cents / 100).toLocaleString(isAr ? "ar-EG" : "en-US", { minimumFractionDigits: 2 });
  const fmt = (cents: number) => { const v = cents / 100; return isAr ? `${v.toLocaleString("ar-EG")} ج.م` : `EGP ${v.toLocaleString()}`; };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString(isAr ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (!storeId) return;
    apiClient<{ wallet_balance_cents: number; store_balance_cents: number }>(`/stores/${storeId}/payments/balances`)
      .then(b => { setWalletBalance(b.wallet_balance_cents); setStoreBalance(b.store_balance_cents); }).catch(() => {});
    setLoadingInvoices(true);
    apiClient<Invoice[]>(`/stores/${storeId}/payments/invoices`).then(setInvoices).catch(() => setInvoices([])).finally(() => setLoadingInvoices(false));
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    setLoadingDeposits(true);
    apiClient<Transaction[]>(`/stores/${storeId}/payments/transactions?skip=${depositPage * 20}&limit=20`)
      .then(setDeposits).catch(() => setDeposits([])).finally(() => setLoadingDeposits(false));
  }, [storeId, depositPage]);

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{isAr ? "المالية" : "Finance"}</h1>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate("/payment-setup")}>
          <Settings2 className="h-3 w-3" />{isAr ? "إعداد المدفوعات" : "Payment Setup"}
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════
         SECTION 1: الأرصدة — Balances (NUMU branded bg)
         ═══════════════════════════════════════════════════════ */}
      <div className="rounded-xl overflow-hidden text-white" style={{ background: NUMU_PRIMARY }}>
        {/* Subtle NUMU watermark */}
        <div className="relative">
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('/numu_v3.webp')", backgroundSize: "100px", backgroundRepeat: "repeat" }} />
          <div className="relative z-10 px-5 pt-5 pb-2">
            <h2 className="text-base font-bold text-white">{isAr ? "الأرصدة" : "Balances"}</h2>
          </div>
          <div className="relative z-10 px-5 pb-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Wallet Balance */}
              <div className="rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.08] p-5 flex flex-col justify-between min-h-[130px]">
                <p className="text-sm text-white/70">{isAr ? "رصيد المحفظة الحالي" : "Current Wallet Balance"}</p>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-3xl font-bold tabular-nums text-white">{fmtBig(walletBalance)}</span>
                  <span className="text-sm font-medium text-white/50">{isAr ? "ج.م" : "EGP"}</span>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" className="h-8 text-xs rounded-lg bg-white text-foreground hover:bg-white/90">{isAr ? "عرض رصيد المحفظة" : "View Wallet"}</Button>
                  <Button size="sm" className="h-8 text-xs rounded-lg bg-white/10 text-white border border-white/20 hover:bg-white/20">{isAr ? "إضافة رصيد للمحفظة" : "Add Balance"}</Button>
                </div>
              </div>
              {/* Store Balance */}
              <div className="rounded-xl bg-white/[0.07] backdrop-blur-sm border border-white/[0.08] p-5 flex flex-col justify-between min-h-[130px]">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm text-white/70">{isAr ? "رصيد المدفوعات الحالي للمتجر الإلكتروني" : "Current Store Payment Balance"}</p>
                  <Info className="h-3.5 w-3.5 text-white/30" />
                </div>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="text-3xl font-bold tabular-nums text-white">{fmtBig(storeBalance)}</span>
                  <span className="text-sm font-medium text-white/50">{isAr ? "ج.م" : "EGP"}</span>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" className="h-8 text-xs rounded-lg bg-white text-foreground hover:bg-white/90">{isAr ? "عرض رصيد المتجر" : "View Store Balance"}</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
         SECTION 2: الإيداعات — Deposits
         ═══════════════════════════════════════════════════════ */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-bold">{isAr ? "المدفوعات الواردة" : "Incoming Payments"}</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="text-[11px] font-semibold">{isAr ? "رقم العملية" : "Transaction #"}</TableHead>
                <TableHead className="text-[11px] font-semibold">{isAr ? "العميل" : "Customer"}</TableHead>
                <TableHead className="text-[11px] font-semibold">
                  <div>{isAr ? "المبلغ" : "Amount"}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">{isAr ? "العملة" : "Currency"}</div>
                </TableHead>
                <TableHead className="text-[11px] font-semibold">{isAr ? "طريقة الدفع" : "Method"}</TableHead>
                <TableHead className="text-[11px] font-semibold">{isAr ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-[11px] font-semibold">
                  <div>{isAr ? "التاريخ" : "Date"}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">{isAr ? "الوقت" : "Time"}</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingDeposits ? (
                <TableRow><TableCell colSpan={6} className="text-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></TableCell></TableRow>
              ) : deposits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
                        <svg width="40" height="40" viewBox="0 0 48 48" fill="none" className="text-muted-foreground/20">
                          <rect x="8" y="12" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="2" />
                          <path d="M8 20h32" stroke="currentColor" strokeWidth="2" />
                          <rect x="12" y="28" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">{isAr ? "المدفوعات الواردة من الطلبات ستظهر هنا" : "Incoming payments from orders will appear here"}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : deposits.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs font-medium">{t.reference_id || t.id.slice(0, 10)}</TableCell>
                  <TableCell className="text-xs truncate max-w-[140px]">{t.customer_name || t.customer_email || <span className="text-muted-foreground/40">—</span>}</TableCell>
                  <TableCell>
                    <div className="text-xs font-semibold tabular-nums">{fmt(t.amount_cents)}</div>
                    <div className="text-[10px] text-muted-foreground">{t.currency || "EGP"}</div>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {t.payment_method === "card" ? <><CreditCard className="h-3.5 w-3.5" />{isAr ? "بطاقة" : "Card"}</> :
                       t.payment_method === "wallet" ? <><Wallet className="h-3.5 w-3.5" />{isAr ? "محفظة" : "Wallet"}</> :
                       t.payment_method === "cod" ? <><Banknote className="h-3.5 w-3.5" />{isAr ? "نقدي" : "COD"}</> :
                       <><ArrowLeftRight className="h-3.5 w-3.5" />{isAr ? "تحويل" : "Transfer"}</>}
                    </span>
                  </TableCell>
                  <TableCell>
                    {t.status === "successful" ? <Badge variant="outline" className="text-[10px] font-medium gap-1 rounded-md py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/50"><Check className="h-3 w-3" />{isAr ? "ناجح" : "Paid"}</Badge> :
                     t.status === "pending" ? <Badge variant="outline" className="text-[10px] font-medium gap-1 rounded-md py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/50"><Loader2 className="h-3 w-3" />{isAr ? "معلق" : "Pending"}</Badge> :
                     t.status === "failed" ? <Badge variant="outline" className="text-[10px] font-medium gap-1 rounded-md py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/50"><AlertCircle className="h-3 w-3" />{isAr ? "فشل" : "Failed"}</Badge> :
                     <Badge variant="outline" className="text-[10px] font-medium gap-1 rounded-md py-0.5 bg-slate-500/10 text-slate-600 border-slate-200/50"><ArrowLeftRight className="h-3 w-3" />{isAr ? "مسترد" : "Refunded"}</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">{fmtDate(t.created_at)}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtTime(t.created_at)}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {deposits.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t">
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={depositPage === 0} onClick={() => setDepositPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />{isAr ? "السابق" : "Prev"}
            </Button>
            <span className="text-[10px] text-muted-foreground tabular-nums">{isAr ? `صفحة ${depositPage + 1}` : `Page ${depositPage + 1}`}</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={deposits.length < 20} onClick={() => setDepositPage(p => p + 1)}>
              {isAr ? "التالي" : "Next"}<ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
         SECTION 3: فواتير عملياتك — Your Operation Invoices
         ═══════════════════════════════════════════════════════ */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-bold">{isAr ? "فواتير عملياتك" : "Your Operation Invoices"}</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 hover:bg-muted/20">
                <TableHead className="text-[11px] font-semibold">{isAr ? "رقم الفاتورة" : "Invoice #"}</TableHead>
                <TableHead className="text-[11px] font-semibold">{isAr ? "الخدمة" : "Service"}</TableHead>
                <TableHead className="text-[11px] font-semibold">
                  <div>{isAr ? "السعر" : "Price"}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">{isAr ? "العملة" : "Currency"}</div>
                </TableHead>
                <TableHead className="text-[11px] font-semibold">{isAr ? "حالة الدفع" : "Payment Status"}</TableHead>
                <TableHead className="text-[11px] font-semibold">
                  <div>{isAr ? "تاريخ الموافقة" : "Approval Date"}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">{isAr ? "الوقت" : "Time"}</div>
                </TableHead>
                <TableHead className="text-[11px] font-semibold">
                  <div>{isAr ? "تم الإنشاء في" : "Created At"}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">{isAr ? "الوقت" : "Time"}</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingInvoices ? (
                <TableRow><TableCell colSpan={6} className="text-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
                        <svg width="40" height="40" viewBox="0 0 48 48" fill="none" className="text-muted-foreground/20">
                          <rect x="10" y="6" width="28" height="36" rx="3" stroke="currentColor" strokeWidth="2" />
                          <path d="M16 14h16M16 20h12M16 26h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <circle cx="34" cy="34" r="6" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="2" />
                          <path d="M32 34l1.5 1.5L36 33" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">{isAr ? "لا توجد بيانات حالياً، ستظهر هنا عند توفرها" : "No invoices yet — they'll appear here"}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : invoices.map(inv => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs font-medium">{inv.id.slice(0, 10)}</TableCell>
                  <TableCell className="text-xs">{inv.service}</TableCell>
                  <TableCell>
                    <div className="text-xs tabular-nums">{fmt(inv.amount_cents)}</div>
                    <div className="text-[10px] text-muted-foreground">{inv.currency || "EGP"}</div>
                  </TableCell>
                  <TableCell>
                    {(inv.payment_status === "paid" || inv.payment_status === "accepted") ? <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200/50">{isAr ? "مقبول" : "Accepted"}</Badge>
                    : inv.payment_status === "submitted" ? <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-200/50">{isAr ? "مُرسل" : "Submitted"}</Badge>
                    : (inv.payment_status === "pending" || inv.payment_status === "draft") ? <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200/50">{isAr ? "مسودة" : "Draft"}</Badge>
                    : inv.payment_status === "rejected" ? <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-600 border-red-200/50">{isAr ? "مرفوض" : "Rejected"}</Badge>
                    : <Badge variant="secondary" className="text-[10px]">{inv.payment_status}</Badge>}
                  </TableCell>
                  <TableCell>
                    {inv.approved_at ? (<><div className="text-xs">{fmtDate(inv.approved_at)}</div><div className="text-[10px] text-muted-foreground">{fmtTime(inv.approved_at)}</div></>) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">{fmtDate(inv.created_at)}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtTime(inv.created_at)}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default Payments;
