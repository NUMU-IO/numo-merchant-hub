import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDashboardStore } from "@/contexts/StoreContext";
import { handleOAuthCallback } from "@/services/channelsApi";
import { Loader2, AlertCircle } from "lucide-react";

export const MetaOAuthCallback = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentStore } = useDashboardStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(searchParams.get("error_description") || errorParam);
      return;
    }

    if (!code || !state) {
      setError("Missing code or state parameter");
      return;
    }

    if (!currentStore?.id) {
      setError("No store selected");
      return;
    }

    handleOAuthCallback(currentStore.id, code, state)
      .then(() => {
        navigate("/channels");
      })
      .catch((err) => {
        setError(err.message || "Failed to connect");
      });
  }, [searchParams, currentStore, navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-semibold">Connection Failed</h2>
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => navigate("/channels")}
          className="text-primary hover:underline"
        >
          Back to Channels
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <h2 className="text-xl font-semibold">Connecting...</h2>
      <p className="text-muted-foreground">Please wait while we connect your account.</p>
    </div>
  );
};

export default MetaOAuthCallback;