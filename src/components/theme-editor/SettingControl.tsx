/**
 * SettingControl — renders a single setting field based on its schema type.
 *
 * Supported types: text, textarea, color, checkbox, select, font, range, number, image, url.
 */

import { useEffect } from "react";
import type { SectionSettingDefinition } from "@/services/themeApi";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type SettingValue = string | number | boolean;

export interface SettingControlProps {
  setting: SectionSettingDefinition;
  value: SettingValue;
  onChange: (key: string, value: SettingValue) => void;
}

// ---------------------------------------------------------------------------
// Canonical font list — always show all 12 fonts regardless of what API sends
// ---------------------------------------------------------------------------
const CANONICAL_FONTS: Array<{ label: string; labelAr?: string; value: string }> = [
  { label: "Cairo", value: "Cairo" },
  { label: "Tajawal", value: "Tajawal" },
  { label: "IBM Plex Sans Arabic", value: "IBM Plex Sans Arabic" },
  { label: "Noto Sans Arabic", value: "Noto Sans Arabic" },
  { label: "El Messiri", value: "El Messiri" },
  { label: "Almarai", value: "Almarai" },
  { label: "Changa", value: "Changa" },
  { label: "Rubik", value: "Rubik" },
  { label: "Readex Pro", value: "Readex Pro" },
  { label: "Inter", value: "Inter" },
  { label: "Poppins", value: "Poppins" },
  { label: "Space Grotesk", value: "Space Grotesk" },
];

// ---------------------------------------------------------------------------
// Google Fonts dynamic loader (dashboard side)
// ---------------------------------------------------------------------------
const _dashLoadedFonts = new Set<string>();
const _fontsPreloaded = { done: false };

function ensureFontLoaded(fontFamily: string) {
  if (!fontFamily || _dashLoadedFonts.has(fontFamily)) return;
  _dashLoadedFonts.add(fontFamily);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}

function preloadAllCanonicalFonts() {
  if (_fontsPreloaded.done) return;
  _fontsPreloaded.done = true;
  const families = CANONICAL_FONTS.map(f => `family=${encodeURIComponent(f.value)}:wght@400;600;700`).join("&");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}

