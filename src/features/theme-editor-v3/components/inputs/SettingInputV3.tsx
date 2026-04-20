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

import { useState, useCallback } from "react";
import type { SettingDefinition, EditorLocale } from "../../types";
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
import { ImageIcon, Link2, Package, FolderOpen, Type } from "lucide-react";

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
