/**
 * Meta Pixel + Conversions API settings panel.
 *
 * Lives under Store Settings → Marketing & Tracking. Implements plan §7
 * end-to-end: status badge, Pixel ID input, three activation-mode cards,
 * conditional CAPI token field, domain verification token (auto-emitted
 * by storefront), debug + consent toggles, test event button, recent
 * events table.
 *
 * The mode card is the *primary* control. Behind the scenes it just
 * flips the two booleans (`pixel_enabled`, `capi_enabled`) — the data
 * model doesn't carry a mode enum so we never need a migration when a
 * fourth combination shows up.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  Send,
  ServerCog,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";
import { showError, extractFieldErrors } from "@/lib/show-error";
import { ApiError } from "@/lib/api-error";

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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  type MetaEventChannel,
  type MetaEventLogEntry,
  type MetaTrackingMode,
  type MetaTrackingSettings,
  type MetaTrackingStatus,
  type SaveMetaTrackingPayload,
  type TrackingSettings,
  deriveModeFromFlags,
  disconnectMeta,
  fetchRecentMetaEvents,
  fetchTrackingSettings,
  flagsForMode,
  saveMetaTracking,
  sendMetaTestEvent,
} from "@/services/metaTrackingApi";
import { MetaTrackingAdvancedSettings } from "./MetaTrackingAdvancedSettings";

const PIXEL_ID_REGEX = /^\d{15,16}$/;
const TEST_EVENT_REGEX = /^TEST\d+$/;
const MIN_CAPI_TOKEN_LENGTH = 50;

// ─── Status badge helpers ─────────────────────────────────────────────────

interface StatusBadgeMeta {
  label: { en: string; ar: string };
  className: string;
  Icon: typeof Wifi;
}

const STATUS_BADGES: Record<MetaTrackingStatus, StatusBadgeMeta> = {
  connected: {
    label: { en: "Connected", ar: "متصل" },
    className:
      "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
    Icon: Wifi,
  },
  configured_no_events: {
    label: { en: "Configured · awaiting traffic", ar: "مُعدّ · في انتظار الزيارات" },
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
  mode: Exclude<MetaTrackingMode, "off">;
  Icon: typeof BarChart3;
  recommended?: boolean;
}

const MODE_CARDS: ModeCardSpec[] = [
  { mode: "pixel_only", Icon: Globe2 },
  { mode: "capi_only", Icon: ServerCog },
  { mode: "both", Icon: Sparkles, recommended: true },
];

// ─── Channel chip for events table ─────────────────────────────────────────

function channelChipClass(channel: MetaEventChannel): string {
  switch (channel) {
    case "browser":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "server":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30";
    case "both":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  }
}

function statusChipForResponse(
  status: number | null,
  isAr: boolean,
): { label: string; className: string } {
  if (status === null) {
    return {
      label: isAr ? "في الانتظار" : "Pending",
      className: "bg-muted text-muted-foreground border-border",
    };
  }
  if (status >= 200 && status < 300) {
    return {
      label: `${status} OK`,
      className:
        "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
    };
  }
  return {
    label: `${status}`,
    className: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
  };
}

// ─── Component ─────────────────────────────────────────────────────────────

export function MetaTrackingPanel() {
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isAr = language === "ar";
  const storeId = currentStore?.id;

  // ─── Server state ────────────────────────────────────────────────────────
  const settingsQuery = useQuery({
    queryKey: ["tracking-settings", storeId],
    queryFn: () => fetchTrackingSettings(storeId!),
    enabled: !!storeId,
    retry: 1,
  });

  const eventsQuery = useQuery({
    queryKey: ["meta-tracking-events", storeId],
    queryFn: () => fetchRecentMetaEvents(storeId!, 20),
    enabled: !!storeId,
    // Recent events table is best-effort; don't spam the merchant with toasts
    // if the endpoint is not reachable yet.
    retry: 1,
  });

  const settings = settingsQuery.data?.meta;

  // ─── Form state ──────────────────────────────────────────────────────────
  const [pixelId, setPixelId] = useState("");
  // Mode is derived from the booleans on load, then becomes the single source
  // of truth for the mode-card UI. `pixel_enabled` / `capi_enabled` get
  // recomputed at save-time via flagsForMode() — keeps the radio always in
  // sync with what we'll persist.
  const [mode, setMode] = useState<Exclude<MetaTrackingMode, "off">>("pixel_only");
  const [capiToken, setCapiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testEventCode, setTestEventCode] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const [consentRequired, setConsentRequired] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Hydrate form state when fresh settings arrive. Treat the absence of a
  // saved record (404 → undefined) as the "off" defaults.
  useEffect(() => {
    if (!settings) return;
    setPixelId(settings.pixel_id ?? "");
    const derivedMode = deriveModeFromFlags(
      settings.pixel_enabled,
      settings.capi_enabled,
    );
    // If the merchant has nothing yet (`off`), default the radio to the
    // recommended card rather than leaving everything unselected — matches
    // the "default for new merchants" guidance in plan §2.4 (Mode A) but
    // upgrades Mode A→C feel one click away.
    setMode(derivedMode === "off" ? "pixel_only" : derivedMode);
    setTestEventCode(settings.test_event_code ?? "");
    setConsentRequired(settings.consent_required);
    // Reflect the server's notion of "debug mode currently active" — it
    // flips to false once `debug_mode_expires_at` passes, regardless of
    // what the toggle was last set to.
    setDebugMode(settings.debug_mode);
    // Don't echo the masked token back into the input — leaves the field
    // empty so the merchant only types when (re)setting.
    setCapiToken("");
  }, [settings]);

  // ─── Validation ──────────────────────────────────────────────────────────
  const pixelIdValid = useMemo(
    () => PIXEL_ID_REGEX.test(pixelId.trim()),
    [pixelId],
  );
  const testEventCodeValid = useMemo(
    () => testEventCode.trim() === "" || TEST_EVENT_REGEX.test(testEventCode.trim()),
    [testEventCode],
  );

  // CAPI token requirement: when the chosen mode includes CAPI, we either
  // need a freshly typed token (length ≥ 50) or one already on file
  // (`capi_access_token_masked` non-null). Plan §7.4 calls this out — we
  // disable Save here to avoid the inevitable 422 from the backend.
  const modeIncludesCapi = mode === "capi_only" || mode === "both";
  const tokenOnFile = !!settings?.capi_access_token_masked;
  const tokenInputValid =
    capiToken.trim().length === 0 || capiToken.trim().length >= MIN_CAPI_TOKEN_LENGTH;
  const capiTokenSatisfied = !modeIncludesCapi || tokenOnFile || capiToken.trim().length >= MIN_CAPI_TOKEN_LENGTH;

  const canSave =
    !!storeId &&
    pixelIdValid &&
    testEventCodeValid &&
    tokenInputValid &&
    capiTokenSatisfied &&
    !saving;

  // ─── Mutations ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!storeId || !canSave) return;
    setSaving(true);
    setFieldErrors({});
    const flags = flagsForMode(mode);
    const payload: SaveMetaTrackingPayload = {
      pixel_id: pixelId.trim(),
      ...flags,
      consent_required: consentRequired,
      test_event_code: testEventCode.trim() || null,
      debug_mode: debugMode,
    };
    if (capiToken.trim()) {
      payload.capi_access_token = capiToken.trim();
    }
    try {
      const updated = await saveMetaTracking(storeId, payload);
      // Merge into the cached envelope so dependent UI re-renders.
      queryClient.setQueryData<TrackingSettings>(
        ["tracking-settings", storeId],
        (prev) => ({ meta: updated, ...(prev ?? {}) }),
      );
      // Refetch events — server may have just emitted a config-change marker.
      queryClient.invalidateQueries({
        queryKey: ["meta-tracking-events", storeId],
      });
      // Wipe the token input so the masked value can take over the UI.
      setCapiToken("");
      setShowToken(false);
      toast.success(isAr ? t("metaTracking.saved") : t("metaTracking.saved"));
    } catch (err) {
      const fields = extractFieldErrors(err);
      if (Object.keys(fields).length > 0) {
        setFieldErrors(fields);
      }
      // Custom message for the canonical missing-token 422 from plan §13.2.
      if (
        err instanceof ApiError &&
        err.status === 422 &&
        modeIncludesCapi &&
        !tokenOnFile &&
        !payload.capi_access_token
      ) {
        toast.error(
          isAr
            ? "محتاج توكن CAPI من Meta علشان تختار الوضع ده"
            : "CAPI access token is required for this mode",
        );
        return;
      }
      showError(err, language);
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    capiToken,
    consentRequired,
    isAr,
    language,
    mode,
    modeIncludesCapi,
    pixelId,
    queryClient,
    storeId,
    t,
    testEventCode,
    tokenOnFile,
  ]);

  const handleSendTest = useCallback(async () => {
    if (!storeId) return;
    setSendingTest(true);
    try {
      const code = testEventCode.trim() || "TEST00000";
      const result = await sendMetaTestEvent(storeId, code);
      if (result.received) {
        toast.success(
          isAr
            ? `تم استلامه في Events Manager${result.fbtrace_id ? ` · ${result.fbtrace_id}` : ""}`
            : `Received in Events Manager${result.fbtrace_id ? ` · ${result.fbtrace_id}` : ""}`,
        );
      } else {
        toast.error(
          result.error ?? (isAr ? "فشل إرسال الحدث التجريبي" : "Test event failed"),
        );
      }
      queryClient.invalidateQueries({
        queryKey: ["meta-tracking-events", storeId],
      });
    } catch (err) {
      showError(err, language);
    } finally {
      setSendingTest(false);
    }
  }, [isAr, language, queryClient, storeId, testEventCode]);

  const handleDisconnect = useCallback(async () => {
    if (!storeId) return;
    const ok = window.confirm(
      isAr
        ? "هتقطع توصيل Meta وتلغي توكن CAPI. متأكد؟"
        : "This disconnects Meta and revokes the CAPI credential. Continue?",
    );
    if (!ok) return;
    setDisconnecting(true);
    try {
      await disconnectMeta(storeId);
      toast.success(
        isAr ? "تم قطع الاتصال" : "Meta tracking disconnected",
      );
      queryClient.invalidateQueries({
        queryKey: ["tracking-settings", storeId],
      });
      queryClient.invalidateQueries({
        queryKey: ["meta-tracking-events", storeId],
      });
    } catch (err) {
      showError(err, language);
    } finally {
      setDisconnecting(false);
    }
  }, [isAr, language, queryClient, storeId]);

  // ─── Render guards ───────────────────────────────────────────────────────
  if (!storeId) {
    return (
      <div className="settings-section-header">
        <h2>{t("metaTracking.title")}</h2>
        <p>{isAr ? "اختار متجر الأول" : "Select a store first."}</p>
      </div>
    );
  }

  const status: MetaTrackingStatus = settings?.status ?? "disabled";
  const badge = STATUS_BADGES[status];
  const BadgeIcon = badge.Icon;
  const tokenMasked = settings?.capi_access_token_masked ?? null;
  const domainToken = settings?.domain_verification_token ?? null;

  return (
    <div key="marketing" className="settings-section-enter space-y-6">
      {/* ─── Header + status badge ─── */}
      <div className="settings-section-header flex flex-row items-start justify-between gap-4">
        <div>
          <h2>{t("metaTracking.title")}</h2>
          <p>{t("metaTracking.subtitle")}</p>
        </div>
        <Badge
          variant="outline"
          className={cn("flex items-center gap-1.5 border", badge.className)}
        >
          <BadgeIcon className="h-3.5 w-3.5" />
          {isAr ? badge.label.ar : badge.label.en}
        </Badge>
      </div>

      {/* ─── Step 1 · Pixel ID ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("metaTracking.pixelIdLabel")}
          </CardTitle>
          <CardDescription>
            {t("metaTracking.pixelIdHelp")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="meta-pixel-id" className="sr-only">
            {t("metaTracking.pixelIdLabel")}
          </Label>
          <Input
            id="meta-pixel-id"
            inputMode="numeric"
            placeholder="1234567890123456"
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value.replace(/\s/g, ""))}
            aria-invalid={pixelId.length > 0 && !pixelIdValid}
          />
          {pixelId.length > 0 && !pixelIdValid && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {t("metaTracking.pixelIdInvalid")}
            </p>
          )}
          {fieldErrors.pixel_id && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {fieldErrors.pixel_id}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Step 2 · Activation mode cards ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("metaTracking.modeTitle")}
          </CardTitle>
          <CardDescription>
            {t("metaTracking.modeSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={mode}
            onValueChange={(v) =>
              setMode(v as Exclude<MetaTrackingMode, "off">)
            }
            className="grid gap-3 md:grid-cols-3"
          >
            {MODE_CARDS.map((card) => {
              const selected = mode === card.mode;
              const Icon = card.Icon;
              return (
                <label
                  key={card.mode}
                  htmlFor={`mode-${card.mode}`}
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-border/80 hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <RadioGroupItem
                      id={`mode-${card.mode}`}
                      value={card.mode}
                      className="mt-0.5"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {t(`metaTracking.modes.${card.mode}.title`)}
                      {card.recommended && (
                        <Badge
                          variant="outline"
                          className="border-primary/40 bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary"
                        >
                          {isAr ? "مُوصى به" : "Recommended"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t(`metaTracking.modes.${card.mode}.description`)}
                    </p>
                    <p className="text-[11px] font-medium text-muted-foreground/80">
                      {t(`metaTracking.modes.${card.mode}.requirement`)}
                    </p>
                  </div>
                </label>
              );
            })}
          </RadioGroup>

          {/* Inline warning when "Both" / CAPI-only is chosen but no token */}
          {modeIncludesCapi && !tokenOnFile && capiToken.trim().length === 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              {t("metaTracking.tokenRequiredForMode")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Step 3 · CAPI token (conditional) ─── */}
      {modeIncludesCapi && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("metaTracking.capiTokenLabel")}
            </CardTitle>
            <CardDescription>
              {t("metaTracking.capiTokenHelp")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Input
                id="meta-capi-token"
                type={showToken ? "text" : "password"}
                placeholder={
                  tokenMasked ?? "EAAB••••••••••••••••••••••••••••••••••"
                }
                value={capiToken}
                onChange={(e) => setCapiToken(e.target.value)}
                aria-invalid={!tokenInputValid}
                autoComplete="off"
                className="pr-10"
              />
              <button
                type="button"
                aria-label={
                  showToken
                    ? t("metaTracking.hideToken")
                    : t("metaTracking.showToken")
                }
                onClick={() => setShowToken((s) => !s)}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {!tokenInputValid && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                {t("metaTracking.capiTokenTooShort")}
              </p>
            )}
            {fieldErrors.capi_access_token && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.capi_access_token}
              </p>
            )}
            {tokenMasked && capiToken.trim().length === 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {isAr
                  ? `محفوظ: ${tokenMasked} — اكتب توكن جديد لاستبداله`
                  : `Saved: ${tokenMasked} — type a new token to replace it`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Step 4 · Domain verification ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("metaTracking.domainLabel")}
          </CardTitle>
          <CardDescription>
            {t("metaTracking.domainHelp")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={
                domainToken ??
                (isAr
                  ? "هيتولّد بعد أول حفظ"
                  : "Generated after first save")
              }
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!domainToken}
              onClick={() => {
                if (!domainToken) return;
                navigator.clipboard.writeText(domainToken).then(
                  () =>
                    toast.success(
                      isAr ? "تم النسخ" : "Copied to clipboard",
                    ),
                  () =>
                    toast.error(
                      isAr ? "فشل النسخ" : "Couldn't copy",
                    ),
                );
              }}
            >
              <Copy className="me-1.5 h-3.5 w-3.5" />
              {isAr ? "نسخ" : "Copy"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("metaTracking.domainAutoEmit")}
          </p>
        </CardContent>
      </Card>

      {/* ─── Toggles + Test event ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("metaTracking.behaviourTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Debug mode */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">
                {t("metaTracking.debugLabel")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("metaTracking.debugHelp")}
              </p>
            </div>
            <Switch checked={debugMode} onCheckedChange={setDebugMode} />
          </div>

          {/* Consent required */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">
                {t("metaTracking.consentLabel")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("metaTracking.consentHelp")}
              </p>
            </div>
            <Switch
              checked={consentRequired}
              onCheckedChange={setConsentRequired}
            />
          </div>

          {/* Test event code */}
          <div>
            <Label htmlFor="meta-test-event" className="text-sm font-medium">
              {t("metaTracking.testEventLabel")}
            </Label>
            <Input
              id="meta-test-event"
              placeholder="TEST12345"
              value={testEventCode}
              onChange={(e) => setTestEventCode(e.target.value.trim())}
              aria-invalid={!testEventCodeValid}
              className="mt-1.5"
            />
            {!testEventCodeValid && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                {t("metaTracking.testEventInvalid")}
              </p>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("metaTracking.testEventHelp")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Action buttons ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={!canSave}>
          {saving && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
          {t("metaTracking.save")}
        </Button>
        <Button
          variant="outline"
          onClick={handleSendTest}
          disabled={sendingTest || !modeIncludesCapi || !tokenOnFile}
          title={
            !modeIncludesCapi
              ? isAr
                ? "متاح فقط للأوضاع اللي فيها CAPI"
                : "Available only for modes that include CAPI"
              : !tokenOnFile
                ? isAr
                  ? "احفظ التوكن الأول"
                  : "Save the CAPI token first"
                : undefined
          }
        >
          {sendingTest ? (
            <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Send className="me-1.5 h-4 w-4" />
          )}
          {t("metaTracking.sendTestEvent")}
        </Button>
        <Button
          variant="ghost"
          className="text-red-600 hover:bg-red-500/10 hover:text-red-700"
          onClick={handleDisconnect}
          disabled={disconnecting || status === "disabled"}
        >
          {disconnecting ? (
            <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="me-1.5 h-4 w-4" />
          )}
          {t("metaTracking.disconnect")}
        </Button>
      </div>

      {/* ─── Recent events table ─── */}
      <RecentEventsTable
        events={eventsQuery.data ?? []}
        isLoading={eventsQuery.isLoading}
        isAr={isAr}
        expandedRowId={expandedRowId}
        onToggleRow={(id) =>
          setExpandedRowId((current) => (current === id ? null : id))
        }
      />

      {/* ─── Wave 2/3 advanced settings (collapsed by default) ─── */}
      {settings && (
        <MetaTrackingAdvancedSettings
          settings={settings}
          saving={saving}
          onSave={async (partial) => {
            if (!storeId) return;
            // Build a full payload from current settings + partial overrides.
            // The backend PUT requires pixel_id + booleans on every call, so
            // we replay the current values for the unchanged half.
            const flags = flagsForMode(mode);
            const payload: SaveMetaTrackingPayload = {
              pixel_id: pixelId.trim() || settings.pixel_id || "",
              ...flags,
              consent_required: consentRequired,
              test_event_code: testEventCode.trim() || null,
              debug_mode: debugMode,
              ...partial,
            };
            setSaving(true);
            try {
              const updated = await saveMetaTracking(storeId, payload);
              queryClient.setQueryData<TrackingSettings>(
                ["tracking-settings", storeId],
                (prev) => ({ meta: updated, ...(prev ?? {}) }),
              );
            } catch (err) {
              showError(err, language);
              throw err;
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Recent events sub-table ───────────────────────────────────────────────

interface RecentEventsTableProps {
  events: MetaEventLogEntry[];
  isLoading: boolean;
  isAr: boolean;
  expandedRowId: string | null;
  onToggleRow: (id: string) => void;
}

function RecentEventsTable({
  events,
  isLoading,
  isAr,
  expandedRowId,
  onToggleRow,
}: RecentEventsTableProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("metaTracking.recentEventsTitle")}
        </CardTitle>
        <CardDescription>
          {t("metaTracking.recentEventsSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
            {isAr ? "بنحمّل..." : "Loading…"}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              {t("metaTracking.recentEventsEmpty")}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>{t("metaTracking.eventCol.time")}</TableHead>
                <TableHead>{t("metaTracking.eventCol.event")}</TableHead>
                <TableHead>{t("metaTracking.eventCol.channel")}</TableHead>
                <TableHead>{t("metaTracking.eventCol.status")}</TableHead>
                <TableHead className="font-mono text-xs">
                  {t("metaTracking.eventCol.fbtrace")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                const expanded = expandedRowId === event.id;
                const statusChip = statusChipForResponse(
                  event.response_status,
                  isAr,
                );
                return (
                  <>
                    <TableRow
                      key={event.id}
                      className="cursor-pointer"
                      onClick={() => onToggleRow(event.id)}
                    >
                      <TableCell>
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(event.created_at).toLocaleString(
                          isAr ? "ar-EG" : undefined,
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {event.event_name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border text-[11px] capitalize",
                            channelChipClass(event.channel),
                          )}
                        >
                          {event.channel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border text-[11px]",
                            statusChip.className,
                          )}
                        >
                          {statusChip.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {event.fbtrace_id ?? "—"}
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow
                        key={`${event.id}-detail`}
                        className="bg-muted/30 hover:bg-muted/30"
                      >
                        <TableCell />
                        <TableCell colSpan={5}>
                          <ExpandedEventDetail
                            event={event}
                            isAr={isAr}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Expanded row detail ───────────────────────────────────────────────────

function ExpandedEventDetail({
  event,
  isAr,
}: {
  event: MetaEventLogEntry;
  isAr: boolean;
}) {
  return (
    <div className="space-y-2 py-2 text-xs">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <DetailKv
          label={isAr ? "المحاولات" : "Attempts"}
          value={String(event.attempt_count)}
        />
        <DetailKv
          label={isAr ? "أُرسل في" : "Sent at"}
          value={
            event.sent_at
              ? new Date(event.sent_at).toLocaleString(isAr ? "ar-EG" : undefined)
              : "—"
          }
        />
        <DetailKv label="event_id" value={event.event_id} mono />
        {event.last_error && (
          <DetailKv
            label={isAr ? "آخر خطأ" : "Last error"}
            value={event.last_error}
            error
          />
        )}
      </div>
      {event.redacted_payload && (
        <div className="rounded-md border border-border bg-background p-2">
          <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Check className="h-3 w-3 text-green-600" />
            {isAr
              ? "البيانات مشفّرة قبل الإرسال (Email · Phone · Name)"
              : "User data hashed before send (Email · Phone · Name)"}
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground">
            {JSON.stringify(event.redacted_payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function DetailKv({
  label,
  value,
  mono,
  error,
}: {
  label: string;
  value: string;
  mono?: boolean;
  error?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "break-all text-xs",
          mono && "font-mono",
          error && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export default MetaTrackingPanel;
