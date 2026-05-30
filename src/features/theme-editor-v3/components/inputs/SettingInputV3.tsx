/**
 * SettingInputV3 — Renders a single setting control based on its type.
 *
 * Supports all 14 input types:
 *  1. text         — single-line text input
 *  2. textarea     — multi-line text area
 *  3. richtext     — rich text editor (simplified markdown)
 *  4. number       — numeric input with min/max/step
 *  5. range        — slider with min/max/step and unit label
 *  6. color        — color picker with hex input
 *  7. checkbox     — boolean toggle switch
 *  8. select       — dropdown select
 *  9. radio        — radio button group
 * 10. font         — font family picker (opens font gallery)
 * 11. image_picker — image upload/select dialog
 * 12. url          — URL input with validation
 * 13. product      — product search/select
 * 14. collection   — collection search/select
 *
 * All labels are bilingual (EN/AR) based on the editor locale.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import type { SettingDefinition, EditorLocale, ColorSchemeValue } from "../../types";
import { uploadStoreAsset } from "@/services/storeApi";
import { listProducts } from "@/services/productApi";
import { listCategories } from "@/services/categoryApi";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  Link2,
  Package,
  FolderOpen,
  Type,
  Calendar,
  Clock,
  Code,
  Film,
  List,
  Palette,
  Upload,
  Bold,
  Italic,
  Plus,
  Trash2,
} from "lucide-react";
import {
  ResourceSearchPicker,
  type ResourceSearchItem,
} from "./ResourceSearchPicker";
import { LinkPickerButton } from "./LinkPicker";
import {
  MediaLibraryDialog,
  getImageUrl,
  getImageAlt,
  type ImageValue,
} from "./MediaLibraryDialog";
import {
  DynamicSourceToggle,
  isDynamicSourceValue,
  dynamicSourceLabel,
  hasBindableSources,
} from "./DynamicSourcePicker";
import { useCustomizerStore } from "../../store/customizerStore";

// ─── Props ──────────────────────────────────────────────────────────────────

export interface SettingInputV3Props {
  setting: SettingDefinition;
  value: unknown;
  locale: EditorLocale;
  onChange: (value: unknown) => void;
  storeId?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getLabel(setting: SettingDefinition, locale: EditorLocale): string {
  if (locale === "ar") {
    return setting.locales?.ar?.label || setting.label;
  }
  return setting.locales?.en?.label || setting.label;
}

function getInfo(setting: SettingDefinition, locale: EditorLocale): string | undefined {
  if (locale === "ar") {
    return setting.locales?.ar?.info || setting.info;
  }
  return setting.locales?.en?.info || setting.info;
}

function getPlaceholder(setting: SettingDefinition, locale: EditorLocale): string | undefined {
  if (locale === "ar") {
    return setting.locales?.ar?.placeholder || setting.placeholder;
  }
  return setting.locales?.en?.placeholder || setting.placeholder;
}

function getOptionLabel(
  option: { label: string; value: string; locales?: { ar?: { label?: string } } },
  locale: EditorLocale,
): string {
  if (locale === "ar") {
    return option.locales?.ar?.label || option.label;
  }
  return option.label;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Decorative `header` and `paragraph` setting types are layout-only
 * dividers — they have no `id` and no value. Rendering them in a
 * separate component keeps `SettingInputV3`'s hook order stable
 * (rules-of-hooks): we can't early-return before the hooks below
 * without splitting render paths.
 */
function SettingDivider({
  setting,
  locale,
}: {
  setting: SettingDefinition;
  locale: EditorLocale;
}) {
  const content =
    locale === "ar"
      ? (setting as { locales?: { ar?: { content?: string } } }).locales?.ar?.content ??
        (setting as { content?: string }).content
      : (setting as { content?: string }).content;
  if (!content) return null;
  if (setting.type === "header") {
    return (
      <div className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {content}
      </div>
    );
  }
  return (
    <p className="mb-2 text-xs leading-relaxed text-muted-foreground">{content}</p>
  );
}

export function SettingInputV3(props: SettingInputV3Props) {
  // Route decorative setting types away from the input pipeline so
  // their lack of `id` / `value` doesn't trip code that assumes them.
  // Without this, `setting.id.replace(...)` below blows up with
  // "Cannot read properties of undefined (reading 'replace')" the
  // first time a theme ships one of these.
  if (props.setting.type === "header" || props.setting.type === "paragraph") {
    return <SettingDivider setting={props.setting} locale={props.locale} />;
  }
  return <SettingInputV3Input {...props} />;
}

