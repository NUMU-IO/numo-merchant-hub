import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  listPages,
  createPage,
  upsertPage,
  deletePage,
  type StorePage,
} from "@/services/pagesApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Eye, Search, Globe, EyeOff, Loader2, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/ui/help-tip";
import { getStoreUrl } from "@/lib/storefront";

function makeSlug(title: string) {
  return title.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/** Local editing shape (flattened from the API's bilingual maps). */
interface PageDraft {
  handle?: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  seoTitleEn: string;
  seoTitleAr: string;
  seoDescEn: string;
  seoDescAr: string;
  isPublished: boolean;
  /** Original handle when editing (so we PUT to the right key). */
  originalHandle?: string;
}

function toDraft(p?: StorePage): PageDraft {
  const seo = p?.seo as
    | { title?: { en?: string; ar?: string }; description?: { en?: string; ar?: string } }
    | undefined;
  return {
    handle: p?.handle,
    originalHandle: p?.handle,
    titleEn: p?.title?.en ?? "",
    titleAr: p?.title?.ar ?? "",
    bodyEn: p?.body?.en ?? "",
    bodyAr: p?.body?.ar ?? "",
    seoTitleEn: seo?.title?.en ?? "",
    seoTitleAr: seo?.title?.ar ?? "",
    seoDescEn: seo?.description?.en ?? "",
    seoDescAr: seo?.description?.ar ?? "",
    isPublished: p?.is_published ?? false,
  };
}

export default function OnlineStorePages() {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id ?? "";

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PageDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorePage | null>(null);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ["pages", storeId],
    queryFn: () => listPages(storeId),
    enabled: !!storeId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["pages", storeId] });

  const saveMutation = useMutation({
    mutationFn: async (d: PageDraft) => {
      const payload = {
        title: { en: d.titleEn, ar: d.titleAr },
        body: { en: d.bodyEn, ar: d.bodyAr },
        seo: {
          title: { en: d.seoTitleEn, ar: d.seoTitleAr },
          description: { en: d.seoDescEn, ar: d.seoDescAr },
        },
        is_published: d.isPublished,
      };
      if (d.originalHandle) {
        return upsertPage(storeId, d.originalHandle, payload);
      }
      const handle = makeSlug(d.titleEn) || `page-${Date.now()}`;
      return createPage(storeId, { handle, ...payload });
    },
    onSuccess: () => {
      invalidate();
      toast.success(isRTL ? "تم حفظ الصفحة" : "Page saved");
      setEditing(null);
    },
    onError: (err) => showError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (handle: string) => deletePage(storeId, handle),
    onSuccess: () => {
      invalidate();
      toast.success(isRTL ? "تم حذف الصفحة" : "Page deleted");
      setDeleteTarget(null);
    },
    onError: (err) => showError(err),
  });

  const togglePublish = useMutation({
    mutationFn: (p: StorePage) =>
      upsertPage(storeId, p.handle, { is_published: !p.is_published }),
    onSuccess: () => invalidate(),
    onError: (err) => showError(err),
  });

  const filtered = pages.filter((p) => {
    const q = search.toLowerCase();
    return (
      (p.title?.en ?? "").toLowerCase().includes(q) ||
      (p.title?.ar ?? "").toLowerCase().includes(q) ||
      p.handle.includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
            {isRTL ? "الصفحات" : "Pages"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isRTL
              ? "إدارة صفحات المحتوى الثابت في متجرك"
              : "Manage static content pages for your store"}
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing(toDraft())}>
          <Plus className="h-3.5 w-3.5 me-1.5" />
          {isRTL ? "صفحة جديدة" : "Add page"}
        </Button>
      </div>

      <HelpTip title={isRTL ? "كيف تدير صفحات متجرك؟" : "How to manage your pages"}>
        <ul className="list-inside list-disc space-y-1">
          <li>{isRTL ? "أنشئ صفحات مثل «عن المتجر» و«تواصل معنا» لبناء ثقة عملائك." : "Create pages like About Us and Contact to build customer trust."}</li>
          <li>{isRTL ? "كل صفحة تدعم عنوانًا ومحتوى بالإنجليزية والعربية — يظهر المناسب حسب لغة الزائر." : "Each page supports English + Arabic title and body — the right one shows by visitor language."}</li>
          <li>{isRTL ? "رابط الصفحة يُنشأ من العنوان الإنجليزي — مثلاً /pages/about-us." : "The page URL is generated from the English title — e.g. /pages/about-us."}</li>
          <li>{isRTL ? "تُحفظ كل صفحة فورًا عند الحفظ — لا حاجة لزر حفظ منفصل." : "Each page saves immediately — no separate Save step."}</li>
        </ul>
      </HelpTip>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 ps-9 text-sm"
          placeholder={isRTL ? "ابحث في الصفحات..." : "Search pages..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState isRTL={isRTL} hasSearch={!!search} onAdd={() => setEditing(toDraft())} />
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border bg-card">
          {filtered.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              isRTL={isRTL}
              subdomain={currentStore?.subdomain ?? ""}
              onEdit={() => setEditing(toDraft(page))}
              onToggle={() => togglePublish.mutate(page)}
              onDelete={() => setDeleteTarget(page)}
            />
          ))}
        </div>
      )}

      {/* Edit / Create dialog */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {editing?.originalHandle
                ? isRTL ? "تعديل الصفحة" : "Edit page"
                : isRTL ? "صفحة جديدة" : "New page"}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto py-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isRTL ? "العنوان (إنجليزي)" : "Title (English)"}
                    <span className="ms-0.5 text-destructive">*</span>
                  </Label>
                  <Input
                    value={editing.titleEn}
                    onChange={(e) => setEditing({ ...editing, titleEn: e.target.value })}
                    placeholder="About Us"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{isRTL ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
                  <Input
                    dir="rtl"
                    value={editing.titleAr}
                    onChange={(e) => setEditing({ ...editing, titleAr: e.target.value })}
                    placeholder="عن المتجر"
                  />
                </div>
              </div>

              {/* Slug preview */}
              {(editing.handle || editing.titleEn) && (
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <span className="opacity-60">{currentStore?.subdomain ?? "yourstore"}.numueg.app/pages/</span>
                  <span className="font-medium text-foreground/70">
                    {editing.handle ?? makeSlug(editing.titleEn) ?? "—"}
                  </span>
                </p>
              )}

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{isRTL ? "المحتوى (إنجليزي)" : "Body (English)"}</Label>
                  <Textarea
                    value={editing.bodyEn}
                    onChange={(e) => setEditing({ ...editing, bodyEn: e.target.value })}
                    rows={5}
                    placeholder={isRTL ? "محتوى الصفحة بالإنجليزية..." : "Page content in English…"}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{isRTL ? "المحتوى (عربي)" : "Body (Arabic)"}</Label>
                  <Textarea
                    dir="rtl"
                    value={editing.bodyAr}
                    onChange={(e) => setEditing({ ...editing, bodyAr: e.target.value })}
                    rows={5}
                    placeholder={isRTL ? "محتوى الصفحة بالعربية..." : "Page content in Arabic…"}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* SEO */}
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isRTL ? "تحسين محركات البحث (SEO)" : "Search engine listing"}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRTL ? "عنوان الميتا (إنجليزي)" : "Meta title (English)"}</Label>
                    <Input
                      value={editing.seoTitleEn}
                      onChange={(e) => setEditing({ ...editing, seoTitleEn: e.target.value })}
                      placeholder={editing.titleEn || "About Us — My Store"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRTL ? "عنوان الميتا (عربي)" : "Meta title (Arabic)"}</Label>
                    <Input
                      dir="rtl"
                      value={editing.seoTitleAr}
                      onChange={(e) => setEditing({ ...editing, seoTitleAr: e.target.value })}
                      placeholder={editing.titleAr || "عن المتجر — متجري"}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRTL ? "وصف الميتا (إنجليزي)" : "Meta description (English)"}</Label>
                    <Textarea
                      value={editing.seoDescEn}
                      onChange={(e) => setEditing({ ...editing, seoDescEn: e.target.value })}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isRTL ? "وصف الميتا (عربي)" : "Meta description (Arabic)"}</Label>
                    <Textarea
                      dir="rtl"
                      value={editing.seoDescAr}
                      onChange={(e) => setEditing({ ...editing, seoDescAr: e.target.value })}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Published toggle */}
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{isRTL ? "منشورة" : "Published"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {isRTL ? "تظهر للزوار على المتجر" : "Visible to shoppers on the storefront"}
                  </p>
                </div>
                <Switch
                  checked={editing.isPublished}
                  onCheckedChange={(v) => setEditing({ ...editing, isPublished: v })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
            <Button
              onClick={() => editing && saveMutation.mutate(editing)}
              disabled={!editing?.titleEn.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
              {isRTL ? "حفظ" : "Save page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm" dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "حذف الصفحة" : "Delete page"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `سيتم حذف صفحة "${deleteTarget?.title?.ar || deleteTarget?.title?.en}" نهائيًا. لا يمكن التراجع.`
                : `"${deleteTarget?.title?.en}" will be permanently deleted. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.handle)}
              disabled={deleteMutation.isPending}
            >
              {isRTL ? "حذف" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Page row ──────────────────────────────────────────────────────────────
function PageRow({
  page, isRTL, subdomain, onEdit, onToggle, onDelete,
}: {
  page: StorePage; isRTL: boolean; subdomain: string;
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const displayTitle = (isRTL && page.title?.ar) ? page.title.ar : (page.title?.en || page.handle);
  const storeUrl = subdomain ? getStoreUrl(subdomain) : null;
  const viewUrl = storeUrl ? `${storeUrl.replace(/\/+$/, "")}/pages/${page.handle}` : null;

  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium leading-tight">{displayTitle}</span>
          {page.is_published ? (
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
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/60">
          <Globe className="h-2.5 w-2.5" />
          /pages/{page.handle}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 px-0 opacity-0 transition-opacity group-hover:opacity-100">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 me-2" />
            {isRTL ? "تعديل" : "Edit"}
          </DropdownMenuItem>
          {viewUrl && page.is_published && (
            <DropdownMenuItem onClick={() => window.open(viewUrl, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="h-3.5 w-3.5 me-2" />
              {isRTL ? "عرض في المتجر" : "View on storefront"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onToggle}>
            {page.is_published
              ? <><EyeOff className="h-3.5 w-3.5 me-2" />{isRTL ? "إخفاء" : "Hide"}</>
              : <><Eye className="h-3.5 w-3.5 me-2" />{isRTL ? "نشر" : "Show"}</>}
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

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ isRTL, hasSearch, onAdd }: { isRTL: boolean; hasSearch: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-muted/10 px-4 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <FileText className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <p className="mb-1 text-sm font-semibold">
        {hasSearch ? (isRTL ? "لا توجد نتائج" : "No pages found") : (isRTL ? "لا توجد صفحات بعد" : "No pages yet")}
      </p>
      <p className="mb-5 max-w-xs text-xs text-muted-foreground">
        {hasSearch
          ? isRTL ? "جرب كلمات بحث أخرى" : "Try a different search term"
          : isRTL ? "أنشئ صفحات مثل «عن المتجر» و«تواصل معنا»" : "Create pages like About Us and Contact"}
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
