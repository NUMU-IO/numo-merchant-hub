/**
 * Surface-specific content fields for the four visual promotion surfaces
 * (announcement bar / popup / floating widget / cookie banner).
 *
 * The full visual builder with iframe live-preview from step 08 §4 lands
 * once the storefront-side `NUMU_PROMO_PREVIEW` listener (step 11) and
 * the merchant-side preview-token endpoint (step 05 §4.9, deferred) are
 * in place. This panel ships the data side first so merchants can
 * actually create / edit popups and banners against the API today.
 */

import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import type {
  PromotionContent,
  PromotionSurface,
} from "@/services/promotionApi";

import { LinkPicker } from "./LinkPicker";

export interface VisualContentState {
  // announcement bar
  bg: string;
  fg: string;
  icon: string;
  dismissible: boolean;
  linkUrl: string;
  // shared bilingual headline / body / cta
  headlineEn: string;
  headlineAr: string;
  bodyEn: string;
  bodyAr: string;
  ctaLabelEn: string;
  ctaLabelAr: string;
  /**
   * Where the CTA button on a popup or floating widget sends the
   * visitor when clicked. Persisted as `cta_url` in `translated_content`
   * (per-locale) on the storefront side; we keep one shared value here
   * because the spec doesn't ask for per-locale destinations.
   */
  ctaUrl: string;
  // popup
  popupLayout: "centered" | "side";
  popupCodeReveal: string;
  popupShowAfterDays: number;
  /** Optional hero image URL shown above the headline on a popup. */
  popupImageUrl: string;
  /** When true, the popup renders an inline email-capture form. */
  popupCollectEmail: boolean;
  /** Adds an optional Egyptian-phone field below email when true. */
  popupCollectPhone: boolean;
  /** Translated copy for the post-submit success state. */
  popupSuccessHeadlineAr: string;
  popupSuccessHeadlineEn: string;
  popupSuccessBodyAr: string;
  popupSuccessBodyEn: string;
  /** Custom labels for the form's email/phone/consent/submit elements. */
  popupEmailLabelAr: string;
  popupEmailLabelEn: string;
  popupPhoneLabelAr: string;
  popupPhoneLabelEn: string;
  popupConsentLabelAr: string;
  popupConsentLabelEn: string;
  popupSubmitLabelAr: string;
  popupSubmitLabelEn: string;
  // floating widget
  widgetPosition: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  widgetIcon: string;
  widgetExpanded: boolean;
  widgetBg: string;
  // cookie banner
  cookiePosition: "bottom" | "modal";
  cookieAcceptRequired: boolean;
  cookiePolicyUrl: string;
}

export const EMPTY_VISUAL_CONTENT: VisualContentState = {
  bg: "#0f172a",
  fg: "#ffffff",
  icon: "sparkle",
  dismissible: true,
  linkUrl: "",
  headlineEn: "",
  headlineAr: "",
  bodyEn: "",
  bodyAr: "",
  ctaLabelEn: "",
  ctaLabelAr: "",
  ctaUrl: "",
  popupLayout: "centered",
  popupCodeReveal: "",
  popupShowAfterDays: 30,
  popupImageUrl: "",
  popupCollectEmail: false,
  popupCollectPhone: false,
  popupSuccessHeadlineAr: "",
  popupSuccessHeadlineEn: "",
  popupSuccessBodyAr: "",
  popupSuccessBodyEn: "",
  popupEmailLabelAr: "",
  popupEmailLabelEn: "",
  popupPhoneLabelAr: "",
  popupPhoneLabelEn: "",
  popupConsentLabelAr: "",
  popupConsentLabelEn: "",
  popupSubmitLabelAr: "",
  popupSubmitLabelEn: "",
  widgetPosition: "bottom-right",
  widgetIcon: "tag",
  widgetExpanded: false,
  widgetBg: "#0f172a",
  cookiePosition: "bottom",
  cookieAcceptRequired: false,
  cookiePolicyUrl: "",
};

