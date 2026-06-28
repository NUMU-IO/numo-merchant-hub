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
import { listProducts, getProduct, apiToProduct } from "@/services/productApi";
import { listCategories } from "@/services/categoryApi";
import { listMenus } from "@/services/menusApi";
import { listPages } from "@/services/pagesApi";
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
  Underline,
  ListOrdered,
  RemoveFormatting,
  Plus,
  Trash2,
  Crop,
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
  getImageTransform,
  type ImageValue,
} from "./MediaLibraryDialog";
import { FocalPointEditor } from "./FocalPointEditor";
import type { ImageTransform } from "./imageTransform";
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
    // Phase 3.1 — block-level WYSIWYG (bold/italic/underline/lists/link +
    // view-source). Stored value is sanitized HTML; the storefront renders
    // it via the SDK's <RichText> (which re-sanitizes). Existing raw
    // markdown/HTML values still load (shown as-is, editable).
    case "richtext":
      return wrapper(
        <RichTextField
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
          placeholder={placeholder}
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

    // ── Icon picker ───────────────────────────────────────────────────
    // Searchable grid of the shared icon set. Value = icon name string; the
    // storefront renders the same name via the SDK's <Icon/>, so the chosen
    // glyph matches this preview exactly. Previously fell through to the
    // "unrecognized type" text fallback (no icon control existed).
    case "icon":
    case "icon_picker":
      return wrapper(
        <IconPickerButton
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
          // Optional per-setting aspect (e.g. "4/5", "16/9") so the focal-point
          // editor's viewport matches the real storefront container. Falls back
          // to 1/1 when the theme schema doesn't declare one.
          aspectRatio={(setting as unknown as { aspect_ratio?: string }).aspect_ratio}
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
    // Phase 3.2 — upload (R2 via the assets pipeline) OR paste a
    // YouTube/Vimeo/MP4 URL, plus an optional poster image. Stored value
    // is `{ url, poster }` (a legacy plain-string url still loads).
    case "video_picker":
      return wrapper(
        <VideoPickerField
          value={value}
          locale={locale}
          onChange={onChange}
          storeId={storeId}
          placeholder={placeholder}
        />,
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
    // ── Link list (navigation menu) picker ────────────────────────────
    // Real dropdown of the store's menus (Phase 2). Value = menu handle;
    // the theme renders that menu via useNavigation(handle).
    case "link_list_picker":
      return wrapper(
        <LinkListPicker
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
          storeId={storeId}
        />,
      );

    // ── Page picker (Phase 4.4b — real Pages model) ───────────────────
    // Dropdown of the store's content pages. Value = page handle; the
    // theme links to /pages/<handle>.
    case "page_picker":
      return wrapper(
        <PagePicker
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
          storeId={storeId}
        />,
      );

    // ── Blog picker (dependency-flagged) ──────────────────────────────
    // NUMU has no Blog model yet — accepts a free-form handle so themes
    // declaring it don't crash; the helper text makes the pending
    // dependency explicit (not a silent stub).
    case "blog_picker":
      return wrapper(
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <List className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={(value as string) ?? ""}
              placeholder={placeholder || "handle"}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1"
            />
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            {locale === "ar"
              ? "أدخل المعرّف مؤقتًا — منتقي المدوّنات يصل مع نموذج المدوّنة."
              : "Enter a handle for now — a real picker arrives with the Blog model."}
          </p>
        </div>,
      );

    // ── 23. Variant picker ────────────────────────────────────────────
    // Phase 3.3 — two-step: pick a product (search), then choose one of its
    // variant options. NUMU models variants as option groups
    // (Color: Red/Blue, Size: S/M/L), so the value is
    //   { product_id, variant_id }
    // where variant_id is a `"<group>:<option>"` key (empty = product only).
    case "variant_picker":
      return wrapper(
        <VariantPickerField
          value={value}
          locale={locale}
          onChange={onChange}
          storeId={storeId}
        />,
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

// ─── Icon Picker ────────────────────────────────────────────────────────────
//
// The icon set for the `icon_picker` / `icon` setting type. The keys + inner
// SVG MUST stay byte-identical to the SDK's ICON_DEFS in
// numu-theme-sdk/src/components/Icon.tsx — the storefront renders the picked
// name via the SDK's <Icon/>, so the glyph here and there must match. (We
// duplicate rather than import the SDK because the editor can't depend on the
// SDK's unpublished build.)
const ICON_DEFS: Record<string, string> = {
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  "check-circle": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  "shield-check":
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  truck:
    '<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  "shopping-bag":
    '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  "shopping-cart":
    '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  gift:
    '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C9 3 10.5 4.5 12 8c1.5-3.5 3-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  tag: '<path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  sparkles:
    '<path d="M12 3 13.9 9.2 20 11l-6.1 1.8L12 19l-1.9-6.2L4 11l6.1-1.8L12 3Z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/>',
  flame:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/>',
  leaf:
    '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>',
  globe:
    '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/>',
  "map-pin":
    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>',
  mail:
    '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  lock:
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  headphones:
    '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
  percent:
    '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  home:
    '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  store:
    '<path d="M2 7l2-4h16l2 4"/><path d="M4 7v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7"/><path d="M2 7h20"/><path d="M9 21v-6h6v6"/>',
  bell:
    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  camera:
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  image:
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  smile:
    '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  "message-circle":
    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  package:
    '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  award:
    '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  coffee:
    '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M6 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>',
};

const ICON_NAMES = Object.keys(ICON_DEFS);

function EditorIcon({ name, size = 20 }: { name: string; size?: number }) {
  const inner = ICON_DEFS[name] ?? ICON_DEFS["check-circle"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

function IconPickerButton({
  value,
  locale,
  onChange,
}: {
  value: string;
  locale: EditorLocale;
  onChange: (v: unknown) => void;
}) {
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q ? ICON_NAMES.filter((n) => n.includes(q)) : ICON_NAMES;

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2"
        onClick={() => setOpen((o) => !o)}
      >
        {value ? <EditorIcon name={value} size={16} /> : <ImageIcon className="h-4 w-4" />}
        <span className="truncate">
          {value || (isAr ? "اختر أيقونة..." : "Choose icon...")}
        </span>
      </Button>
      {open && (
        <div className="rounded-md border bg-popover p-3 shadow-md">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isAr ? "ابحث عن أيقونة" : "Search icons"}
            className="mb-2"
            dir={isAr ? "rtl" : "ltr"}
          />
          <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
            {filtered.map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={name}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md border text-foreground transition-colors hover:bg-accent",
                  value === name
                    ? "border-primary bg-primary/10"
                    : "border-transparent",
                )}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
              >
                <EditorIcon name={name} />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-6 py-3 text-center text-xs text-muted-foreground">
                {isAr ? "لا توجد نتائج" : "No icons match"}
              </p>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            {value && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                {isAr ? "مسح" : "Clear"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              {isAr ? "إغلاق" : "Close"}
            </Button>
          </div>
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
  aspectRatio,
}: {
  value: ImageValue | undefined;
  locale: EditorLocale;
  onChange: (v: unknown) => void;
  storeId?: string;
  aspectRatio?: string;
}) {
  // P1.3 — Thin wrapper around <MediaLibraryDialog>. The button shows
  // a preview tile (or empty drop-zone) plus a row of actions
  // (Choose / Replace / Adjust / Remove). All of the upload/drag-drop/URL-
  // paste logic lives in the dialog now so the inline UI stays
  // compact even on dense forms.
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
  const [focalOpen, setFocalOpen] = useState(false);
  const url = getImageUrl(value);
  const alt = getImageAlt(value);
  const transform = getImageTransform(value);

  // Commit a focal/zoom/rotation edit. Identity (undefined) drops the transform
  // and reverts to the backwards-compatible string / { url, alt } shape — the
  // original asset URL is never changed, only the metadata around it.
  const handleApplyTransform = (next: ImageTransform | undefined) => {
    if (next) onChange({ url, ...(alt ? { alt } : {}), transform: next });
    else onChange(alt ? { url, alt } : url);
  };

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
            type="button"
            variant="outline"
            size="sm"
            className={cn("gap-1.5", transform && "border-primary text-primary")}
            onClick={() => setFocalOpen(true)}
            title={isAr ? "ضبط الإطار / نقطة التركيز" : "Adjust framing / focal point"}
          >
            <Crop className="h-3.5 w-3.5" />
            {isAr ? "ضبط" : "Adjust"}
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

      {url && (
        <FocalPointEditor
          open={focalOpen}
          onOpenChange={setFocalOpen}
          url={url}
          alt={alt}
          aspectRatio={aspectRatio || "1/1"}
          value={transform}
          onApply={handleApplyTransform}
          locale={locale}
        />
      )}
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
function LinkListPicker({
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
  const isAr = locale === "ar";
  const [menus, setMenus] = useState<
    { handle: string; title?: Record<string, string> }[]
  >([]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    listMenus(storeId)
      .then((res) => {
        if (!cancelled) setMenus(res ?? []);
      })
      .catch(() => {
        /* leave empty — the merchant can still create menus */
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  return (
    <div className="space-y-1.5">
      <Select value={value || undefined} onValueChange={(v) => onChange(v)}>
        <SelectTrigger>
          <SelectValue placeholder={isAr ? "اختر قائمة" : "Select a menu"} />
        </SelectTrigger>
        <SelectContent>
          {menus.map((m) => (
            <SelectItem key={m.handle} value={m.handle}>
              {(m.title && (m.title[locale] || m.title.en)) || m.handle}
            </SelectItem>
          ))}
          {menus.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {isAr ? "لا توجد قوائم بعد" : "No menus yet"}
            </div>
          )}
        </SelectContent>
      </Select>
      <a
        href="/online-store/navigation"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
      >
        <Plus className="h-3 w-3" />
        {isAr ? "إنشاء / إدارة القوائم" : "Create / manage menus"}
      </a>
    </div>
  );
}

// ── Page picker (Phase 4.4b) ─────────────────────────────────────────────
// Dropdown of the store's content pages; value = page handle. Mirrors
// LinkListPicker. The theme links to /pages/<handle>.
function PagePicker({
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
  const isAr = locale === "ar";
  const [pages, setPages] = useState<
    { handle: string; title?: Record<string, string> }[]
  >([]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    listPages(storeId)
      .then((res) => {
        if (!cancelled) setPages(res ?? []);
      })
      .catch(() => {
        /* leave empty — the merchant can still create pages */
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  return (
    <div className="space-y-1.5">
      <Select value={value || undefined} onValueChange={(v) => onChange(v)}>
        <SelectTrigger>
          <SelectValue placeholder={isAr ? "اختر صفحة" : "Select a page"} />
        </SelectTrigger>
        <SelectContent>
          {pages.map((p) => (
            <SelectItem key={p.handle} value={p.handle}>
              {(p.title && (p.title[locale] || p.title.en)) || p.handle}
            </SelectItem>
          ))}
          {pages.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {isAr ? "لا توجد صفحات بعد" : "No pages yet"}
            </div>
          )}
        </SelectContent>
      </Select>
      <a
        href="/online-store/pages"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
      >
        <Plus className="h-3 w-3" />
        {isAr ? "إنشاء / إدارة الصفحات" : "Create / manage pages"}
      </a>
    </div>
  );
}

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

// ─── Block-level rich text (WYSIWYG) ────────────────────────────────────────

const RICHTEXT_ALLOWED_TAGS = new Set([
  "B", "STRONG", "I", "EM", "U", "A", "UL", "OL", "LI", "P", "BR", "SPAN",
  "DIV", "H1", "H2", "H3", "H4", "BLOCKQUOTE",
]);

/**
 * Defense-in-depth sanitize for editor-produced rich-text HTML. The
 * storefront's `<RichText>` re-sanitizes authoritatively at render; this
 * keeps the stored draft clean by stripping the obvious sinks
 * (script/style/iframe, on* handlers, javascript: URLs, inline styles) and
 * unwrapping unknown tags. DOM-based, not regex, for correctness.
 */
function sanitizeRichText(html: string): string {
  if (typeof document === "undefined" || !html) return html ?? "";
  const root = document.createElement("div");
  root.innerHTML = html;
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toUpperCase();
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"].includes(tag)) {
        child.remove();
        continue;
      }
      if (!RICHTEXT_ALLOWED_TAGS.has(tag)) {
        walk(child); // sanitize descendants first
        child.replaceWith(...Array.from(child.childNodes)); // unwrap
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        const drop =
          name.startsWith("on") ||
          name === "style" ||
          ((name === "href" || name === "src") &&
            /^\s*javascript:/i.test(attr.value));
        if (drop) child.removeAttribute(attr.name);
      }
      if (tag === "A") child.setAttribute("rel", "noopener noreferrer");
      walk(child);
    }
  };
  walk(root);
  return root.innerHTML;
}

/**
 * Block-level WYSIWYG for the `richtext` setting type (Phase 3.1).
 * Toolbar: bold/italic/underline, bullet/ordered lists, link, clear
 * formatting, + a view-source toggle. Bilingual + RTL-aware. Stored value
 * is sanitized HTML; existing raw markdown/HTML values still load.
 */
function RichTextField({
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
  const isAr = locale === "ar";
  const ref = useRef<HTMLDivElement | null>(null);
  const [showSource, setShowSource] = useState(false);

  // Keep the contentEditable synced with external value changes (theme
  // reset, source-toggle round-trip) without clobbering the caret mid-type.
  useEffect(() => {
    const el = ref.current;
    if (!el || showSource) return;
    if (el.innerHTML !== (value || "")) el.innerHTML = value || "";
  }, [value, showSource]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (el) onChange(sanitizeRichText(el.innerHTML));
  }, [onChange]);

  const exec = useCallback(
    (cmd: string, arg?: string) => {
      document.execCommand(cmd, false, arg);
      emit();
    },
    [emit],
  );

  const addLink = useCallback(() => {
    const url = window.prompt(isAr ? "رابط:" : "Link URL:", "https://");
    if (url) exec("createLink", url);
  }, [exec, isAr]);

  const ToolbarBtn = ({
    cmd,
    icon: Icon,
    title,
  }: {
    cmd: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      disabled={showSource}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => (cmd === "createLink" ? addLink() : exec(cmd))}
      title={title}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 bg-muted/30 px-1.5 py-1">
        <ToolbarBtn cmd="bold" icon={Bold} title={isAr ? "غامق" : "Bold"} />
        <ToolbarBtn cmd="italic" icon={Italic} title={isAr ? "مائل" : "Italic"} />
        <ToolbarBtn cmd="underline" icon={Underline} title={isAr ? "تسطير" : "Underline"} />
        <span className="mx-1 h-4 w-px bg-border" />
        <ToolbarBtn cmd="insertUnorderedList" icon={List} title={isAr ? "قائمة نقطية" : "Bullet list"} />
        <ToolbarBtn cmd="insertOrderedList" icon={ListOrdered} title={isAr ? "قائمة مرقّمة" : "Numbered list"} />
        <ToolbarBtn cmd="createLink" icon={Link2} title={isAr ? "رابط" : "Link"} />
        <ToolbarBtn cmd="removeFormat" icon={RemoveFormatting} title={isAr ? "مسح التنسيق" : "Clear formatting"} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("ms-auto h-7 w-7", showSource && "bg-primary/10 text-primary")}
          onClick={() => setShowSource((s) => !s)}
          title={isAr ? "عرض الكود" : "View source"}
        >
          <Code className="h-3.5 w-3.5" />
        </Button>
      </div>
      {showSource ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          className="rounded-t-none font-mono text-xs"
          dir="ltr"
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder || (isAr ? "نص منسّق" : "Rich text")}
          dir={isAr ? "rtl" : "ltr"}
          onInput={emit}
          onBlur={emit}
          data-placeholder={placeholder || (isAr ? "اكتب هنا..." : "Type here...")}
          className={cn(
            "min-h-[120px] rounded-b-md border bg-background px-3 py-2 text-sm outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring",
            "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-5 [&_ol]:ps-5",
            "empty:before:text-muted-foreground/50 empty:before:content-[attr(data-placeholder)]",
          )}
        />
      )}
    </div>
  );
}

// ─── Video picker (upload + URL + poster) ───────────────────────────────────

/**
 * `video_picker` (Phase 3.2). Upload an MP4 to R2 via the assets pipeline
 * OR paste a YouTube/Vimeo/MP4 URL, with an optional poster image. Stored
 * value is `{ url, poster }`; a legacy plain-string url still loads.
 */
function VideoPickerField({
  value,
  locale,
  onChange,
  storeId,
  placeholder,
}: {
  value: unknown;
  locale: EditorLocale;
  onChange: (v: unknown) => void;
  storeId?: string;
  placeholder?: string;
}) {
  const isAr = locale === "ar";
  const current =
    value && typeof value === "object"
      ? (value as { url?: string; poster?: unknown })
      : { url: typeof value === "string" ? value : "", poster: undefined };
  const url = current.url ?? "";
  const poster = current.poster as ImageValue | undefined;

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const setUrl = (next: string) => onChange({ ...current, url: next });
  const setPoster = (next: unknown) =>
    onChange({ ...current, poster: next || undefined });

  const handleFile = async (file: File) => {
    if (!storeId) {
      setUploadError(
        isAr ? "تعذّر الرفع: المتجر غير معروف." : "Upload failed: store context missing.",
      );
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadStoreAsset(storeId, file, "generic_file");
      setUrl(result.url);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : isAr ? "فشل الرفع" : "Upload failed",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const isDirectVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <div className="flex items-center gap-2">
        <Film className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          type="url"
          value={url}
          placeholder={placeholder || "https://youtu.be/… or …/video.mp4"}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1"
          disabled={uploading}
        />
      </div>
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
            ? isAr ? "جاري الرفع..." : "Uploading..."
            : isAr ? "رفع فيديو" : "Upload video"}
        </Button>
        {url && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setUrl("")}
          >
            {isAr ? "إزالة" : "Remove"}
          </Button>
        )}
      </div>
      {uploadError && <p className="text-[11px] text-destructive">{uploadError}</p>}
      {isDirectVideo && (
        <video
          src={url}
          controls
          className="w-full rounded-md border"
          style={{ maxHeight: 160 }}
        />
      )}
      <div className="space-y-1 pt-1">
        <Label className="text-xs text-muted-foreground">
          {isAr ? "صورة الغلاف (اختياري)" : "Poster image (optional)"}
        </Label>
        <ImagePickerButton
          value={poster}
          locale={locale}
          onChange={setPoster}
          storeId={storeId}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {isAr
          ? "يدعم YouTube و Vimeo و MP4 — ارفع ملفاً أو الصق رابطاً."
          : "Supports YouTube, Vimeo, and MP4 — upload a file or paste a URL."}
      </p>
    </div>
  );
}

// ─── Variant picker (product → option) ──────────────────────────────────────

/**
 * Two-step variant picker (Phase 3.3). Pick a product, then one of its
 * variant options. NUMU models variants as option groups, so a "variant"
 * is a `"<group>:<option>"` key (e.g. "Color:Red"). Stored value:
 *   { product_id: string, variant_id: string }
 * (variant_id is "" when only the product is chosen).
 */
function VariantPickerField({
  value,
  locale,
  onChange,
  storeId,
}: {
  value: unknown;
  locale: EditorLocale;
  onChange: (v: unknown) => void;
  storeId?: string;
}) {
  const isAr = locale === "ar";
  const current =
    value && typeof value === "object"
      ? (value as { product_id?: string; variant_id?: string })
      : {};
  const productId = current.product_id ?? "";
  const variantId = current.variant_id ?? "";

  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId || !productId) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getProduct(storeId, productId)
      .then((res) => {
        const product = apiToProduct(res);
        const flat: { value: string; label: string }[] = [];
        for (const group of product.variants ?? []) {
          const opts = group.options ?? [];
          const optsAr = group.optionsAr ?? [];
          opts.forEach((opt, i) => {
            const groupName = isAr ? group.nameAr || group.name : group.name;
            const optLabel = isAr ? optsAr[i] || opt : opt;
            flat.push({ value: `${group.name}:${opt}`, label: `${groupName}: ${optLabel}` });
          });
        }
        if (!cancelled) setOptions(flat);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, productId, isAr]);

  return (
    <div className="space-y-2">
      <ProductPicker
        value={productId}
        locale={locale}
        onChange={(pid) => onChange({ product_id: (pid as string) ?? "", variant_id: "" })}
        storeId={storeId}
        multi={false}
      />
      {productId &&
        (options.length > 0 ? (
          <Select
            value={variantId || undefined}
            onValueChange={(vid) =>
              onChange({ product_id: productId, variant_id: vid })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={isAr ? "اختر خياراً" : "Choose a variant"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {loading
              ? isAr
                ? "جارٍ التحميل..."
                : "Loading…"
              : isAr
                ? "لا توجد خيارات لهذا المنتج."
                : "This product has no variant options."}
          </p>
        ))}
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