export function SettingControl({ setting, value, onChange }: SettingControlProps) {
  const displayLabel = setting.labelAr || setting.label;
  const resolvedValue = value ?? setting.default ?? "";

  return (
    <div className="space-y-1.5">
      {/* Label — except for checkbox which has its own inline label */}
      {setting.type !== "checkbox" && (
        <Label htmlFor={setting.key} className="text-sm font-medium">
          {displayLabel}
        </Label>
      )}

      {/* Description */}
      {setting.description && (
        <p className="text-xs text-muted-foreground">{setting.description}</p>
      )}

      {/* Control */}
      {renderControl(setting, resolvedValue, onChange)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal renderer per type
// ---------------------------------------------------------------------------

function renderControl(
  setting: SectionSettingDefinition,
  value: SettingValue,
  onChange: (key: string, value: SettingValue) => void,
) {
  // Font picker for any setting with _font key suffix (handles both type:"font" and type:"select")
  // Also triggers for type:"font" even without _font suffix
  const isFontSetting = setting.key.endsWith("_font") || setting.type === "font";
  if (isFontSetting) {
    return <FontPicker setting={setting} value={value} onChange={onChange} />;
  }

  switch (setting.type) {
    // ── Text ──────────────────────────────────────────────────────────────
    case "text":
      return (
        <Input
          id={setting.key}
          type="text"
          value={value as string}
          placeholder={setting.placeholder}
          onChange={(e) => onChange(setting.key, e.target.value)}
        />
      );

    // ── Textarea ─────────────────────────────────────────────────────────
    case "textarea":
      return (
        <Textarea
          id={setting.key}
          value={value as string}
          placeholder={setting.placeholder}
          rows={4}
          onChange={(e) => onChange(setting.key, e.target.value)}
        />
      );

    // ── Color ────────────────────────────────────────────────────────────
    case "color":
      return (
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="color"
              value={(value as string) || "#000000"}
              onChange={(e) => onChange(setting.key, e.target.value)}
              className="absolute inset-0 h-10 w-10 cursor-pointer opacity-0"
            />
            <div
              className="h-10 w-10 rounded-lg border border-input shadow-sm"
              style={{ backgroundColor: (value as string) || "#000000" }}
            />
          </div>
          <Input
            id={setting.key}
            type="text"
            value={value as string}
            placeholder="#000000"
            className="flex-1 font-mono text-sm"
            onChange={(e) => onChange(setting.key, e.target.value)}
          />
        </div>
      );

    // ── Checkbox (Switch toggle) ─────────────────────────────────────────
    case "checkbox":
      return (
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <Label
            htmlFor={setting.key}
            className="text-sm font-medium cursor-pointer"
          >
            {setting.labelAr || setting.label}
          </Label>
          <Switch
            id={setting.key}
            checked={!!value}
            onCheckedChange={(checked) => onChange(setting.key, checked)}
          />
        </div>
      );

    // ── Font ──────────────────────────────────────────────────────────────
    case "font":
      return <FontPicker setting={setting} value={value} onChange={onChange} />;

    // ── Select ───────────────────────────────────────────────────────────
    case "select":
      return (
        <Select
          value={value as string}
          onValueChange={(v) => onChange(setting.key, v)}
        >
          <SelectTrigger id={setting.key} className="w-full">
            <SelectValue placeholder={setting.placeholder || setting.labelAr || setting.label} />
          </SelectTrigger>
          <SelectContent>
            {(setting.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.labelAr || opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    // ── Range (Slider) ───────────────────────────────────────────────────
    case "range":
      return (
        <div className="flex items-center gap-3">
          <Slider
            id={setting.key}
            min={setting.min ?? 0}
            max={setting.max ?? 100}
            step={setting.step ?? 1}
            value={[typeof value === "number" ? value : Number(value) || 0]}
            onValueChange={([v]) => onChange(setting.key, v)}
            className="flex-1"
          />
          <span className="min-w-[3rem] text-end text-sm tabular-nums text-muted-foreground">
            {value}
            {setting.unit ? setting.unit : ""}
          </span>
        </div>
      );

    // ── Number ───────────────────────────────────────────────────────────
    case "number":
      return (
        <Input
          id={setting.key}
          type="number"
          value={value as number}
          min={setting.min}
          max={setting.max}
          step={setting.step ?? 1}
          placeholder={setting.placeholder}
          onChange={(e) => onChange(setting.key, Number(e.target.value))}
        />
      );

    // ── Image ────────────────────────────────────────────────────────────
    case "image":
      return (
        <div className="space-y-2">
          <Input
            id={setting.key}
            type="url"
            value={value as string}
            placeholder={setting.placeholder || "https://..."}
            onChange={(e) => onChange(setting.key, e.target.value)}
          />
          {value && (
            <div className="relative overflow-hidden rounded-lg border border-input">
              <img
                src={value as string}
                alt={setting.label}
                className="h-24 w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>
      );

    // ── URL ──────────────────────────────────────────────────────────────
    case "url":
      return (
        <Input
          id={setting.key}
          type="url"
          value={value as string}
          placeholder={setting.placeholder || "https://..."}
          onChange={(e) => onChange(setting.key, e.target.value)}
        />
      );

    // ── Fallback ─────────────────────────────────────────────────────────
    default:
      return (
        <Input
          id={setting.key}
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(setting.key, e.target.value)}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Font Picker — shows each option in its actual font with a live preview
// ---------------------------------------------------------------------------

function FontPicker({
  setting,
  value,
  onChange,
}: {
  setting: SectionSettingDefinition;
  value: SettingValue;
  onChange: (key: string, value: SettingValue) => void;
}) {
  // Always use canonical font list to guarantee all 12 fonts show
  const options = CANONICAL_FONTS;
  const currentValue = (value as string) || (setting.default as string) || "";

  // Preload all fonts in a single request
  useEffect(() => {
    preloadAllCanonicalFonts();
  }, []);

  return (
    <div className="space-y-2">
      {/* Current font preview */}
      <div
        className="rounded-lg border border-input bg-muted/30 p-3 text-center"
        style={{ fontFamily: `'${currentValue}', sans-serif` }}
      >
        <p className="text-lg font-bold leading-relaxed">أهلاً وسهلاً</p>
        <p className="text-sm text-muted-foreground">Hello World — {currentValue}</p>
      </div>

      {/* Font grid */}
      <div className="grid grid-cols-2 gap-1.5 max-h-[240px] overflow-y-auto rounded-lg border p-1.5">
        {options.map((opt) => {
          const isSelected = opt.value === currentValue;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(setting.key, opt.value)}
              className={cn(
                "rounded-md px-2.5 py-2 text-start transition-all",
                "hover:bg-accent/50",
                isSelected
                  ? "bg-primary/10 border border-primary ring-1 ring-primary/20"
                  : "border border-transparent",
              )}
              style={{ fontFamily: `'${opt.value}', sans-serif` }}
            >
              <span className="block text-sm font-semibold truncate">{opt.label}</span>
              <span className="block text-xs text-muted-foreground mt-0.5" style={{ fontFamily: `'${opt.value}', sans-serif` }}>
                مرحباً بالعالم
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
