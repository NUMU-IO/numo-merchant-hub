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

import { uploadStoreAsset, updateStore } from "@/services/storeApi";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { ImageCropDialog, fileFromCropBlob } from "@/components/ImageCropDialog";
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

  // `logo` and `favicon` are STORE-level (they live on the store record, not
  // the theme customization) and are edited by the dedicated LogoField /
  // FaviconField below. Drop them from the schema-driven form so a theme that
  // still declares them in its settings_schema doesn't render a second,
  // competing upload that writes to the wrong place.
  const STORE_LEVEL_KEYS = new Set(["logo", "favicon"]);
  const settings = (schemas?.global_settings ?? []).filter(
    (s) => !STORE_LEVEL_KEYS.has((s as { id?: string }).id ?? ""),
  );
  const values = (draft?.global_settings ?? {}) as Record<string, unknown>;
  const isAr = locale === "ar";

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
        {/* Logo — STORE-level (store.logo_url). Edited here AND in dashboard →
            Store Settings; both write the same store logo, so the two are
            always in sync (change it in either place, it shows in both and on
            the storefront). Any theme shape/size controls below style it. */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isAr ? "الشعار" : "Logo"}
          </h3>
          <LogoField isAr={isAr} />
        </div>

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

        {/* Favicon — STORE-level (settings.favicon_url), not a theme setting.
            It lives here as a convenient entry point, but it writes the
            store-wide favicon so it persists across theme switches and always
            wins in the storefront's favicon resolution. (Setting it as a
            per-theme `global_settings.favicon` meant it silently vanished when
            the merchant switched themes — store-level fixes that.) */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isAr ? "أيقونة المتصفح" : "Favicon"}
          </h3>
          <FaviconField isAr={isAr} />
        </div>

        {/* Store-level social links — always available, even when the theme
            exposes no global settings. Drives the storefront footer icons. */}
        <SocialLinksEditor locale={locale} />
      </div>
    </div>
  );
}

/**
 * LogoField — store logo uploader for the V3 customizer.
 *
 * Writes the STORE-level logo (`store.logo_url`) via the store update API — the
 * SAME field the dashboard's Store Settings → Store Logo edits. There is one
 * logo per store, so setting it here or there keeps both (and the storefront)
 * in sync. The theme reads `shop.logo_url`, so this is the single source of
 * truth; the theme's shape/size controls (rendered by the schema form) only
 * affect how this logo is displayed.
 */
function LogoField({ isAr }: { isAr: boolean }) {
  const { currentStore, refetchStores } = useDashboardStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const value = (currentStore?.logo_url ?? "") || "";

  const onCropDone = async (blob: Blob) => {
    if (!currentStore?.id) return;
    setSaving(true);
    try {
      const file = fileFromCropBlob(blob, "logo");
      const result = await uploadStoreAsset(currentStore.id, file, "logo");
      await updateStore(currentStore.id, { logo_url: result.url });
      await refetchStores();
      setCropSrc(null);
      toast.success(isAr ? "تم رفع الشعار" : "Logo uploaded");
    } catch {
      toast.error(isAr ? "فشل رفع الشعار" : "Failed to upload logo");
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    if (!currentStore?.id) return;
    setSaving(true);
    try {
      await updateStore(currentStore.id, { logo_url: null });
      await refetchStores();
      toast.success(isAr ? "تم إزالة الشعار" : "Logo removed");
    } catch {
      toast.error(isAr ? "فشل إزالة الشعار" : "Failed to remove logo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "شعار متجرك — نفس الشعار الموجود في إعدادات المتجر، فأي تغيير هنا يظهر هناك وعلى المتجر. يُفضّل صورة PNG شفافة."
          : "Your store logo — the same one in Store Settings, so a change here shows there and on your storefront. A transparent PNG works best."}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        aria-label={isAr ? "رفع الشعار" : "Upload logo"}
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
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
          style={{
            backgroundColor: "hsl(var(--background))",
            backgroundImage:
              "linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%, transparent 75%, hsl(var(--muted)) 75%), linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%, transparent 75%, hsl(var(--muted)) 75%)",
            backgroundSize: "10px 10px",
            backgroundPosition: "0 0, 5px 5px",
          }}
        >
          {value ? (
            <img
              src={value}
              alt="Logo"
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
            disabled={saving || !currentStore?.id}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {value
              ? isAr
                ? "استبدال"
                : "Replace"
              : isAr
                ? "رفع شعار"
                : "Upload logo"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-destructive"
              disabled={saving}
              onClick={onRemove}
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
          title={isAr ? "تعديل الشعار" : "Edit logo"}
          loading={saving}
          onCropComplete={onCropDone}
        />
      )}
    </div>
  );
}

/**
 * FaviconField — browser-tab icon uploader for the V3 customizer.
 *
 * Writes the STORE-level favicon (`store.settings.favicon_url`) via the store
 * update API — NOT a per-theme `global_settings.favicon`. Favicon is a property
 * of the store, not the theme: storing it per-theme meant it disappeared the
 * moment a merchant switched themes (the active theme had no favicon, so the
 * storefront fell back to the platform default). Going through `updateStore`
 * keeps a single store-wide value that survives theme switches and out-ranks
 * everything in the storefront's favicon resolution.
 */
function FaviconField({ isAr }: { isAr: boolean }) {
  const { currentStore, refetchStores } = useDashboardStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const value =
    ((currentStore?.settings as { favicon_url?: string } | null)?.favicon_url ??
      "") || "";

  const onCropDone = async (blob: Blob) => {
    if (!currentStore?.id) return;
    setSaving(true);
    try {
      const file = fileFromCropBlob(blob, "favicon");
      const result = await uploadStoreAsset(currentStore.id, file, "favicon");
      await updateStore(currentStore.id, {
        settings: { favicon_url: result.url },
      });
      await refetchStores();
      setCropSrc(null);
      toast.success(isAr ? "تم رفع الأيقونة" : "Favicon uploaded");
    } catch {
      toast.error(isAr ? "فشل رفع الأيقونة" : "Failed to upload favicon");
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async () => {
    if (!currentStore?.id) return;
    setSaving(true);
    try {
      await updateStore(currentStore.id, { settings: { favicon_url: "" } });
      await refetchStores();
      toast.success(isAr ? "تم إزالة الأيقونة" : "Favicon removed");
    } catch {
      toast.error(isAr ? "فشل إزالة الأيقونة" : "Failed to remove favicon");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "أيقونة مربعة تظهر في تبويب المتصفح — تنطبق على متجرك بالكامل وتبقى عند تغيير الثيم. يُفضّل صورة بسيطة عالية التباين ٥١٢×٥١٢ بكسل."
          : "The square icon shown in the browser tab — applies to your whole store and survives theme switches. A simple, high-contrast 512×512px image works best."}
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
            disabled={saving || !currentStore?.id}
          >
            {saving ? (
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
              disabled={saving}
              onClick={onRemove}
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
          loading={saving}
          onCropComplete={onCropDone}
        />
      )}
    </div>
  );
}

export default GlobalSettingsPanel;
