import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/services/api";
import { Wallet, PlusCircle } from "lucide-react";

interface WalletState {
  balance_cents: number;
  pending_balance_cents: number;
  currency: string;
  is_blocked: boolean;
  effective_commission_bps: number;
}

/**
 * Header wallet chip (Salla-style) for pay-as-you-go tenants.
 *
 * Resting state shows the live balance ("ج.م 250 💳"); hovering morphs
 * the pill into a primary-colored "إدارة المحفظة / Manage wallet" action.
 * Click → /wallet. An amber dot marks money on hold; a negative balance
 * renders red so the merchant can't miss it.
 *
 * A pay-as-you-go merchant always gets a wallet entry point here, even
 * when the balance cannot be fetched. This used to render nothing until
 * the query resolved, so a slow, failed or not-yet-created wallet left
 * the header with no route to /wallet at all — worst for exactly the
 * merchant whose wallet is in trouble, which is when they most need to
 * reach it. The balance is the enhancement; the way in is the point.
 */
const WalletHeaderChip = () => {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";
  const isPayg = tenant?.plan === "payg";

  const walletQuery = useQuery({
    queryKey: ["header", "wallet"],
    queryFn: () => apiClient<WalletState>("/wallet"),
    enabled: isPayg,
    refetchInterval: 60_000,
    staleTime: 55_000,
  });

  if (!isPayg) return null;

  const w = walletQuery.data;

  // No balance yet — loading, failed, or the wallet has not been created.
  // Show the icon anyway so the merchant can still get to the page.
  if (!w) {
    return (
      <button
        type="button"
        onClick={() => navigate("/wallet")}
        aria-label={isAr ? "إدارة المحفظة" : "Manage wallet"}
        className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-white/15 bg-white/10 text-white transition-colors duration-150 hover:bg-saffron hover:border-saffron hover:text-navy-900"
      >
        <Wallet className="h-[18px] w-[18px] opacity-90" />
      </button>
    );
  }
  const negative = w.balance_cents < 0;
  const balance = (w.balance_cents / 100).toLocaleString(
    isAr ? "ar-EG" : "en-EG",
    { minimumFractionDigits: 0, maximumFractionDigits: 2 },
  );
  const currencyLabel = w.currency === "EGP" ? (isAr ? "ج.م" : "EGP") : w.currency;

  return (
    <button
      type="button"
      onClick={() => navigate("/wallet")}
      aria-label={isAr ? "إدارة المحفظة" : "Manage wallet"}
      title={
        w.pending_balance_cents > 0
          ? isAr
            ? `رصيد معلّق قيد التحقق: ${(w.pending_balance_cents / 100).toLocaleString("ar-EG")} ج.م`
            : `On hold pending verification: ${(w.pending_balance_cents / 100).toLocaleString()} EGP`
          : undefined
      }
      className={`group relative inline-flex items-center h-10 px-4 rounded-xl border transition-colors duration-150 text-white
        ${
          w.is_blocked
            ? "bg-red-600 border-red-500 hover:bg-red-500"
            : "bg-white/10 border-white/15 hover:bg-saffron hover:border-saffron hover:text-navy-900"
        }`}
    >
      {/* Resting: currency glyph + balance + wallet icon (solid pill) */}
      <span className="flex items-center gap-2 group-hover:hidden">
        <span className="text-[11px] font-bold opacity-80">{currencyLabel}</span>
        <span
          className={`tabular-nums font-extrabold text-sm ${negative && !w.is_blocked ? "text-red-300" : ""}`}
        >
          {balance}
        </span>
        <Wallet className="h-[18px] w-[18px] opacity-90" />
        {w.pending_balance_cents > 0 && (
          <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[hsl(var(--topbar))]" />
        )}
      </span>

      {/* Hover: manage-wallet action */}
      <span className="hidden group-hover:flex items-center gap-2">
        <PlusCircle className="h-[18px] w-[18px]" />
        <span className="text-sm font-bold whitespace-nowrap">
          {isAr ? "إدارة المحفظة" : "Manage wallet"}
        </span>
        <Wallet className="h-[18px] w-[18px] opacity-80" />
      </span>
    </button>
  );
};

export default WalletHeaderChip;
