import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { AlertTriangle, Clock, Timer, Zap } from "lucide-react";
import { Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useNavigate } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import MobileBottomNav from "./MobileBottomNav";
import DemoBanner from "@/components/demo/DemoBanner";
import GoLiveBanner from "@/components/wallet/GoLiveBanner";
import LowBalanceBanner from "@/components/wallet/LowBalanceBanner";
import { ImpersonationBanner } from "./ImpersonationBanner";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { useAppBadge } from "@/hooks/useAppBadge";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotifications";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import { useFaviconBadge } from "@/hooks/useFaviconBadge";
import { NewOrderNotifier } from "@/components/NewOrderNotifier";
import { AgentPanel } from "@/features/agent";
import { useNavConfig } from "@/hooks/useNavConfig";
import { PageLoader } from "@/components/PageLoader";

const DashboardLayout = () => {
  const { currentStore } = useDashboardStore();
  const { user } = useAuth();
  // Admin-controlled via the same nav-config the sidebar tabs use
  // (Merchant Hub Nav → key "assistant"). Read from the public
  // /merchant-hub-nav endpoint, so visibility never depends on tenant
  // ownership or the /auth/me session. Fails open (visible) like every tab.
  const { isVisible } = useNavConfig();
  const assistantEnabled = isVisible("assistant");
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";

  // Mirror the unread count onto the installed app icon. Same hook and same
  // store id the header bell uses, so the badge and the bell can never
  // disagree. No-ops where the Badging API is unsupported — notably Chrome
  // for Android.
  const unreadNotifications = useUnreadNotificationCount(currentStore?.id);
  useAppBadge(unreadNotifications);
  // Same count on the browser tab: numbered favicon + "(n) " title prefix.
  useFaviconBadge(unreadNotifications);
  // SSE stream — invalidates the notification queries the moment the API
  // commits a feed row, so the 45 s poll is only the fallback.
  useNotificationStream(currentStore?.id);

  const trialDaysLeft = useMemo(() => {
    if (!user?.trial_ends_at) return null;
    const end = new Date(user.trial_ends_at);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [user?.trial_ends_at]);

  // Color progression: blue (>7d) → amber (3-7d) → red (≤3d)
  const trialColor = useMemo(() => {
    if (trialDaysLeft === null || trialDaysLeft === 0) return null;
    if (trialDaysLeft > 7) return { border: "border-blue-200 dark:border-blue-500/30", bg: "bg-blue-50/80 dark:bg-blue-950/40", icon: "text-blue-600 dark:text-blue-400", title: "text-blue-800 dark:text-blue-200", desc: "text-blue-700/80 dark:text-blue-300", btn: "bg-blue-600 hover:bg-blue-700 text-white" };
    if (trialDaysLeft > 3) return { border: "border-amber-200 dark:border-amber-500/30", bg: "bg-amber-50/80 dark:bg-amber-950/40", icon: "text-amber-600 dark:text-amber-400", title: "text-amber-800 dark:text-amber-200", desc: "text-amber-700/80 dark:text-amber-300", btn: "bg-amber-600 hover:bg-amber-700 text-white" };
    return { border: "border-red-200 dark:border-red-500/30", bg: "bg-red-50/80 dark:bg-red-950/40", icon: "text-red-600 dark:text-red-400", title: "text-red-800 dark:text-red-200", desc: "text-red-700/80 dark:text-red-300", btn: "bg-red-600 hover:bg-red-700 text-white" };
  }, [trialDaysLeft]);

  return (
    <SidebarProvider>
      {/* Zid-style shell: the navy top bar spans the full width; the
          sidebar hangs beneath it (offset via --topbar-h in .dash-header). */}
      <div className="flex min-h-screen w-full flex-col">
        <AppHeader />
        <div className="flex w-full flex-1">
          <AppSidebar />
          <div className="flex flex-1 flex-col min-w-0 dash-content">
            <ImpersonationBanner />
            <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1440px] p-4 md:p-6 lg:px-8 lg:py-6">
              {/* Demo mode banner — shows countdown + "Save my work" CTA */}
              <DemoBanner />
              {/* Go-live gate: new merchants must pick a plan (or Pay as
                  you Grow) before the storefront accepts orders. */}
              <GoLiveBanner />
              {/* Pay-as-you-grow wallet warnings (low / negative / blocked) */}
              <LowBalanceBanner />
              {/* PWA install nudge. Self-gating: mobile only, dashboard route
                  only, and only once the merchant has had a real order. */}
              <InstallPrompt />
              {/* Store status alerts */}
              {currentStore?.status === "suspended" && (
                <Alert className="mb-5 rounded-xl border-red-200 bg-red-50/80 dark:border-red-500/30 dark:bg-red-950/40">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertTitle className="text-red-800 dark:text-red-200 text-sm font-semibold">{t("dashboard.storeSuspendedTitle")}</AlertTitle>
                  <AlertDescription className="text-red-700/80 dark:text-red-300 text-xs">
                    {t("dashboard.storeSuspendedDesc")}
                  </AlertDescription>
                </Alert>
              )}
              {currentStore?.status === "pending_approval" && (
                <Alert className="mb-5 rounded-xl border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-950/40">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertTitle className="text-amber-800 dark:text-amber-200 text-sm font-semibold">{t("dashboard.pendingApprovalTitle")}</AlertTitle>
                  <AlertDescription className="text-amber-700/80 dark:text-amber-300 text-xs">
                    {t("dashboard.pendingApprovalDesc")}
                  </AlertDescription>
                </Alert>
              )}
              {/* Same brand ring as the route-level Suspense fallback and
                  the boot splash — a deep link used to show three different
                  loaders back to back (ring → ring → grey circle + English
                  "Loading..."). */}
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>

              {/* Footer — inline at bottom of content like Zid */}
              <div className="mt-12 mb-6 pt-6 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground/60">
                <span>{isAr ? `© NUMU ${new Date().getFullYear()} جميع الحقوق محفوظة` : `© NUMU ${new Date().getFullYear()} All rights reserved`}</span>
                <span className="flex items-center gap-1.5">
                  {isAr ? "صنع في مصر بواسطة" : "Made in Egypt by"}
                  <img
                    src="/brand/numu-navy.png"
                    alt="NUMU"
                    className="h-4 w-auto object-contain"
                  />
                  <span className="souq-wordmark text-[12px] text-muted-foreground/80">numu</span>
                </span>
              </div>

              {/* Spacer for mobile bottom nav (76px Souq bar) */}
              <div className="h-20 md:hidden" />
            </div>
          </main>
          </div>
        </div>
      </div>
      <MobileBottomNav />
      {/* Polls /orders and toasts whenever a new one arrives. Mounted at the
          layout level so it runs on every dashboard page. */}
      <NewOrderNotifier />
      {/* NUMU Agent (merchant copilot) — floating launcher + slide-over panel,
          available on every dashboard route (US1 read-only assistant). */}
      {assistantEnabled && <AgentPanel />}
    </SidebarProvider>
  );
};

export default DashboardLayout;
