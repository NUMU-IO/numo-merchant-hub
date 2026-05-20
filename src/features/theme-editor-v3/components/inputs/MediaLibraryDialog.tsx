/**
 * MediaLibraryDialog — Shopify-style image picker with three tabs:
 *
 *   1. **Library** — recent uploads pulled from
 *      `GET /stores/:id/settings/customization/assets`. Merchant
 *      clicks a thumbnail; we hand the URL back. No re-upload needed.
 *
 *   2. **Upload** — drag-drop or click-to-pick. Calls the same
 *      `uploadStoreAsset(storeId, file, "section_image")` the inline
 *      flow used. Auto-compresses via the existing storeApi pipeline.
 *
 *   3. **URL** — paste an external URL. The fallback for theme
 *      authors who host imagery on their own CDN.
 *
 * Stored value contract (backwards-compatible):
 *   - The picker's `onChange` always passes a plain URL string OR an
 *     `{ url, alt }` object. Themes that read `settings.hero_image_url`
 *     as a string keep working — the storeImageValue helper below
 *     normalizes both shapes when the merchant pastes a URL or picks
 *     from the library.
 *
 * Alt text:
 *   - Always editable from a field below the preview. Empty alt is
 *     stored as `""` (intentional decoration, per WCAG) — we don't
 *     elide the field because that would obscure the difference
 *     between "deliberately decorative" and "I forgot to add alt".
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Upload,
  Link2,
  Loader2,
  X,
  Library,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { uploadStoreAsset, listStoreAssets, type StoreAsset } from "@/services/storeApi";

import type { EditorLocale } from "../../types";

/**
 * Stored image value. Either a plain URL string (legacy + simple case)
 * or an object carrying URL + alt text. Themes that consume the
 * setting should be ready for both — `getImageUrl` and `getImageAlt`
 * below are the canonical accessors.
 */
export type ImageValue = string | { url: string; alt?: string };

export function getImageUrl(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "url" in value) {
    const v = (value as { url?: unknown }).url;
    return typeof v === "string" ? v : "";
  }
  return "";
}

export function getImageAlt(value: unknown): string {
  if (value && typeof value === "object" && "alt" in value) {
    const v = (value as { alt?: unknown }).alt;
    return typeof v === "string" ? v : "";
  }
  return "";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current value (string-or-object). Used to highlight the active
   *  selection in the Library tab. */
  value: ImageValue | undefined;
  /** Always called with the object form so the alt text travels with
   *  the URL. Themes can still read just `.url`. */
  onChange: (next: ImageValue) => void;
  locale: EditorLocale;
  storeId?: string;
}

type TabId = "library" | "upload" | "url";

