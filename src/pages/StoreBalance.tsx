import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { formatMoney } from "@/lib/format-money";
import { apiClient } from "@/services/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Check, ChevronLeft, ChevronRight, ArrowLeft,
  Banknote, AlertCircle, Wallet, ArrowLeftRight, CreditCard, Store,
} from "lucide-react";

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

const NUMU_PRIMARY = "hsl(222.2, 47.4%, 11.2%)";

const StoreBalance = () => {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const storeId = currentStore?.id;
  const navigate = useNavigate();

  const [balance, setBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [page, setPage] = useState(0);

  const fmtBig = (cents: number) => (cents / 100).toLocaleString(isAr ? "ar-EG" : "en-US", { minimumFractionDigits: 2 });
  const fmt = (cents: number) => formatMoney(cents, { fromCents: true, locale: isAr ? "ar" : "en" });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString(isAr ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (!storeId) return;
    setLoadingBalance(true);
    apiClient<{ wallet_balance_cents: number; store_balance_cents: number }>(`/stores/${storeId}/payments/balances`)
      .then(b => setBalance(b.store_balance_cents))
      .catch(() => {})
      .finally(() => setLoadingBalance(false));
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    setLoadingTx(true);
    apiClient<Transaction[]>(`/stores/${storeId}/payments/transactions?skip=${page * 20}&limit=20`)
      .then(setTransactions)
      .catch(() => setTransactions([]))
      .finally(() => setLoadingTx(false));
  }, [storeId, page]);

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/payments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "رصيد المتجر" : "Store Balance"}</h1>
      </div>

      {/* Balance Card */}
      <div className="rounded-xl overflow-hidden text-white" style={{ background: NUMU_PRIMARY }}>
        <div className="relative">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: "url('/numu-n-mark-transparent.png')", backgroundSize: "80px", backgroundRepeat: "repeat" }} />
          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Store className="h-5 w-5 text-white/80" />
              </div>
              <p className="text-sm text-white/60">{isAr ? "رصيد مدفوعات المتجر الحالي" : "Current Store Payment Balance"}</p>
            </div>
            <div className="flex items-baseline gap-2">
              {loadingBalance ? (
                <Loader2 className="h-6 w-6 animate-spin text-white/50" />
              ) : (
                <>
                  <span className="text-4xl sm:text-5xl font-bold tabular-nums text-white">{fmtBig(balance)}</span>
                  <span className="text-lg font-medium text-white/50">{isAr ? "ج.م" : "EGP"}</span>
                </>
              )}
            </div>
            <p className="text-xs text-white/40 mt-3">{isAr ? "إجمالي المدفوعات الناجحة من طلبات المتجر" : "Total successful payments from store orders"}</p>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
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
                <TableHead className="text-[11px] font-semibold">{isAr ? "المبلغ" : "Amount"}</TableHead>
                <TableHead className="text-[11px] font-semibold">{isAr ? "طريقة الدفع" : "Method"}</TableHead>
                <TableHead className="text-[11px] font-semibold">{isAr ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-[11px] font-semibold">{isAr ? "التاريخ" : "Date"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingTx ? (
                <TableRow><TableCell colSpan={6} className="text-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></TableCell></TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
                        <CreditCard className="h-8 w-8 text-muted-foreground/20" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">{isAr ? "لا توجد مدفوعات واردة بعد" : "No incoming payments yet"}</p>
                      <p className="text-xs text-muted-foreground/60">{isAr ? "ستظهر هنا عند استلام مدفوعات من الطلبات" : "Payments from orders will appear here"}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : transactions.map(t => (
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
        {transactions.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t">
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />{isAr ? "السابق" : "Prev"}
            </Button>
            <span className="text-[10px] text-muted-foreground tabular-nums">{isAr ? `صفحة ${page + 1}` : `Page ${page + 1}`}</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={transactions.length < 20} onClick={() => setPage(p => p + 1)}>
              {isAr ? "التالي" : "Next"}<ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreBalance;
