import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/services/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Wallet } from "lucide-react";

interface WalletState {
  balance_cents: number;
  is_blocked: boolean;
  low_balance_level: number; // 0 healthy, 1 low, 2 negative, 3 blocked
  effective_commission_bps: number;
}

/**
 * Dashboard-wide wallet warning for pay-as-you-go tenants.
 * Fetches GET /wallet once per mount (server-side answer is cheap);
 * renders nothing for subscription tenants or healthy balances.
 */
const LowBalanceBanner = () => {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";
  const [wallet, setWallet] = useState<WalletState | null>(null);

  const isPayg = tenant?.plan === "payg";

  useEffect(() => {
    if (!isPayg) return;
    apiClient<WalletState>("/wallet")
      .then(setWallet)
      .catch(() => {});
  }, [isPayg]);

  if (!isPayg || !wallet || wallet.low_balance_level < 1 || wallet.effective_commission_bps === 0) {
    return null;
  }

  const blocked = wallet.low_balance_level >= 3;
  const styles = blocked
    ? {
        border: "border-red-200 dark:border-red-500/30",
        bg: "bg-red-50/80 dark:bg-red-950/40",
        icon: "text-red-600 dark:text-red-400",
        title: "text-red-800 dark:text-red-200",
        desc: "text-red-700/80 dark:text-red-300",
      }
    : {
        border: "border-amber-200 dark:border-amber-500/30",
        bg: "bg-amber-50/80 dark:bg-amber-950/40",
        icon: "text-amber-600 dark:text-amber-400",
        title: "text-amber-800 dark:text-amber-200",
        desc: "text-amber-700/80 dark:text-amber-300",
      };

  const title = blocked
    ? (isAr ? "تم إيقاف إتمام الطلبات — اشحن محفظتك" : "Checkout paused — top up your wallet")
    : wallet.low_balance_level === 2
      ? (isAr ? "رصيد محفظتك بالسالب" : "Your wallet balance is negative")
      : (isAr ? "رصيد محفظتك منخفض" : "Your wallet balance is low");

  const desc = blocked
    ? (isAr
        ? "رصيدك أقل من الحد المسموح ولا يمكن لعملائك إتمام الطلبات. اشحن الآن لاستئناف البيع فوراً."
        : "Your balance is below the allowed limit and customers can't check out. Top up now to resume selling immediately.")
    : (isAr
        ? "تُخصم عمولة من كل طلب مدفوع. اشحن رصيدك لتجنب إيقاف إتمام الطلبات."
        : "A commission is deducted from each paid order. Top up to avoid checkout being paused.");

  return (
    <Alert className={`mb-5 rounded-xl ${styles.border} ${styles.bg}`}>
      <AlertTriangle className={`h-4 w-4 ${styles.icon}`} />
      <AlertTitle className={`${styles.title} text-sm font-semibold`}>{title}</AlertTitle>
      <AlertDescription className={`${styles.desc} text-xs flex items-center justify-between gap-3 flex-wrap`}>
        <span>{desc}</span>
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => navigate("/wallet")}
        >
          <Wallet className="h-3 w-3" />
          {isAr ? "شحن المحفظة" : "Top up wallet"}
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default LowBalanceBanner;
