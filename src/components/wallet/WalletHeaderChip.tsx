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

  if (!isPayg || !walletQuery.data) return null;

  const w = walletQuery.data;
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
      className={`group relative hidden sm:inline-flex items-center h-[42px] px-3.5 rounded-xl border transition-colors duration-150
        hover:bg-primary hover:border-primary hover:text-primary-foreground
        ${
          w.is_blocked
            ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-500/30 dark:text-red-300"
            : "bg-card border-border"
        }`}
    >
      {/* Resting: balance + wallet icon */}
      <span className="flex items-center gap-2 group-hover:hidden">
        <span
          className={`tabular-nums font-extrabold text-sm ${negative && !w.is_blocked ? "text-red-600" : ""}`}
        >
          {currencyLabel} {balance}
        </span>
        <Wallet className="h-[18px] w-[18px] opacity-70" />
        {w.pending_balance_cents > 0 && (
          <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-card" />
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