export function MediaLibraryDialog({
  open,
  onOpenChange,
  value,
  onChange,
  locale,
  storeId,
}: Props) {
  const isAr = locale === "ar";
  const currentUrl = getImageUrl(value);
  const currentAlt = getImageAlt(value);

  // Default to the Library tab so reuse is the default flow. First
  // time around the library is empty → the empty state nudges them to
  // upload. After the first upload, library becomes the fastest path.
  const [tab, setTab] = useState<TabId>("library");
  const [altDraft, setAltDraft] = useState(currentAlt);

  // Reset alt-draft to the persisted alt whenever the dialog reopens
  // — so a half-typed alt from a previous open doesn't survive cancel.
  useEffect(() => {
    if (open) setAltDraft(currentAlt);
  }, [open, currentAlt]);

  // ── Library tab ─────────────────────────────────────────────────────
  const [assets, setAssets] = useState<StoreAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !storeId) return;
    let cancelled = false;
    setLoadingAssets(true);
    setAssetsError(null);
    listStoreAssets(storeId)
      .then((list) => {
        if (cancelled) return;
        // Filter to image extensions — the assets endpoint mixes
        // section images with PDFs and fonts when the theme has
        // file_upload settings. We only want pickable images here.
        const imageOnly = list.filter((a) =>
          /\.(jpg|jpeg|png|webp|gif|svg|ico)$/i.test(a.key),
        );
        // Newest first — local_storage doesn't always populate
        // last_modified, so fall back to a stable key sort.
        imageOnly.sort((a, b) => {
          if (a.last_modified && b.last_modified) {
            return b.last_modified.localeCompare(a.last_modified);
          }
          return b.key.localeCompare(a.key);
        });
        setAssets(imageOnly);
      })
      .catch((err) => {
        if (cancelled) return;
        setAssetsError(err instanceof Error ? err.message : "Failed to load library");
      })
      .finally(() => !cancelled && setLoadingAssets(false));
    return () => {
      cancelled = true;
    };
  }, [open, storeId]);

  // ── Upload tab ──────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const MAX_BYTES = 10 * 1024 * 1024;
  const acceptHeader = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml";

  async function handleUpload(file: File) {
    if (!storeId) {
      setUploadError(
        isAr ? "تعذّر الرفع: المتجر غير معروف." : "Upload failed: no active store.",
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError(
        isAr
          ? `الملف كبير جداً (الحد ${MAX_BYTES / 1024 / 1024} ميجابايت).`
          : `File too large (max ${MAX_BYTES / 1024 / 1024} MB).`,
      );
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadError(
        isAr ? "نوع الملف غير مدعوم." : "Unsupported file type.",
      );
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadStoreAsset(storeId, file, "section_image");
      onChange({ url: result.url, alt: altDraft });
      onOpenChange(false);
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : isAr
            ? "فشل الرفع"
            : "Upload failed",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ── URL tab ─────────────────────────────────────────────────────────
  const [urlInput, setUrlInput] = useState(currentUrl);
  useEffect(() => {
    if (open) setUrlInput(currentUrl);
  }, [open, currentUrl]);
  const urlValid = /^https?:\/\/.+/i.test(urlInput) || urlInput === "";

  /**
   * Serialise the picked image. **Backwards-compat shape**: when no
   * alt text has been set, store as a plain URL string — this is what
   * existing themes that read `settings.hero_image_url as string`
   * already expect. Only switch to the `{ url, alt }` object shape
   * when the merchant has authored an alt. New themes can call the
   * SDK's `useImage()` helper which normalises both shapes.
   */
  function pack(url: string, alt: string): ImageValue {
    const trimmed = alt.trim();
    return trimmed ? { url, alt: trimmed } : url;
  }

  function commitLibraryPick(asset: StoreAsset) {
    onChange(pack(asset.url, altDraft));
    onOpenChange(false);
  }

  function commitUrlPaste() {
    if (!urlInput) return;
    onChange(pack(urlInput, altDraft));
    onOpenChange(false);
  }

  function commitAltOnly() {
    // Save the alt without changing the URL — useful when the merchant
    // just wants to add alt to an existing image. If they emptied the
    // alt, we revert to the plain-string shape so the storage stays
    // consistent with themes that expect a string.
    if (!currentUrl) {
      onOpenChange(false);
      return;
    }
    onChange(pack(currentUrl, altDraft));
    onOpenChange(false);
  }

  const tabs: { id: TabId; icon: typeof Library; label: { en: string; ar: string } }[] = [
    { id: "library", icon: Library, label: { en: "Library", ar: "المكتبة" } },
    { id: "upload", icon: Upload, label: { en: "Upload", ar: "رفع" } },
    { id: "url", icon: Link2, label: { en: "From URL", ar: "من رابط" } },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{isAr ? "اختر صورة" : "Choose image"}</DialogTitle>
        </DialogHeader>

        {/* Tab strip */}
        <div role="tablist" className="flex gap-1 border-b pb-2">
          {tabs.map(({ id, icon: Icon, label }) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive ? "true" : "false"}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label[isAr ? "ar" : "en"]}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="min-h-[280px] max-h-[60vh] overflow-y-auto">
          {tab === "library" && (
            <LibraryTab
              isAr={isAr}
              loading={loadingAssets}
              error={assetsError}
              assets={assets}
              currentUrl={currentUrl}
              onPick={commitLibraryPick}
            />
          )}

          {tab === "upload" && (
            <UploadTab
              isAr={isAr}
              dragOver={dragOver}
              uploading={uploading}
              error={uploadError}
              hasStore={Boolean(storeId)}
              acceptHeader={acceptHeader}
              fileInputRef={fileInputRef}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) await handleUpload(f);
              }}
              onFile={handleUpload}
            />
          )}

          {tab === "url" && (
            <UrlTab
              isAr={isAr}
              url={urlInput}
              valid={urlValid}
              onChange={setUrlInput}
              onApply={commitUrlPaste}
            />
          )}
        </div>

        {/* Alt text field — always editable. Sits below the body so
            the merchant can fill it in once and have it survive across
            library picks and uploads. */}
        <div className="space-y-1.5 border-t pt-3">
          <Label htmlFor="numu-img-alt" className="text-xs font-medium">
            {isAr ? "النص البديل (Alt)" : "Alt text"}
            <span className="ms-1.5 font-normal text-muted-foreground">
              {isAr ? "للوصولية ومحركات البحث" : "for accessibility & SEO"}
            </span>
          </Label>
          <Textarea
            id="numu-img-alt"
            value={altDraft}
            onChange={(e) => setAltDraft(e.target.value)}
            placeholder={
              isAr
                ? "صف الصورة باختصار (اتركه فارغًا للصور الزخرفية)"
                : "Describe the image briefly (empty = decorative)"
            }
            rows={2}
            className="text-sm"
            dir={isAr ? "rtl" : "ltr"}
          />
          {/* Save-alt-only button — useful when the merchant only
              wanted to edit the alt of an existing image and not
              swap the file. Only enabled when there's a current URL
              AND the alt actually changed. */}
          {currentUrl && altDraft !== currentAlt && (
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={commitAltOnly}
              >
                {isAr ? "حفظ النص البديل" : "Save alt text"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tab subcomponents ─────────────────────────────────────────────────

function LibraryTab({
  isAr,
  loading,
  error,
  assets,
  currentUrl,
  onPick,
}: {
  isAr: boolean;
  loading: boolean;
  error: string | null;
  assets: StoreAsset[];
  currentUrl: string;
  onPick: (a: StoreAsset) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-start gap-2 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium">
          {isAr ? "لا توجد صور في المكتبة بعد" : "No images in your library yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          {isAr
            ? "ارفع صورة من تبويب «رفع» وستظهر هنا في كل مرة لاحقة."
            : "Upload an image from the Upload tab and it'll appear here for reuse next time."}
        </p>
      </div>
    );
  }

  const filenameOf = (a: StoreAsset) => a.key.split("/").pop() ?? a.key;

  return (
    <div className="grid grid-cols-3 gap-2 p-1 sm:grid-cols-4 lg:grid-cols-5">
      {assets.map((a) => {
        const isSelected = currentUrl === a.url;
        return (
          <button
            key={a.key}
            type="button"
            onClick={() => onPick(a)}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-md border bg-muted/30 transition-all",
              isSelected
                ? "border-primary ring-2 ring-primary/30"
                : "hover:border-primary/40",
            )}
            title={filenameOf(a)}
          >
            <img
              src={a.url}
              alt={filenameOf(a)}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-3 text-[10px] text-white">
              {filenameOf(a)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function UploadTab({
  isAr,
  dragOver,
  uploading,
  error,
  hasStore,
  acceptHeader,
  fileInputRef,
  onDragOver,
  onDragLeave,
  onDrop,
  onFile,
}: {
  isAr: boolean;
  dragOver: boolean;
  uploading: boolean;
  error: string | null;
  hasStore: boolean;
  acceptHeader: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFile: (f: File) => void;
}) {
  return (
    <div className="space-y-3 p-1">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptHeader}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        disabled={uploading || !hasStore}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "flex aspect-[5/2] w-full flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed bg-muted/30 text-sm transition-colors",
          dragOver
            ? "border-primary bg-primary/5 text-primary"
            : "border-muted-foreground/30 text-muted-foreground hover:border-primary/40 hover:bg-muted/50",
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="h-6 w-6 animate-pulse" />
            <span>{isAr ? "جاري الرفع..." : "Uploading…"}</span>
          </>
        ) : (
          <>
            <Upload className="h-7 w-7" />
            <span className="font-medium">
              {isAr ? "اسحب صورة هنا أو اضغط للاختيار" : "Drop image here or click to choose"}
            </span>
            <span className="text-xs">
              {isAr ? "JPG / PNG / WebP — حتى 10MB" : "JPG / PNG / WebP — up to 10MB"}
            </span>
          </>
        )}
      </button>
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function UrlTab({
  isAr,
  url,
  valid,
  onChange,
  onApply,
}: {
  isAr: boolean;
  url: string;
  valid: boolean;
  onChange: (next: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="space-y-3 p-1">
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "ألصق رابط صورة من CDN خارجي. يجب أن يبدأ بـ https://"
          : "Paste a hosted image URL. Must start with https://"}
      </p>
      <Input
        type="url"
        value={url}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://cdn.example.com/hero.jpg"
        autoFocus
        dir="ltr"
      />
      <div className="flex justify-end">
        <Button type="button" disabled={!url || !valid} onClick={onApply}>
          {isAr ? "تطبيق الرابط" : "Apply URL"}
        </Button>
      </div>
      {url && !valid && (
        <p className="text-xs text-destructive">
          {isAr ? "الرابط غير صالح." : "Invalid URL."}
        </p>
      )}
    </div>
  );
}
