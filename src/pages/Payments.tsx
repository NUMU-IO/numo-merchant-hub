import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { formatMoney, currencyLabel } from "@/lib/format-money";
import { apiClient } from "@/services/api";
import { StatTile } from "@/components/ui/stat-tile";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ResponsiveTable,
  MobileCardList,
  MobileCard,
  MobileCardSkeleton,
} from "@/components/ui/responsive-table";
import { Button } from "@/components/ui/button";
import {
  Loader2, ChevronLeft, ChevronRight, Hourglass,
  Banknote, Wallet, ArrowLeftRight, Settings2, CreditCard,
  ArrowUpRight, Receipt, ChevronRight as ChevronRightIcon,
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

interface Invoice {
  id: string;
  service: string;
  amount_cents: number;
  currency: string;
  payment_status: string;
  approved_at: string | null;
  created_at: string;
}

// Status canonicalisation — tightened from the original. The previous
// set included "reversed" and "partial_refund" in the refund bucket,
// which mislabeled normal transfer transactions as refunds because
// some backends use "reversed" for cross-account transfers (not for
// customer refunds). Now we only label as refunded when the API is
// unambiguous about it. The "paid" set picked up extra synonyms
// observed in Paymob/Kashier/Fawry webhooks.
const PAID_STATUSES = new Set([
  "success", "successful", "paid", "completed", "captured",
  "succeeded", "approved", "settled", "ok", "done",
]);
const PENDING_STATUSES = new Set([
  "pending", "processing", "authorized", "in_progress", "initiated",
]);
const REFUNDED_STATUSES = new Set([
  "refunded", "partially_refunded",
]);
const FAILED_STATUSES = new Set([
  "failed", "declined", "error", "cancelled", "canceled", "rejected",
]);
// Distinct from refunds: a "reversed" transfer is just a balance move
// going the other way. We surface it as its own neutral pill so the
// merchant sees it for what it is.
const REVERSED_STATUSES = new Set(["reversed", "reversal", "partial_refund"]);

/**
 * Payment-method pill. Extracted (not duplicated) so the desktop table and the
 * mobile card render the same four branches from one place.
 */
const MethodPill = ({ method, isAr }: { method?: string | null; isAr: boolean }) => (
  <span className="souq-pill bg-muted text-ink-soft">
    {method === "card" ? (
      <>
        <CreditCard className="h-3.5 w-3.5" strokeWidth={2.2} />
        {isAr ? "بطاقة" : "Card"}
      </>
    ) : method === "wallet" ? (
      <>
        <Wallet className="h-3.5 w-3.5" strokeWidth={2.2} />
        {isAr ? "محفظة" : "Wallet"}
      </>
    ) : method === "cod" ? (
      <>
        <Banknote className="h-3.5 w-3.5" strokeWidth={2.2} />
        {isAr ? "عند الاستلام" : "COD"}
      </>
    ) : (
      <>
        <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2.2} />
        {method || (isAr ? "تحويل" : "Transfer")}
      </>
    )}
  </span>
);

const StatusPill = ({ status, isAr }: { status: string; isAr: boolean }) => {
  const s = (status || "").toLowerCase().trim();
  if (PAID_STATUSES.has(s)) {
    return (
      <span className="souq-pill bg-emerald-500/14 text-emerald-700 dark:text-emerald-400">
        <span className="dot" />
        {isAr ? "ناجح" : "Paid"}
      </span>
    );
  }
  if (PENDING_STATUSES.has(s)) {
    return (
      <span className="souq-pill bg-amber-500/14 text-amber-700 dark:text-amber-400">
        <span className="dot" />
        {isAr ? "معلق" : "Pending"}
      </span>
    );
  }
  if (REFUNDED_STATUSES.has(s)) {
    return (
      <span className="souq-pill bg-blue-500/14 text-blue-700 dark:text-blue-400">
        <ArrowLeftRight className="h-3 w-3" />
        {isAr ? "مسترد" : "Refunded"}
      </span>
    );
  }
  if (REVERSED_STATUSES.has(s)) {
    return (
      <span className="souq-pill bg-muted text-ink-soft">
        <ArrowLeftRight className="h-3 w-3" />
        {isAr ? "تحويل عكسي" : "Reversed"}
      </span>
    );
  }
  if (FAILED_STATUSES.has(s)) {
    return (
      <span className="souq-pill bg-destructive/14 text-destructive">
        <span className="dot" />
        {isAr ? "فشل" : "Failed"}
      </span>
    );
  }
  // Unknown — show the raw API value so we don't lie about the state.
  return (
    <span className="souq-pill bg-muted text-muted-foreground">
      {status || (isAr ? "غير معروف" : "Unknown")}
    </span>
  );
};