interface Props {
  surface: PromotionSurface;
  state: VisualContentState;
  onChange: (next: VisualContentState) => void;
  /** Required by `LinkPicker` for product / category search. */
  storeId: string | undefined;
}

/** Build the API `content` payload from form state. */
export function buildVisualContent(
  surface: PromotionSurface,
  s: VisualContentState,
): PromotionContent {
  switch (surface) {
    case "announcement_bar":
      return {
        surface: "announcement_bar",
        background: s.bg,
        text_color: s.fg,
        icon: s.icon || null,
        dismissible: s.dismissible,
        link_url: s.linkUrl || null,
      };
    case "popup": {
      // Backend stores form-capture toggles as a `form_fields` list of
      // discriminated values, NOT as separate `collect_email` /
      // `collect_phone` booleans. Sending the boolean keys tripped
      // Pydantic's `extra="forbid"` and 422'd creation. Map the form's
      // checkbox state into the list shape here.
      const formFields: ("email" | "phone" | "name")[] = [];
      if (s.popupCollectEmail) formFields.push("email");
      if (s.popupCollectPhone) formFields.push("phone");
      return {
        surface: "popup",
        layout: s.popupLayout,
        discount_code_to_reveal: s.popupCodeReveal || null,
        show_after_dismiss_days: s.popupShowAfterDays,
        image_url: s.popupImageUrl || null,
        form_fields: formFields,
      };
    }
    case "floating_widget":
      return {
        surface: "floating_widget",
        position: s.widgetPosition,
        icon: s.widgetIcon,
        expanded_default: s.widgetExpanded,
        color_bg: s.widgetBg,
      };
    case "cookie_banner":
      return {
        surface: "cookie_banner",
        position: s.cookiePosition,
        accept_required: s.cookieAcceptRequired,
        policy_url: s.cookiePolicyUrl || null,
      };
    default:
      return { surface };
  }
}

/** Build the bilingual translations object from the same state.
 *
 * The storefront popup / floating widget read `cta_url` from
 * `translated_content` regardless of locale (a single click-through
 * destination per promotion). Popup form-capture pulls `email_label`,
 * `phone_label`, `consent_label`, `submit_label`, `success_headline`,
 * `success_body` from the same translation block — the storefront
 * `PopupModal` falls back to Egyptian-Arabic defaults when a field
 * isn't filled, so it's safe to send only the fields the merchant
 * actually customized.
 */
