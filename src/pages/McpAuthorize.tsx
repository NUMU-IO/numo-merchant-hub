/**
 * Consent for ChatGPT or Claude signing in to a store through the hosted MCP
 * server (numu-mcp `oauth.py`). Opened as `/mcp/authorize?request=…&client=…`.
 *
 * Approve mints an ordinary store key (the same kind Settings → Connect your
 * AI creates) with the merchant's session and posts it to the MCP server,
 * which hands the AI app a one-time code. The key then shows in that list,
 * and revoking it disconnects the app.
 */

import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import { MCP_URL, RECOMMENDED_SCOPES, createAccessToken } from "@/services/mcpApi";

/** Leaves for the MCP server with a form POST, so the key never sits in a URL. */
function postToMcp(fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${new URL(MCP_URL).origin}/authorize/complete`;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export default function McpAuthorize() {
  const { isRTL } = useLanguage();
  const t = (en: string, ar: string) => (isRTL ? ar : en);
  const { search } = useLocation();
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const request = query.get("request");
  // Only the names the server sends; nothing else from the URL reaches the screen.
  const client = query.get("client") === "Claude" ? "Claude" : "ChatGPT";
  const { stores, currentStore, isLoading } = useDashboardStore();
  const [storeId, setStoreId] = useState<string>();
  const [fullAccess, setFullAccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const chosen = storeId ?? currentStore?.id;

  const approve = async () => {
    if (!request || !chosen) return;
    setBusy(true);
    try {
      const key = await createAccessToken(chosen, {
        name: `${client} · ${new Date().toISOString().slice(0, 10)}`,
        scopes: fullAccess ? ["*"] : RECOMMENDED_SCOPES,
        expires_in_days: 365,
      });
      postToMcp({ request, token: key.token });
    } catch (err) {
      showError(err, t("Couldn't connect your store", "معرفناش نربط متجرك"));
      setBusy(false);
    }
  };

  const cancel = () => {
    if (!request) return window.history.back();
    setBusy(true);
    postToMcp({ request, deny: "1" });
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground flex items-center justify-center p-4"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 pt-6">
          {!request ? (
            <p className="text-center text-sm text-destructive">
              {t(
                `This link is incomplete. Start again from ${client}.`,
                `الرابط ده ناقص. ابدأ تاني من ${client}.`,
              )}
            </p>
          ) : isLoading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <img src="/apple-touch-icon.png" alt="" className="h-14 w-14 rounded-xl" />
                <div className="min-w-0">
                  <h1 className="text-lg font-bold leading-tight">
                    {t(`Connect ${client} to your store`, `اربط ${client} بمتجرك`)}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      `${client} will manage your store through NUMU.`,
                      `${client} هيدير متجرك من خلال NUMU.`,
                    )}
                  </p>
                </div>
              </div>

              {stores.length > 1 ? (
                <div className="space-y-1.5">
                  <Label>{t("Store", "المتجر")}</Label>
                  <Select dir={isRTL ? "rtl" : "ltr"} value={chosen} onValueChange={setStoreId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("Store", "المتجر")}:{" "}
                  <span className="font-medium text-foreground">{currentStore?.name}</span>
                </p>
              )}

              <div className="space-y-2 text-sm">
                <p>
                  {fullAccess
                    ? t(
                        "It can read and change everything in your store.",
                        "هيقدر يشوف ويعدّل كل حاجة في متجرك.",
                      )
                    : t(
                        "It can read everything, and change only products and images.",
                        "هيقدر يشوف كل حاجة، ويعدّل المنتجات والصور بس.",
                      )}
                </p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="mcp-full-access"
                    checked={fullAccess}
                    onCheckedChange={(v) => setFullAccess(v === true)}
                  />
                  <Label htmlFor="mcp-full-access" className="font-normal leading-snug">
                    {t(
                      "Also allow orders, discounts, theme and settings",
                      "اسمح كمان بالطلبات والخصومات والثيم والإعدادات",
                    )}
                  </Label>
                </div>
              </div>

              <p className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t(
                    `Approve only if you started this from your own ${client} account. You can disconnect anytime from Settings → Connect your AI.`,
                    `وافق بس لو إنت اللي بدأت الربط من حساب ${client} بتاعك. تقدر تفصله في أي وقت من الإعدادات ← اربط الذكاء الاصطناعي.`,
                  )}
                </span>
              </p>

              <div className="flex gap-2">
                <Button className="flex-1" disabled={busy || !chosen} onClick={approve}>
                  {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t("Connect", "اربط")}
                </Button>
                <Button variant="outline" disabled={busy} onClick={cancel}>
                  {t("Cancel", "إلغاء")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