interface Balances {
  wallet_balance_cents: number;
  store_balance_cents: number;
  // Server-side aggregates (API #498). Optional so an older backend
  // still renders — the page falls back to page-derived sums.
  pending_clearance_cents?: number;
  cod_in_transit_cents?: number;
  cod_in_transit_count?: number;
  /** "transactions" | "orders" — what store_balance_cents was summed from. */
  store_balance_source?: string;
}

const Payments = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const storeId = currentStore?.id;
  const navigate = useNavigate();

  // ─── Sub-tab (Overview / Payouts / Invoices) lives in `?tab=` so a
  // reload / back button keeps it. The comment here used to claim the
  // URL was updated; it never was.
  type Tab = "overview" | "payouts" | "invoices";
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = tabParam === "payouts" || tabParam === "invoices" ? tabParam : "overview";
  const setTab = (next: Tab) =>
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        if (next === "overview") n.delete("tab");
        else n.set("tab", next);
        return n;
      },
      { replace: true },
    );
  const segItems: { key: Tab; label: string; labelAr: string }[] = [
    { key: "overview", label: "Overview", labelAr: "نظرة عامة" },
    { key: "payouts", label: "Payouts", labelAr: "التحويلات" },
    { key: "invoices", label: "Invoices", labelAr: "الفواتير" },
  ];

  const [balances, setBalances] = useState<Balances | null>(null);
  const storeBalance = balances?.store_balance_cents ?? 0;
  const walletBalance = balances?.wallet_balance_cents ?? 0;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [txPage, setTxPage] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  const fmtBig = (cents: number) =>
    (cents / 100).toLocaleString(isAr ? "ar-EG" : "en-US", { minimumFractionDigits: 2 });
  const fmt = (cents: number) => formatMoney(cents, { fromCents: true, locale: isAr ? "ar" : "en" });
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString(isAr ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (!storeId) return;
    apiClient<Balances>(`/stores/${storeId}/payments/balances`)
      .then(setBalances)
      .catch(() => {});
    setLoadingInvoices(true);
    apiClient<Invoice[]>(`/stores/${storeId}/payments/invoices`)
      .then(setInvoices)
      .catch(() => setInvoices([]))
      .finally(() => setLoadingInvoices(false));
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    setLoadingTx(true);
    apiClient<Transaction[]>(
      `/stores/${storeId}/payments/transactions?skip=${txPage * 20}&limit=20`,
    )
      .then(setTransactions)
      .catch(() => setTransactions([]))
      .finally(() => setLoadingTx(false));
  }, [storeId, txPage]);

  // Pending clearance + COD-in-transit come from the balances endpoint
  // (server-side aggregates). They used to be summed from whichever 20
  // transactions were on the current page, so paginating changed both
  // KPIs. The page-derived numbers remain only as a fallback for a
  // backend that doesn't send the fields yet.
  const derivedPending = useMemo(
    () =>
      transactions
        .filter((tx) => PENDING_STATUSES.has((tx.status || "").toLowerCase()))
        .reduce((sum, tx) => sum + tx.amount_cents, 0),
    [transactions],
  );
  const derivedCod = useMemo(() => {
    const rows = transactions.filter(
      (tx) => tx.payment_method === "cod" && !PAID_STATUSES.has((tx.status || "").toLowerCase()),
    );
    return { cents: rows.reduce((sum, tx) => sum + tx.amount_cents, 0), count: rows.length };
  }, [transactions]);
  const pendingClearance = balances?.pending_clearance_cents ?? derivedPending;
  const codInTransit = balances?.cod_in_transit_cents ?? derivedCod.cents;
  const codCount = balances?.cod_in_transit_count ?? derivedCod.count;

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <PageHeader
        title={isAr ? "المالية" : "Finance"}
        subtitle={isAr ? "فلوسك، تحويلاتك، والدفع عند الاستلام" : "Your money, payouts, and cash-on-delivery"}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate("/payment-setup")}
          >
            <Settings2 className="h-4 w-4" strokeWidth={2.2} />
            {isAr ? "إعداد المدفوعات" : "Payment Setup"}
          </Button>
        }
      />

      {/* ─── Ledger hero + stat tiles ───────────────────────────────
          The hero used to be titled "Store balance" with a "Payouts
          soon" pill — a spendable-sounding number on a finance page for
          a feature that isn't live. It is a LEDGER total (sum of
          successful payments recorded), and it says so. The payouts
          note moved to a muted footnote under the tiles. */}
      <div className="grid gap-4 lg:[grid-template-columns:1.5fr_1fr_1fr]">
        <div className="souq-hero-navy p-5 flex flex-col">
          <span className="text-[13px] font-semibold text-white/70">
            {t("payments.ledgerTotal")}
          </span>
          <div className="text-[34px] font-extrabold tabular-nums tracking-tight leading-none mt-3 text-white">
            {fmtBig(storeBalance)}
            <span className="text-base font-bold text-white/50 ms-2">
              {currencyLabel(undefined, isAr ? "ar" : "en")}
            </span>
          </div>
          <p className="text-[12px] text-white/60 mt-2 leading-snug">
            {balances?.store_balance_source === "orders"
              ? t("payments.ledgerFromOrders")
              : t("payments.ledgerDefinition")}
          </p>
          <div className="flex items-center gap-3 mt-auto pt-4 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              onClick={() => navigate("/store-balance")}
            >
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.4} />
              {isAr ? "تفاصيل الرصيد" : "View details"}
            </Button>
          </div>
        </div>

        <StatTile
          icon={Hourglass}
          tone="saffron"
          label={t("payments.pendingClearance")}
          value={fmt(pendingClearance)}
          loading={balances === null && loadingTx}
          className="h-full"
        />
        <StatTile
          icon={Banknote}
          tone="navy"
          label={t("payments.codInTransit")}
          value={fmt(codInTransit)}
          sub={codCount > 0 ? t("payments.codInTransitSub", { count: codCount }) : undefined}
          loading={balances === null && loadingTx}
          href="/cod"
          className="h-full"
        />
      </div>
      <p className="text-[11.5px] text-muted-foreground -mt-2">{t("payments.payoutsFootnote")}</p>

      {/* ─── COD reconcile callout ──────────────────────────────────
          Surfaces the unreconciled COD bucket as an actionable row
          right under the hero, so merchants don't have to discover
          it in the sidebar. Hides when there's nothing to reconcile. */}
      {codCount > 0 && (
        <Card>
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <div className="ichip ichip-terra">
              <Banknote className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold">
                <span className="tabular-nums">
                  {isAr ? codCount.toLocaleString("ar-EG") : codCount}
                </span>{" "}
                {isAr ? "شحنات استلام محتاجة تسوية" : "COD shipments to reconcile"}
                {" · "}
                <span className="tabular-nums">{fmt(codInTransit)}</span>
              </div>
              <div className="text-[12.5px] text-muted-foreground mt-0.5">
                {isAr ? "طابق الفلوس المحصّلة مع شركة الشحن" : "Match collected cash with your courier"}
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate("/cod")}
            >
              {isAr ? "سوّي الاستلام" : "Reconcile COD"}
              <ChevronRightIcon className="h-4 w-4 rtl:rotate-180" strokeWidth={2.2} />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Segmented control ─────────────────────────────────────
          Souq segmented pill — Overview / Payouts / Invoices. Just
          a local tab toggle; the full URL routes still exist (the
          sidebar nav links straight to /wallet and /invoices for
          deep-link access). */}
      <div className="flex items-center bg-muted/50 rounded-full p-1 w-fit">
        {segItems.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setTab(s.key)}
            className={`h-9 px-4 text-[13px] font-bold rounded-full transition-all ${
              tab === s.key
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isAr ? s.labelAr : s.label}
          </button>
        ))}
      </div>

      {/* ─── Tab content ───────────────────────────────────────── */}
      {tab === "invoices" ? (
        <Card className="overflow-hidden">
          <div className="souq-section-head px-5 pt-5">
            <h2 className="text-[17px] font-bold tracking-tight">
              {isAr ? "فواتير عملياتك" : "Operation invoices"}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="text-[11px] font-semibold">{isAr ? "رقم الفاتورة" : "Invoice #"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "الخدمة" : "Service"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "السعر" : "Amount"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "حالة الدفع" : "Status"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "تاريخ الموافقة" : "Approved"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "أُنشئت في" : "Created"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingInvoices ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <div className="ichip ichip-saffron ichip-lg">
                          <Receipt className="h-6 w-6" strokeWidth={2} />
                        </div>
                        <p className="text-sm font-bold">
                          {isAr ? "لا توجد فواتير لسه" : "No invoices yet"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isAr ? "هتظهر هنا أول ما تتوفر" : "They'll appear here when available"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-bold">{inv.id.slice(0, 10)}</TableCell>
                      <TableCell className="text-[13px]">{inv.service}</TableCell>
                      <TableCell>
                        <span className="text-[13px] font-extrabold tabular-nums">{fmt(inv.amount_cents)}</span>
                      </TableCell>
                      <TableCell>
                        {inv.payment_status === "paid" || inv.payment_status === "accepted" ? (
                          <span className="souq-pill bg-emerald-500/14 text-emerald-700 dark:text-emerald-400">
                            <span className="dot" />
                            {isAr ? "مقبول" : "Accepted"}
                          </span>
                        ) : inv.payment_status === "submitted" ? (
                          <span className="souq-pill bg-blue-500/14 text-blue-700 dark:text-blue-400">
                            <span className="dot" />
                            {isAr ? "مُرسل" : "Submitted"}
                          </span>
                        ) : inv.payment_status === "pending" || inv.payment_status === "draft" ? (
                          <span className="souq-pill bg-amber-500/14 text-amber-700 dark:text-amber-400">
                            <span className="dot" />
                            {isAr ? "مسودة" : "Draft"}
                          </span>
                        ) : inv.payment_status === "rejected" ? (
                          <span className="souq-pill bg-destructive/14 text-destructive">
                            <span className="dot" />
                            {isAr ? "مرفوض" : "Rejected"}
                          </span>
                        ) : (
                          <span className="souq-pill bg-muted text-muted-foreground">{inv.payment_status}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {inv.approved_at ? (
                          <>
                            <div className="text-xs">{fmtDate(inv.approved_at)}</div>
                            <div className="text-[10px] text-muted-foreground">{fmtTime(inv.approved_at)}</div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">{fmtDate(inv.created_at)}</div>
                        <div className="text-[10px] text-muted-foreground">{fmtTime(inv.created_at)}</div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="souq-section-head px-5 pt-5">
            <h2 className="text-[17px] font-bold tracking-tight">
              {tab === "payouts"
                ? isAr ? "التحويلات" : "Payouts"
                : isAr ? "الحركات" : "Transactions"}
            </h2>
            {/* This is the TENANT's prepaid platform wallet (fees), not
                store money — "Wallet: EGP 0" beside a balance hero read as
                a contradiction. Named, and linked to its own page. */}
            <Link
              to="/wallet"
              className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
            >
              {t("payments.platformWallet")}: <span className="tabular-nums">{fmt(walletBalance)}</span>
            </Link>
          </div>
          <ResponsiveTable
            mobile={
              loadingTx ? (
                <MobileCardSkeleton />
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <div className="ichip ichip-navy ichip-lg">
                    <Wallet className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <p className="text-sm font-bold">
                    {isAr ? "مفيش حركات لسه" : "No transactions yet"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "المدفوعات من الطلبات هتظهر هنا" : "Payments from orders will appear here"}
                  </p>
                </div>
              ) : (
                <MobileCardList className="p-3">
                  {transactions.map((tx) => {
                    const isOut = REFUNDED_STATUSES.has((tx.status || "").toLowerCase().trim());
                    return (
                      <MobileCard
                        key={tx.id}
                        title={
                          <span className="font-mono">
                            {tx.reference_id || tx.id.slice(0, 10)}
                          </span>
                        }
                        subtitle={tx.customer_name || tx.customer_email || "—"}
                        trailing={
                          <span className={isOut ? "text-terracotta" : "text-sage"}>
                            {isOut ? "−" : "+"}
                            {fmt(tx.amount_cents)}
                          </span>
                        }
                        badges={
                          <>
                            <StatusPill status={tx.status} isAr={isAr} />
                            <MethodPill method={tx.payment_method} isAr={isAr} />
                          </>
                        }
                        meta={
                          <span>
                            {fmtDate(tx.created_at)} · {fmtTime(tx.created_at)}
                          </span>
                        }
                      />
                    );
                  })}
                </MobileCardList>
              )
            }
          >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="text-[11px] font-semibold">{isAr ? "المرجع" : "Reference"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "العميل" : "Customer"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "الطريقة" : "Method"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "التاريخ" : "Date"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-[11px] font-semibold text-end">{isAr ? "المبلغ" : "Amount"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingTx ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3">
                        <div className="ichip ichip-navy ichip-lg">
                          <Wallet className="h-6 w-6" strokeWidth={2} />
                        </div>
                        <p className="text-sm font-bold">
                          {isAr ? "مفيش حركات لسه" : "No transactions yet"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isAr ? "المدفوعات من الطلبات هتظهر هنا" : "Payments from orders will appear here"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((t) => {
                    // Outflow (terracotta −) for explicit refunds only.
                    // Reversed transfers, pending, failed all stay
                    // neutral so we don't paint normal payments red.
                    const s = (t.status || "").toLowerCase().trim();
                    const isOut = REFUNDED_STATUSES.has(s);
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <span className="font-mono text-xs font-bold">
                            {t.reference_id || t.id.slice(0, 10)}
                          </span>
                        </TableCell>
                        <TableCell className="text-[13px] truncate max-w-[160px]">
                          {t.customer_name || t.customer_email || (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <MethodPill method={t.payment_method} isAr={isAr} />
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">{fmtDate(t.created_at)}</div>
                          <div className="text-[10px] text-muted-foreground">{fmtTime(t.created_at)}</div>
                        </TableCell>
                        <TableCell>
                          <StatusPill status={t.status} isAr={isAr} />
                        </TableCell>
                        <TableCell className="text-end">
                          <span
                            className={`text-[14px] font-extrabold tabular-nums ${isOut ? "text-terracotta" : "text-sage"}`}
                          >
                            {isOut ? "−" : "+"}
                            {fmt(t.amount_cents)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          </ResponsiveTable>
          {transactions.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                disabled={txPage === 0}
                onClick={() => setTxPage((p) => p - 1)}
                className="gap-1.5"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" strokeWidth={2.2} />
                {isAr ? "السابق" : "Prev"}
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {isAr ? `صفحة ${txPage + 1}` : `Page ${txPage + 1}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={transactions.length < 20}
                onClick={() => setTxPage((p) => p + 1)}
                className="gap-1.5"
              >
                {isAr ? "التالي" : "Next"}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" strokeWidth={2.2} />
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default Payments;
