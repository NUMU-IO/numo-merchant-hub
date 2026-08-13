/**
 * "Install NUMU" nudge.
 *
 * TIMING IS THE WHOLE DESIGN. An install card on first load is the fastest way
 * to get permanently dismissed by a merchant who has no idea what the app is
 * yet. So this waits until they have at least ONE REAL ORDER — proof the
 * product is working for them — before it appears at all.
 *
 * It is also scoped to the dashboard route rather than the layout: the other
 * banners in DashboardLayout (go-live, low balance) are blocking conditions the
 * merchant must act on. This is a suggestion, and a suggestion that follows you
 * across all 79 pages is nagging.
 *
 * Mobile only. Installing on desktop is possible but not the problem we are
 * solving, and the card would be noise on a 1440px dashboard.
 */
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Smartphone, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { listOrders } from "@/services/orderApi";
import { IosInstallSheet } from "./IosInstallSheet";

export function InstallPrompt() {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isMobile = useIsMobile();
  const location = useLocation();
  const { affordance, install, dismiss } = useInstallPrompt();
  const [sheetOpen, setSheetOpen] = useState(false);

  const onDashboard = location.pathname === "/";

  // Gate on "has the merchant ever received an order?". Shares the cache key
  // shape MobileBottomNav already uses so this costs no extra round trip in
  // practice.
  const ordersQuery = useQuery({
    queryKey: ["install-prompt", "hasOrders", currentStore?.id],
    queryFn: () => listOrders(currentStore!.id, { page: 1, limit: 1 }),
    enabled: !!currentStore?.id && isMobile && onDashboard && affordance !== null,
    staleTime: 10 * 60 * 1000,
  });

  const hasOrders = (ordersQuery.data?.total ?? 0) > 0;

  if (!isMobile || !onDashboard || !affordance || !hasOrders) return null;

  const onAction = () => {
    if (affordance === "native") {
      void install();
    } else {
      // iOS and in-app WebViews both get the instruction sheet; it renders the
      // right variant for each.
      setSheetOpen(true);
    }
  };

  return (
    <>
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-navy/20 bg-navy/[0.04] p-4 dark:bg-navy/[0.12]">
        <div className="ichip ichip-navy shrink-0">
          <Smartphone className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold leading-tight">
            {isRTL ? "ثبّت نومو على موبايلك" : "Install NUMU on your phone"}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            {isRTL
              ? "افتح متجرك من الشاشة الرئيسية على طول — أسرع وبيشتغل حتى لو النت ضعيف."
              : "Open your store straight from the home screen — faster, and it still loads on a weak connection."}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              onClick={onAction}
              className="h-10 rounded-xl px-4 text-[13px] font-bold"
            >
              {affordance === "native"
                ? isRTL
                  ? "ثبّت"
                  : "Install"
                : isRTL
                  ? "إزاي؟"
                  : "Show me how"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={dismiss}
              className="h-10 rounded-xl px-3 text-[13px] font-semibold text-muted-foreground"
            >
              {isRTL ? "مش دلوقتي" : "Not now"}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={isRTL ? "إغلاق" : "Dismiss"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <IosInstallSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        inWebView={affordance === "webview"}
      />
    </>
  );
}
