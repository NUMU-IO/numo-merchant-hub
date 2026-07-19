import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/services/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import TopUpDialog from "@/components/wallet/TopUpDialog";
import {
  Loader2, ArrowLeft, Wallet as WalletIcon, Plus,
  ArrowUpRight, ArrowDownLeft, AlertTriangle,
} from "lucide-react";

const NUMU_PRIMARY = "hsl(222.2, 47.4%, 11.2%)";
const BLOCKED_RED = "hsl(0, 62%, 38%)";

interface WalletData {
  balance_cents: number;
  pending_balance_cents: number;
  currency: string;
  status: string;
  effective_commission_bps: number;
  negative_allowance_cents: number;
  low_balance_threshold_cents: number;
  is_blocked: boolean;
  low_balance_level: number;
  methods_enabled: Record<string, boolean>;
  topups_enabled: boolean;
  min_topup_cents?: number;
}

interface WalletTx {
  id: string;
  kind: string;
  amount_cents: number;
  balance_after_cents: number;
  currency: string;
  order_id: string | null;
  note: string | null;
  created_at: string;
}

interface TopupHistoryItem {
  id: string;
  method: string;
  amount_cents: number;
  status: string;
  special_reference: string;
  created_at: string;
  rejection_reason: string | null;
}

const TOPUP_STATUS: Record<string, { en: string; ar: string; cls: string }> = {
  succeeded: { en: "Credited", ar: "تم الشحن", cls: "border-emerald-300 text-emerald-700" },
  under_review: { en: "On hold — reviewing", ar: "معلّق — قيد المراجعة", cls: "border-amber-300 text-amber-700" },
  awaiting_proof: { en: "Awaiting receipt", ar: "بانتظار الإيصال", cls: "text-muted-foreground" },
  pending: { en: "Awaiting payment", ar: "بانتظار الدفع", cls: "text-muted-foreground" },
  expired: { en: "Expired", ar: "منتهية", cls: "text-muted-foreground/70" },
  failed: { en: "Failed", ar: "فشلت", cls: "border-red-300 text-red-700" },
};

const METHOD_LABEL: Record<string, { en: string; ar: string }> = {
  vodafone_cash: { en: "Vodafone Cash", ar: "فودافون كاش" },
  instapay: { en: "InstaPay", ar: "إنستاباي" },
  card: { en: "Card", ar: "بطاقة" },
};

const KIND_LABELS: Record<string, { en: string; ar: string }> = {
  topup: { en: "Top-up", ar: "شحن رصيد" },
  commission: { en: "Commission", ar: "عمولة" },
  commission_reversal: { en: "Commission reversal", ar: "استرداد عمولة" },
  adjustment: { en: "Adjustment", ar: "تسوية" },
};

