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
import { Loader2, ShoppingBag, Trash2, Wifi, WifiOff } from "lucide-react";

import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              {isAr ? "متجر TikTok" : "TikTok Shop"}
            </CardTitle>
            <CardDescription>
              {isAr
                ? "اربط متجرك على TikTok Shop لتصل الطلبات تلقائيًا إلى NUMU"
                : "Connect your TikTok Shop so orders flow into NUMU automatically"}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 whitespace-nowrap",
              connected
                ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30"
                : "bg-muted text-muted-foreground border-border",
            )}
          >
            {connected ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            {connected
              ? isAr
                ? "متصل"
                : "Connected"
              : isAr
                ? "غير متصل"
                : "Not connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {statusQuery.isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">
                {status?.shop_name || status?.shop_id}
              </div>
              {status?.seller_name && (
                <p className="text-xs text-muted-foreground">
                  {status.seller_name}
                  {status.region ? ` · ${status.region}` : ""}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin me-1.5" />
              ) : (
                <Trash2 className="h-4 w-4 me-1.5" />
              )}
              {isAr ? "فصل" : "Disconnect"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {isAr
                ? "اضغط للربط عبر TikTok Shop (تجريبي)."
                : "Connect via TikTok Shop (beta)."}
            </p>
            <Button
              onClick={() => {
                window.location.href = tiktokShopOAuthStartUrl(storeId);
              }}
            >
              {isAr ? "ربط متجر TikTok" : "Connect TikTok Shop"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
