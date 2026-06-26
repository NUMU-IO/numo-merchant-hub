/**
 * GlobalSettingsPanel — Theme Settings mode body.
 *
 * Shopify-parity: this is the panel a merchant sees when they switch
 * from Sections mode to Theme settings mode. Renders every entry from
 * `schemas.global_settings` (which the backend assembles from the
 * active theme's `settings_schema.json`).
 *
 * Examples of what lives here, per the V3 schema convention:
 *   - Brand: primary color, accent color, page background
 *   - Typography: heading font, body font
 *   - Layout: announcement bar toggle, frosted header toggle, etc.
 *   - Cart / Buttons / Inputs / Custom CSS (when the theme exposes them)
 *
 * Settings are grouped by `setting.group` via `SchemaFormV3`'s built-in
 * grouping; we just hand the whole list off and let the form take care
 * of section headings, `visible_if` conditional visibility, and locale
 * resolution.
 *
 * Edits route through `updateGlobalSetting(key, value)` in the
 * customizer store — same code path the live-preview roundtrip uses,
 * so every edit propagates to the storefront iframe within ~16ms
 * thanks to the Wave-3 `applyDraft` channel.
 */

import { useRef, useState } from "react";
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Upload,
  Trash2,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { uploadStoreAsset } from "@/services/storeApi";
import { Button } from "@/components/ui/button";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { useCustomizerStore } from "../../store/customizerStore";
import { SchemaFormV3 } from "../inputs/SchemaFormV3";
import { SocialLinksEditor } from "./SocialLinksEditor";

export function GlobalSettingsPanel() {
  const draft = useCustomizerStore((s) => s.draft);
  const schemas = useCustomizerStore((s) => s.schemas);
  const locale = useCustomizerStore((s) => s.locale);
  const storeId = useCustomizerStore((s) => s.storeId);
  const updateGlobalSetting = useCustomizerStore(
    (s) => s.updateGlobalSetting,
  );
  const setActiveMode = useCustomizerStore((s) => s.setActiveMode);

  const settings = schemas?.global_settings ?? [];
  const values = (draft?.global_settings ?? {}) as Record<string, unknown>;
  const isAr = locale === "ar";

  // Only show the built-in favicon control when the active theme doesn't
  // already expose its own `favicon` setting (some V3 themes declare an
  // image_picker with id "favicon" in their settings_schema.json). Both
  // write the same `global_settings.favicon` key, so we avoid a duplicate.
  const themeHasFavicon = settings.some((s) => s.id === "favicon");

  return (
    <div className="flex h-full flex-col">
      {/* Header — same shape as SectionEditorPanel for visual consistency.
          The back arrow returns to Sections mode; this gives the merchant
          one always-visible escape hatch on top of the mode-switcher tabs. */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setActiveMode("sections")}
          aria-label={isAr ? "العودة إلى الأقسام" : "Back to sections"}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <SettingsIcon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold truncate">
          {isAr ? "إعدادات الثيم" : "Theme settings"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {settings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "هذا الثيم لا يعرض إعدادات عامة قابلة للتعديل."
              : "This theme doesn't expose theme-level settings."}
          </p>
        ) : (
          <SchemaFormV3
            settings={settings}
            values={values}
            locale={locale}
            onChange={(key, value) => updateGlobalSetting(key, value)}
            storeId={storeId ?? undefined}
          />
        )}

        {/* Favicon — always available (unless the theme ships its own picker).
            Writes `global_settings.favicon`, which the storefront <head> reads
            when rendering the browser-tab icon. */}
        {!themeHasFavicon && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isAr ? "أيقونة المتصفح" : "Favicon"}
            </h3>
            <FaviconField
              storeId={storeId ?? undefined}
              value={(values.favicon as string) ?? ""}
              onChange={(url) => updateGlobalSetting("favicon", url)}
              isAr={isAr}
            />
          </div>
        )}

        {/* Store-level social links — always available, even when the theme
            exposes no global settings. Drives the storefront footer icons. */}
        <SocialLinksEditor locale={locale} />
      </div>
    </div>
  );
}

/**
 * FaviconField — built-in browser-tab icon uploader for the V3 customizer.
 * Uploads via the shared customization asset endpoint (asset_type "favicon")
 * and stores a plain URL string in `global_settings.favicon`. The storefront
 * layout reads that key when assembling per-store <head> metadata.
 */
function FaviconField({
  storeId,
  value,
  onChange,
  isAr,
}: {
  storeId: string | undefined;
  value: string;
  onChange: (url: string) => void;
  isAr: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const onCropDone = async (blob: Blob) => {
    if (!storeId) return;
    setUploading(true);
    try {
      const file = new File([blob], "favicon.png", { type: "image/png" });
      const result = await uploadStoreAsset(storeId, file, "favicon");
      onChange(result.url);
      setCropSrc(null);
      toast.success(isAr ? "تم رفع الأيقونة" : "Favicon uploaded");
    } catch {
      toast.error(isAr ? "فشل رفع الأيقونة" : "Failed to upload favicon");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "أيقونة مربعة تظهر في تبويب المتصفح — يُفضّل ٥١٢×٥١٢ بكسل."
          : "The square icon shown in the browser tab. 512×512px works best."}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/x-icon,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            const reader = new FileReader();
            reader.onload = () => setCropSrc(reader.result as string);
            reader.readAsDataURL(f);
          }
          e.target.value = "";
        }}
      />

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/20">
          {value ? (
            <img
              src={value}
              alt="Favicon"
              className="h-full w-full object-contain"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !storeId}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {value
              ? isAr
                ? "استبدال"
                : "Replace"
              : isAr
                ? "رفع أيقونة"
                : "Upload favicon"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={() => onChange("")}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isAr ? "إزالة" : "Remove"}
            </Button>
          )}
        </div>
      </div>

      {cropSrc && (
        <ImageCropDialog
          open={!!cropSrc}
          onClose={() => setCropSrc(null)}
          imageSrc={cropSrc}
          cropShape="rect"
          aspect={1}
          title={isAr ? "تعديل الأيقونة (مربعة)" : "Edit favicon (square)"}
          loading={uploading}
          onCropComplete={onCropDone}
        />
      )}
    </div>
  );
}

export default GlobalSettingsPanel;
