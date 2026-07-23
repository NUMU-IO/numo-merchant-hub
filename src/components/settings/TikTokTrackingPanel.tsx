/**
 * TikTok Pixel + Events API settings panel — Souq redesign.
 *
 * Mirrors MetaTrackingPanel's two-column layout so the two platforms read
 * as one product: configuration column (connect → identity → delivery mode
 * → behaviour → multi-pixel), live rail (signal path + health + test
 * sender), then ad performance and the unified events log full-width.
 *
 * Behaviour is unchanged: mode cards flip the two persisted booleans
 * (`pixel_enabled`, `api_enabled`), the Events API token stays write-only,
 * multi-pixel extras persist primary-first sharing the primary's flags.
 * New: dirty-state floating save bar, disconnect confirmation, debug
 * countdown, `/status` health metrics, expandable event log rows.
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  ExternalLink,
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  Plus,
  Send,
  ServerCog,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  type OrderStatusTrigger,
  type SaveTikTokTrackingPayload,
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
  fetchTikTokTrackingStatus,
  flagsForMode,
  saveTikTokTracking,
  sendTikTokTestEvent,
  tiktokOAuthStartUrl,
} from "@/services/tiktokTrackingApi";
import { TikTokGlyph } from "./tracking/PlatformGlyphs";
import {
  DisconnectDialog,
  EventsLog,
  EventsWeSend,
  FloatingSaveBar,
  HelpLink,
  ModeCardGrid,
  SettingSection,
  SignalPath,
  StatTrio,
  StatusPill,
  useCountdownMinutes,
  type ModeCardSpec,
  type UnifiedEventRow,
} from "./tracking/TrackingShared";

const PIXEL_ID_REGEX = /^[A-Za-z0-9]{6,40}$/;
const TEST_EVENT_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
const MIN_API_TOKEN_LENGTH = 10;
const MAX_EXTRA_PIXELS = 4; // + the primary = 5 total (backend allows 10)

/** Events the storefront + webhooks fire automatically (mirrors the
 * funnel-step map in tiktok_capi.py — TikTok's purchase event is
 * CompletePayment, and page views ride the ViewContent server rail). */
const TIKTOK_AUTO_EVENTS = [
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "CompletePayment",
];

