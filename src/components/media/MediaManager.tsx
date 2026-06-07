/**
 * MediaManager — the shared Shopify-style "Files" grid.
 *
 * One component, two homes:
 *   1. **Standalone Files page** (`pages/online-store/Files.tsx`) —
 *      full management: upload, search, sort, copy-URL, rename
 *      (friendly label), edit alt text, delete.
 *   2. **In-editor image picker** (`MediaLibraryDialog` Library tab) —
 *      same grid, plus `onPick` so a click hands the URL back to the
 *      section setting. Management actions stay available via the
 *      per-card menu so merchants can tidy up without leaving the editor.
 *
 * Metadata model (matches the backend):
 *   - The object key / URL is **immutable** — renaming only changes a
 *     friendly `name` label stored in `store.settings.asset_meta[key]`,
 *     so a URL already embedded in a published section never breaks.
 *   - `alt` is the library-level default alt; the picker can still
 *     override it per placement.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Upload,
  Loader2,
  AlertCircle,
  MoreVertical,
  Copy,
  Pencil,
  Trash2,
  Check,
  FileText,
  ArrowDownUp,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { showError } from "@/lib/show-error";
import {
  listStoreAssets,
  updateStoreAsset,
  deleteStoreAsset,
  uploadStoreAsset,
  type StoreAsset,
} from "@/services/storeApi";

type SortKey = "recent" | "name" | "size";

interface MediaManagerProps {
  storeId?: string;
  isRTL: boolean;
  /** Picker mode: clicking a tile hands the asset back. */
  onPick?: (asset: StoreAsset) => void;
  /** Highlight the active selection (picker mode). */
  selectedUrl?: string;
  /** "images" restricts to image extensions; "all" shows everything. */
  filterKind?: "images" | "all";
  /** Render the built-in upload dropzone (Files page). The dialog has
   *  its own Upload tab, so it passes `false`. */
  showUpload?: boolean;
}

const IMAGE_RE = /\.(jpg|jpeg|png|webp|gif|svg|ico|avif)$/i;

function filenameOf(a: StoreAsset): string {
  return a.name?.trim() || a.key.split("/").pop() || a.key;
}

