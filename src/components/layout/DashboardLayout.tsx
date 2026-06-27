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
import { ImpersonationBanner } from "./ImpersonationBanner";
import { NewOrderNotifier } from "@/components/NewOrderNotifier";
import { AgentPanel } from "@/features/agent";

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="text-xs text-muted-foreground animate-pulse">Loading...</p>
      </div>
    </div>
  );
}

const DashboardLayout = () => {
  const { currentStore } = useDashboardStore();
  const { user, tenant } = useAuth();
  // Admin-controlled (platform settings → /auth/me feature_flags). Show the
  // Assistant unless it's been explicitly disabled, so older sessions /
  // missing flag still behave as before.
  const assistantEnabled = tenant?.feature_flags?.assistant_enabled !== false;
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";

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
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0 dash-content">
          <ImpersonationBanner />
          <AppHeader />
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1440px] p-4 md:p-6 lg:px-8 lg:py-6">
              {/* Demo mode banner — shows countdown + "Save my work" CTA */}
              <DemoBanner />
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
              <Suspense fallback={<PageFallback />}>
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