export function buildVisualTranslations(s: VisualContentState) {
  type Block = {
    headline?: { en?: string; ar?: string };
    body?: { en?: string; ar?: string };
    cta_label?: { en?: string; ar?: string };
    cta_url?: string;
    email_label?: { en?: string; ar?: string };
    phone_label?: { en?: string; ar?: string };
    consent_label?: { en?: string; ar?: string };
    submit_label?: { en?: string; ar?: string };
    success_headline?: { en?: string; ar?: string };
    success_body?: { en?: string; ar?: string };
  };
  const out: Record<string, Block> = {};

  const enHas =
    s.headlineEn ||
    s.bodyEn ||
    s.ctaLabelEn ||
    s.popupSuccessHeadlineEn ||
    s.popupSuccessBodyEn ||
    s.popupEmailLabelEn ||
    s.popupPhoneLabelEn ||
    s.popupConsentLabelEn ||
    s.popupSubmitLabelEn;
  if (enHas) {
    out.en = {};
    if (s.headlineEn) out.en.headline = { en: s.headlineEn };
    if (s.bodyEn) out.en.body = { en: s.bodyEn };
    if (s.ctaLabelEn) out.en.cta_label = { en: s.ctaLabelEn };
    if (s.popupSuccessHeadlineEn)
      out.en.success_headline = { en: s.popupSuccessHeadlineEn };
    if (s.popupSuccessBodyEn) out.en.success_body = { en: s.popupSuccessBodyEn };
    if (s.popupEmailLabelEn) out.en.email_label = { en: s.popupEmailLabelEn };
    if (s.popupPhoneLabelEn) out.en.phone_label = { en: s.popupPhoneLabelEn };
    if (s.popupConsentLabelEn)
      out.en.consent_label = { en: s.popupConsentLabelEn };
    if (s.popupSubmitLabelEn) out.en.submit_label = { en: s.popupSubmitLabelEn };
  }

  const arHas =
    s.headlineAr ||
    s.bodyAr ||
    s.ctaLabelAr ||
    s.popupSuccessHeadlineAr ||
    s.popupSuccessBodyAr ||
    s.popupEmailLabelAr ||
    s.popupPhoneLabelAr ||
    s.popupConsentLabelAr ||
    s.popupSubmitLabelAr;
  if (arHas) {
    out.ar = {};
    if (s.headlineAr) out.ar.headline = { ar: s.headlineAr };
    if (s.bodyAr) out.ar.body = { ar: s.bodyAr };
    if (s.ctaLabelAr) out.ar.cta_label = { ar: s.ctaLabelAr };
    if (s.popupSuccessHeadlineAr)
      out.ar.success_headline = { ar: s.popupSuccessHeadlineAr };
    if (s.popupSuccessBodyAr) out.ar.success_body = { ar: s.popupSuccessBodyAr };
    if (s.popupEmailLabelAr) out.ar.email_label = { ar: s.popupEmailLabelAr };
    if (s.popupPhoneLabelAr) out.ar.phone_label = { ar: s.popupPhoneLabelAr };
    if (s.popupConsentLabelAr)
      out.ar.consent_label = { ar: s.popupConsentLabelAr };
    if (s.popupSubmitLabelAr) out.ar.submit_label = { ar: s.popupSubmitLabelAr };
  }

  // `cta_url` lives on translated_content per the storefront component
  // contract, but the value itself is locale-agnostic. Drop it onto
  // both blocks so both the AR-default and EN-fallback readers see it.
  if (s.ctaUrl) {
    if (out.ar) out.ar.cta_url = s.ctaUrl;
    if (out.en) out.en.cta_url = s.ctaUrl;
    if (!out.ar && !out.en) out.ar = { cta_url: s.ctaUrl };
  }

  return out;
}

