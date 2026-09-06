import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getStorefrontPassword } from "@/services/storeAccessApi";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Copy, Lock } from "lucide-react";
import { toast } from "sonner";

/**
 * Storefront is locked to shoppers because the tenant never converted.
 *
 * Distinct from `GoLiveBanner`, which nudges a merchant who has not picked a
 * plan yet: this one fires after the trial actually expired (or a
 * subscription lapsed), when the backend is already gating the storefront
 * behind its pre-launch password. There is nothing to toggle here — only a
 * wallet top-up or a paid subscription clears it.
 *
 * The lock itself is read from the session (`tenant.is_read_only`), so the
 * banner needs no request to decide whether to render. The password costs
 * one call, and only while locked.
 */
const StorefrontLockedBanner = () => {
  const { tenant, isReadOnly } = useAuth();
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";
  const storeId = currentStore?.id;

  const isPayg = (tenant?.plan ?? "").toLowerCase() === "payg";

  const statusQuery = useQuery({
    queryKey: ["storefront-password", storeId],
    queryFn: () => getStorefrontPassword(storeId as string),
    enabled: !!storeId && isReadOnly,
    staleTime: 5 * 60 * 1000,
  });

  // Trust the server's answer over the session's when we have it: the
  // session is cached and a top-up may have cleared the lock since.
  const locked = statusQuery.data
    ? statusQuery.data.billing_locked
    : isReadOnly;
  if (!locked) return null;

  const password = statusQuery.data?.billing_lock_password;

  const copyPassword = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    toast.success(isAr ? "تم نسخ كلمة المرور" : "Password copied");
  };

  return (
    <Alert className="mb-5 rounded-xl border-amber-500/40 bg-amber-500/5">
      <Lock className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-sm font-semibold">
        {isAr ? "متجرك مقفول قدام الزوار" : "Your storefront is closed to visitors"}
      </AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground space-y-2.5">
        <p>
          {isPayg
            ? isAr
              ? "التجربة خلصت. لوحة التحكم شغالة زي ما هي، لكن الزوار بيشوفوا صفحة كلمة مرور. اشحن محفظتك عشان المتجر يفتح تاني."
              : "Your trial ended. Your dashboard still works, but shoppers see a password page. Top up your wallet to reopen the store."
            : isAr
              ? "التجربة خلصت. لوحة التحكم شغالة زي ما هي، لكن الزوار بيشوفوا صفحة كلمة مرور. ادفع باقتك وارفع الإيصال عشان المتجر يفتح تاني."
              : "Your trial ended. Your dashboard still works, but shoppers see a password page. Pay for your plan and upload the receipt to reopen the store."}
        </p>

        {password ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              {isAr ? "كلمة مرور المعاينة:" : "Preview password:"}
            </span>
            <code className="rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[11px] ltr-nums">
              {password}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] gap-1"
              onClick={copyPassword}
            >
              <Copy className="h-3 w-3" />
              {isAr ? "نسخ" : "Copy"}
            </Button>
          </div>
        ) : null}

        <Button
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => navigate(isPayg ? "/wallet" : "/billing")}
        >
          <Lock className="h-3 w-3" />
          {isPayg
            ? isAr
              ? "اشحن المحفظة"
              : "Top up wallet"
            : isAr
              ? "ادفع الاشتراك"
              : "Pay for your plan"}
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default StorefrontLockedBanner;
