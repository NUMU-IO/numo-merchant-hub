import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { getStore, updateStore } from "@/services/storeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  FileText, Plus, MoreHorizontal, Pencil, Trash2,
  Eye, Search, Globe, EyeOff, Loader2, Save, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/ui/help-tip";
import { getStoreUrl } from "@/lib/storefront";

interface StorePage {
  id: string;
  title: string;
  titleAr: string;
  slug: string;
  body: string;
  published: boolean;
  updatedAt: string;
}

function makeSlug(title: string) {
  return title.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function OnlineStorePages() {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id ?? "";

  const [pages, setPages] = useState<StorePage[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<StorePage> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorePage | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const initializedRef = useRef(false);

  // ── Fetch pages from store.settings.pages ──
  const { data: storeData, isLoading } = useQuery({
    queryKey: ["store", storeId],
    queryFn: () => getStore(storeId),
    enabled: !!storeId,
  });

  // Seed local state ONCE from API
  useEffect(() => {
    if (!storeData || initializedRef.current) return;
    initializedRef.current = true;
    const stored = ((storeData.settings ?? {}) as Record<string, unknown>).pages as StorePage[] | undefined;
    if (stored && Array.isArray(stored) && stored.length > 0) {
      setPages(stored);
    } else {
      // Seed defaults for new stores
      setPages([
        { id: "about",   title: "About Us", titleAr: "عن المتجر",   slug: "about",   body: "", published: true,  updatedAt: new Date().toISOString() },
        { id: "contact", title: "Contact",  titleAr: "تواصل معنا",  slug: "contact", body: "", published: true,  updatedAt: new Date().toISOString() },
      ]);
      setIsDirty(true); // mark dirty so user saves the defaults
    }
  }, [storeData]);

  // ── Save pages to store.settings.pages ──
  const saveMutation = useMutation({
    mutationFn: () =>
      updateStore(storeId, { settings: { pages } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      toast.success(isRTL ? "تم حفظ الصفحات" : "Pages saved");
      setIsDirty(false);
    },
    onError: (err) => showError(err),
  });

  const filtered = pages.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.titleAr.toLowerCase().includes(q) ||
      p.slug.includes(q)
    );
  });

  function openNew()            { setEditing({ title: "", titleAr: "", body: "", published: false }); }
  function openEdit(p: StorePage) { setEditing({ ...p }); }

  function handleSave() {
    if (!editing?.title?.trim()) return;
    if (editing.id) {
      setPages((prev) => prev.map((p) =>
        p.id === editing.id
          ? { ...p, ...editing, updatedAt: new Date().toISOString() } as StorePage
          : p
      ));
      toast.success(isRTL ? "تم تحديث الصفحة" : "Page updated");
    } else {
      const slug = makeSlug(editing.title);
      const newPage: StorePage = {
        id: slug || Date.now().toString(),
        title: editing.title!,
        titleAr: editing.titleAr ?? "",
        slug,
        body: editing.body ?? "",
        published: false,
        updatedAt: new Date().toISOString(),
      };
      setPages((prev) => [...prev, newPage]);
      toast.success(isRTL ? "تم إنشاء الصفحة" : "Page created");
    }
    setEditing(null);
    setIsDirty(true);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setPages((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    toast.success(isRTL ? "تم حذف الصفحة" : "Page deleted");
    setDeleteTarget(null);
    setIsDirty(true);
  }

  function togglePublish(id: string) {
    setPages((prev) => prev.map((p) => p.id === id ? { ...p, published: !p.published } : p));
    setIsDirty(true);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isRTL ? "الصفحات" : "Pages"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL ? "إدارة صفحات المحتوى الثابت في متجرك" : "Manage static content pages for your store"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 dark:border-amber-700 dark:text-amber-400">
              {isRTL ? "تغييرات غير محفوظة" : "Unsaved changes"}
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading || !isDirty}
          >
            {saveMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              : <Save className="h-3.5 w-3.5 me-1.5" />}
            {isRTL ? "حفظ" : "Save"}
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-3.5 w-3.5 me-1.5" />
            {isRTL ? "صفحة جديدة" : "Add page"}
          </Button>
        </div>
      </div>

      {/* Help tip */}
      <HelpTip title={isRTL ? "كيف تدير صفحات متجرك؟" : "How to manage your pages"}>
        <ul className="list-disc list-inside space-y-1">
          <li>{isRTL ? "أنشئ صفحات ثابتة مثل «عن المتجر» و«سياسة الاسترجاع» و«تواصل معنا» لبناء ثقة عملائك." : "Create static pages like About Us, Return Policy, and Contact to build customer trust."}</li>
          <li>{isRTL ? "كل صفحة تدعم عنوان إنجليزي وعربي — يظهر العنوان المناسب حسب لغة الزائر." : "Each page supports English and Arabic titles — the correct one displays based on visitor language."}</li>
          <li>{isRTL ? "استخدم زر النشر/الإخفاء للتحكم في ظهور الصفحة للزوار دون حذفها." : "Use the Show/Hide toggle to control page visibility without deleting it."}</li>
          <li>{isRTL ? "رابط الصفحة يُنشأ تلقائيًا من العنوان الإنجليزي — مثلاً: /pages/about-us." : "Page URL slug is auto-generated from the English title — e.g., /pages/about-us."}</li>
          <li>{isRTL ? "اضغط «حفظ» في الأعلى لحفظ جميع التغييرات (إنشاء/تعديل/حذف) دفعة واحدة." : "Click Save at the top to persist all changes (create/edit/delete) in one go."}</li>
        </ul>
      </HelpTip>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          className="ps-9 h-9 text-sm bg-muted/30 border-transparent focus:border-input focus:bg-background transition-colors"
          placeholder={isRTL ? "ابحث في الصفحات..." : "Search pages..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Pages list */}
      {isLoading ? (
        <div className="rounded-2xl border bg-card overflow-hidden divide-y">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
              <div className="h-8 w-8 rounded-lg bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 rounded bg-muted" />
                <div className="h-2.5 w-20 rounded bg-muted" />
              </div>
              <div className="h-3 w-12 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState isRTL={isRTL} hasSearch={!!search} onAdd={openNew} />
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden divide-y">
          {filtered.map((page, i) => (
            <PageRow
              key={page.id}
              page={page}
              isRTL={isRTL}
              subdomain={currentStore?.subdomain ?? ""}
              isFirst={i === 0}
              isLast={i === filtered.length - 1}
              isDirty={isDirty}
              onEdit={() => openEdit(page)}
              onToggle={() => togglePublish(page.id)}
              onDelete={() => setDeleteTarget(page)}
            />
          ))}
        </div>
      )}

      {/* ── Edit / Create dialog ─────────────────────────────────────────────── */}
      <Dialog open={editing !== null} onOpenChange={() => setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.id
                ? isRTL ? "تعديل الصفحة" : "Edit page"
                : isRTL ? "صفحة جديدة" : "New page"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Title row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {isRTL ? "العنوان (إنجليزي)" : "Title (English)"}
                  <span className="text-destructive ms-0.5">*</span>
                </Label>
                <Input
                  value={editing?.title ?? ""}
                  onChange={(e) => setEditing((p) => ({ ...p, title: e.target.value }))}
                  placeholder="About Us"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{isRTL ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
                <Input
                  dir="rtl"
                  value={editing?.titleAr ?? ""}
                  onChange={(e) => setEditing((p) => ({ ...p, titleAr: e.target.value }))}
                  placeholder="عن المتجر"
                />
              </div>
            </div>

            {/* Slug preview */}
            {editing?.title && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <span className="opacity-60">{currentStore?.subdomain ?? "yourstore"}.numueg.app/pages/</span>
                <span className="font-medium text-foreground/70">{makeSlug(editing.title) || "—"}</span>
              </p>
            )}

            {/* Content */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{isRTL ? "محتوى الصفحة" : "Page content"}</Label>
              <Textarea
                value={editing?.body ?? ""}
                onChange={(e) => setEditing((p) => ({ ...p, body: e.target.value }))}
                placeholder={isRTL ? "اكتب محتوى الصفحة هنا..." : "Write your page content here..."}
                rows={6}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} disabled={!editing?.title?.trim()}>
              {isRTL ? "حفظ" : "Save page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ──────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{isRTL ? "حذف الصفحة" : "Delete page"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `سيتم حذف صفحة "${deleteTarget?.titleAr || deleteTarget?.title}" نهائيًا. لا يمكن التراجع.`
                : `"${deleteTarget?.title}" will be permanently deleted. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
            <Button variant="destructive" onClick={handleDelete}>{isRTL ? "حذف" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page row ─────────────────────────────────────────────────────────────────
interface PageRowProps {
  page: StorePage; isRTL: boolean;
  subdomain: string;
  isFirst: boolean; isLast: boolean;
  /** True when local edits haven't been saved to the backend yet — used to
   *  warn the merchant that the "View" link will show the LAST PUBLISHED
   *  version, not the in-flight draft. */
  isDirty: boolean;
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}

function PageRow({
  page,
  isRTL,
  subdomain,
  isFirst,
  isLast,
  isDirty,
  onEdit,
  onToggle,
  onDelete,
}: PageRowProps) {
  const displayTitle = isRTL && page.titleAr ? page.titleAr : page.title;
  const altTitle     = isRTL && page.titleAr ? page.title : page.titleAr;

  // Build the storefront URL for this page so the merchant can open it
  // in a new tab and confirm the content matches their edits. Disabled
  // when the page is hidden (Next.js returns 404 in that case), and
  // marked with a warning tooltip when local edits haven't saved yet.
  const storeUrl = subdomain ? getStoreUrl(subdomain) : null;
  const viewUrl = storeUrl ? `${storeUrl.replace(/\/+$/, "")}/pages/${page.slug}` : null;

  return (
    <div className={cn(
      "group flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors",
      isFirst && "rounded-t-2xl", isLast && "rounded-b-2xl"
    )}>
      {/* Icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-muted/80">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium leading-tight">{displayTitle}</span>
          {altTitle && (
            <span className="text-xs text-muted-foreground/60">{altTitle}</span>
          )}
          {page.published ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              <Globe className="h-2.5 w-2.5" />
              {isRTL ? "مرئي" : "Visible"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60">
              <EyeOff className="h-2.5 w-2.5" />
              {isRTL ? "مخفي" : "Hidden"}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-1">
          <Globe className="h-2.5 w-2.5" />
          /pages/{page.slug}
        </p>
      </div>

      {/* Date */}
      <span className="text-xs text-muted-foreground/50 hidden sm:block shrink-0">
        {new Date(page.updatedAt).toLocaleDateString(isRTL ? "ar-EG" : "en-US", { month: "short", day: "numeric" })}
      </span>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 px-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 me-2" />
            {isRTL ? "تعديل" : "Edit"}
          </DropdownMenuItem>
          {viewUrl && page.published && (
            <DropdownMenuItem
              onClick={() =>
                window.open(viewUrl, "_blank", "noopener,noreferrer")
              }
              // Surface dirty state in the label so the merchant doesn't
              // open the URL, see the old content, and think Save was a
              // no-op. Hidden pages return 404 on the storefront, so we
              // gate the entry on `page.published` to avoid the trip.
              title={
                isDirty
                  ? isRTL
                    ? "احفظ التغييرات أولاً لرؤية أحدث نسخة"
                    : "Save changes first to see the latest version"
                  : undefined
              }
            >
              <ExternalLink className="h-3.5 w-3.5 me-2" />
              {isRTL ? "عرض في المتجر" : "View on storefront"}
              {isDirty && (
                <span className="ms-auto text-[10px] text-amber-600">
                  {isRTL ? "غير محفوظ" : "unsaved"}
                </span>
              )}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onToggle}>
            {page.published
              ? <><EyeOff className="h-3.5 w-3.5 me-2" />{isRTL ? "إخفاء" : "Hide"}</>
              : <><Eye  className="h-3.5 w-3.5 me-2" />{isRTL ? "نشر"  : "Show"}</>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 me-2" />
            {isRTL ? "حذف" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ isRTL, hasSearch, onAdd }: { isRTL: boolean; hasSearch: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center py-16 px-4 text-center rounded-2xl border border-dashed bg-muted/10">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
        <FileText className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-semibold mb-1">
        {hasSearch
          ? isRTL ? "لا توجد نتائج" : "No pages found"
          : isRTL ? "لا توجد صفحات بعد" : "No pages yet"}
      </p>
      <p className="text-xs text-muted-foreground max-w-xs mb-5">
        {hasSearch
          ? isRTL ? "جرب كلمات بحث أخرى" : "Try a different search term"
          : isRTL
            ? "أنشئ صفحات مثل «عن المتجر» و«تواصل معنا» لتعزيز ثقة عملائك"
            : "Create pages like About Us and Contact to build trust with your customers"}
      </p>
      {!hasSearch && (
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 me-1.5" />
          {isRTL ? "إنشاء أول صفحة" : "Create your first page"}
        </Button>
      )}
    </div>
  );
}