const Wallet = () => {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [topups, setTopups] = useState<TopupHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [topupOpen, setTopupOpen] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString(isAr ? "ar-EG" : "en-US", { minimumFractionDigits: 2 });

  const refresh = useCallback(async () => {
    try {
      const [w, t, tp] = await Promise.all([
        apiClient<WalletData>("/wallet"),
        apiClient<WalletTx[]>("/wallet/transactions?limit=50"),
        apiClient<TopupHistoryItem[]>("/wallet/topups?limit=10").catch(() => [] as TopupHistoryItem[]),
      ]);
      setWallet(w);
      setTxs(t);
      setTopups(tp);
    } catch {
      /* keep whatever we had */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Return leg from Paymob hosted checkout: ?topup_id=… → poll until the
  // webhook lands (usually seconds), then toast + refresh.
  useEffect(() => {
    const topupId = searchParams.get("topup_id");
    if (!topupId) return;

    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const t = await apiClient<{ status: string; amount_cents: number }>(`/wallet/topups/${topupId}`);
        if (t.status === "succeeded") {
          toast.success(
            isAr
              ? `تم شحن محفظتك بمبلغ ${fmt(t.amount_cents)} ج.م`
              : `Wallet topped up with ${fmt(t.amount_cents)} EGP`,
          );
          setSearchParams({}, { replace: true });
          refresh();
          return;
        }
        if (t.status === "failed" || t.status === "expired") {
          toast.error(isAr ? "لم يكتمل الدفع" : "Payment didn't complete");
          setSearchParams({}, { replace: true });
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      if (attempts < 15) {
        pollTimer.current = setTimeout(poll, 2000);
      } else {
        setSearchParams({}, { replace: true });
      }
    };
    poll();
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("topup_id")]);

  const negative = (wallet?.balance_cents ?? 0) < 0;
  const commissionPct = wallet ? (wallet.effective_commission_bps / 100).toLocaleString(isAr ? "ar-EG" : "en-US") : null;

  return (
    <div className="max-w-[900px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/payments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "المحفظة" : "Wallet"}</h1>
        {wallet && wallet.effective_commission_bps > 0 && (
          <Badge variant="secondary" className="ms-auto">
            {isAr ? `${commissionPct}٪ لكل طلب مدفوع` : `${commissionPct}% per paid order`}
          </Badge>
        )}
      </div>

      {/* Blocked banner */}
      {wallet?.is_blocked && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-700 dark:text-red-400">
              {isAr ? "تم إيقاف إتمام الطلبات في متجرك مؤقتاً" : "Checkout on your storefront is paused"}
            </p>
            <p className="text-sm text-red-600/80 dark:text-red-400/80">
              {isAr
                ? "رصيد محفظتك أقل من الحد المسموح. اشحن رصيدك الآن لاستئناف استقبال الطلبات فوراً."
                : "Your wallet balance is below the allowed limit. Top up now to resume taking orders immediately."}
            </p>
          </div>
        </div>
      )}

      {/* Balance Card */}
      <div className="rounded-xl overflow-hidden text-white" style={{ background: wallet?.is_blocked ? BLOCKED_RED : NUMU_PRIMARY }}>
        <div className="relative">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ backgroundImage: "url('/numu-n-mark-transparent.png')", backgroundSize: "80px", backgroundRepeat: "repeat" }} />
          <div className="relative z-10 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <WalletIcon className="h-5 w-5 text-white/80" />
              </div>
              <p className="text-sm text-white/60">{isAr ? "رصيد المحفظة الحالي" : "Current Wallet Balance"}</p>
            </div>
            <div className="flex items-baseline gap-2">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-white/50" />
              ) : (
                <>
                  <span className={`text-4xl sm:text-5xl font-bold tabular-nums ${negative ? "text-red-300" : "text-white"}`}>
                    {fmt(wallet?.balance_cents ?? 0)}
                  </span>
                  <span className="text-lg font-medium text-white/50">{isAr ? "ج.م" : "EGP"}</span>
                </>
              )}
            </div>
            {(wallet?.pending_balance_cents ?? 0) > 0 && !loading && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs text-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
                {isAr
                  ? `${fmt(wallet!.pending_balance_cents)} ج.م رصيد معلّق قيد التحقق`
                  : `${fmt(wallet!.pending_balance_cents)} EGP on hold pending verification`}
              </div>
            )}
            {negative && !loading && (
              <p className="text-xs text-white/60 mt-2">
                {isAr
                  ? "رصيدك بالسالب — تُخصم العمولات من الرصيد المدفوع مقدماً."
                  : "Your balance is negative — commissions are deducted from your prepaid balance."}
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <Button
                size="sm"
                className="h-9 text-sm rounded-lg bg-white text-gray-900 hover:bg-white/90 gap-1.5"
                onClick={() => setTopupOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                {isAr ? "إضافة رصيد" : "Add Balance"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Top-up history — includes rejected/on-hold attempts that never
          reach the money ledger, with the admin's rejection reason. */}
      {topups.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="px-5 py-4 border-b">
            <h2 className="text-base font-bold">{isAr ? "عمليات الشحن" : "Top-ups"}</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isAr ? "الطريقة" : "Method"}</TableHead>
                <TableHead className="text-end">{isAr ? "المبلغ" : "Amount"}</TableHead>
                <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                <TableHead className="text-end">{isAr ? "التاريخ" : "Date"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topups.map((t) => {
                const rejected = !!t.rejection_reason && t.status !== "succeeded";
                const st = TOPUP_STATUS[t.status] ?? { en: t.status, ar: t.status, cls: "text-muted-foreground" };
                const method = METHOD_LABEL[t.method] ?? { en: t.method, ar: t.method };
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{isAr ? method.ar : method.en}</p>
                      <p className="text-[11px] text-muted-foreground font-mono" dir="ltr">{t.special_reference}</p>
                    </TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{fmt(t.amount_cents)}</TableCell>
                    <TableCell>
                      {rejected ? (
                        <div>
                          <Badge variant="outline" className="border-red-300 text-red-700 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {isAr ? "مرفوض" : "Rejected"}
                          </Badge>
                          <p className="text-[11px] text-red-600/90 mt-1 max-w-[220px]">
                            {t.rejection_reason}
                            {t.status === "awaiting_proof" && (
                              <span className="text-muted-foreground"> · {isAr ? "يمكنك رفع إيصال جديد" : "you can upload a new receipt"}</span>
                            )}
                          </p>
                        </div>
                      ) : (
                        <Badge variant="outline" className={st.cls}>{isAr ? st.ar : st.en}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-end text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString(isAr ? "ar-EG" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Wallet Transactions */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="text-base font-bold">{isAr ? "سجل المعاملات" : "Transaction History"}</h2>
        </div>
        {txs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
              <WalletIcon className="h-8 w-8 text-muted-foreground/20" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{isAr ? "لا توجد معاملات بعد" : "No wallet transactions yet"}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{isAr ? "ستظهر معاملات المحفظة هنا عند إضافة رصيد" : "Wallet transactions will appear here when you add balance"}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isAr ? "النوع" : "Type"}</TableHead>
                <TableHead>{isAr ? "التفاصيل" : "Details"}</TableHead>
                <TableHead className="text-end">{isAr ? "المبلغ" : "Amount"}</TableHead>
                <TableHead className="text-end">{isAr ? "الرصيد بعدها" : "Balance after"}</TableHead>
                <TableHead className="text-end">{isAr ? "التاريخ" : "Date"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txs.map((t) => {
                const credit = t.amount_cents > 0;
                const kind = KIND_LABELS[t.kind] ?? { en: t.kind, ar: t.kind };
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Badge variant={credit ? "default" : "secondary"} className="gap-1">
                        {credit ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {isAr ? kind.ar : kind.en}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                      {t.note || (t.order_id ? `#${t.order_id.slice(0, 8)}` : "—")}
                    </TableCell>
                    <TableCell className={`text-end tabular-nums font-medium ${credit ? "text-green-600" : "text-red-600"}`}>
                      {credit ? "+" : ""}{fmt(t.amount_cents)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums text-muted-foreground">{fmt(t.balance_after_cents)}</TableCell>
                    <TableCell className="text-end text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString(isAr ? "ar-EG" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <TopUpDialog
        open={topupOpen}
        onOpenChange={setTopupOpen}
        methodsEnabled={wallet?.methods_enabled ?? {}}
        minTopupCents={wallet?.min_topup_cents}
        onDone={refresh}
      />
    </div>
  );
};

export default Wallet;