function formatBytes(n?: number): string {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaManager({
  storeId,
  isRTL,
  onPick,
  selectedUrl,
  filterKind = "all",
  showUpload = false,
}: MediaManagerProps) {
  const [assets, setAssets] = useState<StoreAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");

  const [editTarget, setEditTarget] = useState<StoreAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreAsset | null>(null);

  const reload = useCallback(() => {
    if (!storeId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listStoreAssets(storeId)
      .then((list) => {
        if (cancelled) return;
        const scoped =
          filterKind === "images"
            ? list.filter((a) => IMAGE_RE.test(a.key))
            : list;
        setAssets(scoped);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load files");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [storeId, filterKind]);

  useEffect(() => {
    const cleanup = reload();
    return cleanup;
  }, [reload]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? assets.filter(
          (a) =>
            filenameOf(a).toLowerCase().includes(q) ||
            (a.alt ?? "").toLowerCase().includes(q) ||
            a.key.toLowerCase().includes(q),
        )
      : assets.slice();
    filtered.sort((a, b) => {
      if (sort === "name") return filenameOf(a).localeCompare(filenameOf(b));
      if (sort === "size") return (b.size ?? 0) - (a.size ?? 0);
      // recent
      if (a.last_modified && b.last_modified) {
        return b.last_modified.localeCompare(a.last_modified);
      }
      return b.key.localeCompare(a.key);
    });
    return filtered;
  }, [assets, search, sort]);

  // ── Upload (Files-page mode) ───────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleUpload(files: FileList | null) {
    if (!storeId || !files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const kind = file.type.startsWith("image/")
          ? "section_image"
          : "generic_file";
        await uploadStoreAsset(storeId, file, kind);
      }
      toast.success(isRTL ? "تم الرفع" : "Uploaded");
      reload();
    } catch (err) {
      showError(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleCopy(asset: StoreAsset) {
    try {
      await navigator.clipboard.writeText(asset.url);
      toast.success(isRTL ? "تم نسخ الرابط" : "URL copied");
    } catch {
      toast.error(isRTL ? "تعذّر النسخ" : "Couldn't copy");
    }
  }

  async function confirmDelete() {
    if (!storeId || !deleteTarget) return;
    try {
      await deleteStoreAsset(storeId, deleteTarget.key);
      setAssets((prev) => prev.filter((a) => a.key !== deleteTarget.key));
      toast.success(isRTL ? "تم حذف الملف" : "File deleted");
    } catch (err) {
      showError(err);
    } finally {
      setDeleteTarget(null);
    }
  }

  if (!storeId) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {isRTL ? "لا يوجد متجر نشط." : "No active store."}
      </p>
    );
  }

  return (
    <div className="space-y-3" dir={isRTL ? "rtl" : "ltr"}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9 h-9 text-sm"
            placeholder={isRTL ? "ابحث في الملفات..." : "Search files..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-auto gap-1.5 text-xs">
            <ArrowDownUp className="h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">{isRTL ? "الأحدث" : "Most recent"}</SelectItem>
            <SelectItem value="name">{isRTL ? "الاسم" : "Name"}</SelectItem>
            <SelectItem value="size">{isRTL ? "الحجم" : "Size"}</SelectItem>
          </SelectContent>
        </Select>
        {showUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button
              size="sm"
              className="h-9"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5 me-1.5" />
              )}
              {isRTL ? "رفع" : "Upload"}
            </Button>
          </>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          isRTL={isRTL}
          hasSearch={!!search}
          canUpload={showUpload}
          onUpload={() => fileInputRef.current?.click()}
          onDrop={showUpload ? handleUpload : undefined}
          dragOver={dragOver}
          setDragOver={setDragOver}
        />
      ) : (
        <div
          className={cn(
            "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
            showUpload && dragOver && "rounded-lg ring-2 ring-primary/40",
          )}
          onDragOver={
            showUpload
              ? (e) => {
                  e.preventDefault();
                  setDragOver(true);
                }
              : undefined
          }
          onDragLeave={showUpload ? () => setDragOver(false) : undefined}
          onDrop={
            showUpload
              ? (e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleUpload(e.dataTransfer.files);
                }
              : undefined
          }
        >
          {visible.map((a) => (
            <AssetCard
              key={a.key}
              asset={a}
              isRTL={isRTL}
              selected={selectedUrl === a.url}
              isImage={IMAGE_RE.test(a.key)}
              onPick={onPick}
              onCopy={() => handleCopy(a)}
              onEdit={() => setEditTarget(a)}
              onDelete={() => setDeleteTarget(a)}
            />
          ))}
        </div>
      )}

      {/* Edit details (alt + friendly name) */}
      <EditDetailsDialog
        storeId={storeId}
        isRTL={isRTL}
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={(updated) => {
          setAssets((prev) =>
            prev.map((a) =>
              a.key === updated.key
                ? { ...a, alt: updated.alt, name: updated.name }
                : a,
            ),
          );
          setEditTarget(null);
        }}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "حذف الملف" : "Delete file"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? "سيُحذف الملف نهائيًا. إذا كان مستخدمًا في أحد الأقسام فلن تظهر صورته. لا يمكن التراجع."
                : "This file will be permanently deleted. If it's used in a section, that image will break. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {isRTL ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Asset card ────────────────────────────────────────────────────────
function AssetCard({
  asset,
  isRTL,
  selected,
  isImage,
  onPick,
  onCopy,
  onEdit,
  onDelete,
}: {
  asset: StoreAsset;
  isRTL: boolean;
  selected: boolean;
  isImage: boolean;
  onPick?: (a: StoreAsset) => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const label = filenameOf(asset);
  const pickable = Boolean(onPick);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-muted/20 transition-all",
        selected ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40",
      )}
    >
      <button
        type="button"
        onClick={() => (pickable ? onPick!(asset) : onEdit())}
        className="block w-full"
        title={pickable ? (isRTL ? "اختيار" : "Select") : label}
      >
        <div className="flex aspect-square items-center justify-center bg-muted/30">
          {isImage ? (
            <img
              src={asset.url}
              alt={asset.alt || label}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          ) : (
            <FileText className="h-8 w-8 text-muted-foreground/50" />
          )}
        </div>
      </button>

      {selected && (
        <span className="absolute start-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}

      {/* Action menu */}
      <div className="absolute end-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 w-7 px-0 shadow"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onCopy}>
              <Copy className="h-3.5 w-3.5 me-2" />
              {isRTL ? "نسخ الرابط" : "Copy URL"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 me-2" />
              {isRTL ? "تعديل التفاصيل" : "Edit details"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 me-2" />
              {isRTL ? "حذف" : "Delete"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Caption */}
      <div className="truncate px-2 py-1.5 text-[11px]">
        <span className="block truncate font-medium" title={label}>
          {label}
        </span>
        <span className="block truncate text-muted-foreground">
          {asset.alt
            ? asset.alt
            : formatBytes(asset.size) || (isRTL ? "بدون نص بديل" : "No alt text")}
        </span>
      </div>
    </div>
  );
}

// ─── Edit details dialog ─────────────────────────────────────────────────
function EditDetailsDialog({
  storeId,
  isRTL,
  target,
  onClose,
  onSaved,
}: {
  storeId: string;
  isRTL: boolean;
  target: StoreAsset | null;
  onClose: () => void;
  onSaved: (updated: { key: string; alt: string; name: string }) => void;
}) {
  const [alt, setAlt] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setAlt(target.alt ?? "");
      setName(target.name ?? "");
    }
  }, [target]);

  async function save() {
    if (!target) return;
    setSaving(true);
    try {
      await updateStoreAsset(storeId, target.key, { alt, name });
      toast.success(isRTL ? "تم الحفظ" : "Saved");
      onSaved({ key: target.key, alt, name });
    } catch (err) {
      showError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{isRTL ? "تفاصيل الملف" : "File details"}</DialogTitle>
        </DialogHeader>
        {target && (
          <div className="space-y-4">
            {IMAGE_RE.test(target.key) && (
              <div className="overflow-hidden rounded-lg border bg-muted/30">
                <img
                  src={target.url}
                  alt={alt || filenameOf(target)}
                  className="mx-auto max-h-48 object-contain"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {isRTL ? "الاسم المعروض" : "Display name"}
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={filenameOf(target)}
                dir={isRTL ? "rtl" : "ltr"}
              />
              <p className="text-[11px] text-muted-foreground">
                {isRTL
                  ? "اسم ودّي فقط — لن يتغيّر رابط الملف."
                  : "A friendly label only — the file URL won't change."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {isRTL ? "النص البديل (Alt)" : "Alt text"}
                <span className="ms-1.5 font-normal text-muted-foreground">
                  {isRTL ? "للوصولية ومحركات البحث" : "for accessibility & SEO"}
                </span>
              </Label>
              <Textarea
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                rows={2}
                dir={isRTL ? "rtl" : "ltr"}
                placeholder={
                  isRTL
                    ? "صف الصورة باختصار (اتركه فارغًا للصور الزخرفية)"
                    : "Describe the image briefly (empty = decorative)"
                }
              />
            </div>
            <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5">
              <code className="flex-1 truncate text-[11px] text-muted-foreground" dir="ltr">
                {target.url}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={() => {
                  navigator.clipboard
                    .writeText(target.url)
                    .then(() => toast.success(isRTL ? "تم نسخ الرابط" : "URL copied"))
                    .catch(() => undefined);
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {isRTL ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
            {isRTL ? "حفظ" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────
function EmptyState({
  isRTL,
  hasSearch,
  canUpload,
  onUpload,
  onDrop,
  dragOver,
  setDragOver,
}: {
  isRTL: boolean;
  hasSearch: boolean;
  canUpload: boolean;
  onUpload: () => void;
  onDrop?: (files: FileList | null) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center transition-colors",
        dragOver ? "border-primary bg-primary/5" : "bg-muted/10",
      )}
      onDragOver={
        canUpload
          ? (e) => {
              e.preventDefault();
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={canUpload ? () => setDragOver(false) : undefined}
      onDrop={
        canUpload && onDrop
          ? (e) => {
              e.preventDefault();
              setDragOver(false);
              onDrop(e.dataTransfer.files);
            }
          : undefined
      }
    >
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <p className="mb-1 text-sm font-semibold">
        {hasSearch
          ? isRTL
            ? "لا توجد نتائج"
            : "No files found"
          : isRTL
            ? "لا توجد ملفات بعد"
            : "No files yet"}
      </p>
      <p className="mb-5 max-w-xs text-xs text-muted-foreground">
        {hasSearch
          ? isRTL
            ? "جرّب كلمة بحث أخرى"
            : "Try a different search term"
          : isRTL
            ? "ارفع صورًا وملفات لإعادة استخدامها عبر متجرك"
            : "Upload images and files to reuse across your store"}
      </p>
      {!hasSearch && canUpload && (
        <Button size="sm" onClick={onUpload}>
          <Upload className="h-3.5 w-3.5 me-1.5" />
          {isRTL ? "رفع ملف" : "Upload a file"}
        </Button>
      )}
    </div>
  );
}
