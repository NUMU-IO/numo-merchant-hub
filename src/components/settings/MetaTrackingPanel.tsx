/**
 * Meta Pixel + Conversions API settings panel — Souq redesign.
 *
 * Two-column layout: configuration on the start side (identity → delivery
 * mode → behaviour → advanced), a live rail on the end side (signal-path
 * schematic + delivery health from the /status endpoint + test-event
 * sender + resources). The unified events log spans full width below.
 *
 * Behaviour is unchanged from the pre-redesign panel: the mode cards
 * still just flip the two persisted booleans (`pixel_enabled`,
 * `capi_enabled`), the CAPI token stays write-only, and saving replays
 * the full PUT payload. New here: dirty-state floating save bar,
 * disconnect confirmation dialog (replaces window.confirm), debug-mode
 * countdown, and the previously unused `/status` health metrics.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  Send,
  ServerCog,
  Sparkles,
  Trash2,
} from "lucide-react";

import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";
import { showError, extractFieldErrors } from "@/lib/show-error";
import { ApiError } from "@/lib/api-error";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  type MetaTrackingMode,
  type MetaTrackingStatus,
  type SaveMetaTrackingPayload,
  type TrackingSettings,
  deriveModeFromFlags,
  disconnectMeta,
  fetchMetaTrackingStatus,
  fetchRecentMetaEvents,
  fetchTrackingSettings,
  flagsForMode,
  saveMetaTracking,
  sendMetaTestEvent,
  verifyMetaConnection,
  type VerifyConnectionResult,
} from "@/services/metaTrackingApi";
import { MetaTrackingAdvancedSettings } from "./MetaTrackingAdvancedSettings";
import { MetaGlyph } from "./tracking/PlatformGlyphs";
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
  VerifyConnectionRow,
  useCountdownMinutes,
  type ModeCardSpec,
  type UnifiedEventRow,
} from "./tracking/TrackingShared";
import {
  compilePattern,
  DEFAULT_TRACKING_CONTRACT,
  useTrackingContract,
} from "@/lib/tracking-validation";

/** Standard events the storefront + webhooks fire automatically (mirrors
 * FUNNEL_STEP_TO_META_EVENT + the Phase-2 standard events in meta_capi.py). */