const PURCHASE_TRIGGERS: Array<{
  value: OrderStatusTrigger;
  label: { en: string; ar: string };
}> = [
  { value: "confirmed", label: { en: "Confirmed", ar: "مؤكد" } },
  { value: "processing", label: { en: "Processing", ar: "قيد التجهيز" } },
  { value: "shipped", label: { en: "Shipped", ar: "تم الشحن" } },
  { value: "delivered", label: { en: "Delivered", ar: "تم التسليم" } },
];

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

  const statusQuery = useQuery({
    queryKey: ["tiktok-tracking-status", storeId],
    queryFn: () => fetchTikTokTrackingStatus(storeId as string),
    enabled: !!storeId,
    retry: false,
    staleTime: 60_000,
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
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testCodeInput, setTestCodeInput] = useState("");

  const settings = settingsQuery.data ?? null;

  // Saved form values — what "Discard" reverts to and dirty compares against.
  const baseline = useMemo(() => {
    const derived = settings
      ? deriveModeFromFlags(settings.pixel_enabled, settings.api_enabled)
      : "off";
    return {
      pixelId: settings?.pixel_id ?? "",
      mode: (derived === "off" ? "both" : derived) as Exclude<TikTokTrackingMode, "off">,
      testEventCode: settings?.test_event_code ?? "",
      consentRequired: !!settings?.consent_required,
      debugMode: !!settings?.debug_mode,
      purchaseTrigger: ((settings?.purchase_trigger as OrderStatusTrigger | null) ??
        "") as OrderStatusTrigger | "",
      extras: (settings?.pixels ?? []).filter((p) => p.pixel_id !== settings?.pixel_id),
    };
  }, [settings]);

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
    setApiToken("");
    // Advanced multi-pixel: everything except the primary (the Pixel ID field).
    const extras = (s.pixels ?? []).filter((p) => p.pixel_id !== s.pixel_id);
    setExtraPixels(extras);
    if (extras.length > 0) setShowAdvanced(true);
  }, [settingsQuery.data]);

  const hasTokenOnFile = !!settings?.api_access_token_masked;
  const status: TikTokTrackingStatus = settings?.status ?? "disabled";

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

  const dirty =
    pixelId !== baseline.pixelId ||
    mode !== baseline.mode ||
    apiToken.trim().length > 0 ||
    testEventCode !== baseline.testEventCode ||
    consentRequired !== baseline.consentRequired ||
    debugMode !== baseline.debugMode ||
    purchaseTrigger !== baseline.purchaseTrigger ||
    JSON.stringify(extraPixels) !== JSON.stringify(baseline.extras);

  const blockedHint = !dirty
    ? null
    : pixelId.trim().length === 0
      ? isAr
        ? "اكتب معرّف الـ Pixel الأول"
        : "Enter your Pixel Code first"
      : !pixelValid
        ? isAr
          ? "المعرّف لازم يكون ٦–٤٠ حرف/رقم"
          : "Pixel Code must be 6-40 alphanumeric characters"
        : !testCodeValid
          ? isAr
            ? "كود الاختبار غير صحيح"
            : "Test-event code looks invalid"
          : needsToken
            ? isAr
              ? "التوكن مطلوب لتفعيل Events API"
              : "A token is required to enable the Events API"
            : !tokenLongEnough
              ? isAr
                ? "التوكن قصير جدًا"
                : "Token looks too short"
              : null;

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
      const validExtras = extraPixels.filter((p) => PIXEL_ID_REGEX.test(p.pixel_id.trim()));
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
      setShowToken(false);
      toast.success(isAr ? "تم حفظ إعدادات TikTok" : "TikTok settings saved");
      queryClient.invalidateQueries({ queryKey: ["tiktok-tracking-settings", storeId] });
      queryClient.invalidateQueries({ queryKey: ["tiktok-tracking-status", storeId] });
    } catch (err) {
      showError(err, language);
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setPixelId(baseline.pixelId);
    setMode(baseline.mode);
    setTestEventCode(baseline.testEventCode);
    setConsentRequired(baseline.consentRequired);
    setDebugMode(baseline.debugMode);
    setPurchaseTrigger(baseline.purchaseTrigger);
    setExtraPixels(baseline.extras);
    setApiToken("");
    setShowToken(false);
  }

  async function handleDisconnect() {
    if (!storeId) return;
    setDisconnecting(true);
    try {
      await disconnectTikTok(storeId);
      toast.success(isAr ? "تم فصل TikTok" : "TikTok disconnected");
      setConfirmDisconnect(false);
      queryClient.invalidateQueries({ queryKey: ["tiktok-tracking-settings", storeId] });
      queryClient.invalidateQueries({ queryKey: ["tiktok-tracking-events", storeId] });
      queryClient.invalidateQueries({ queryKey: ["tiktok-tracking-status", storeId] });
    } catch (err) {
      showError(err, language);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSendTest() {
    if (!storeId) return;
    if (!TEST_EVENT_REGEX.test(testCodeInput.trim())) {
      toast.error(isAr ? "أدخل كود اختبار صحيح" : "Enter a valid test-event code");
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
      queryClient.invalidateQueries({ queryKey: ["tiktok-tracking-events", storeId] });
    } catch (err) {
      showError(err, language);
    } finally {
      setTesting(false);
    }
  }

  const debugMinutesLeft = useCountdownMinutes(settings?.debug_mode_expires_at);

  if (!storeId) {
    return (
      <div className="souq-section p-6 text-sm text-muted-foreground">
        {isAr ? "اختار متجر الأول" : "Select a store first."}
      </div>
    );
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="souq-section flex items-center justify-center p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const modeCards: ModeCardSpec[] = [
    {
      mode: "pixel_only",
      Icon: Globe2,
      title: isAr ? "Pixel فقط" : "Pixel only",
      desc: isAr
        ? "تتبع من المتصفح. بسيط، لكن بيفوته ~٣٠٪ من التحويلات."
        : "Browser-side tracking. Simple, but misses ~30% of conversions.",
      requirement: isAr ? "محتاج معرّف Pixel فقط." : "Requires Pixel Code only.",
    },
    {
      mode: "capi_only",
      Icon: ServerCog,
      title: isAr ? "Events API فقط" : "Events API only",
      desc: isAr
        ? "من السيرفر فقط. مقاوم لمانع الإعلانات؛ بدون سكربت في المتصفح."
        : "Server-side only. Resilient to ad-blockers; no browser script.",
      requirement: isAr ? "محتاج معرّف + توكن." : "Requires Pixel Code + token.",
    },
    {
      mode: "both",
      Icon: Sparkles,
      title: isAr ? "الاثنين" : "Both",
      desc: isAr
        ? "Pixel + Events API مع إزالة التكرار. أفضل جودة مطابقة."
        : "Pixel + Events API, deduplicated. Best match quality.",
      requirement: isAr ? "محتاج معرّف + توكن." : "Requires Pixel Code + token.",
      recommended: true,
    },
  ];

  const eventRows: UnifiedEventRow[] = (eventsQuery.data ?? []).map((e) => ({
    id: e.id,
    eventId: e.event_id,
    name: e.event_name,
    channel: e.channel,
    httpStatus: e.response_status,
    bizCode: e.response_code,
    traceId: e.request_id,
    attempts: e.attempt_count,
    lastError: e.last_error,
    createdAt: e.created_at,
    sentAt: e.sent_at,
    payload: e.request_payload_redacted,
  }));

  return (
    <div>
      <div className="settings-section-enter space-y-5">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* ══ Config column ══ */}
          <div className="min-w-0 space-y-5">
            {/* Identity */}
            <SettingSection
              title={isAr ? "هوية الـ Pixel" : "Pixel identity"}
              desc={
                isAr
                  ? "الـ Pixel Code من TikTok Events Manager → Web Events"
                  : "The Pixel Code from TikTok Events Manager → Web Events"
              }
              aside={
                <a
                  href="https://ads.tiktok.com/i18n/events_manager/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-bold text-navy hover:underline dark:text-primary"
                >
                  {isAr ? "فين ألاقيه؟" : "Where do I find this?"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              }
            >
              {/* One-click connect (OAuth). Dormant until the NUMU TikTok App
                  is configured — the backend returns 503 and merchants use the
                  manual paste flow below. Navigates the top window so the CSRF
                  cookie + redirect chain work. */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2/60 p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="ichip bg-[#0f0f0f] text-white dark:bg-white dark:text-[#0f0f0f]">
                    <TikTokGlyph size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[13px] font-extrabold">
                      {isAr ? "الربط بنقرة واحدة" : "One-click connect"}
                      <span className="souq-pill bg-saffron-100 text-saffron-600 dark:text-saffron">
                        {isAr ? "تجريبي" : "Beta"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isAr
                        ? "اربط حساب TikTok Business لجلب الـ Pixel تلقائيًا"
                        : "Connect your TikTok Business account to auto-fill your pixel"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.location.href = tiktokOAuthStartUrl(storeId);
                  }}
                >
                  {isAr ? "الربط مع TikTok" : "Connect with TikTok"}
                </Button>
              </div>

              <Label htmlFor="tt-pixel-id" className="sr-only">
                {isAr ? "معرّف Pixel (Pixel Code)" : "Pixel ID (Pixel Code)"}
              </Label>
              <Input
                id="tt-pixel-id"
                value={pixelId}
                onChange={(e) => setPixelId(e.target.value.trim())}
                placeholder="C4A2B1D3E4F5G6H7I8J9"
                dir="ltr"
                aria-invalid={!!pixelId && !pixelValid}
                className="font-mono"
              />
              {pixelId && !pixelValid && (
                <p className="mt-1.5 text-xs text-destructive">
                  {isAr ? "المعرّف لازم يكون ٦–٤٠ حرف/رقم" : "Must be 6-40 alphanumeric characters"}
                </p>
              )}
            </SettingSection>

            {/* Delivery mode */}
            <SettingSection
              title={isAr ? "إزاي الأحداث توصل لـ TikTok" : "How events reach TikTok"}
              desc={
                isAr
                  ? "حدد هل الأحداث تتبعت من المتصفح، من السيرفر، أو الاثنين"
                  : "Decide whether events go through the browser, the server, or both"
              }
            >
              <ModeCardGrid value={mode} onChange={setMode} cards={modeCards} isAr={isAr} />

              {/* Events API token — only when a server mode is selected */}
              {wantsApi && (
                <div className="mt-4 border-t border-border pt-4">
                  <Label htmlFor="tt-api-token" className="text-[12.5px] font-extrabold">
                    {isAr ? "توكن Events API" : "Events API access token"}
                  </Label>
                  <p className="mb-2 mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    {hasTokenOnFile
                      ? isAr
                        ? "توكن محفوظ بالفعل — اتركه فارغًا للإبقاء عليه"
                        : "A token is on file — leave blank to keep it"
                      : isAr
                        ? "من Events Manager → إعدادات الـ Pixel → Generate Access Token. مكتوب فقط ولا يظهر بعد الحفظ."
                        : "From Events Manager → your pixel's settings → Generate Access Token. Write-only; never shown again after saving."}
                  </p>
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
                      // auto: Arabic placeholder renders RTL, typed token LTR
                      dir="auto"
                      autoComplete="off"
                      className="pe-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      aria-label={
                        showToken
                          ? isAr
                            ? "إخفاء التوكن"
                            : "Hide token"
                          : isAr
                            ? "إظهار التوكن"
                            : "Show token"
                      }
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {needsToken && (
                    <p className="mt-1.5 text-xs text-destructive">
                      {isAr
                        ? "التوكن مطلوب لتفعيل Events API"
                        : "A token is required to enable the Events API"}
                    </p>
                  )}
                  {!tokenLongEnough && (
                    <p className="mt-1.5 text-xs text-destructive">
                      {isAr ? "التوكن قصير جدًا" : "Token looks too short"}
                    </p>
                  )}
                </div>
              )}
            </SettingSection>

            {/* Behaviour */}
            <SettingSection title={isAr ? "السلوك" : "Behaviour"}>
              <div className="divide-y divide-border">
                {/* Debug mode */}
                <div className="flex items-start justify-between gap-4 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-[13px] font-bold">
                        {isAr ? "وضع التصحيح (Debug)" : "Debug mode (60 min)"}
                      </Label>
                      {settings?.debug_mode && debugMinutesLeft !== null && (
                        <span className="souq-pill bg-saffron-100 text-saffron-600 dark:text-saffron">
                          <span className="dot animate-pulse" />
                          {isAr
                            ? `فاضل ${debugMinutesLeft.toLocaleString("ar-EG")} دقيقة`
                            : `${debugMinutesLeft} min left`}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {isAr
                        ? "يرفق كود الاختبار بكل حدث لمدة ٦٠ دقيقة علشان تتحقق في Events Manager"
                        : "Attaches your test code to every event for 60 minutes so you can verify in Events Manager"}
                    </p>
                  </div>
                  <Switch checked={debugMode} onCheckedChange={setDebugMode} />
                </div>

                {/* Consent required */}
                <div className="flex items-start justify-between gap-4 py-4">
                  <div>
                    <Label className="text-[13px] font-bold">
                      {isAr ? "اشتراط الموافقة (Consent)" : "Require consent banner"}
                    </Label>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {isAr
                        ? "لا يعمل Pixel في المتصفح إلا بعد موافقة الزائر"
                        : "The browser Pixel only fires after the visitor accepts the banner"}
                    </p>
                  </div>
                  <Switch checked={consentRequired} onCheckedChange={setConsentRequired} />
                </div>

                {/* Test event code + COD purchase timing */}
                <div className="grid gap-4 pt-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="tt-test-code" className="text-[13px] font-bold">
                      {isAr ? "كود الحدث التجريبي (اختياري)" : "Test event code (optional)"}
                    </Label>
                    <Input
                      id="tt-test-code"
                      value={testEventCode}
                      onChange={(e) => setTestEventCode(e.target.value.trim())}
                      placeholder="TEST12345"
                      dir="ltr"
                      aria-invalid={!testCodeValid}
                      className="mt-1.5 font-mono"
                    />
                    {!testCodeValid && (
                      <p className="mt-1.5 text-xs text-destructive">
                        {isAr ? "كود الاختبار غير صحيح" : "Test-event code looks invalid"}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="tt-purchase-trigger" className="text-[13px] font-bold">
                      {isAr ? "توقيت حدث الشراء (COD)" : "Purchase timing (COD)"}
                    </Label>
                    <Select
                      value={purchaseTrigger || "__default"}
                      onValueChange={(v) =>
                        setPurchaseTrigger(v === "__default" ? "" : (v as OrderStatusTrigger))
                      }
                    >
                      <SelectTrigger id="tt-purchase-trigger" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default">
                          {isAr ? "عند تأكيد الدفع (افتراضي)" : "On payment (default)"}
                        </SelectItem>
                        {PURCHASE_TRIGGERS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {isAr ? t.label.ar : t.label.en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
                      {isAr
                        ? "للدفع عند الاستلام: إرسال CompletePayment عند التسليم يخلّي ROAS مظبوط على الإيراد الحقيقي."
                        : "For COD: firing CompletePayment on delivery keeps ROAS aligned with real revenue."}
                    </p>
                  </div>
                </div>
              </div>
            </SettingSection>

            {/* Multiple pixels (advanced) */}
            <section className="souq-section overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start"
              >
                <div>
                  <span className="text-[15px] font-extrabold tracking-tight">
                    {isAr ? "بيكسلات متعددة" : "Multiple pixels"}
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {isAr
                      ? "لوكالة إعلانات أو بكسل إعادة استهداف — كل حدث يتبعت لكل بيكسل مفعّل"
                      : "For an agency or a retargeting pixel — every event fires to each enabled pixel"}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  {extraPixels.length > 0 && (
                    <span className="souq-pill bg-muted text-ink-soft tabular-nums">
                      {extraPixels.length + 1}
                    </span>
                  )}
                  <Plus
                    className={cn(
                      "h-4 w-4 text-ink-faint transition-transform",
                      showAdvanced && "rotate-45",
                    )}
                    strokeWidth={2.4}
                  />
                </span>
              </button>

              {showAdvanced && (
                <div className="space-y-3 border-t border-border px-5 py-4">
                  {/* Primary (read-only reference from the Pixel ID field above) */}
                  <div className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-3.5 py-2.5 text-xs">
                    <span className="souq-pill bg-navy/10 text-navy dark:bg-primary/15 dark:text-primary">
                      {isAr ? "أساسي" : "Primary"}
                    </span>
                    <span dir="ltr" className="font-mono font-semibold">
                      {pixelId || "—"}
                    </span>
                  </div>

                  {extraPixels.map((p, i) => (
                    <div
                      key={i}
                      className="grid gap-2.5 rounded-xl border border-border p-3.5 sm:grid-cols-[1fr_auto]"
                    >
                      <div className="min-w-0 space-y-2.5">
                        <Input
                          value={p.pixel_id}
                          onChange={(e) =>
                            setExtraPixels((list) =>
                              list.map((x, j) =>
                                j === i ? { ...x, pixel_id: e.target.value.trim() } : x,
                              ),
                            )
                          }
                          placeholder="C4A2B1D3E4F5G6H7I8J9"
                          dir="ltr"
                          className={cn(
                            "font-mono text-xs",
                            p.pixel_id &&
                              !PIXEL_ID_REGEX.test(p.pixel_id) &&
                              "border-destructive focus-visible:ring-destructive",
                          )}
                        />
                        <Input
                          value={p.label ?? ""}
                          onChange={(e) =>
                            setExtraPixels((list) =>
                              list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                            )
                          }
                          placeholder={isAr ? "تسمية (اختياري)" : "Label (optional)"}
                          className="text-xs"
                        />
                        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
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
                            Pixel
                          </label>
                          <label className="flex items-center gap-1.5">
                            <Switch
                              checked={p.api_enabled}
                              onCheckedChange={(v) =>
                                setExtraPixels((list) =>
                                  list.map((x, j) => (j === i ? { ...x, api_enabled: v } : x)),
                                )
                              }
                            />
                            Events API
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
                      <Plus className="h-4 w-4" />
                      {isAr ? "إضافة بيكسل" : "Add pixel"}
                    </Button>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ══ Live rail ══ */}
          <div className="space-y-5">
            <section className="souq-section space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-extrabold tracking-tight">
                  {isAr ? "الإشارة الحية" : "Live signal"}
                </h3>
                <StatusPill status={status} isAr={isAr} />
              </div>

              <SignalPath
                pixelOn={mode === "pixel_only" || mode === "both"}
                serverOn={wantsApi}
                serverLabel="Events API"
                platformName="TikTok"
                platformNode={
                  <div className="ichip bg-[#0f0f0f] text-white dark:bg-white dark:text-[#0f0f0f]">
                    <TikTokGlyph size={22} />
                  </div>
                }
                isAr={isAr}
              />

              <StatTrio
                lastEventAt={
                  statusQuery.data?.last_validated_at ?? settings?.last_validated_at ?? null
                }
                failureRate={statusQuery.data?.recent_failure_rate ?? null}
                eventCount={statusQuery.data?.recent_event_count ?? null}
                isAr={isAr}
              />

              {/* Test event sender */}
              <div className="space-y-2 rounded-xl border border-border p-3.5">
                <div className="text-[12.5px] font-extrabold">
                  {isAr ? "أرسل حدثًا تجريبيًا" : "Send a test event"}
                </div>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  {isAr
                    ? "يتطلب Events API. يظهر في Events Manager → Test Events."
                    : "Requires the Events API. Shows in Events Manager → Test Events."}
                </p>
                <Input
                  value={testCodeInput}
                  onChange={(e) => setTestCodeInput(e.target.value.trim())}
                  placeholder="TEST12345"
                  dir="ltr"
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleSendTest}
                  disabled={testing || !testCodeInput.trim()}
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isAr ? "إرسال" : "Send"}
                </Button>
              </div>

              {(settings?.pixel_enabled || settings?.api_enabled) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDisconnect(true)}
                  disabled={disconnecting}
                >
                  <Trash2 className="h-4 w-4" />
                  {isAr ? "فصل TikTok" : "Disconnect TikTok"}
                </Button>
              )}
            </section>

            {/* Resources */}
            <SettingSection title={isAr ? "روابط TikTok" : "TikTok resources"}>
              <div className="-mx-2.5 space-y-0.5">
                <HelpLink href="https://ads.tiktok.com/i18n/events_manager/">
                  {isAr ? "افتح Events Manager" : "Open Events Manager"}
                </HelpLink>
                <HelpLink href="https://ads.tiktok.com/help/article/events-api">
                  {isAr ? "إزاي تجيب توكن Events API" : "How to get an Events API token"}
                </HelpLink>
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <EventsWeSend
                  events={TIKTOK_AUTO_EVENTS}
                  isAr={isAr}
                  note={
                    isAr
                      ? "حدث الشراء عند TikTok اسمه CompletePayment — بيتبعت حسب توقيت الشراء اللي اخترته."
                      : "TikTok's purchase event is CompletePayment — it fires per the purchase timing you chose."
                  }
                />
              </div>
            </SettingSection>
          </div>
        </div>

        {/* ══ Ad performance (Marketing API) ══ */}
        <AdReportSection report={reportQuery.data} loading={reportQuery.isLoading} isAr={isAr} />

        {/* ══ Events log — full width ══ */}
        <EventsLog
          rows={eventRows}
          loading={eventsQuery.isLoading}
          isAr={isAr}
          traceHeader={isAr ? "معرّف الطلب" : "request id"}
          title={isAr ? "أحدث الأحداث" : "Recent events"}
          subtitle={
            isAr
              ? "آخر ٢٠ حدث اتبعتوا لـ TikTok. اضغط على أي صف لعرض التفاصيل."
              : "Last 20 events sent to TikTok. Click a row to expand the details."
          }
          emptyTitle={isAr ? "لا توجد أحداث بعد" : "No events yet"}
          emptyHint={
            isAr
              ? "ابعت حدث تجريبي أو افتح متجرك في تبويب تاني — أول حدث هيظهر هنا."
              : "Send a test event or open your storefront in another tab — the first event lands here."
          }
        />
      </div>

      {/* Floating save pill + disconnect confirm (outside the staggered
          container — the entrance transform would break their positioning) */}
      <FloatingSaveBar
        visible={dirty}
        canSave={canSave}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
        isAr={isAr}
        blockedHint={blockedHint}
      />
      <DisconnectDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        onConfirm={handleDisconnect}
        disconnecting={disconnecting}
        isAr={isAr}
        platformName="TikTok"
        description={
          isAr
            ? "هيتوقف إرسال الأحداث لـ TikTok. إعلاناتك هتفقد إشارات التحويل لحد ما تعيد الربط."
            : "Event delivery to TikTok stops. Your ads lose conversion signals until you reconnect."
        }
      />
    </div>
  );
}

// ─── Ad performance (Marketing API report) ─────────────────────────────────

function AdReportSection({
  report,
  loading,
  isAr,
}: {
  report: TikTokReport | undefined;
  loading: boolean;
  isAr: boolean;
}) {
  const nf = new Intl.NumberFormat(isAr ? "ar-EG" : "en-US");

  return (
    <SettingSection
      title={isAr ? "أداء إعلانات TikTok" : "TikTok ad performance"}
      desc={isAr ? "آخر ٣٠ يوم من الحساب الإعلاني المربوط" : "Last 30 days from your connected ad account"}
      aside={
        <span className="souq-pill bg-muted text-ink-soft">
          <BarChart3 className="h-3.5 w-3.5" />
          {isAr ? "٣٠ يوم" : "30d"}
        </span>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : !report || !report.connected ? (
        <p className="rounded-xl border border-dashed border-border py-4 text-center text-sm text-muted-foreground">
          {isAr
            ? "اربط حساب TikTok Business (الربط بنقرة واحدة فوق) لعرض الإنفاق والتحويلات."
            : "Connect your TikTok Business account (one-click connect above) to see spend and conversions."}
        </p>
      ) : report.error ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 py-4 text-center text-sm font-semibold text-amber-700 dark:text-amber-400">
          {isAr
            ? "تعذّر جلب التقرير — تأكد أن التوكن يملك صلاحية إعداد التقارير."
            : "Couldn't load the report — make sure the token has reporting scope."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: isAr ? "الإنفاق" : "Spend", value: nf.format(report.spend) },
            { label: isAr ? "الظهور" : "Impressions", value: nf.format(report.impressions) },
            { label: isAr ? "النقرات" : "Clicks", value: nf.format(report.clicks) },
            { label: isAr ? "التحويلات" : "Conversions", value: nf.format(report.conversions) },
          ].map((m) => (
            <div key={m.label} className="rounded-xl bg-surface-2/60 px-4 py-3">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">
                {m.label}
              </div>
              <div className="mt-0.5 text-[19px] font-extrabold tabular-nums leading-tight" dir="ltr">
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingSection>
  );
}

export default TikTokTrackingPanel;
