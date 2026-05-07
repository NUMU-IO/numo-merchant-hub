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
  // popup
  popupLayout: "centered" | "side";
  popupCodeReveal: string;
  popupShowAfterDays: number;
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
  popupLayout: "centered",
  popupCodeReveal: "",
  popupShowAfterDays: 30,
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
    case "popup":
      return {
        surface: "popup",
        layout: s.popupLayout,
        discount_code_to_reveal: s.popupCodeReveal || null,
        show_after_dismiss_days: s.popupShowAfterDays,
      };
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

/** Build the bilingual translations object from the same state. */
export function buildVisualTranslations(s: VisualContentState) {
  const out: Record<
    string,
    { headline?: { en?: string; ar?: string }; body?: { en?: string; ar?: string }; cta_label?: { en?: string; ar?: string } }
  > = {};
  if (s.headlineEn || s.bodyEn || s.ctaLabelEn) {
    out.en = {};
    if (s.headlineEn) out.en.headline = { en: s.headlineEn };
    if (s.bodyEn) out.en.body = { en: s.bodyEn };
    if (s.ctaLabelEn) out.en.cta_label = { en: s.ctaLabelEn };
  }
  if (s.headlineAr || s.bodyAr || s.ctaLabelAr) {
    out.ar = {};
    if (s.headlineAr) out.ar.headline = { ar: s.headlineAr };
    if (s.bodyAr) out.ar.body = { ar: s.bodyAr };
    if (s.ctaLabelAr) out.ar.cta_label = { ar: s.ctaLabelAr };
  }
  return out;
}

export function VisualContentPanel({ surface, state, onChange }: Props) {
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
              <Input
                id="bar-link"
                value={state.linkUrl}
                onChange={(e) => update("linkUrl", e.target.value)}
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