const META_AUTO_EVENTS = [
  "PageView",
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "Purchase",
  "Lead",
  "Search",
  "CompleteRegistration",
  "AddPaymentInfo",
];

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

  // Delivery health — failure rate + volume + last validated event.
  const statusQuery = useQuery({
    queryKey: ["meta-tracking-status", storeId],
    queryFn: () => fetchMetaTrackingStatus(storeId!),
    enabled: !!storeId,
    retry: 1,
    staleTime: 60_000,
  });

  const settings = settingsQuery.data?.meta;

  // ─── Form state ──────────────────────────────────────────────────────────
  const [pixelId, setPixelId] = useState("");
  // Mode is derived from the booleans on load, then becomes the single source
  // of truth for the mode-card UI. `pixel_enabled` / `capi_enabled` get
  // recomputed at save-time via flagsForMode() — keeps the cards always in
  // sync with what we'll persist.
  const [mode, setMode] = useState<Exclude<MetaTrackingMode, "off">>("pixel_only");
  const [capiToken, setCapiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testEventCode, setTestEventCode] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const [consentRequired, setConsentRequired] = useState(false);
  const [adAccountId, setAdAccountId] = useState("");
  const [pageId, setPageId] = useState("");
  // Meta mints this in Business Manager; the merchant pastes it here. It used
  // to be a read-only field showing a value NUMU generated, which could never
  // verify a domain because Meta looks for the token IT issued.
  const [domainToken, setDomainToken] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyConnectionResult | null>(
    null,
  );

  // The saved form values — what "Discard" reverts to, and what dirty-state
  // compares against. Mirrors the hydration mapping below exactly.
  const baseline = useMemo(() => {
    const derived = settings
      ? deriveModeFromFlags(settings.pixel_enabled, settings.capi_enabled)
      : "off";
    return {
      pixelId: settings?.pixel_id ?? "",
      mode: (derived === "off" ? "pixel_only" : derived) as Exclude<MetaTrackingMode, "off">,
      testEventCode: settings?.test_event_code ?? "",
      consentRequired: settings?.consent_required ?? false,
      debugMode: settings?.debug_mode ?? false,
      adAccountId: settings?.ad_account_id ?? "",
      pageId: settings?.page_id ?? "",
      domainToken: settings?.domain_verification_token ?? "",
    };
  }, [settings]);

  // Hydrate form state when fresh settings arrive. Treat the absence of a
  // saved record (404 → undefined) as the "off" defaults.
  useEffect(() => {
    if (!settings) return;
    setPixelId(settings.pixel_id ?? "");
    const derivedMode = deriveModeFromFlags(
      settings.pixel_enabled,
      settings.capi_enabled,
    );
    setMode(derivedMode === "off" ? "pixel_only" : derivedMode);
    setTestEventCode(settings.test_event_code ?? "");
    setConsentRequired(settings.consent_required);
    // Reflect the server's notion of "debug mode currently active" — it
    // flips to false once `debug_mode_expires_at` passes.
    setDebugMode(settings.debug_mode);
    // Don't echo the masked token back into the input — leaves the field
    // empty so the merchant only types when (re)setting.
    setCapiToken("");
    setAdAccountId(settings.ad_account_id ?? "");
    setPageId(settings.page_id ?? "");
    setDomainToken(settings.domain_verification_token ?? "");
  }, [settings]);

  // ─── Validation ──────────────────────────────────────────────────────────
  // Rules come from the API (`/settings/tracking/validation-contract`) rather
  // than local literals. The literals drifted: this panel enforced
  // `/^\d{15,16}$/` on the Pixel ID — folklore, not a Meta-published bound —
  // and rejected real 17-digit 2026 dataset IDs, and it required a 50-char
  // CAPI token while the API it posts to accepts 20.
  const rules = useTrackingContract(storeId).meta;
  const pixelIdRegex = useMemo(
    () => compilePattern(rules.pixel_id, DEFAULT_TRACKING_CONTRACT.meta.pixel_id),
    [rules.pixel_id],
  );
  const testEventRegex = useMemo(
    () =>
      compilePattern(
        rules.test_event_code,
        DEFAULT_TRACKING_CONTRACT.meta.test_event_code,
      ),
    [rules.test_event_code],
  );
  const minTokenLength = rules.min_token_length;

  const pixelIdValid = useMemo(
    () => pixelIdRegex.test(pixelId.trim()),
    [pixelId, pixelIdRegex],
  );
  const testEventCodeValid = useMemo(
    () => testEventCode.trim() === "" || testEventRegex.test(testEventCode.trim()),
    [testEventCode, testEventRegex],
  );

  // CAPI token requirement: when the chosen mode includes CAPI, we either
  // need a freshly typed token (long enough per the contract) or one on file.
  const modeIncludesCapi = mode === "capi_only" || mode === "both";
  const tokenOnFile = !!settings?.capi_access_token_masked;
  const tokenInputValid =
    capiToken.trim().length === 0 || capiToken.trim().length >= minTokenLength;
  const capiTokenSatisfied =
    !modeIncludesCapi || tokenOnFile || capiToken.trim().length >= minTokenLength;

  const canSave =
    !!storeId &&
    pixelIdValid &&
    testEventCodeValid &&
    tokenInputValid &&
    capiTokenSatisfied &&
    !saving;

  const dirty =
    pixelId !== baseline.pixelId ||
    mode !== baseline.mode ||
    capiToken.trim().length > 0 ||
    testEventCode !== baseline.testEventCode ||
    consentRequired !== baseline.consentRequired ||
    debugMode !== baseline.debugMode ||
    adAccountId !== baseline.adAccountId ||
    pageId !== baseline.pageId ||
    domainToken !== baseline.domainToken;

  const blockedHint = !dirty
    ? null
    : pixelId.trim().length === 0
      ? isAr
        ? "اكتب معرّف الـ Pixel الأول"
        : "Enter your Pixel ID first"
      : !pixelIdValid
        ? t("metaTracking.pixelIdInvalid")
        : !testEventCodeValid
          ? t("metaTracking.testEventInvalid")
          : !tokenInputValid
            ? t("metaTracking.capiTokenTooShort")
            : !capiTokenSatisfied
              ? t("metaTracking.tokenRequiredForMode")
              : null;

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
      // Persist business IDs only when the merchant typed something —
      // the backend keeps the existing value when the request omits the
      // field, so undefined here is the safe "no change" signal.
      ad_account_id: adAccountId.trim() || undefined,
      page_id: pageId.trim() || undefined,
      // Same "undefined means no change" contract as the two IDs above, so a
      // save that doesn't touch this field can't clear a working token.
      domain_verification_token: domainToken.trim() || undefined,
    };
    if (capiToken.trim()) {
      payload.capi_access_token = capiToken.trim();
    }
    try {
      const updated = await saveMetaTracking(storeId, payload);
      // Merge into the cached envelope so dependent UI re-renders. The
      // fresh `meta` must land AFTER the spread — the previous order let
      // the stale cached value clobber the update, which kept the form
      // hydrated from old data (visible now that the save bar tracks dirt).
      queryClient.setQueryData<TrackingSettings>(
        ["tracking-settings", storeId],
        (prev) => ({ ...(prev ?? {}), meta: updated }),
      );
      // Refetch events — server may have just emitted a config-change marker.
      queryClient.invalidateQueries({ queryKey: ["meta-tracking-events", storeId] });
      queryClient.invalidateQueries({ queryKey: ["meta-tracking-status", storeId] });
      // Wipe the token input so the masked value can take over the UI.
      setCapiToken("");
      setShowToken(false);
      toast.success(t("metaTracking.saved"));
    } catch (err) {
      const fields = extractFieldErrors(err);
      if (Object.keys(fields).length > 0) {
        setFieldErrors(fields);
      }
      // Custom message for the canonical missing-token 422.
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
    adAccountId,
    pageId,
    debugMode,
    domainToken,
  ]);

  const handleDiscard = useCallback(() => {
    setPixelId(baseline.pixelId);
    setMode(baseline.mode);
    setTestEventCode(baseline.testEventCode);
    setConsentRequired(baseline.consentRequired);
    setDebugMode(baseline.debugMode);
    setAdAccountId(baseline.adAccountId);
    setPageId(baseline.pageId);
    setDomainToken(baseline.domainToken);
    setCapiToken("");
    setShowToken(false);
    setFieldErrors({});
  }, [baseline]);

  const handleSendTest = useCallback(async () => {
    if (!storeId) return;
    setSendingTest(true);
    try {
      const code = testEventCode.trim() || "TEST00000";
      const result = await sendMetaTestEvent(storeId, code);
      if (result.enqueued) {
        toast.success(
          isAr
            ? `تم إرسال الحدث · هيظهر في Test Events خلال ثواني${result.queued_event_id ? ` · ${result.queued_event_id}` : ""}`
            : `Test event dispatched · check Events Manager → Test Events in a few seconds${result.queued_event_id ? ` · ${result.queued_event_id}` : ""}`,
        );
      } else {
        toast.error(isAr ? "فشل إرسال الحدث التجريبي" : "Test event failed");
      }
      queryClient.invalidateQueries({ queryKey: ["meta-tracking-events", storeId] });
    } catch (err) {
      showError(err, language);
    } finally {
      setSendingTest(false);
    }
  }, [isAr, language, queryClient, storeId, testEventCode]);

  const handleVerify = useCallback(async () => {
    if (!storeId) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      // A "no" from Meta resolves normally with `verified: false` — only a
      // transport/auth failure throws. Both are surfaced; neither is fatal.
      setVerifyResult(await verifyMetaConnection(storeId));
    } catch (err) {
      showError(err, language);
    } finally {
      setVerifying(false);
    }
  }, [language, storeId]);

  const handleDisconnect = useCallback(async () => {
    if (!storeId) return;
    setDisconnecting(true);
    try {
      await disconnectMeta(storeId);
      toast.success(isAr ? "تم قطع الاتصال" : "Meta tracking disconnected");
      setConfirmDisconnect(false);
      queryClient.invalidateQueries({ queryKey: ["tracking-settings", storeId] });
      queryClient.invalidateQueries({ queryKey: ["meta-tracking-events", storeId] });
      queryClient.invalidateQueries({ queryKey: ["meta-tracking-status", storeId] });
    } catch (err) {
      showError(err, language);
    } finally {
      setDisconnecting(false);
    }
  }, [isAr, language, queryClient, storeId]);

  const debugMinutesLeft = useCountdownMinutes(settings?.debug_mode_expires_at);

  // ─── Render guards ───────────────────────────────────────────────────────
  if (!storeId) {
    return (
      <div className="souq-section p-6 text-sm text-muted-foreground">
        {isAr ? "اختار متجر الأول" : "Select a store first."}
      </div>
    );
  }

  const status: MetaTrackingStatus = settings?.status ?? "disabled";
  const tokenMasked = settings?.capi_access_token_masked ?? null;
  const canSendTest = modeIncludesCapi && tokenOnFile;

  const eventsManagerUrl = pixelIdValid
    ? `https://business.facebook.com/events_manager2/list/pixel/${pixelId.trim()}/overview`
    : "https://www.facebook.com/events_manager2";
  const testEventsUrl = pixelIdValid
    ? `https://business.facebook.com/events_manager2/list/pixel/${pixelId.trim()}/test_events`
    : "https://www.facebook.com/events_manager2";

  const modeCards: ModeCardSpec[] = [
    {
      mode: "pixel_only",
      Icon: Globe2,
      title: t("metaTracking.modes.pixel_only.title"),
      desc: t("metaTracking.modes.pixel_only.description"),
      requirement: t("metaTracking.modes.pixel_only.requirement"),
    },
    {
      mode: "capi_only",
      Icon: ServerCog,
      title: t("metaTracking.modes.capi_only.title"),
      desc: t("metaTracking.modes.capi_only.description"),
      requirement: t("metaTracking.modes.capi_only.requirement"),
    },
    {
      mode: "both",
      Icon: Sparkles,
      title: t("metaTracking.modes.both.title"),
      desc: t("metaTracking.modes.both.description"),
      requirement: t("metaTracking.modes.both.requirement"),
      recommended: true,
    },
  ];

  const eventRows: UnifiedEventRow[] = (eventsQuery.data ?? []).map((e) => ({
    id: e.id,
    eventId: e.event_id,
    name: e.event_name,
    channel: e.channel,
    httpStatus: e.response_status,
    traceId: e.fbtrace_id,
    attempts: e.attempt_count,
    lastError: e.last_error,
    createdAt: e.created_at,
    sentAt: e.sent_at,
    payload: e.redacted_payload,
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
                  ? "المعرّف الرقمي من Meta Events Manager → Data sources"
                  : "The numeric ID from Meta Events Manager → Data sources"
              }
              aside={
                <a
                  href="https://www.facebook.com/events_manager2"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-bold text-navy hover:underline dark:text-primary"
                >
                  {isAr ? "فين ألاقيه؟" : "Where do I find this?"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              }
            >
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
                className="font-mono"
                dir="ltr"
              />
              {pixelId.length > 0 && !pixelIdValid && (
                <p className="mt-1.5 text-xs text-destructive">
                  {t("metaTracking.pixelIdInvalid")}
                </p>
              )}
              {fieldErrors.pixel_id && (
                <p className="mt-1.5 text-xs text-destructive">{fieldErrors.pixel_id}</p>
              )}

              {/* Domain verification — the token Meta issues, pasted here */}
              <div className="mt-5 border-t border-border pt-4">
                <div className="text-[12.5px] font-extrabold">
                  {t("metaTracking.domainLabel")}
                </div>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  {t("metaTracking.domainHelp")}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <Input
                    value={domainToken}
                    onChange={(e) => setDomainToken(e.target.value)}
                    placeholder={
                      isAr
                        ? "الصق التوكن من Business Manager"
                        : "Paste the token from Business Manager"
                    }
                    className="font-mono text-xs"
                    // LTR only when a value shows — the Arabic placeholder
                    // sentence must render in page direction.
                    dir={domainToken ? "ltr" : undefined}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!domainToken.trim()}
                    onClick={() => {
                      const value = domainToken.trim();
                      if (!value) return;
                      navigator.clipboard.writeText(value).then(
                        () => toast.success(isAr ? "تم النسخ" : "Copied to clipboard"),
                        () => toast.error(isAr ? "فشل النسخ" : "Couldn't copy"),
                      );
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {isAr ? "نسخ" : "Copy"}
                  </Button>
                </div>
                {fieldErrors.domain_verification_token && (
                  <p className="mt-1.5 text-xs text-destructive">
                    {fieldErrors.domain_verification_token}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  {t("metaTracking.domainAutoEmit")}
                </p>
              </div>
            </SettingSection>

            {/* Delivery mode */}
            <SettingSection
              title={isAr ? "إزاي الأحداث توصل لـ Meta" : "How events reach Meta"}
              desc={t("metaTracking.modeSubtitle")}
            >
              <ModeCardGrid value={mode} onChange={setMode} cards={modeCards} isAr={isAr} />

              {modeIncludesCapi && !tokenOnFile && capiToken.trim().length === 0 && (
                <p className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {t("metaTracking.tokenRequiredForMode")}
                </p>
              )}

              {/* CAPI token — only for modes with a server rail */}
              {modeIncludesCapi && (
                <div className="mt-4 border-t border-border pt-4">
                  <Label htmlFor="meta-capi-token" className="text-[12.5px] font-extrabold">
                    {t("metaTracking.capiTokenLabel")}
                  </Label>
                  <p className="mb-2 mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    {t("metaTracking.capiTokenHelp")}
                  </p>
                  <div className="relative">
                    <Input
                      id="meta-capi-token"
                      type={showToken ? "text" : "password"}
                      placeholder={tokenMasked ?? "EAAB••••••••••••••••••••••••••••••••••"}
                      value={capiToken}
                      onChange={(e) => setCapiToken(e.target.value)}
                      aria-invalid={!tokenInputValid}
                      autoComplete="off"
                      className="pe-10 font-mono text-xs"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      aria-label={
                        showToken ? t("metaTracking.hideToken") : t("metaTracking.showToken")
                      }
                      onClick={() => setShowToken((s) => !s)}
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {!tokenInputValid && (
                    <p className="mt-1.5 text-xs text-destructive">
                      {t("metaTracking.capiTokenTooShort")}
                    </p>
                  )}
                  {fieldErrors.capi_access_token && (
                    <p className="mt-1.5 text-xs text-destructive">
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
                </div>
              )}
            </SettingSection>

            {/* Behaviour */}
            <SettingSection title={t("metaTracking.behaviourTitle")}>
              <div className="divide-y divide-border">
                {/* Debug mode */}
                <div className="flex items-start justify-between gap-4 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-[13px] font-bold">
                        {t("metaTracking.debugLabel")}
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
                      {t("metaTracking.debugHelp")}
                    </p>
                  </div>
                  <Switch checked={debugMode} onCheckedChange={setDebugMode} />
                </div>

                {/* Consent required */}
                <div className="flex items-start justify-between gap-4 py-4">
                  <div>
                    <Label className="text-[13px] font-bold">
                      {t("metaTracking.consentLabel")}
                    </Label>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {t("metaTracking.consentHelp")}
                    </p>
                  </div>
                  <Switch checked={consentRequired} onCheckedChange={setConsentRequired} />
                </div>

                {/* Test event code */}
                <div className="py-4">
                  <Label htmlFor="meta-test-event" className="text-[13px] font-bold">
                    {t("metaTracking.testEventLabel")}
                  </Label>
                  <Input
                    id="meta-test-event"
                    placeholder="TEST12345"
                    value={testEventCode}
                    onChange={(e) => setTestEventCode(e.target.value.trim())}
                    aria-invalid={!testEventCodeValid}
                    className="mt-1.5 max-w-[240px] font-mono"
                    dir="ltr"
                  />
                  {!testEventCodeValid && (
                    <p className="mt-1.5 text-xs text-destructive">
                      {t("metaTracking.testEventInvalid")}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("metaTracking.testEventHelp")}
                  </p>
                </div>

                {/* Meta Business connection IDs — gates Custom Audience sync
                    and Promote-on-Meta. Optional for Pixel/CAPI-only stores. */}
                <div className="pt-4">
                  <div className="space-y-3 rounded-xl bg-surface-2/50 p-4">
                    <div>
                      <p className="text-[13px] font-bold">
                        {isAr ? "ربط Meta Business" : "Meta Business connection"}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {isAr
                          ? "اختياري — مطلوب فقط لمزامنة الجماهير (Custom Audiences) و\"الترويج على Meta\". اتركهم فارغين لو بتستخدم Pixel + CAPI فقط."
                          : "Optional — needed only for Custom Audience sync and Promote-on-Meta. Leave blank if you only use Pixel + CAPI."}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="meta-ad-account" className="text-xs font-bold">
                        {isAr ? "معرّف حساب الإعلانات" : "Ad Account ID"}
                      </Label>
                      <Input
                        id="meta-ad-account"
                        placeholder="act_123456789 or 123456789"
                        value={adAccountId}
                        onChange={(e) => setAdAccountId(e.target.value.trim())}
                        className="mt-1.5 font-mono text-xs"
                        dir="ltr"
                      />
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {isAr
                          ? "افتح Ads Manager → القائمة الأعلى → الرقم اللي بعد act_."
                          : "Open Ads Manager → top-left dropdown → the number after act_."}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="meta-page-id" className="text-xs font-bold">
                        {isAr ? "معرّف صفحة الفيسبوك" : "Facebook Page ID"}
                      </Label>
                      <Input
                        id="meta-page-id"
                        placeholder="123456789012345"
                        value={pageId}
                        onChange={(e) => setPageId(e.target.value.trim())}
                        className="mt-1.5 font-mono text-xs"
                        dir="ltr"
                      />
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {isAr
                          ? "صفحة الفيسبوك → الإعدادات → معلومات الصفحة → معرّف الصفحة."
                          : "Your Facebook Page → Settings → Page info → Page ID."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </SettingSection>

            {/* Wave 2/3 advanced settings (collapsed by default) */}
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
                      (prev) => ({ ...(prev ?? {}), meta: updated }),
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

          {/* ══ Live rail ══ */}
          <div className="space-y-5">
            {/* Signal + health */}
            <section className="souq-section space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-extrabold tracking-tight">
                  {isAr ? "الإشارة الحية" : "Live signal"}
                </h3>
                <StatusPill status={status} isAr={isAr} />
              </div>

              <SignalPath
                pixelOn={mode === "pixel_only" || mode === "both"}
                serverOn={modeIncludesCapi}
                serverLabel="CAPI"
                platformName="Meta"
                platformNode={
                  <div className="ichip ichip-navy">
                    <MetaGlyph className="h-6 w-6" />
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

              <VerifyConnectionRow
                onVerify={handleVerify}
                result={verifyResult}
                verifying={verifying}
                // Meta needs a saved Pixel ID; the endpoint also needs a token
                // but it reports that itself rather than us pre-guessing.
                disabled={!settings?.pixel_id}
                disabledHint={
                  isAr ? "احفظ معرّف الـ Pixel الأول." : "Save your Pixel ID first."
                }
                isAr={isAr}
              />

              {/* Test event sender */}
              <div className="space-y-2 rounded-xl border border-border p-3.5">
                <div className="text-[12.5px] font-extrabold">
                  {t("metaTracking.sendTestEvent")}
                </div>
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  {isAr
                    ? "هيظهر خلال ثواني في Events Manager → Test Events."
                    : "Shows up in Events Manager → Test Events within seconds."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleSendTest}
                  disabled={sendingTest || !canSendTest}
                >
                  {sendingTest ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {t("metaTracking.sendTestEvent")}
                </Button>
                {!canSendTest && (
                  <p className="text-[11px] leading-relaxed text-ink-faint">
                    {!modeIncludesCapi
                      ? isAr
                        ? "متاح فقط للأوضاع اللي فيها CAPI."
                        : "Available only for modes that include CAPI."
                      : isAr
                        ? "احفظ توكن CAPI الأول."
                        : "Save your CAPI token first."}
                  </p>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "w-full text-destructive hover:bg-destructive/10 hover:text-destructive",
                )}
                onClick={() => setConfirmDisconnect(true)}
                disabled={disconnecting || status === "disabled"}
              >
                <Trash2 className="h-4 w-4" />
                {t("metaTracking.disconnect")}
              </Button>
            </section>

            {/* Resources */}
            <SettingSection title={isAr ? "روابط Meta" : "Meta resources"}>
              <div className="-mx-2.5 space-y-0.5">
                <HelpLink href={eventsManagerUrl}>
                  {isAr ? "افتح Events Manager" : "Open Events Manager"}
                </HelpLink>
                <HelpLink href={testEventsUrl}>
                  {isAr ? "تبويب Test Events" : "Test Events tab"}
                </HelpLink>
                <HelpLink href="https://developers.facebook.com/docs/marketing-api/conversions-api/get-started">
                  {isAr ? "إزاي تجيب توكن CAPI" : "How to get a CAPI token"}
                </HelpLink>
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <EventsWeSend events={META_AUTO_EVENTS} isAr={isAr} />
              </div>
            </SettingSection>
          </div>
        </div>

        {/* ══ Events log — full width ══ */}
        <EventsLog
          rows={eventRows}
          loading={eventsQuery.isLoading}
          isAr={isAr}
          traceHeader="fbtrace"
          title={t("metaTracking.recentEventsTitle")}
          subtitle={t("metaTracking.recentEventsSubtitle")}
          emptyTitle={t("metaTracking.recentEventsEmpty")}
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
        platformName="Meta"
        description={
          isAr
            ? "هيتوقف إرسال الأحداث لـ Meta وهيتلغى توكن CAPI المحفوظ. إعلاناتك هتفقد إشارات التحويل لحد ما تعيد الربط."
            : "Event delivery to Meta stops and the saved CAPI credential is revoked. Your ads lose conversion signals until you reconnect."
        }
      />
    </div>
  );
}

export default MetaTrackingPanel;
