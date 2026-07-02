/**
 * TikTok Pixel + Events API settings panel.
 *
 * Sibling of `MetaTrackingPanel`. Status badge, Pixel Code input, three
 * activation-mode cards (Pixel only / Events API only / Both), conditional
 * Events API token field, test-event code + debug toggle, consent toggle,
 * COD-aware CompletePayment timing, and a recent-events table.
 *
 * The mode card is the primary control — behind the scenes it flips the two
 * booleans (`pixel_enabled`, `api_enabled`); no mode enum is persisted.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  Plus,
  Send,
  ServerCog,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import {
  type OrderStatusTrigger,
  type SaveTikTokTrackingPayload,
  type TikTokEventLogEntry,
  type TikTokPixelEntry,
  type TikTokTrackingMode,
  type TikTokTrackingSettings,
  type TikTokTrackingStatus,
  type TikTokReport,
  deriveModeFromFlags,
  disconnectTikTok,
  fetchRecentTikTokEvents,
  fetchTikTokReport,
  fetchTikTokTracking,
  flagsForMode,
  saveTikTokTracking,
  sendTikTokTestEvent,
  tiktokOAuthStartUrl,
} from "@/services/tiktokTrackingApi";

const PIXEL_ID_REGEX = /^[A-Za-z0-9]{6,40}$/;
const TEST_EVENT_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const MIN_API_TOKEN_LENGTH = 10;
const MAX_EXTRA_PIXELS = 4; // + the primary = 5 total (backend allows 10)

// ─── Status badge helpers ─────────────────────────────────────────────────

interface StatusBadgeMeta {
  label: { en: string; ar: string };
  className: string;
  Icon: typeof Wifi;
}

const STATUS_BADGES: Record<TikTokTrackingStatus, StatusBadgeMeta> = {
  connected: {
    label: { en: "Connected", ar: "متصل" },
    className:
      "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
    Icon: Wifi,
  },
  configured_no_events: {
    label: {
      en: "Configured · awaiting traffic",
      ar: "مُعدّ · في انتظار الزيارات",
    },
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    Icon: Sparkles,
  },
  failing: {
    label: { en: "Failing", ar: "بيفشل" },
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
    Icon: AlertCircle,
  },
  disabled: {
    label: { en: "Disabled", ar: "متوقف" },
    className: "bg-muted text-muted-foreground border-border",
    Icon: WifiOff,
  },
};

// ─── Mode-card spec ────────────────────────────────────────────────────────

interface ModeCardSpec {
  mode: Exclude<TikTokTrackingMode, "off">;
  Icon: typeof Globe2;
  title: { en: string; ar: string };
  desc: { en: string; ar: string };
  recommended?: boolean;
}

const MODE_CARDS: ModeCardSpec[] = [
  {
    mode: "pixel_only",
    Icon: Globe2,
    title: { en: "Pixel only", ar: "Pixel فقط" },
    desc: {
      en: "Browser-side tracking. Simple, but misses ~30% of conversions.",
      ar: "تتبع من المتصفح. بسيط، لكن بيفوته ٣٠٪ من التحويلات.",
    },
  },
  {
    mode: "capi_only",
    Icon: ServerCog,
    title: { en: "Events API only", ar: "Events API فقط" },
    desc: {
      en: "Server-side only. Resilient to ad-blockers; no browser script.",
      ar: "من السيرفر فقط. مقاوم لمانع الإعلانات؛ بدون سكربت في المتصفح.",
    },
  },
  {
    mode: "both",
    Icon: Sparkles,
    title: { en: "Both", ar: "الاثنين" },
    desc: {
      en: "Pixel + Events API, deduplicated. Best match quality.",
      ar: "Pixel + Events API مع إزالة التكرار. أفضل جودة مطابقة.",
    },
    recommended: true,
  },
];

const PURCHASE_TRIGGERS: Array<{ value: OrderStatusTrigger; label: { en: string; ar: string } }> = [
  { value: "confirmed", label: { en: "Confirmed", ar: "مؤكد" } },
  { value: "processing", label: { en: "Processing", ar: "قيد التجهيز" } },
  { value: "shipped", label: { en: "Shipped", ar: "تم الشحن" } },
  { value: "delivered", label: { en: "Delivered", ar: "تم التسليم" } },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function TikTokTrackingPanel() {
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const storeId = currentStore?.id;
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["tiktok-tracking-settings", storeId],
    queryFn: () => fetchTikTokTracking(storeId as string),
    enabled: !!storeId,
  });

  const eventsQuery = useQuery({
    queryKey: ["tiktok-tracking-events", storeId],
    queryFn: () => fetchRecentTikTokEvents(storeId as string, 20),
    enabled: !!storeId,
  });

  const reportQuery = useQuery({
    queryKey: ["tiktok-report", storeId],
    queryFn: () => fetchTikTokReport(storeId as string, 30),
    enabled: !!storeId,
    // Ad-report call hits TikTok's Marketing API upstream — refresh sparingly.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // ── Form state ────────────────────────────────────────────────────────
  const [pixelId, setPixelId] = useState("");
  const [mode, setMode] = useState<Exclude<TikTokTrackingMode, "off">>("both");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testEventCode, setTestEventCode] = useState("");
  const [consentRequired, setConsentRequired] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [purchaseTrigger, setPurchaseTrigger] = useState<OrderStatusTrigger | "">("");
  // Advanced: additional pixels beyond the primary (Pixel ID field above).
  const [extraPixels, setExtraPixels] = useState<TikTokPixelEntry[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testCodeInput, setTestCodeInput] = useState("");

  // Sync form from server on load / refetch.
  useEffect(() => {
    const s: TikTokTrackingSettings | null | undefined = settingsQuery.data;
    if (!s) return;
    setPixelId(s.pixel_id ?? "");
    const derived = deriveModeFromFlags(s.pixel_enabled, s.api_enabled);
    setMode(derived === "off" ? "both" : derived);
    setTestEventCode(s.test_event_code ?? "");
    setConsentRequired(!!s.consent_required);
    setDebugMode(!!s.debug_mode);
    setPurchaseTrigger((s.purchase_trigger as OrderStatusTrigger | null) ?? "");
    // Advanced multi-pixel: everything except the primary (the Pixel ID field).
    const extras = (s.pixels ?? []).filter((p) => p.pixel_id !== s.pixel_id);
    setExtraPixels(extras);
    if (extras.length > 0) setShowAdvanced(true);
  }, [settingsQuery.data]);

  const settings = settingsQuery.data ?? null;
  const hasTokenOnFile = !!settings?.api_access_token_masked;
  const status: TikTokTrackingStatus = settings?.status ?? "disabled";
  const badge = STATUS_BADGES[status];

  const pixelValid = PIXEL_ID_REGEX.test(pixelId);
  const testCodeValid = !testEventCode || TEST_EVENT_REGEX.test(testEventCode);
  const wantsApi = mode === "capi_only" || mode === "both";
  const needsToken = wantsApi && !hasTokenOnFile && apiToken.trim().length === 0;
  const tokenLongEnough =
    apiToken.trim().length === 0 || apiToken.trim().length >= MIN_API_TOKEN_LENGTH;

  const canSave = useMemo(
    () => pixelValid && testCodeValid && !needsToken && tokenLongEnough && !saving,
    [pixelValid, testCodeValid, needsToken, tokenLongEnough, saving],
  );

  async function handleSave() {
    if (!storeId || !canSave) return;
    setSaving(true);
    try {
      const flags = flagsForMode(mode);
      const payload: SaveTikTokTrackingPayload = {
        pixel_id: pixelId.trim(),
        pixel_enabled: flags.pixel_enabled,
        api_enabled: flags.api_enabled,
        test_event_code: testEventCode.trim() || null,
        consent_required: consentRequired,
        debug_mode: debugMode,
        purchase_trigger: purchaseTrigger || null,
      };
      if (apiToken.trim()) payload.api_access_token = apiToken.trim();

      // Multi-pixel: when the merchant added extras, persist the full list
      // (primary first, sharing the primary's mode flags) so the storefront
      // + backend fan out to every pixel. Empty → null = legacy single-pixel.
      const validExtras = extraPixels.filter((p) =>
        PIXEL_ID_REGEX.test(p.pixel_id.trim()),
      );
      if (validExtras.length > 0) {
        payload.pixels = [
          {
            pixel_id: pixelId.trim(),
            pixel_enabled: flags.pixel_enabled,
            api_enabled: flags.api_enabled,
            label: "Primary",
            role: "primary",
          },
          ...validExtras.map((p) => ({
            pixel_id: p.pixel_id.trim(),
            pixel_enabled: p.pixel_enabled,
            api_enabled: p.api_enabled,
            label: p.label ?? null,
            role: p.role ?? null,
          })),
        ];
      } else {
        payload.pixels = null;
      }

      await saveTikTokTracking(storeId, payload);
      setApiToken("");
      toast.success(isAr ? "تم حفظ إعدادات TikTok" : "TikTok settings saved");
      queryClient.invalidateQueries({
        queryKey: ["tiktok-tracking-settings", storeId],
      });
    } catch (err) {
      showError(err, language);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!storeId) return;
    setDisconnecting(true);
    try {
      await disconnectTikTok(storeId);
      toast.success(isAr ? "تم فصل TikTok" : "TikTok disconnected");
      queryClient.invalidateQueries({
        queryKey: ["tiktok-tracking-settings", storeId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tiktok-tracking-events", storeId],
      });
    } catch (err) {
      showError(err, language);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSendTest() {
    if (!storeId) return;
    if (!TEST_EVENT_REGEX.test(testCodeInput.trim())) {
      toast.error(
        isAr ? "أدخل كود اختبار صحيح" : "Enter a valid test-event code",
      );
      return;
    }
    setTesting(true);
    try {
      await sendTikTokTestEvent(storeId, testCodeInput.trim());
      toast.success(
        isAr
          ? "تم إرسال الحدث التجريبي — افحصه في Events Manager"
          : "Test event sent — check Events Manager",
      );
      queryClient.invalidateQueries({
        queryKey: ["tiktok-tracking-events", storeId],
      });
    } catch (err) {
      showError(err, language);
    } finally {
      setTesting(false);
    }
  }

  if (!storeId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {isAr ? "اختر متجرًا أولًا" : "Select a store first"}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {/* TikTok wordmark stand-in — the hub ships no brand SVG here. */}
              <span className="font-black tracking-tight">TikTok</span>
              <span className="text-muted-foreground font-normal">
                {isAr ? "Pixel و Events API" : "Pixel & Events API"}
              </span>
            </CardTitle>
            <CardDescription>
              {isAr
                ? "قِس مشاهدات المنتجات والإضافة للسلة والشراء من متجرك على TikTok"
                : "Measure product views, add-to-cart, and purchases from your store on TikTok"}
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn("gap-1.5 whitespace-nowrap", badge.className)}
          >
            <badge.Icon className="h-3.5 w-3.5" />
            {isAr ? badge.label.ar : badge.label.en}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {settingsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* One-click connect (OAuth). Dormant until the NUMU TikTok App
                is configured — the backend returns 503 and merchants use the
                manual paste flow below. Navigates the top window so the CSRF
                cookie + redirect chain work. */}
            <div className="rounded-lg border border-dashed p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <div className="font-medium">
                  {isAr ? "الربط بنقرة واحدة" : "One-click connect"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "اربط حساب TikTok Business لجلب الـ Pixel تلقائيًا (تجريبي)"
                    : "Connect your TikTok Business account to auto-fill your pixel (beta)"}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = tiktokOAuthStartUrl(storeId);
                }}
              >
                {isAr ? "الربط مع TikTok" : "Connect with TikTok"}
              </Button>
            </div>

            {/* Pixel ID */}
            <div className="space-y-1.5">
              <Label htmlFor="tt-pixel-id">
                {isAr ? "معرّف Pixel (Pixel Code)" : "Pixel ID (Pixel Code)"}
              </Label>
              <Input
                id="tt-pixel-id"
                value={pixelId}
                onChange={(e) => setPixelId(e.target.value.trim())}
                placeholder="C4A2B1D3E4F5G6H7I8J9"
                dir="ltr"
                className={cn(
                  pixelId && !pixelValid && "border-red-500 focus-visible:ring-red-500",
                )}
              />
              {pixelId && !pixelValid && (
                <p className="text-xs text-red-600">
                  {isAr
                    ? "المعرّف لازم يكون ٦–٤٠ حرف/رقم"
                    : "Must be 6-40 alphanumeric characters"}
                </p>
              )}
            </div>

            {/* Mode cards */}
            <div className="space-y-2">
              <Label>{isAr ? "طريقة التفعيل" : "Activation mode"}</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {MODE_CARDS.map((card) => {
                  const active = mode === card.mode;
                  return (
                    <button
                      key={card.mode}
                      type="button"
                      onClick={() => setMode(card.mode)}
                      className={cn(
                        "relative rounded-lg border p-3 text-start transition",
                        active
                          ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      {card.recommended && (
                        <Badge className="absolute -top-2 end-2 text-[10px]">
                          {isAr ? "موصى به" : "Recommended"}
                        </Badge>
                      )}
                      <card.Icon className="h-5 w-5 mb-1.5 text-primary" />
                      <div className="font-semibold text-sm">
                        {isAr ? card.title.ar : card.title.en}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isAr ? card.desc.ar : card.desc.en}
                      </p>
                      {active && (
                        <Check className="absolute top-2 end-2 h-4 w-4 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Events API token — only when a server mode is selected */}
            {wantsApi && (
              <div className="space-y-1.5">
                <Label htmlFor="tt-api-token">
                  {isAr ? "توكن Events API" : "Events API access token"}
                </Label>
                <div className="relative">
                  <Input
                    id="tt-api-token"
                    type={showToken ? "text" : "password"}
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder={
                      hasTokenOnFile
                        ? settings?.api_access_token_masked ?? "••••••••"
                        : isAr
                          ? "الصق التوكن من TikTok Events Manager"
                          : "Paste the token from TikTok Events Manager"
                    }
                    dir="ltr"
                    className="pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground"
                    tabIndex={-1}
                  >
                    {showToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {hasTokenOnFile
                    ? isAr
                      ? "توكن محفوظ بالفعل — اتركه فارغًا للإبقاء عليه"
                      : "A token is on file — leave blank to keep it"
                    : isAr
                      ? "التوكن مكتوب فقط ولا يظهر بعد الحفظ"
                      : "The token is write-only and never shown again after saving"}
                </p>
                {needsToken && (
                  <p className="text-xs text-red-600">
                    {isAr
                      ? "التوكن مطلوب لتفعيل Events API"
                      : "A token is required to enable the Events API"}
                  </p>
                )}
              </div>
            )}

            {/* Test event code + debug + consent */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tt-test-code">
                  {isAr ? "كود الحدث التجريبي (اختياري)" : "Test event code (optional)"}
                </Label>
                <Input
                  id="tt-test-code"
                  value={testEventCode}
                  onChange={(e) => setTestEventCode(e.target.value.trim())}
                  placeholder="TEST12345"
                  dir="ltr"
                  className={cn(
                    !testCodeValid && "border-red-500 focus-visible:ring-red-500",
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tt-purchase-trigger">
                  {isAr ? "توقيت حدث الشراء (COD)" : "Purchase timing (COD)"}
                </Label>
                <select
                  id="tt-purchase-trigger"
                  aria-label={isAr ? "توقيت حدث الشراء" : "Purchase timing"}
                  value={purchaseTrigger}
                  onChange={(e) =>
                    setPurchaseTrigger(e.target.value as OrderStatusTrigger | "")
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">
                    {isAr ? "عند تأكيد الدفع (افتراضي)" : "On payment (default)"}
                  </option>
                  {PURCHASE_TRIGGERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {isAr ? t.label.ar : t.label.en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">
                  {isAr ? "وضع التصحيح (Debug)" : "Debug mode"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "يرفق كود الاختبار بكل حدث لمدة ٦٠ دقيقة"
                    : "Attaches the test code to every event for 60 minutes"}
                </p>
              </div>
              <Switch checked={debugMode} onCheckedChange={setDebugMode} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">
                  {isAr ? "اشتراط الموافقة (Consent)" : "Require consent"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "لا يعمل Pixel في المتصفح إلا بعد موافقة الزائر"
                    : "Browser Pixel only fires after the visitor accepts the banner"}
                </p>
              </div>
              <Switch checked={consentRequired} onCheckedChange={setConsentRequired} />
            </div>

            {/* Advanced — multiple pixels */}
            <div className="rounded-lg border">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between p-3 text-sm font-medium"
              >
                <span className="flex items-center gap-2">
                  {showAdvanced ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {isAr ? "بيكسلات متعددة (متقدم)" : "Multiple pixels (advanced)"}
                </span>
                {extraPixels.length > 0 && (
                  <Badge variant="secondary">{extraPixels.length + 1}</Badge>
                )}
              </button>

              {showAdvanced && (
                <div className="space-y-3 border-t p-3">
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? "أضف بيكسلات إضافية (مثلًا لوكالة أو لإعادة الاستهداف). كل حدث يُرسَل لكل بيكسل مُفعّل بنفس المعرّف."
                      : "Add extra pixels (e.g. an agency's or a retargeting pixel). Every event fires to each enabled pixel with the same event_id."}
                  </p>

                  {/* Primary (read-only reference from the Pixel ID field above) */}
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
                    <Badge className="text-[10px]">
                      {isAr ? "أساسي" : "Primary"}
                    </Badge>
                    <span dir="ltr" className="font-mono">
                      {pixelId || (isAr ? "—" : "—")}
                    </span>
                  </div>

                  {extraPixels.map((p, i) => (
                    <div
                      key={i}
                      className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_auto]"
                    >
                      <div className="space-y-2">
                        <Input
                          value={p.pixel_id}
                          onChange={(e) =>
                            setExtraPixels((list) =>
                              list.map((x, j) =>
                                j === i
                                  ? { ...x, pixel_id: e.target.value.trim() }
                                  : x,
                              ),
                            )
                          }
                          placeholder="C4A2B1D3E4F5G6H7I8J9"
                          dir="ltr"
                          className={cn(
                            "font-mono text-xs",
                            p.pixel_id &&
                              !PIXEL_ID_REGEX.test(p.pixel_id) &&
                              "border-red-500 focus-visible:ring-red-500",
                          )}
                        />
                        <Input
                          value={p.label ?? ""}
                          onChange={(e) =>
                            setExtraPixels((list) =>
                              list.map((x, j) =>
                                j === i ? { ...x, label: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder={isAr ? "تسمية (اختياري)" : "Label (optional)"}
                          className="text-xs"
                        />
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <label className="flex items-center gap-1.5">
                            <Switch
                              checked={p.pixel_enabled}
                              onCheckedChange={(v) =>
                                setExtraPixels((list) =>
                                  list.map((x, j) =>
                                    j === i ? { ...x, pixel_enabled: v } : x,
                                  ),
                                )
                              }
                            />
                            {isAr ? "Pixel" : "Pixel"}
                          </label>
                          <label className="flex items-center gap-1.5">
                            <Switch
                              checked={p.api_enabled}
                              onCheckedChange={(v) =>
                                setExtraPixels((list) =>
                                  list.map((x, j) =>
                                    j === i ? { ...x, api_enabled: v } : x,
                                  ),
                                )
                              }
                            />
                            {isAr ? "Events API" : "Events API"}
                          </label>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setExtraPixels((list) => list.filter((_, j) => j !== i))
                        }
                        aria-label={isAr ? "حذف البيكسل" : "Remove pixel"}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {extraPixels.length < MAX_EXTRA_PIXELS && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setExtraPixels((list) => [
                          ...list,
                          {
                            pixel_id: "",
                            pixel_enabled: true,
                            api_enabled: true,
                            label: null,
                            role: "retargeting",
                          },
                        ])
                      }
                    >
                      <Plus className="h-4 w-4 me-1.5" />
                      {isAr ? "إضافة بيكسل" : "Add pixel"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleSave} disabled={!canSave}>
                {saving && <Loader2 className="h-4 w-4 animate-spin me-1.5" />}
                {isAr ? "حفظ" : "Save"}
              </Button>
              {(settings?.pixel_enabled || settings?.api_enabled) && (
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
              )}
            </div>

            {/* Test event sender */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="text-sm font-medium">
                {isAr ? "أرسل حدثًا تجريبيًا" : "Send a test event"}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={testCodeInput}
                  onChange={(e) => setTestCodeInput(e.target.value.trim())}
                  placeholder="TEST12345"
                  dir="ltr"
                  className="max-w-[200px]"
                />
                <Button
                  variant="secondary"
                  onClick={handleSendTest}
                  disabled={testing || !testCodeInput.trim()}
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin me-1.5" />
                  ) : (
                    <Send className="h-4 w-4 me-1.5" />
                  )}
                  {isAr ? "إرسال" : "Send"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "يتطلب تفعيل Events API. يظهر في TikTok Events Manager → Test Events."
                  : "Requires the Events API. Appears in TikTok Events Manager → Test Events."}
              </p>
            </div>

            {/* Ad performance (Marketing API) */}
            <AdReport
              report={reportQuery.data}
              loading={reportQuery.isLoading}
              isAr={isAr}
            />

            {/* Recent events */}
            <RecentEvents
              rows={eventsQuery.data ?? []}
              loading={eventsQuery.isLoading}
              isAr={isAr}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Recent events table ────────────────────────────────────────────────────

function AdReport({
  report,
  loading,
  isAr,
}: {
  report: TikTokReport | undefined;
  loading: boolean;
  isAr: boolean;
}) {
  const nf = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US");
  const label = isAr ? "أداء إعلانات TikTok (آخر ٣٠ يوم)" : "TikTok ad performance (last 30 days)";

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <BarChart3 className="h-4 w-4" />
        {label}
      </Label>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !report || !report.connected ? (
        <p className="text-sm text-muted-foreground py-3 text-center rounded-lg border border-dashed">
          {isAr
            ? "اربط حساب TikTok Business (بنقرة واحدة بالأعلى) لعرض الإنفاق والتحويلات."
            : "Connect your TikTok Business account (one-click above) to see spend and conversions."}
        </p>
      ) : report.error ? (
        <p className="text-sm text-amber-600 py-3 text-center rounded-lg border border-amber-500/30">
          {isAr
            ? "تعذّر جلب التقرير — تأكد أن التوكن يملك صلاحية إعداد التقارير."
            : "Couldn't load the report — make sure the token has reporting scope."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: isAr ? "الإنفاق" : "Spend", value: nf.format(report.spend) },
            { label: isAr ? "الظهور" : "Impressions", value: nf.format(report.impressions) },
            { label: isAr ? "النقرات" : "Clicks", value: nf.format(report.clicks) },
            { label: isAr ? "التحويلات" : "Conversions", value: nf.format(report.conversions) },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{m.label}</div>
              <div className="text-lg font-bold" dir="ltr">
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentEvents({
  rows,
  loading,
  isAr,
}: {
  rows: TikTokEventLogEntry[];
  loading: boolean;
  isAr: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{isAr ? "أحدث الأحداث" : "Recent events"}</Label>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {isAr ? "لا توجد أحداث بعد" : "No events yet"}
        </p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isAr ? "الحدث" : "Event"}</TableHead>
                <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                <TableHead>{isAr ? "الوقت" : "Time"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const ok = r.response_status
                  ? r.response_status >= 200 &&
                    r.response_status < 300 &&
                    (r.response_code === 0 || r.response_code === null)
                  : false;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.event_name}</TableCell>
                    <TableCell>
                      {r.response_status === null ? (
                        <span className="text-xs text-muted-foreground">
                          {isAr ? "قيد الإرسال" : "Pending"}
                        </span>
                      ) : ok ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" />
                          {r.response_status}
                        </span>
                      ) : (
                        <span className="text-xs text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {r.response_status}
                          {r.response_code != null && r.response_code !== 0
                            ? ` · ${r.response_code}`
                            : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" dir="ltr">
                      {new Date(r.created_at).toLocaleString(
                        isAr ? "ar-EG" : "en-US",
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
