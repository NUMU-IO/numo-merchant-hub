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

import { useRef, useState, useCallback } from "react";
import type { SettingDefinition, EditorLocale } from "../../types";
import { uploadStoreAsset } from "@/services/storeApi";
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
} from "lucide-react";

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

export function SettingInputV3({ setting, value, locale, onChange, storeId }: SettingInputV3Props) {
  const label = getLabel(setting, locale);
  const info = getInfo(setting, locale);
  const placeholder = getPlaceholder(setting, locale);
  const testId = `v3-setting-${setting.id.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

  const wrapper = (children: React.ReactNode, inline = false) => (
    <div className={cn("space-y-1.5", inline && "flex items-center justify-between gap-3")} data-testid={testId}>
      {!inline && (
        <Label className="text-sm font-medium text-foreground">{label}</Label>
      )}
      {inline && (
        <Label className="text-sm font-medium text-foreground flex-1">{label}</Label>
      )}
      {children}
      {info && !inline && (
        <p className="text-xs text-muted-foreground">{info}</p>
      )}
    </div>
  );

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
    case "font":
      return wrapper(
        <FontPickerButton
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
        />,
      );

    // ── 11. Image Picker ──────────────────────────────────────────────
    case "image_picker":
      return wrapper(
        <ImagePickerButton
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
          storeId={storeId}
        />,
      );

    // ── 12. URL ───────────────────────────────────────────────────────
    case "url":
      return wrapper(
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            type="url"
            value={(value as string) ?? ""}
            placeholder={placeholder || "https://..."}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1"
          />
        </div>,
      );

    // ── 13. Product ───────────────────────────────────────────────────
    case "product":
      return wrapper(
        <ResourcePickerButton
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
          resourceType="product"
          icon={<Package className="h-4 w-4" />}
        />,
      );

    // ── 14. Collection ────────────────────────────────────────────────
    case "collection":
      return wrapper(
        <ResourcePickerButton
          value={(value as string) ?? ""}
          locale={locale}
          onChange={onChange}
          resourceType="collection"
          icon={<FolderOpen className="h-4 w-4" />}
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

    // ── 21. Color scheme ──────────────────────────────────────────────
    // Selects from the theme's `color_schemes` global setting. Today
    // we render as a free-text input (the theme defines schemes by id
    // in settings_schema.json under a `color_scheme_group` setting,
    // which we'll wire when that ships); merchants type the scheme id
    // and the theme renders the matching palette.
    case "color_scheme":
      return wrapper(
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={(value as string) ?? ""}
            placeholder={placeholder || "scheme-1"}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1"
          />
        </div>,
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
    default:
      return wrapper(
        <Input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />,
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
  value: string;
  locale: EditorLocale;
  onChange: (v: unknown) => void;
  storeId?: string;
}) {
  const [urlInput, setUrlInput] = useState(value);

  return (
    <div className="space-y-2">
      {value && (
        <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
          <img
            src={value}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder={locale === "ar" ? "رابط الصورة" : "Image URL"}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(urlInput)}
        >
          <ImageIcon className="h-4 w-4" />
        </Button>
      </div>
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-destructive"
          onClick={() => { onChange(""); setUrlInput(""); }}
        >
          {locale === "ar" ? "إزالة الصورة" : "Remove image"}
        </Button>
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
