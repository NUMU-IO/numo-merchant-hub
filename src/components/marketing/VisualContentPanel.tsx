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

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  MediaLibraryDialog,
  getImageUrl,
} from "@/features/theme-editor-v3/components/inputs/MediaLibraryDialog";
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
  GeneratedPromoContent,
  PromotionContent,
  PromotionSurface,
} from "@/services/promotionApi";
import { generatePromoContent } from "@/services/promotionApi";

import { LinkPicker } from "./LinkPicker";

export interface VisualContentState {
  // announcement bar
  bg: string;
  fg: string;
  icon: string;
  dismissible: boolean;
  linkUrl: string;
  /** Optional 2nd color — when set the bar background is a gradient. */
  barGradientTo: string;
  barFontSize: "sm" | "md" | "lg";
  barTextAlign: "start" | "center" | "end";
  barAnimation: "none" | "pulse" | "marquee";
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
  /** Coupon code auto-pinned to the cart when a shopper follows this promo's CTA. */
  autoApplyCode: string;
  // popup
  /** Template = our headline/body/form popup; Custom = merchant-pasted HTML. */
  popupContentMode: "template" | "custom";
  /** Raw HTML pasted by the merchant, used when popupContentMode === "custom". */
  popupCustomHtml: string;
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
  icon: "",
  dismissible: true,
  linkUrl: "",
  barGradientTo: "",
  barFontSize: "md",
  barTextAlign: "center",
  barAnimation: "none",
  headlineEn: "",
  headlineAr: "",
  bodyEn: "",
  bodyAr: "",
  ctaLabelEn: "",
  ctaLabelAr: "",
  ctaUrl: "",
  autoApplyCode: "",
  popupContentMode: "template",
  popupCustomHtml: "",
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
        background_gradient_to: s.barGradientTo || null,
        font_size: s.barFontSize,
        text_align: s.barTextAlign,
        animation: s.barAnimation,
        auto_apply_code: s.autoApplyCode || null,
      };
    case "popup": {
      // Custom-HTML mode: the merchant supplies the entire popup body
      // (e.g. pasted from an AI assistant). The storefront renders it in
      // a sandboxed iframe, so we only ship the markup + the dismissal
      // window — none of the templated copy/form/image fields apply.
      if (s.popupContentMode === "custom") {
        return {
          surface: "popup",
          layout: "custom",
          custom_html: s.popupCustomHtml || null,
          show_after_dismiss_days: s.popupShowAfterDays,
          auto_apply_code: s.autoApplyCode || null,
        };
      }
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
        auto_apply_code: s.autoApplyCode || null,
      };
    }
    case "floating_widget":
      return {
        surface: "floating_widget",
        position: s.widgetPosition,
        icon: s.widgetIcon,
        expanded_default: s.widgetExpanded,
        color_bg: s.widgetBg,
        auto_apply_code: s.autoApplyCode || null,
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bar-icon">
                  {t("promotions.visual.bar_icon")}
                </Label>
                <Input
                  id="bar-icon"
                  value={state.icon}
                  onChange={(e) => update("icon", e.target.value)}
                  placeholder="🎉"
                  maxLength={4}
                  className="w-24 text-center text-lg"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bar-grad">
                  {t("promotions.visual.bar_gradient")}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="bar-grad"
                    type="color"
                    value={state.barGradientTo || state.bg}
                    onChange={(e) => update("barGradientTo", e.target.value)}
                    className="h-10 w-20"
                  />
                  {state.barGradientTo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => update("barGradientTo", "")}
                    >
                      {t("promotions.visual.bar_gradient_clear")}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("promotions.visual.bar_gradient_hint")}
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="bar-size">
                  {t("promotions.visual.bar_font_size")}
                </Label>
                <Select
                  value={state.barFontSize}
                  onValueChange={(v) =>
                    update("barFontSize", v as VisualContentState["barFontSize"])
                  }
                >
                  <SelectTrigger id="bar-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">{t("promotions.visual.size_sm")}</SelectItem>
                    <SelectItem value="md">{t("promotions.visual.size_md")}</SelectItem>
                    <SelectItem value="lg">{t("promotions.visual.size_lg")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bar-align">
                  {t("promotions.visual.bar_align")}
                </Label>
                <Select
                  value={state.barTextAlign}
                  onValueChange={(v) =>
                    update("barTextAlign", v as VisualContentState["barTextAlign"])
                  }
                >
                  <SelectTrigger id="bar-align">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start">{t("promotions.visual.align_start")}</SelectItem>
                    <SelectItem value="center">{t("promotions.visual.align_center")}</SelectItem>
                    <SelectItem value="end">{t("promotions.visual.align_end")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bar-anim">
                  {t("promotions.visual.bar_animation")}
                </Label>
                <Select
                  value={state.barAnimation}
                  onValueChange={(v) =>
                    update("barAnimation", v as VisualContentState["barAnimation"])
                  }
                >
                  <SelectTrigger id="bar-anim">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("promotions.visual.anim_none")}</SelectItem>
                    <SelectItem value="pulse">{t("promotions.visual.anim_pulse")}</SelectItem>
                    <SelectItem value="marquee">{t("promotions.visual.anim_marquee")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
            <AutoApplyCodeField state={state} update={update} />
            <AiPromptPanel
              surface="announcement_bar"
              state={state}
              update={update}
              storeId={storeId}
            />
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
              <Label htmlFor="popup-mode">
                {t("promotions.visual.popup_mode")}
              </Label>
              <Select
                value={state.popupContentMode}
                onValueChange={(v) =>
                  update("popupContentMode", v as "template" | "custom")
                }
              >
                <SelectTrigger id="popup-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">
                    {t("promotions.visual.popup_mode_template")}
                  </SelectItem>
                  <SelectItem value="custom">
                    {t("promotions.visual.popup_mode_custom")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("promotions.visual.popup_mode_hint")}
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

            {state.popupContentMode === "custom" ? (
              <PopupCustomHtmlField
                state={state}
                update={update}
                storeId={storeId}
              />
            ) : (
              <>
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
                <PopupImageField
                  state={state}
                  update={update}
                  storeId={storeId}
                />
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
                <AutoApplyCodeField state={state} update={update} />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {surface === "popup" && state.popupContentMode === "template" && (
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
            <AutoApplyCodeField state={state} update={update} />
            <AiPromptPanel
              surface="floating_widget"
              state={state}
              update={update}
              storeId={storeId}
            />
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
            <AiPromptPanel
              surface="cookie_banner"
              state={state}
              update={update}
              storeId={storeId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// Popup image picker + custom-HTML fields                                      //
// --------------------------------------------------------------------------- //

type PopupFieldUpdate = <K extends keyof VisualContentState>(
  key: K,
  value: VisualContentState[K],
) => void;

/** Optional coupon code auto-pinned to the cart when a shopper follows this
 *  promo's CTA — shared by the banner, popup and floating-widget cards. */
function AutoApplyCodeField({
  state,
  update,
}: {
  state: VisualContentState;
  update: PopupFieldUpdate;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-2">
      <Label htmlFor="auto-apply-code">
        {t("promotions.visual.auto_apply_code")}
      </Label>
      <Input
        id="auto-apply-code"
        value={state.autoApplyCode}
        onChange={(e) => update("autoApplyCode", e.target.value.toUpperCase())}
        className="font-mono"
        placeholder="WELCOME10"
        dir="ltr"
      />
      <p className="text-xs text-muted-foreground">
        {t("promotions.visual.auto_apply_code_hint")}
      </p>
    </div>
  );
}

/** Image field backed by the same media library / uploader the theme editor
 *  uses — shows existing uploads, an Upload tab, and a URL tab. */
function PopupImageField({
  state,
  update,
  storeId,
}: {
  state: VisualContentState;
  update: PopupFieldUpdate;
  storeId: string | undefined;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const locale = i18n.language?.startsWith("ar") ? "ar" : "en";
  return (
    <div className="grid gap-2">
      <Label>{t("promotions.visual.popup_image_url")}</Label>
      <div className="flex items-center gap-3">
        {state.popupImageUrl ? (
          <img
            src={state.popupImageUrl}
            alt=""
            className="h-16 w-24 rounded-md border object-cover"
          />
        ) : (
          <div className="flex h-16 w-24 items-center justify-center rounded-md border border-dashed text-center text-xs text-muted-foreground">
            {t("promotions.visual.popup_image_none")}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            {t("promotions.visual.popup_image_choose")}
          </Button>
          {state.popupImageUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => update("popupImageUrl", "")}
            >
              {t("promotions.visual.popup_image_remove")}
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("promotions.visual.popup_image_hint")}
      </p>
      <MediaLibraryDialog
        open={open}
        onOpenChange={setOpen}
        value={state.popupImageUrl}
        onChange={(next) => update("popupImageUrl", getImageUrl(next))}
        locale={locale}
        storeId={storeId}
      />
    </div>
  );
}

/** Textarea for merchant-pasted HTML + a fully-sandboxed live preview. */
function PopupCustomHtmlField({
  state,
  update,
  storeId,
}: {
  state: VisualContentState;
  update: PopupFieldUpdate;
  storeId?: string;
}) {
  const { t } = useTranslation();
  const html = state.popupCustomHtml;
  const trimmed = html.trim();
  // Lightweight, non-blocking checks so the merchant knows their pasted HTML
  // will render + act the way our popup expects.
  const hasScript = /<script[\s>]/i.test(html);
  const hasCta = /<a[\s>]/i.test(html);
  return (
    <div className="space-y-3">
      <AiPromptPanel
        surface="popup"
        state={state}
        update={update}
        storeId={storeId}
      />
      <div className="grid gap-2">
        <Label htmlFor="popup-custom-html">
          {t("promotions.visual.popup_custom_html")}
        </Label>
        <Textarea
          id="popup-custom-html"
          value={html}
          onChange={(e) => update("popupCustomHtml", e.target.value)}
          placeholder='<div style="padding:24px;text-align:center">…</div>'
          className="min-h-[200px] font-mono text-xs"
          dir="ltr"
        />
        <p className="text-xs text-muted-foreground">
          {t("promotions.visual.popup_custom_html_hint")}
        </p>
        {trimmed && hasScript && (
          <p className="text-xs font-medium text-amber-600">
            ⚠ {t("promotions.visual.popup_custom_warn_script")}
          </p>
        )}
        {trimmed && !hasCta && (
          <p className="text-xs font-medium text-amber-600">
            ⚠ {t("promotions.visual.popup_custom_warn_cta")}
          </p>
        )}
      </div>
      {trimmed && (
        <div className="grid gap-2">
          <Label>{t("promotions.visual.popup_custom_preview")}</Label>
          <div className="overflow-hidden rounded-lg border">
            {/* sandbox="" fully locks the preview: no scripts, no navigation,
                no same-origin access — safe to render untrusted markup. Wrap in
                a zero-margin doc so the preview matches the storefront (the
                snippet fills edge-to-edge, no white gutter). */}
            <iframe
              title="popup-preview"
              sandbox=""
              srcDoc={`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>*{box-sizing:border-box}html,body{margin:0;padding:0;height:100%}body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}</style></head><body>${html}</body></html>`}
              className="block h-80 w-full border-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- //
// AI prompt helper — a copyable, contract-aware prompt the merchant pastes    //
// into their own AI assistant (ChatGPT / Claude) to generate popup HTML or    //
// banner copy that fits what our surfaces actually render.                    //
// --------------------------------------------------------------------------- //

function buildAiPrompt(
  surface: PromotionSurface,
  s: VisualContentState,
  brief?: string,
): string {
  const details =
    (brief && brief.trim()) ||
    [s.headlineEn || s.headlineAr, s.bodyEn || s.bodyAr]
      .filter(Boolean)
      .join(" — ") ||
    "(describe your promotion / offer here)";

  if (surface === "popup") {
    const cta = s.ctaUrl || "https://your-store-link";
    const label = s.ctaLabelEn || s.ctaLabelAr || "Shop now";
    return [
      "Design the inner HTML for an e-commerce popup modal.",
      "Output ONLY one self-contained HTML snippet — no <html>/<head>/<body>, no <script>, no markdown code fences.",
      "",
      "Hard requirements (our popup renders your HTML inside a sandboxed iframe ~460px wide):",
      "- Inline CSS only (style=\"...\"). No <script>, no <link>, no external fonts/images/URLs — scripts and remote resources are stripped for security.",
      "- Design for ~460px wide, responsive down to 320px. Keep the total height under ~560px.",
      `- Include EXACTLY ONE call to action as a link: <a href="${cta}" target="_top" style="...">${label}</a>. target="_top" is REQUIRED so the click navigates the storefront.`,
      "- If the copy is Arabic, add dir=\"rtl\" to the root element.",
      "- Do NOT add a close (X) button — our modal already provides one.",
      "",
      `Brand colors to use: background ${s.bg}, text ${s.fg}.`,
      `Offer to feature: ${details}.`,
      "",
      "Return only the HTML.",
    ].join("\n");
  }

  // Copy-only surfaces (announcement bar / floating widget / cookie banner) —
  // we style these ourselves, so the AI just writes short bilingual copy.
  const surfaceBrief =
    surface === "floating_widget"
      ? "a small floating corner widget (a pill that expands to a card)"
      : surface === "cookie_banner"
        ? "a cookie-consent banner"
        : "a store's top announcement bar";
  const ctaLine =
    surface === "cookie_banner"
      ? "CTA (EN): <accept-button label, max 24 chars>\nCTA (AR): <accept-button label, max 24 chars>"
      : "CTA (EN): <button label, max 24 chars>\nCTA (AR): <button label, max 24 chars>";
  const toneLine =
    surface === "cookie_banner"
      ? "Tone: reassuring, plain-language, privacy-respecting."
      : "Tone: energetic and trustworthy.";
  return [
    `Write short bilingual copy for ${surfaceBrief} on an e-commerce store. Keep it concise.`,
    "",
    "Return exactly this, filling BOTH languages:",
    "Headline (EN): <max 60 chars, include one relevant emoji unless it's the cookie banner>",
    "Headline (AR): <max 60 chars>",
    "Body (EN): <max 90 chars>",
    "Body (AR): <max 90 chars>",
    ctaLine,
    "",
    `Offer / context: ${details}.`,
    `${toneLine} Plain text only — no links, no HTML.`,
  ].join("\n");
}

function AiPromptPanel({
  surface,
  state,
  update,
  storeId,
}: {
  surface: PromotionSurface;
  state: VisualContentState;
  update: PopupFieldUpdate;
  storeId?: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The popup's AI panel lives in custom-HTML mode, so it generates HTML;
  // every other surface generates short bilingual copy.
  const isHtml = surface === "popup";
  const prompt = buildAiPrompt(surface, state, brief);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the prompt textarea is selectable as a fallback */
    }
  };

  const applyResult = (r: GeneratedPromoContent) => {
    if (r.mode === "html" && r.html) {
      update("popupContentMode", "custom");
      update("popupCustomHtml", r.html);
      return;
    }
    if (r.headline_en) update("headlineEn", r.headline_en);
    if (r.headline_ar) update("headlineAr", r.headline_ar);
    if (r.body_en) update("bodyEn", r.body_en);
    if (r.body_ar) update("bodyAr", r.body_ar);
    if (r.cta_en) update("ctaLabelEn", r.cta_en);
    if (r.cta_ar) update("ctaLabelAr", r.cta_ar);
  };

  const generate = async () => {
    if (!storeId || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Feed the AI the copy the merchant already typed (headline / body /
      // button label) so it builds on *their* content instead of inventing a
      // generic offer. The free-text brief, when present, leads.
      const headline = state.headlineEn || state.headlineAr;
      const bodyText = state.bodyEn || state.bodyAr;
      const ctaLabel = state.ctaLabelEn || state.ctaLabelAr;
      const composedBrief = [
        brief.trim(),
        headline && `Headline: ${headline}`,
        bodyText && `Body: ${bodyText}`,
        ctaLabel && `Button label: ${ctaLabel}`,
      ]
        .filter(Boolean)
        .join(". ");
      const r = await generatePromoContent(storeId, {
        surface,
        mode: isHtml ? "html" : "copy",
        brief: composedBrief,
        primary_color: state.bg,
        text_color: state.fg,
        cta_url: state.ctaUrl || null,
      });
      applyResult(r);
    } catch (e) {
      setError(
        e instanceof Error && /429|rate|too many/i.test(e.message)
          ? (t("promotions.visual.ai_err_rate") as string)
          : (t("promotions.visual.ai_err") as string),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed bg-muted/40 p-3">
      <Label className="flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="h-4 w-4" />
        {t("promotions.visual.ai_title")}
      </Label>
      <Textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        placeholder={t("promotions.visual.ai_brief_ph") as string}
        className="min-h-[64px] text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={generate}
          disabled={busy || !storeId}
        >
          <Sparkles className="me-1.5 h-3.5 w-3.5" />
          {busy
            ? t("promotions.visual.ai_generating")
            : t("promotions.visual.ai_generate")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied
            ? t("promotions.visual.ai_copied")
            : t("promotions.visual.ai_copy")}
        </Button>
        <span className="text-xs text-muted-foreground">
          {t("promotions.visual.ai_or_copy")}
        </span>
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">
          {t("promotions.visual.ai_view_prompt")}
        </summary>
        <Textarea
          readOnly
          value={prompt}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 min-h-[120px] font-mono text-xs"
          dir="ltr"
        />
      </details>
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
