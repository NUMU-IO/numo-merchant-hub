import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/services/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

/**
 * Go-live gate banner for NEW merchants (no `golive_exempt` feature flag).
 *
 * They can build the store freely — products, theme, settings — but the
 * storefront won't accept orders until they pick a paid plan or
 * Pay as you Grow. This banner is the persistent nudge; the actual
 * enforcement lives in the backend checkout gate (`store_not_live`).
 */
const GoLiveBanner = () => {
  const { tenant } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";

  const needsPlan =
    !!tenant &&
    ["trial", "demo", "free"].includes(tenant.plan) &&
    !tenant.feature_flags?.golive_exempt;

  // Deploy-order guard: only show the banner when the wallet backend
  // (and with it the go-live gate + grandfather backfill) actually
  // exists. If GET /wallet 404s — hub shipped ahead of the API — we
  // must NOT tell existing merchants their store isn't live.
  const walletQuery = useQuery({
    queryKey: ["golive", "wallet-probe"],
    queryFn: () => apiClient("/wallet"),
    enabled: needsPlan,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (!needsPlan || !walletQuery.isSuccess) return null;

  return (
    <Alert className="mb-5 rounded-xl border-primary/30 bg-primary/5">
      <Rocket className="h-4 w-4 text-primary" />
      <AlertTitle className="text-sm font-semibold">
        {isAr ? "متجرك لسه مش لايف" : "Your store isn't live yet"}
      </AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground flex items-center justify-between gap-3 flex-wrap">
        <span>
          {isAr
            ? "جهّز متجرك براحتك — منتجات وثيم وإعدادات. عشان تبدأ تستقبل طلبات، اختار باقة أو فعّل “ادفع وأنت تنمو” (عمولة على الطلب بدون اشتراك)."
            : "Build everything at your own pace — products, theme, settings. To start taking orders, pick a plan or activate “Pay as you Grow” (a per-order commission, no subscription)."}
        </span>
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => navigate("/billing")}
        >
          <Rocket className="h-3 w-3" />
          {isAr ? "فعّل متجرك" : "Go live"}
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default GoLiveBanner;
