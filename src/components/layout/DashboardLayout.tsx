import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { AlertTriangle, Clock, Timer } from "lucide-react";
import { Suspense, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

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
  const { user } = useAuth();
  const { t } = useTranslation();

  const trialDaysLeft = useMemo(() => {
    if (!user?.trial_ends_at) return null;
    const end = new Date(user.trial_ends_at);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [user?.trial_ends_at]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0 dash-content">
          <AppHeader />
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1440px] p-4 md:p-6 lg:px-8 lg:py-6">
              {trialDaysLeft !== null && trialDaysLeft > 0 && (
                <Alert className="mb-5 rounded-xl border-blue-200 bg-blue-50/80 dark:border-blue-500/30 dark:bg-blue-950/40">
                  <Timer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-800 dark:text-blue-200 text-sm font-semibold">
                    {t("dashboard.trialTitle", { count: trialDaysLeft, days: trialDaysLeft })}
                  </AlertTitle>
                  <AlertDescription className="text-blue-700/80 dark:text-blue-300 text-xs">
                    {t("dashboard.trialDesc", {
                      date: new Date(user!.trial_ends_at!).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      }),
                    })}
                  </AlertDescription>
                </Alert>
              )}
              {trialDaysLeft === 0 && (
                <Alert className="mb-5 rounded-xl border-red-200 bg-red-50/80 dark:border-red-500/30 dark:bg-red-950/40">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertTitle className="text-red-800 dark:text-red-200 text-sm font-semibold">{t("dashboard.trialExpiredTitle")}</AlertTitle>
                  <AlertDescription className="text-red-700/80 dark:text-red-300 text-xs">
                    {t("dashboard.trialExpiredDesc")}
                  </AlertDescription>
                </Alert>
              )}
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
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