function SettingInputV3Input({ setting, value, locale, onChange, storeId }: SettingInputV3Props) {
  const label = getLabel(setting, locale);
  const info = getInfo(setting, locale);
  const placeholder = getPlaceholder(setting, locale);
  const testId = `v3-setting-${(setting.id ?? "anon").replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

  // P1.1 — Dynamic sources: read the active template so the picker can
  // filter sources by what's actually in context (product.* sources only
  // surface on product templates, etc.).
  const activePage = useCustomizerStore((s) => s.activePage);
  const isBound = isDynamicSourceValue(value);
  const showSourceToggle =
    isBound || hasBindableSources(setting.type, activePage);
  const sourceToggle = showSourceToggle ? (
    <DynamicSourceToggle
      setting={setting}
      value={value}
      locale={locale}
      activePage={activePage}
      onChange={(next) => onChange(next ?? "")}
    />
  ) : null;

  // Label row injects the toggle to the right of the label so it sits
  // outside the input itself — keeps the input's visual width stable
  // whether or not the field is bindable.
  const labelRow = (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {sourceToggle}
    </div>
  );

  const wrapper = (children: React.ReactNode, inline = false) => (
    <div
      className={cn("space-y-1.5", inline && "flex items-center justify-between gap-3")}
      data-testid={testId}
      data-setting-id={setting.id ?? undefined}
    >
      {!inline && labelRow}
      {inline && (
        <Label className="text-sm font-medium text-foreground flex-1">{label}</Label>
      )}
      {children}
      {info && !inline && (
        <p className="text-xs text-muted-foreground">{info}</p>
      )}
    </div>
  );

  // Bound state — when the merchant has connected a dynamic source, we
  // replace the input control with a chip showing the binding. The
  // toggle in the labelRow still lets them swap source or unbind.
  // Returning early avoids every per-type case having to branch on
  // bound vs literal.
  if (isBound) {
    return wrapper(
      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate font-medium text-foreground">
          {dynamicSourceLabel(value, locale) ?? ""}
        </span>
        <span className="ms-auto font-mono text-[10px] text-muted-foreground">
          {(value as { __numu_source: string }).__numu_source}
        </span>
      </div>,
    );
  }

  switch (setting.type) {
    // ── 1. Text ───────────────────────────────────────────────────────
    case "text":
      return wrapper(
        <Input
          value={(value as string) ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          dir={locale === "ar" ? "rtl" : "ltr"}
        />,
      );

    // ── 2. Textarea ───────────────────────────────────────────────────
    case "textarea":
      return wrapper(
        <Textarea
          value={(value as string) ?? ""}
          placeholder={placeholder}
          rows={4}
          onChange={(e) => onChange(e.target.value)}
          dir={locale === "ar" ? "rtl" : "ltr"}
        />,
      );

    // ── 3. Rich Text ──────────────────────────────────────────────────
    case "richtext":
      return wrapper(
        <Textarea
          value={(value as string) ?? ""}
          placeholder={placeholder || (locale === "ar" ? "أدخل نصاً منسقاً..." : "Enter rich text...")}
          rows={6}
          className="font-mono text-sm"
          onChange={(e) => onChange(e.target.value)}
          dir={locale === "ar" ? "rtl" : "ltr"}
        />,
      );

    // ── Inline rich text ──────────────────────────────────────────────
    // Single-line WYSIWYG. Distinct from `richtext` (multi-line). The
    // stored value is HTML — bold + italic only, no block elements,
    // no embedded scripts. Suitable for product names with emphasis,
    // hero headlines with a single strong word, etc.
    case "inline_richtext":
      return wrapper(
        <InlineRichTextField
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
          placeholder={placeholder}
        />,
      );

    // ── 4. Number ─────────────────────────────────────────────────────
    case "number":
      return wrapper(
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={(value as number) ?? setting.default ?? 0}
            min={setting.min}
            max={setting.max}
            step={setting.step ?? 1}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-24"
          />
          {setting.unit && (
            <span className="text-xs text-muted-foreground">{setting.unit}</span>
          )}
        </div>,
      );

    // ── 5. Range ──────────────────────────────────────────────────────
    case "range":
      return wrapper(
        <div className="flex items-center gap-3">
          <Slider
            value={[(value as number) ?? setting.default ?? setting.min ?? 0]}
            min={setting.min ?? 0}
            max={setting.max ?? 100}
            step={setting.step ?? 1}
            onValueChange={([v]) => onChange(v)}
            className="flex-1"
          />
          <span className="w-12 text-center text-sm font-mono text-muted-foreground">
            {(value as number) ?? setting.default ?? setting.min ?? 0}
            {setting.unit ? setting.unit : ""}
          </span>
        </div>,
      );

    // ── Range with unit ───────────────────────────────────────────────
    // Range + a unit-options dropdown. Stored value is
    //   { value: number, unit: string }
    // so the resolver can render `padding: 16px` vs `padding: 1rem`
    // depending on what the merchant picked.
    case "range_with_unit": {
      const stored = (value && typeof value === "object"
        ? (value as { value?: number; unit?: string })
        : undefined) ?? {};
      const numeric =
        stored.value ?? (setting.default as number) ?? setting.min ?? 0;
      const unit =
        stored.unit ??
        setting.unit ??
        setting.unit_options?.[0]?.value ??
        "px";
      return wrapper(
        <div className="flex items-center gap-2">
          <Slider
            value={[numeric]}
            min={setting.min ?? 0}
            max={setting.max ?? 100}
            step={setting.step ?? 1}
            onValueChange={([v]) => onChange({ value: v, unit })}
            className="flex-1"
          />
          <span className="w-10 text-center text-xs font-mono text-muted-foreground">
            {numeric}
          </span>
          <Select
            value={unit}
            onValueChange={(u) => onChange({ value: numeric, unit: u })}
          >
            <SelectTrigger className="h-8 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                setting.unit_options ??
                [
                  { value: "px", label: "px" },
                  { value: "rem", label: "rem" },
                  { value: "%", label: "%" },
                ]
              ).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label || opt.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>,
      );
    }

    // ── 6. Color ──────────────────────────────────────────────────────
    case "color":
      return wrapper(
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="color"
              value={(value as string) ?? "#000000"}
              onChange={(e) => onChange(e.target.value)}
              className="h-9 w-9 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
            />
          </div>
          <Input
            value={(value as string) ?? "#000000"}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="w-28 font-mono text-sm"
          />
        </div>,
      );

    // ── 7. Checkbox (Toggle) ──────────────────────────────────────────
    case "checkbox":
      return wrapper(
        <Switch
          checked={Boolean(value ?? setting.default ?? false)}
          onCheckedChange={(checked) => onChange(checked)}
        />,
        true, // inline layout
      );

    // ── 8. Select ─────────────────────────────────────────────────────
    case "select":
      return wrapper(
        <Select
          value={(value as string) ?? (setting.default as string) ?? ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={placeholder || label} />
          </SelectTrigger>
          <SelectContent>
            {setting.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {getOptionLabel(opt, locale)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>,
      );

    // ── 9. Radio ──────────────────────────────────────────────────────
    case "radio":
      return wrapper(
        <div className="space-y-2">
          {setting.options?.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm transition-colors",
                value === opt.value
                  ? "border-primary bg-primary/5"
                  : "border-input hover:border-primary/50",
              )}
            >
              <input
                type="radio"
                name={setting.id}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className="h-4 w-4 accent-primary"
              />
              {getOptionLabel(opt, locale)}
            </label>
          ))}
        </div>,
      );

    // ── 10. Font ──────────────────────────────────────────────────────
    // Accept both `font` (canonical) and the `font_picker` alias some
    // themes use (Shopify naming) so neither falls through to the silent
    // text fallback.
    case "font":
    case "font_picker":
      return wrapper(
        <FontPickerButton
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
        />,
      );

    // ── 11. Image Picker ──────────────────────────────────────────────
    // P1.3 — Replaced the inline drop-zone with the MediaLibrary
    // picker. The stored value may now be either a plain URL string
    // (legacy) or an { url, alt } object (new). Theme authors read
    // it via the SDK's image helpers or fall back to
    // typeof value === "string" ? value : value?.url ?? "".
    case "image_picker":
      return wrapper(
        <ImagePickerButton
          value={value as ImageValue | undefined}
          locale={locale}
          onChange={onChange}
          storeId={storeId}
        />,
      );

    // ── 12. URL ───────────────────────────────────────────────────────
    // Replaced the bare URL input with the Shopify-style LinkPicker —
    // merchant clicks the trigger button, picks a destination from
    // Products / Collections / Pages / Common / External URL / Email /
    // Phone / WhatsApp tabs. The stored value remains a plain URL
    // string so existing themes that consume the setting via `href`
    // keep working without changes.
    case "url":
      return wrapper(
        <LinkPickerButton
          value={(value as string) ?? ""}
          locale={locale}
          onChange={(next) => onChange(next)}
          storeId={storeId}
          placeholder={placeholder}
        />,
      );

    // ── 13. Product (single) ──────────────────────────────────────────
    case "product":
      return wrapper(
        <ProductPicker
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
          storeId={storeId}
          multi={false}
        />,
      );

    // ── 14. Collection (single) ───────────────────────────────────────
    case "collection":
      return wrapper(
        <CollectionPicker
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
          storeId={storeId}
          multi={false}
        />,
      );

    // ── Product list (multi-select) ──────────────────────────────────
    // Stored value is `string[]` of product ids. The schema's
    // `max_items` caps the list (defaults to 50). Themes typically use
    // this for "Featured products" sections, "Recently viewed" rails,
    // or curated bundle UIs.
    case "product_list":
      return wrapper(
        <ProductPicker
          value={(value as string[]) ?? []}
          locale={locale}
          onChange={onChange}
          storeId={storeId}
          multi
          maxItems={setting.max_items ?? 50}
        />,
      );

    // ── Collection list (multi-select) ───────────────────────────────
    case "collection_list":
      return wrapper(
        <CollectionPicker
          value={(value as string[]) ?? []}
          locale={locale}
          onChange={onChange}
          storeId={storeId}
          multi
          maxItems={setting.max_items ?? 50}
        />,
      );

    // ── 15. Header (visual divider in customizer) ─────────────────────
    // Renders the label as a section header inside the form. Doesn't
    // accept a value — this is purely organizational (Shopify uses it
    // to break long settings_schemas into groups).
    case "header":
      return (
        <div className="pt-3 mt-2 border-t" data-testid={testId}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {info && <p className="text-xs text-muted-foreground mt-1">{info}</p>}
        </div>
      );

    // ── 16. Paragraph (info text) ─────────────────────────────────────
    // Static rich-but-plain explanatory text. No input. The label is
    // shown small + the info field is the body.
    case "paragraph":
      return (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground" data-testid={testId}>
          {label && <p className="font-medium text-foreground mb-1">{label}</p>}
          {info && <p className="leading-relaxed whitespace-pre-line">{info}</p>}
        </div>
      );

    // ── 17. HTML (raw HTML editor) ────────────────────────────────────
    // Mono-spaced multi-line text input for HTML snippets. We don't
    // sanitize at customize time (that's a runtime concern in the
    // theme renderer); our job is to give merchants a comfortable
    // editing surface.
    case "html":
      return wrapper(
        <div className="space-y-1">
          <Textarea
            value={(value as string) ?? ""}
            placeholder={placeholder || "<div>...</div>"}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Code className="h-3 w-3" />
            {locale === "ar"
              ? "HTML خام — استخدم بحذر"
              : "Raw HTML — use with care"}
          </p>
        </div>,
      );

    // ── 18. Date ──────────────────────────────────────────────────────
    // ISO date (YYYY-MM-DD). Native input is good enough; calendar
    // picker comes from the browser.
    case "date":
      return wrapper(
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1"
          />
        </div>,
      );

    // ── 19. Time ──────────────────────────────────────────────────────
    case "time":
      return wrapper(
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            type="time"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1"
          />
        </div>,
      );

    // ── 20. Video picker ──────────────────────────────────────────────
    // Today: URL input pointed at a hosted video (YouTube/Vimeo/MP4).
    // Future: full picker that uploads to R2 + gives back a CDN URL.
    case "video_picker":
      return wrapper(
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              type="url"
              value={(value as string) ?? ""}
              placeholder={placeholder || "https://youtu.be/... or https://cdn/video.mp4"}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {locale === "ar"
              ? "ادعم YouTube و Vimeo و MP4 المباشر."
              : "Supports YouTube, Vimeo, and direct MP4 URLs."}
          </p>
        </div>,
      );

    // ── Color scheme picker ──────────────────────────────────────────
    // Selects from the theme's `color_scheme_group` global setting.
    // Looks up the live schemes via the customizer store (the global
    // setting holds an array of { id, name, colors }) and surfaces a
    // visual swatch grid. Falls back to a free-text input when no
    // group is defined (rare — themes typically declare one).
    case "color_scheme":
      return wrapper(
        <ColorSchemePicker
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
        />,
      );

    // ── Color scheme group ────────────────────────────────────────────
    // Parent setting placed on `global_settings`. Stored as
    //   ColorSchemeValue[]
    // i.e. an array of named palettes; child `color_scheme` settings
    // pick from this list by id. The editor lets merchants add /
    // remove / rename schemes and paint each role.
    case "color_scheme_group":
      return wrapper(
        <ColorSchemeGroupEditor
          value={(value as ColorSchemeValue[]) ?? []}
          locale={locale}
          onChange={onChange}
          colorRoles={
            setting.color_roles ?? [
              "background",
              "text",
              "primary",
              "accent",
            ]
          }
        />,
      );

    // ── 22. Page / blog / link-list pickers ───────────────────────────
    // These reference dashboard-managed resources (CMS pages, blog
    // posts, navigation menus) that we don't have a backend for yet.
    // Today they accept a free-form handle string so themes that
    // declare these settings don't crash; once the resource backends
    // ship we'll swap in proper search-pickers.
    case "page_picker":
    case "blog_picker":
    case "link_list_picker":
      return wrapper(
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={(value as string) ?? ""}
              placeholder={
                placeholder ||
                (setting.type === "link_list_picker" ? "main-menu" : "handle")
              }
              onChange={(e) => onChange(e.target.value)}
              className="flex-1"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {locale === "ar"
              ? "أدخل المعرّف (handle) للمورد. سيتم تحويله إلى منتقي بحث قريبًا."
              : "Enter the resource handle. A searchable picker is coming."}
          </p>
        </div>,
      );

    // ── 23. Variant picker ────────────────────────────────────────────
    // Like the product picker but for a specific variant id. Also
    // a stub today — accepts the variant_id string.
    case "variant_picker":
      return wrapper(
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={(value as string) ?? ""}
            placeholder={placeholder || "variant_id"}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1"
          />
        </div>,
      );

    // ── 24. File upload ───────────────────────────────────────────────
    // Real upload via /stores/{id}/settings/customization/assets with
    // asset_type=generic_file (PDFs, fonts, video, audio + images,
    // 10MB cap). The inline URL input remains as a fallback for files
    // already hosted elsewhere.
    case "file_upload":
      return wrapper(
        <FileUploadPicker
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
          storeId={storeId}
        />,
      );

    // ── Fallback ──────────────────────────────────────────────────────
    // Unknown setting type: render an editable text input (so the value is
    // never lost) but LABEL it as unrecognized + warn in dev, instead of
    // silently masquerading as a plain text field.
    default:
      if (import.meta.env.DEV) {
        console.warn(
          `[SettingInputV3] Unknown setting type "${setting.type}" for "${setting.id}" — rendering a plain text input.`,
        );
      }
      return wrapper(
        <div className="space-y-1">
          <Input
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            {locale === "ar"
              ? `نوع إعداد غير معروف: ${setting.type}`
              : `Unrecognized setting type: ${setting.type}`}
          </p>
        </div>,
      );
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function FontPickerButton({
  value,
  locale,
  onChange,
}: {
  value: string;
  locale: EditorLocale;
  onChange: (v: unknown) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={() => setOpen(true)}
      >
        <Type className="h-4 w-4" />
        <span className="truncate" style={{ fontFamily: value || undefined }}>
          {value || (locale === "ar" ? "اختر خطاً..." : "Choose font...")}
        </span>
      </Button>
      {open && (
        <div className="rounded-md border bg-popover p-3 shadow-md">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={locale === "ar" ? "اسم الخط" : "Font family name"}
            className="mb-2"
          />
          <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
            {COMMON_FONTS.map((font) => (
              <button
                key={font}
                className={cn(
                  "rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  value === font && "bg-primary/10 font-medium",
                )}
                style={{ fontFamily: font }}
                onClick={() => { onChange(font); setOpen(false); }}
              >
                {font}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => setOpen(false)}
          >
            {locale === "ar" ? "إغلاق" : "Close"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ImagePickerButton({
  value,
  locale,
  onChange,
  storeId,
}: {
  value: ImageValue | undefined;
  locale: EditorLocale;
  onChange: (v: unknown) => void;
  storeId?: string;
}) {
  // P1.3 — Thin wrapper around <MediaLibraryDialog>. The button shows
  // a preview tile (or empty drop-zone) plus a row of actions
  // (Choose / Replace / Remove). All of the upload/drag-drop/URL-
  // paste logic lives in the dialog now so the inline UI stays
  // compact even on dense forms.
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
  const url = getImageUrl(value);
  const alt = getImageAlt(value);

  return (
    <div className="space-y-2">
      {/* Preview tile or empty-state dropzone. Click anywhere to open
          the library dialog — that's the entry to every flow. */}
      {url ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative block aspect-video w-full overflow-hidden rounded-md border bg-muted transition-all hover:border-primary"
        >
          <img
            src={url}
            alt={alt}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100 focus-visible:opacity-100">
            <ImageIcon className="me-2 h-4 w-4" />
            {isAr ? "تغيير الصورة" : "Change image"}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!storeId}
          className={cn(
            "flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed bg-muted/40 text-sm text-muted-foreground transition-colors",
            "hover:border-primary/40 hover:bg-muted/60",
          )}
        >
          <ImageIcon className="h-6 w-6" />
          <span className="font-medium">
            {isAr ? "اختر صورة" : "Choose image"}
          </span>
          <span className="text-xs">
            {isAr ? "مكتبة • رفع • رابط" : "Library • Upload • URL"}
          </span>
        </button>
      )}

      {/* Action row — keeps the most-common shortcuts close to the
          preview so the merchant doesn't have to open the dialog
          just to remove an image. */}
      {url && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setOpen(true)}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            {isAr ? "تغيير" : "Change"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => onChange("")}
          >
            {isAr ? "إزالة" : "Remove"}
          </Button>
          {alt && (
            <span
              className="ms-auto truncate text-[10px] text-muted-foreground"
              title={alt}
            >
              alt: {alt}
            </span>
          )}
        </div>
      )}

      <MediaLibraryDialog
        open={open}
        onOpenChange={setOpen}
        value={value}
        onChange={onChange}
        locale={locale}
        storeId={storeId}
      />
    </div>
  );
}

function ResourcePickerButton({
  value,
  locale,
  onChange,
  resourceType,
  icon,
}: {
  value: string;
  locale: EditorLocale;
  onChange: (v: unknown) => void;
  resourceType: "product" | "collection";
  icon: React.ReactNode;
}) {
  const labels = {
    product: { en: "Select product...", ar: "اختر منتجاً..." },
    collection: { en: "Select collection...", ar: "اختر مجموعة..." },
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={() => {
          // TODO: Open resource picker dialog
          // For now, use a prompt as placeholder
          const id = window.prompt(
            locale === "ar"
              ? `أدخل معرف ال${resourceType === "product" ? "منتج" : "مجموعة"}:`
              : `Enter ${resourceType} ID:`,
            value,
          );
          if (id !== null) onChange(id);
        }}
      >
        {icon}
        <span className="truncate text-muted-foreground">
          {value || labels[resourceType][locale]}
        </span>
      </Button>
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive"
          onClick={() => onChange("")}
        >
          {locale === "ar" ? "إزالة" : "Remove"}
        </Button>
      )}
    </div>
  );
}

function FileUploadPicker({
  value,
  locale,
  onChange,
  storeId,
}: {
  value: string;
  locale: EditorLocale;
  onChange: (v: unknown) => void;
  storeId?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Track the original filename for display ("contract.pdf" beats showing
  // a hashed CDN URL). We only know it post-upload and lose it on
  // page refresh, but the URL itself is enough to render the picker
  // in a sane state on subsequent visits.
  const [filename, setFilename] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File) => {
    if (!storeId) {
      setUploadError(
        locale === "ar"
          ? "تعذّر الرفع: المتجر غير معروف."
          : "Upload failed: store context missing.",
      );
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadStoreAsset(storeId, file, "generic_file");
      onChange(result.url);
      setFilename(result.filename || file.name);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : locale === "ar"
            ? "فشل الرفع"
            : "Upload failed",
      );
    } finally {
      setUploading(false);
      // Reset the input so picking the same file twice fires onChange.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const displayName = filename || (value ? value.split("/").pop() : "");

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {value && (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate underline-offset-2 hover:underline"
              title={value}
            >
              {displayName || value}
            </a>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => {
              onChange("");
              setFilename(null);
            }}
          >
            {locale === "ar" ? "إزالة" : "Remove"}
          </Button>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || !storeId}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {uploading
            ? locale === "ar"
              ? "جاري الرفع..."
              : "Uploading..."
            : locale === "ar"
              ? "اختر ملفاً"
              : "Choose file"}
        </Button>
        <Input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            locale === "ar"
              ? "أو الصق رابط ملف"
              : "or paste a file URL"
          }
          className="flex-1"
          disabled={uploading}
        />
      </div>

      {uploadError && (
        <p className="text-[11px] text-destructive">{uploadError}</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {locale === "ar"
          ? "يدعم PDF، الخطوط، الفيديو، الصوت، والصور (حد أقصى 10 ميجابايت)."
          : "Supports PDFs, fonts, video, audio, and images (10MB max)."}
      </p>
    </div>
  );
}

// ─── Resource pickers (real, search-backed) ─────────────────────────────────

/** Adapt the shared ResourceSearchPicker to product results. Memoizes
 * the search/resolve callbacks so a parent re-render doesn't churn the
 * picker's debounce loop. */
function ProductPicker({
  value,
  locale,
  onChange,
  storeId,
  multi = false,
  maxItems,
}: {
  value: string | string[];
  locale: EditorLocale;
  onChange: (v: unknown) => void;
  storeId?: string;
  multi?: boolean;
  maxItems?: number;
}) {
  const searchFn = useCallback(
    async (q: string): Promise<ResourceSearchItem[]> => {
      if (!storeId) return [];
      const res = await listProducts(storeId, { search: q, limit: 20 });
      const items = (res?.items ?? res?.data ?? res?.products ?? res ?? []) as Array<{
        id: string;
        name?: string;
        slug?: string;
        sku?: string;
        price?: number | string;
        primary_image?: string | null;
        images?: Array<string | { url?: string }>;
      }>;
      return items.map((p) => ({
        id: p.id,
        label: p.name || p.sku || p.id,
        sublabel: p.sku ? `SKU ${p.sku}` : p.slug || undefined,
        image:
          p.primary_image ||
          (typeof p.images?.[0] === "string"
            ? (p.images[0] as string)
            : (p.images?.[0] as { url?: string })?.url) ||
          null,
      }));
    },
    [storeId],
  );

  const resolveById = useCallback(
    async (id: string): Promise<ResourceSearchItem | null> => {
      if (!storeId) return null;
      try {
        // Reuse list with a short page; cheaper than fetching one-by-one
        // for the common "value already cached on storeApi" path.
        const res = await listProducts(storeId, { search: id, limit: 5 });
        const items = (res?.items ?? res?.data ?? res?.products ?? []) as Array<{
          id: string;
          name?: string;
          sku?: string;
          slug?: string;
          primary_image?: string | null;
        }>;
        const found = items.find((p) => p.id === id);
        if (!found) return null;
        return {
          id: found.id,
          label: found.name || found.sku || found.id,
          sublabel: found.sku ? `SKU ${found.sku}` : found.slug || undefined,
          image: found.primary_image || null,
        };
      } catch {
        return null;
      }
    },
    [storeId],
  );

  return (
    <ResourceSearchPicker
      value={value}
      onChange={onChange as (n: string | string[]) => void}
      locale={locale}
      searchFn={searchFn}
      resolveById={resolveById}
      multi={multi}
      maxItems={maxItems}
      icon={<Package className="h-4 w-4" />}
      emptyLabel={{ en: "Search products...", ar: "ابحث عن منتجات..." }}
    />
  );
}

function CollectionPicker({
  value,
  locale,
  onChange,
  storeId,
  multi = false,
  maxItems,
}: {
  value: string | string[];
  locale: EditorLocale;
  onChange: (v: unknown) => void;
  storeId?: string;
  multi?: boolean;
  maxItems?: number;
}) {
  // Categories api doesn't accept a search query — we fetch the full
  // list (small in practice; merchants typically have <50 categories)
  // and filter client-side. If the category count grows, swap to a
  // backend search endpoint without changing the picker's interface.
  const searchFn = useCallback(
    async (q: string): Promise<ResourceSearchItem[]> => {
      if (!storeId) return [];
      const list = await listCategories(storeId).catch(() => [] as Array<{
        id: string;
        name: string;
        slug?: string;
        image_url?: string | null;
      }>);
      const lower = q.toLowerCase();
      return list
        .filter(
          (c) =>
            !lower ||
            c.name.toLowerCase().includes(lower) ||
            (c.slug || "").toLowerCase().includes(lower),
        )
        .slice(0, 30)
        .map((c) => ({
          id: c.id,
          label: c.name,
          sublabel: c.slug,
          image: c.image_url || null,
        }));
    },
    [storeId],
  );

  const resolveById = useCallback(
    async (id: string): Promise<ResourceSearchItem | null> => {
      if (!storeId) return null;
      try {
        const list = await listCategories(storeId);
        const found = list.find((c) => c.id === id);
        if (!found) return null;
        return {
          id: found.id,
          label: found.name,
          sublabel: found.slug,
          image: found.image_url || null,
        };
      } catch {
        return null;
      }
    },
    [storeId],
  );

  return (
    <ResourceSearchPicker
      value={value}
      onChange={onChange as (n: string | string[]) => void}
      locale={locale}
      searchFn={searchFn}
      resolveById={resolveById}
      multi={multi}
      maxItems={maxItems}
      icon={<FolderOpen className="h-4 w-4" />}
      emptyLabel={{
        en: "Search collections...",
        ar: "ابحث عن مجموعات...",
      }}
    />
  );
}

// ─── Inline rich-text (single-line WYSIWYG) ─────────────────────────────────

/**
 * Single-line WYSIWYG. ContentEditable span with bold/italic toolbars
 * and an HTML escape hatch. Stored value is a tiny HTML string —
 * `<b>Bold</b> normal`. The theme renders via the SDK's `<RichText>`
 * sanitizer, so even hand-pasted HTML is safe.
 *
 * Why not a regular text input: themes that mix emphasis ("Welcome
 * **back**, Ahmed") have no way to express it in plain text without
 * running through the merchant's editor. This control gives them
 * inline formatting without committing to a full block-level richtext.
 */
function InlineRichTextField({
  value,
  locale,
  onChange,
  placeholder,
}: {
  value: string;
  locale: EditorLocale;
  onChange: (v: unknown) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Keep the contentEditable in sync with the external value when it
  // changes from outside (e.g. theme reset). We avoid setting innerHTML
  // on every onChange because that resets the caret position.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  const exec = useCallback((cmd: "bold" | "italic") => {
    document.execCommand(cmd, false);
    // Read back; execCommand mutates DOM, so the next state is in
    // ref.current.innerHTML.
    const el = ref.current;
    if (el) onChange(el.innerHTML);
  }, [onChange]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 rounded-t-md border border-b-0 bg-muted/30 px-2 py-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("bold")}
          title={locale === "ar" ? "غامق" : "Bold"}
        >
          <Bold className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("italic")}
          title={locale === "ar" ? "مائل" : "Italic"}
        >
          <Italic className="h-3 w-3" />
        </Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="false"
        aria-label={placeholder || (locale === "ar" ? "نص" : "Text")}
        dir={locale === "ar" ? "rtl" : "ltr"}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        onKeyDown={(e) => {
          // Strip newlines — single-line. Enter triggers blur instead so
          // it works as a "submit" affordance.
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLDivElement).blur();
          }
        }}
        data-placeholder={
          placeholder || (locale === "ar" ? "اكتب هنا..." : "Type here...")
        }
        className={cn(
          "min-h-[36px] rounded-b-md border bg-background px-3 py-2 text-sm outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "empty:before:text-muted-foreground/50 empty:before:content-[attr(data-placeholder)]",
        )}
      />
    </div>
  );
}

// ─── Color scheme picker + group editor ─────────────────────────────────────

/**
 * Picks a single scheme by id from the global `color_scheme_group`
 * setting. Renders a swatch grid keyed by scheme id; falls back to a
 * free-text input when no schemes are defined yet.
 */
function ColorSchemePicker({
  value,
  locale,
  onChange,
}: {
  value: string;
  locale: EditorLocale;
  onChange: (v: unknown) => void;
}) {
  // Read schemes off the live draft. We can't compute this at module
  // scope because the global_settings shape is theme-defined: we look
  // for the first global_settings key whose value is a non-empty
  // ColorSchemeValue[]-shaped array.
  const draft = useCustomizerStore((s) => s.draft);
  const schemes: ColorSchemeValue[] = (() => {
    const globals = (draft?.global_settings ?? {}) as Record<string, unknown>;
    for (const v of Object.values(globals)) {
      if (
        Array.isArray(v) &&
        v.length > 0 &&
        typeof v[0] === "object" &&
        v[0] !== null &&
        "colors" in (v[0] as object)
      ) {
        return v as ColorSchemeValue[];
      }
    }
    return [];
  })();

  if (schemes.length === 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={value}
            placeholder="scheme-1"
            onChange={(e) => onChange(e.target.value)}
            className="flex-1"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {locale === "ar"
            ? "لم يتم تعريف مجموعات ألوان بعد — اضبطها في الإعدادات العامة."
            : "No color schemes defined yet — set them up in Global settings."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {schemes.map((scheme) => {
        const selected = value === scheme.id;
        const swatches = Object.values(scheme.colors).slice(0, 4);
        return (
          <button
            key={scheme.id}
            type="button"
            onClick={() => onChange(scheme.id)}
            className={cn(
              "flex items-center gap-2 rounded-md border p-2 text-left text-xs transition-colors",
              selected
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50",
            )}
          >
            <div className="flex shrink-0 -space-x-1">
              {swatches.map((c, i) => (
                <span
                  key={i}
                  className="h-4 w-4 rounded-full border border-background"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <span className="truncate font-medium">{scheme.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Editor for a `color_scheme_group` setting (lives on global_settings).
 * Stored value is a `ColorSchemeValue[]` — array of named palettes
 * with per-role colors.
 *
 * UX: list of expandable scheme cards, each with a name input and one
 * color picker per role. "Add scheme" appends a new entry with default
 * colors; "Remove" drops it (warning when other settings reference its
 * id is out of scope here — the storefront falls back to the first
 * scheme on miss).
 */
function ColorSchemeGroupEditor({
  value,
  locale,
  onChange,
  colorRoles,
}: {
  value: ColorSchemeValue[];
  locale: EditorLocale;
  onChange: (v: unknown) => void;
  colorRoles: string[];
}) {
  const update = useCallback(
    (next: ColorSchemeValue[]) => {
      onChange(next);
    },
    [onChange],
  );

  const addScheme = useCallback(() => {
    const id = `scheme-${value.length + 1}`;
    const defaultColors: Record<string, string> = {};
    for (const r of colorRoles) {
      defaultColors[r] =
        r === "background" ? "#ffffff" : r === "text" ? "#111111" : "#888888";
    }
    update([
      ...value,
      {
        id,
        name: locale === "ar" ? `مجموعة ${value.length + 1}` : `Scheme ${value.length + 1}`,
        colors: defaultColors,
      },
    ]);
  }, [value, colorRoles, locale, update]);

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          {locale === "ar"
            ? "لا توجد مجموعات ألوان بعد. أضف واحدة لتبدأ."
            : "No color schemes yet. Add one to get started."}
        </p>
      )}
      {value.map((scheme, idx) => (
        <div
          key={scheme.id}
          className="space-y-2 rounded-md border bg-muted/10 p-2"
        >
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={scheme.name}
              onChange={(e) => {
                const next = [...value];
                next[idx] = { ...scheme, name: e.target.value };
                update(next);
              }}
              placeholder={locale === "ar" ? "اسم المجموعة" : "Scheme name"}
              className="h-7 flex-1 text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={() => update(value.filter((_, i) => i !== idx))}
              title={locale === "ar" ? "حذف" : "Remove"}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <p className="px-1 font-mono text-[10px] text-muted-foreground">
            id: {scheme.id}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {colorRoles.map((role) => (
              <label key={role} className="flex items-center gap-2">
                <input
                  type="color"
                  value={scheme.colors[role] ?? "#000000"}
                  onChange={(e) => {
                    const next = [...value];
                    next[idx] = {
                      ...scheme,
                      colors: { ...scheme.colors, [role]: e.target.value },
                    };
                    update(next);
                  }}
                  className="h-7 w-7 cursor-pointer rounded-md border border-input p-0.5"
                  title={role}
                  aria-label={`${scheme.name} ${role} color`}
                />
                <span className="truncate text-[11px]">{role}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={addScheme}
      >
        <Plus className="h-3.5 w-3.5" />
        {locale === "ar" ? "إضافة مجموعة" : "Add scheme"}
      </Button>
    </div>
  );
}

// ─── Font list ──────────────────────────────────────────────────────────────

const COMMON_FONTS = [
  "Inter",
  "Cairo",
  "Tajawal",
  "Noto Sans Arabic",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Playfair Display",
  "Merriweather",
  "Source Sans Pro",
  "Raleway",
  "Nunito",
  "IBM Plex Sans",
  "DM Sans",
];
