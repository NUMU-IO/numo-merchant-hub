/**
 * TikTok Shop sales-channel connection card.
 *
 * Connect your TikTok Shop so orders placed there flow into NUMU as native
 * orders. Connect launches the OAuth flow (dormant until the NUMU TikTok Shop
 * App is configured — the backend returns 503). Disconnect soft-deletes the
 * stored token + clears the channel settings.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";

import { Button } from "@/components/ui/button";
import { TikTokGlyph } from "./tracking/PlatformGlyphs";

import {
  disconnectTikTokShop,
  fetchTikTokShopStatus,
  tiktokShopOAuthStartUrl,
} from "@/services/tiktokShopApi";

export function TikTokShopCard() {
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const storeId = currentStore?.id;
  const queryClient = useQueryClient();
  const [disconnecting, setDisconnecting] = useState(false);

  const statusQuery = useQuery({
    queryKey: ["tiktok-shop-status", storeId],
    queryFn: () => fetchTikTokShopStatus(storeId as string),
    enabled: !!storeId,
    retry: false,
  });

  const status = statusQuery.data;
  const connected = !!status?.connected;

  async function handleDisconnect() {
    if (!storeId) return;
    setDisconnecting(true);
    try {
      await disconnectTikTokShop(storeId);
      toast.success(isAr ? "تم فصل TikTok Shop" : "TikTok Shop disconnected");
      queryClient.invalidateQueries({ queryKey: ["tiktok-shop-status", storeId] });
    } catch (err) {
      showError(err, language);
    } finally {
      setDisconnecting(false);
    }
  }

  if (!storeId) return null;

  return (
    <div className="souq-section flex flex-wrap items-center gap-4 p-5">
      <div className="ichip bg-[#0f0f0f] text-white dark:bg-white dark:text-[#0f0f0f]">
        <TikTokGlyph size={22} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] font-extrabold leading-tight">
            {isAr ? "متجر TikTok" : "TikTok Shop"}
          </span>
          {connected ? (
            <span className="souq-pill bg-emerald-500/14 text-emerald-700 dark:text-emerald-400">
              <span className="dot" />
              {isAr ? "متصل" : "Connected"}
            </span>
          ) : (
            <span className="souq-pill bg-muted text-muted-foreground">
              <span className="dot" />
              {isAr ? "غير متصل" : "Not connected"}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {connected
            ? `${status?.shop_name || status?.shop_id || ""}${
                status?.seller_name ? ` · ${status.seller_name}` : ""
              }${status?.region ? ` · ${status.region}` : ""}`
            : isAr
              ? "اربط متجرك على TikTok Shop لتصل الطلبات تلقائيًا إلى NUMU"
              : "Connect your TikTok Shop so orders flow into NUMU automatically"}
        </p>
      </div>

      {statusQuery.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : connected ? (
        <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
          {disconnecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {isAr ? "فصل" : "Disconnect"}
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => {
            window.location.href = tiktokShopOAuthStartUrl(storeId);
          }}
        >
          {isAr ? "ربط متجر TikTok" : "Connect TikTok Shop"}
        </Button>
      )}
    </div>
  );
}
