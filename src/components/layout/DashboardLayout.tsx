import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useDashboardStore } from "@/contexts/StoreContext";
import { AlertTriangle, Clock } from "lucide-react";
import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

const DashboardLayout = () => {
  const { currentStore } = useDashboardStore();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <AppHeader />
          {currentStore?.status === "suspended" && (
            <Alert className="mx-4 mt-4 border-red-200 bg-red-50 md:mx-6">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800">Store Suspended</AlertTitle>
              <AlertDescription className="text-red-700">
                Your store has been suspended and is not visible to customers. If you believe this is a mistake, please contact support@numu.io.
              </AlertDescription>
            </Alert>
          )}
          {currentStore?.status === "pending_approval" && (
            <Alert className="mx-4 mt-4 border-amber-200 bg-amber-50 md:mx-6">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Pending Approval</AlertTitle>
              <AlertDescription className="text-amber-700">
                Your store is under review. You can continue setting up your store while you wait for approval.
              </AlertDescription>
            </Alert>
          )}
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
