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
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
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
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            {trialDaysLeft !== null && trialDaysLeft > 0 && (
              <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-950/40">
                <Timer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="text-blue-800 dark:text-blue-200">
                  {t("dashboard.trialTitle", { count: trialDaysLeft, days: trialDaysLeft })}
                </AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-300">
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
              <Alert className="mb-6 border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-950/40">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertTitle className="text-red-800 dark:text-red-200">{t("dashboard.trialExpiredTitle")}</AlertTitle>
                <AlertDescription className="text-red-700 dark:text-red-300">
                  {t("dashboard.trialExpiredDesc")}
                </AlertDescription>
              </Alert>
            )}
            {currentStore?.status === "suspended" && (
              <Alert className="mb-6 border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-950/40">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertTitle className="text-red-800 dark:text-red-200">{t("dashboard.storeSuspendedTitle")}</AlertTitle>
                <AlertDescription className="text-red-700 dark:text-red-300">
                  {t("dashboard.storeSuspendedDesc")}
                </AlertDescription>
              </Alert>
            )}
            {currentStore?.status === "pending_approval" && (
              <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/40">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-800 dark:text-amber-200">{t("dashboard.pendingApprovalTitle")}</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  {t("dashboard.pendingApprovalDesc")}
                </AlertDescription>
              </Alert>
            )}
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
