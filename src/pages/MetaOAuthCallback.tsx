import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  connectAssets,
  fetchAvailableAssets,
  type MetaAsset,
} from "@/services/channelsApi";
import { AlertCircle, Check, Facebook, Instagram, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Runs inside the OAuth popup. Meta hands back a code; we exchange it for
 * the list of Pages the merchant granted, let them choose which ones this
 * store should actually use, then connect only those.
 */
export const MetaOAuthCallback = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentStore } = useDashboardStore();

  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<MetaAsset[] | null>(null);
  const [state, setState] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(searchParams.get("error_description") || errorParam);
      return;
    }
    if (!code || !stateParam) {
      setError(t("omnichannel.oauth_missing_code"));
      return;
    }
    if (!currentStore?.id) {
      setError(t("omnichannel.oauth_no_store"));
      return;
    }

    fetchAvailableAssets(currentStore.id, code, stateParam)
      .then((res) => {
        setState(res.state);
        setAssets(res.assets);
        // Pre-select everything: one page is the common case, and the
        // merchant can uncheck what they don't want.
        setSelected(new Set(res.assets.map((a) => a.page_id)));
      })
      .catch((err) => setError(err.message || t("omnichannel.oauth_failed")));
  }, [searchParams, currentStore, t]);

  const toggle = (pageId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const handleConnect = () => {
    if (!currentStore?.id || selected.size === 0) return;
    setConnecting(true);
    connectAssets(currentStore.id, state, Array.from(selected))
      .then(() => {
        // Opened as a popup from Channels: hand control back to the parent.
        if (window.opener) {
          window.opener.postMessage({ type: "meta-connected" }, window.origin);
          window.close();
        } else {
          navigate("/channels");
        }
      })
      .catch((err) => {
        setConnecting(false);
        setError(err.message || t("omnichannel.oauth_failed"));
      });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 px-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h2 className="text-lg font-semibold">{t("omnichannel.oauth_failed")}</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/channels")}>
          {t("omnichannel.channels")}
        </Button>
      </div>
    );
  }

  if (!assets) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {t("omnichannel.oauth_loading_assets")}
        </p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 px-6 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{t("omnichannel.no_pages_title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("omnichannel.no_pages_hint")}
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-lg mx-auto">
      <h2 className="text-lg font-semibold">{t("omnichannel.choose_assets")}</h2>
      <p className="text-sm text-muted-foreground mt-1">
        {t("omnichannel.choose_assets_hint")}
      </p>

      <ul className="mt-5 space-y-2">
        {assets.map((asset) => {
          const isOn = selected.has(asset.page_id);
          return (
            <li key={asset.page_id}>
              <button
                type="button"
                onClick={() => toggle(asset.page_id)}
                aria-pressed={isOn}
                className={`w-full flex items-start gap-3 rounded-lg border p-3 text-start transition-colors ${
                  isOn ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <span
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded border grid place-items-center ${
                    isOn ? "bg-primary border-primary" : "border-muted-foreground/40"
                  }`}
                >
                  {isOn && <Check className="h-3 w-3 text-primary-foreground" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Facebook className="h-3.5 w-3.5 text-[#1877F2]" />
                    {asset.page_name || asset.page_id}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Instagram className="h-3.5 w-3.5" />
                    {asset.instagram
                      ? asset.instagram.name || asset.instagram.id
                      : t("omnichannel.no_ig_linked")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Button
        className="w-full mt-5"
        onClick={handleConnect}
        disabled={selected.size === 0 || connecting}
      >
        {connecting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
        {t("omnichannel.connect_selected", { count: selected.size })}
      </Button>
    </div>
  );
};

export default MetaOAuthCallback;