export function VisualContentPanel({ surface, state, onChange, storeId }: Props) {
  const { t } = useTranslation();
  const update = <K extends keyof VisualContentState>(
    key: K,
    value: VisualContentState[K],
  ) => onChange({ ...state, [key]: value });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("promotions.visual.copy_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ar">
            <TabsList>
              <TabsTrigger value="ar">العربية</TabsTrigger>
              <TabsTrigger value="en">English</TabsTrigger>
            </TabsList>
            <TabsContent value="ar" className="space-y-3 pt-3" dir="rtl">
              <div className="grid gap-2">
                <Label htmlFor="headline-ar">
                  {t("promotions.visual.headline")}
                </Label>
                <Input
                  id="headline-ar"
                  value={state.headlineAr}
                  onChange={(e) => update("headlineAr", e.target.value)}
                  dir="rtl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="body-ar">{t("promotions.visual.body")}</Label>
                <Input
                  id="body-ar"
                  value={state.bodyAr}
                  onChange={(e) => update("bodyAr", e.target.value)}
                  dir="rtl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cta-ar">
                  {t("promotions.visual.cta_label")}
                </Label>
                <Input
                  id="cta-ar"
                  value={state.ctaLabelAr}
                  onChange={(e) => update("ctaLabelAr", e.target.value)}
                  dir="rtl"
                />
              </div>
            </TabsContent>
            <TabsContent value="en" className="space-y-3 pt-3">
              <div className="grid gap-2">
                <Label htmlFor="headline-en">
                  {t("promotions.visual.headline")}
                </Label>
                <Input
                  id="headline-en"
                  value={state.headlineEn}
                  onChange={(e) => update("headlineEn", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="body-en">{t("promotions.visual.body")}</Label>
                <Input
                  id="body-en"
                  value={state.bodyEn}
                  onChange={(e) => update("bodyEn", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cta-en">
                  {t("promotions.visual.cta_label")}
                </Label>
                <Input
                  id="cta-en"
                  value={state.ctaLabelEn}
                  onChange={(e) => update("ctaLabelEn", e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {surface === "announcement_bar" && (
        <Card>
          <CardHeader>
            <CardTitle>
              {t("promotions.visual.bar_appearance_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bar-bg">
                  {t("promotions.visual.background")}
                </Label>
                <Input
                  id="bar-bg"
                  type="color"
                  value={state.bg}
                  onChange={(e) => update("bg", e.target.value)}
                  className="h-10 w-20"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bar-fg">
                  {t("promotions.visual.text_color")}
                </Label>
                <Input
                  id="bar-fg"
                  type="color"
                  value={state.fg}
                  onChange={(e) => update("fg", e.target.value)}
                  className="h-10 w-20"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bar-link">
                {t("promotions.visual.link_url")}
              </Label>
              <LinkPicker
                id="bar-link"
                storeId={storeId}
                value={state.linkUrl}
                onChange={(v) => update("linkUrl", v)}
                placeholder="/products"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="bar-dismiss" className="text-base">
                {t("promotions.visual.dismissible")}
              </Label>
              <Switch
                id="bar-dismiss"
                checked={state.dismissible}
                onCheckedChange={(c) => update("dismissible", c)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {surface === "popup" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("promotions.visual.popup_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="popup-layout">
                {t("promotions.visual.popup_layout")}
              </Label>
              <Select
                value={state.popupLayout}
                onValueChange={(v) =>
                  update("popupLayout", v as "centered" | "side")
                }
              >
                <SelectTrigger id="popup-layout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="centered">
                    {t("promotions.visual.popup_layout_centered")}
                  </SelectItem>
                  <SelectItem value="side">
                    {t("promotions.visual.popup_layout_side")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="popup-code">
                {t("promotions.visual.popup_code")}
              </Label>
              <Input
                id="popup-code"
                value={state.popupCodeReveal}
                onChange={(e) =>
                  update(
                    "popupCodeReveal",
                    e.target.value.toUpperCase(),
                  )
                }
                className="font-mono"
                placeholder="WELCOME10"
              />
              <p className="text-xs text-muted-foreground">
                {t("promotions.visual.popup_code_hint")}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="popup-show-after">
                {t("promotions.visual.popup_show_after")}
              </Label>
              <Input
                id="popup-show-after"
                type="number"
                min={0}
                max={365}
                value={state.popupShowAfterDays}
                onChange={(e) =>
                  update(
                    "popupShowAfterDays",
                    Number(e.target.value) || 0,
                  )
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="popup-image">
                {t("promotions.visual.popup_image_url")}
              </Label>
              <Input
                id="popup-image"
                value={state.popupImageUrl}
                onChange={(e) => update("popupImageUrl", e.target.value)}
                placeholder="https://… (1200×600 recommended)"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                {t("promotions.visual.popup_image_hint")}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="popup-cta-url">
                {t("promotions.visual.cta_url")}
              </Label>
              <LinkPicker
                id="popup-cta-url"
                storeId={storeId}
                value={state.ctaUrl}
                onChange={(v) => update("ctaUrl", v)}
                placeholder="/products"
              />
              <p className="text-xs text-muted-foreground">
                {t("promotions.visual.popup_cta_hint")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {surface === "popup" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("promotions.visual.popup_form_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="popup-collect-email" className="text-base">
                  {t("promotions.visual.popup_collect_email")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("promotions.visual.popup_collect_email_hint")}
                </p>
              </div>
              <Switch
                id="popup-collect-email"
                checked={state.popupCollectEmail}
                onCheckedChange={(c) => update("popupCollectEmail", c)}
              />
            </div>
            {state.popupCollectEmail && (
              <>
                <div className="flex items-center justify-between">
                  <Label htmlFor="popup-collect-phone" className="text-base">
                    {t("promotions.visual.popup_collect_phone")}
                  </Label>
                  <Switch
                    id="popup-collect-phone"
                    checked={state.popupCollectPhone}
                    onCheckedChange={(c) => update("popupCollectPhone", c)}
                  />
                </div>

                <Tabs defaultValue="ar">
                  <TabsList>
                    <TabsTrigger value="ar">العربية</TabsTrigger>
                    <TabsTrigger value="en">English</TabsTrigger>
                  </TabsList>

                  <TabsContent value="ar" className="space-y-3 pt-3" dir="rtl">
                    <PopupFormCopyFields
                      lang="ar"
                      state={state}
                      update={update}
                    />
                  </TabsContent>

                  <TabsContent value="en" className="space-y-3 pt-3" dir="ltr">
                    <PopupFormCopyFields
                      lang="en"
                      state={state}
                      update={update}
                    />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {surface === "floating_widget" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("promotions.visual.widget_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="widget-pos">
                {t("promotions.visual.widget_position")}
              </Label>
              <Select
                value={state.widgetPosition}
                onValueChange={(v) =>
                  update(
                    "widgetPosition",
                    v as VisualContentState["widgetPosition"],
                  )
                }
              >
                <SelectTrigger id="widget-pos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom right</SelectItem>
                  <SelectItem value="bottom-left">Bottom left</SelectItem>
                  <SelectItem value="top-right">Top right</SelectItem>
                  <SelectItem value="top-left">Top left</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="widget-bg">
                {t("promotions.visual.background")}
              </Label>
              <Input
                id="widget-bg"
                type="color"
                value={state.widgetBg}
                onChange={(e) => update("widgetBg", e.target.value)}
                className="h-10 w-20"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="widget-expanded" className="text-base">
                {t("promotions.visual.widget_expanded")}
              </Label>
              <Switch
                id="widget-expanded"
                checked={state.widgetExpanded}
                onCheckedChange={(c) => update("widgetExpanded", c)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="widget-cta-url">
                {t("promotions.visual.cta_url")}
              </Label>
              <LinkPicker
                id="widget-cta-url"
                storeId={storeId}
                value={state.ctaUrl}
                onChange={(v) => update("ctaUrl", v)}
                placeholder="/products"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {surface === "cookie_banner" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("promotions.visual.cookie_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="cookie-pos">
                {t("promotions.visual.cookie_position")}
              </Label>
              <Select
                value={state.cookiePosition}
                onValueChange={(v) =>
                  update("cookiePosition", v as "bottom" | "modal")
                }
              >
                <SelectTrigger id="cookie-pos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom">
                    {t("promotions.visual.cookie_position_bottom")}
                  </SelectItem>
                  <SelectItem value="modal">
                    {t("promotions.visual.cookie_position_modal")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cookie-policy">
                {t("promotions.visual.cookie_policy_url")}
              </Label>
              <Input
                id="cookie-policy"
                value={state.cookiePolicyUrl}
                onChange={(e) => update("cookiePolicyUrl", e.target.value)}
                placeholder="/privacy"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="cookie-accept" className="text-base">
                {t("promotions.visual.cookie_accept_required")}
              </Label>
              <Switch
                id="cookie-accept"
                checked={state.cookieAcceptRequired}
                onCheckedChange={(c) => update("cookieAcceptRequired", c)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Popup form-capture copy fields (success state + form labels)                //
// --------------------------------------------------------------------------- //

interface PopupFormCopyFieldsProps {
  lang: "en" | "ar";
  state: VisualContentState;
  update: <K extends keyof VisualContentState>(key: K, value: VisualContentState[K]) => void;
}

function PopupFormCopyFields({ lang, state, update }: PopupFormCopyFieldsProps) {
  const { t } = useTranslation();
  const isAr = lang === "ar";

  // Map per-locale state keys so the same UI works for both tabs.
  const keys = isAr
    ? {
        successHeadline: "popupSuccessHeadlineAr" as const,
        successBody: "popupSuccessBodyAr" as const,
        emailLabel: "popupEmailLabelAr" as const,
        phoneLabel: "popupPhoneLabelAr" as const,
        consentLabel: "popupConsentLabelAr" as const,
        submitLabel: "popupSubmitLabelAr" as const,
      }
    : {
        successHeadline: "popupSuccessHeadlineEn" as const,
        successBody: "popupSuccessBodyEn" as const,
        emailLabel: "popupEmailLabelEn" as const,
        phoneLabel: "popupPhoneLabelEn" as const,
        consentLabel: "popupConsentLabelEn" as const,
        submitLabel: "popupSubmitLabelEn" as const,
      };

  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`popup-email-label-${lang}`}>
          {t("promotions.visual.popup_email_label")}
        </Label>
        <Input
          id={`popup-email-label-${lang}`}
          value={state[keys.emailLabel]}
          onChange={(e) => update(keys.emailLabel, e.target.value)}
          placeholder={isAr ? "البريد الإلكتروني" : "Email address"}
          dir={isAr ? "rtl" : "ltr"}
        />
      </div>
      {state.popupCollectPhone && (
        <div className="grid gap-2">
          <Label htmlFor={`popup-phone-label-${lang}`}>
            {t("promotions.visual.popup_phone_label")}
          </Label>
          <Input
            id={`popup-phone-label-${lang}`}
            value={state[keys.phoneLabel]}
            onChange={(e) => update(keys.phoneLabel, e.target.value)}
            placeholder={isAr ? "رقم الموبايل" : "Phone number"}
            dir={isAr ? "rtl" : "ltr"}
          />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor={`popup-consent-label-${lang}`}>
          {t("promotions.visual.popup_consent_label")}
        </Label>
        <Input
          id={`popup-consent-label-${lang}`}
          value={state[keys.consentLabel]}
          onChange={(e) => update(keys.consentLabel, e.target.value)}
          placeholder={
            isAr
              ? "ابعتلي عروض وكوبونات على البريد"
              : "Email me promos and coupons"
          }
          dir={isAr ? "rtl" : "ltr"}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`popup-submit-label-${lang}`}>
          {t("promotions.visual.popup_submit_label")}
        </Label>
        <Input
          id={`popup-submit-label-${lang}`}
          value={state[keys.submitLabel]}
          onChange={(e) => update(keys.submitLabel, e.target.value)}
          placeholder={isAr ? "احصل على الكود" : "Get my code"}
          dir={isAr ? "rtl" : "ltr"}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`popup-success-headline-${lang}`}>
          {t("promotions.visual.popup_success_headline")}
        </Label>
        <Input
          id={`popup-success-headline-${lang}`}
          value={state[keys.successHeadline]}
          onChange={(e) => update(keys.successHeadline, e.target.value)}
          placeholder={isAr ? "تمام، اتسجلت!" : "You're in!"}
          dir={isAr ? "rtl" : "ltr"}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`popup-success-body-${lang}`}>
          {t("promotions.visual.popup_success_body")}
        </Label>
        <Input
          id={`popup-success-body-${lang}`}
          value={state[keys.successBody]}
          onChange={(e) => update(keys.successBody, e.target.value)}
          placeholder={
            isAr
              ? "بعتنالك الكود — استخدمه عند الكاشير"
              : "We've sent your code — use it at checkout"
          }
          dir={isAr ? "rtl" : "ltr"}
        />
      </div>
    </>
  );
}
