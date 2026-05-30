import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { fetchCustomization, updateCustomization } from "@/services/themeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  Plus, GripVertical, Trash2, Pencil, Navigation2, Link2,
  LayoutGrid, Loader2, Save, ArrowUp, ArrowDown, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/ui/help-tip";

interface NavLink { label: string; labelAr?: string; to: string }
interface EditState extends NavLink { index?: number }

function isExternal(url: string) {
  return /^https?:\/\//.test(url.trim());
}

export default function OnlineStoreNavigation() {
  const { isRTL } = useLanguage();
  const { currentStore } = useDashboardStore();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id ?? "";

  const [editingLink, setEditingLink] = useState<EditState | null>(null);
  const [links, setLinks] = useState<NavLink[]>([]);
  const [showCategories, setShowCategories] = useState(true);
  const [collectionsDropdown, setCollectionsDropdown] = useState(true);
  const [collectionsLabel, setCollectionsLabel] = useState("Collections");
  const [collectionsLabelAr, setCollectionsLabelAr] = useState("المجموعات");
  const [collectionsMaxItems, setCollectionsMaxItems] = useState(12);
  const [showAllCollectionsLink, setShowAllCollectionsLink] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const initializedRef = useRef(false);

  const { data: customization, isLoading } = useQuery({
    queryKey: ["customization", storeId],
    queryFn: () => fetchCustomization(storeId),
    enabled: !!storeId,
  });

  // Seed local state ONCE — never overwrite user edits on refetch
  useEffect(() => {
    if (!customization || initializedRef.current) return;
    initializedRef.current = true;
    setLinks(customization.navigation?.links ?? []);
    setShowCategories(customization.navigation?.show_categories_in_nav ?? true);
    setCollectionsDropdown(customization.navigation?.collections_dropdown ?? true);
    setCollectionsLabel(customization.navigation?.collections_label ?? "Collections");
    setCollectionsLabelAr(customization.navigation?.collections_label_ar ?? "المجموعات");
    setCollectionsMaxItems(customization.navigation?.collections_max_items ?? 12);
    setShowAllCollectionsLink(customization.navigation?.show_all_collections_link ?? true);
  }, [customization]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateCustomization(storeId, {
        navigation: { 
          links, 
          show_categories_in_nav: showCategories,
          collections_dropdown: collectionsDropdown,
          collections_label: collectionsLabel,
          collections_label_ar: collectionsLabelAr,
          collections_max_items: collectionsMaxItems,
          show_all_collections_link: showAllCollectionsLink,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customization", storeId] });
      toast.success(isRTL ? "تم حفظ التنقل" : "Navigation saved");
      setIsDirty(false);
    },
    onError: (err) => showError(err),
  });

  function markDirty() { setIsDirty(true); }

  function handleSaveLink() {
    if (!editingLink?.label?.trim() || !editingLink?.to?.trim()) return;
    const { index, ...link } = editingLink;
    setLinks((prev) =>
      index !== undefined
        ? prev.map((l, i) => (i === index ? link : l))
        : [...prev, link]
    );
    setEditingLink(null);
    markDirty();
  }

  function handleDelete(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
    markDirty();
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...links];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setLinks(next);
    markDirty();
  }

  // Drag-and-drop
  function handleDragStart(i: number) { setDragIndex(i); }
  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault();
    setDragOverIndex(i);
    if (dragIndex === null || dragIndex === i) return;
    setLinks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(i, 0, moved);
      return next;
    });
    setDragIndex(i);
    markDirty();
  }
  function handleDragEnd() { setDragIndex(null); setDragOverIndex(null); }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isRTL ? "التنقل" : "Navigation"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL
              ? "بناء القوائم والروابط في رأس وتذييل متجرك"
              : "Build the menus shown in your store's header and footer"}
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
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading || !isDirty}
          >
            {saveMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              : <Save className="h-3.5 w-3.5 me-1.5" />}
            {isRTL ? "حفظ" : "Save"}
          </Button>
        </div>
      </div>

      {/* Help tip */}
      <HelpTip title={isRTL ? "كيف تبني قائمة التنقل؟" : "How to build your navigation"}>
        <ul className="list-disc list-inside space-y-1">
          <li>{isRTL ? "أضف روابط لصفحات متجرك مثل «الأقسام» و«تواصل معنا» — يمكنك استخدام مسارات نسبية مثل /products أو روابط كاملة." : "Add links to your store pages like Collections and Contact — use relative paths like /products or full URLs."}</li>
          <li>{isRTL ? "اسحب وأفلت الروابط لإعادة ترتيبها أو استخدم أسهم الترتيب." : "Drag and drop links to reorder them, or use the arrow buttons."}</li>
          <li>{isRTL ? "فعّل «عرض الأقسام في القائمة» لإضافة أقسام المنتجات تلقائيًا بجانب الروابط المخصصة." : "Enable 'Show categories in menu' to auto-append product category links alongside your custom links."}</li>
          <li>{isRTL ? "كل رابط يدعم عنوان إنجليزي وعربي — يظهر العنوان المناسب حسب لغة الزائر." : "Each link supports English and Arabic labels — the correct one displays based on visitor language."}</li>
          <li>{isRTL ? "اضغط «حفظ» لتطبيق التغييرات على واجهة متجرك." : "Click Save to apply changes to your storefront."}</li>
        </ul>
      </HelpTip>

      {/* Collections dropdown card */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{isRTL ? "قائمة المجموعات" : "Collections dropdown"}</span>
          </div>
          <Switch checked={collectionsDropdown} onCheckedChange={(c) => { setCollectionsDropdown(c); markDirty(); }} />
        </div>
        {collectionsDropdown && (
          <div className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              {isRTL ? "المجموعات تُعرض تلقائياً من أقسام المنتجات — لإدارتها انتقل إلى المنتجات → الأقسام" : "Collections are synced from your product categories — manage them in Products → Categories"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">{isRTL ? "العنوان (الإنجليزية)" : "Label (English)"}</Label>
                <Input
                  value={collectionsLabel}
                  onChange={(e) => { setCollectionsLabel(e.target.value); markDirty(); }}
                  placeholder="Collections"
                  className="h-8 mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">{isRTL ? "العنوان (العربية)" : "Label (Arabic)"}</Label>
                <Input
                  value={collectionsLabelAr}
                  onChange={(e) => { setCollectionsLabelAr(e.target.value); markDirty(); }}
                  placeholder="المجموعات"
                  className="h-8 mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">{isRTL ? "الحد الأقصى للعناصر" : "Max items shown"}</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={collectionsMaxItems}
                  onChange={(e) => { setCollectionsMaxItems(Number(e.target.value)); markDirty(); }}
                  className="h-8 mt-1"
                />
              </div>
              <div className="flex items-center gap-2 h-full pb-3">
                <Switch checked={showAllCollectionsLink} onCheckedChange={(c) => { setShowAllCollectionsLink(c); markDirty(); }} />
                <Label className="text-xs">{isRTL ? "إظهار رابط «كل المنتجات»" : "Show 'All Products' link"}</Label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main menu card */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Navigation2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{isRTL ? "القائمة الرئيسية" : "Main menu"}</span>
            {links.length > 0 && (
              <span className="text-[11px] text-muted-foreground/60">({links.length})</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-medium text-primary hover:text-primary hover:bg-primary/8"
            onClick={() => setEditingLink({ label: "", to: "" })}
          >
            <Plus className="h-3.5 w-3.5 me-1" />
            {isRTL ? "إضافة رابط" : "Add link"}
          </Button>
        </div>

        {/* Empty state */}
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-4 w-4 rounded bg-muted" />
                <div className="flex-1 h-4 rounded bg-muted" />
                <div className="h-4 w-12 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="flex flex-col items-center py-10 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-3">
              <Link2 className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium mb-0.5">{isRTL ? "لا توجد روابط بعد" : "No links yet"}</p>
            <p className="text-xs text-muted-foreground mb-4">
              {isRTL ? "أضف روابط لتظهر في قائمة التنقل" : "Add links to appear in your store navigation"}
            </p>
            <Button variant="outline" size="sm" onClick={() => setEditingLink({ label: "", to: "" })}>
              <Plus className="h-3.5 w-3.5 me-1.5" />
              {isRTL ? "إضافة أول رابط" : "Add your first link"}
            </Button>
          </div>
        ) : (
          <ul>
            {links.map((link, i) => (
              <li
                key={i}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "group flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 transition-colors",
                  dragOverIndex === i && dragIndex !== i
                    ? "bg-primary/5 border-primary/30"
                    : "hover:bg-muted/20",
                )}
              >
                {/* Drag handle */}
                <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab active:cursor-grabbing shrink-0 group-hover:text-muted-foreground/60 transition-colors" />

                {/* Link type icon */}
                <div className="shrink-0">
                  {isExternal(link.to)
                    ? <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40" />
                    : <Link2 className="h-3.5 w-3.5 text-muted-foreground/40" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">
                    {isRTL && link.labelAr ? link.labelAr : link.label}
                    {isRTL && link.labelAr && link.label && (
                      <span className="ms-1.5 text-muted-foreground/50 font-normal text-xs">{link.label}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{link.to}</p>
                </div>

                {/* Actions — visible on hover */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 w-7 px-0" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 px-0" onClick={() => move(i, 1)} disabled={i === links.length - 1} title="Move down">
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 px-0" onClick={() => setEditingLink({ ...link, index: i })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 px-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Display options */}
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
          {isRTL ? "خيارات العرض" : "Display options"}
        </p>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted shrink-0 mt-0.5">
              <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{isRTL ? "عرض الأقسام في القائمة" : "Show categories in menu"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isRTL
                  ? "يضيف روابط أقسام المنتجات تلقائيًا إلى القائمة الرئيسية"
                  : "Automatically appends product category links to the main menu"}
              </p>
            </div>
          </div>
          <Switch
            checked={showCategories}
            onCheckedChange={(v) => { setShowCategories(v); markDirty(); }}
          />
        </div>
      </div>

      {/* Edit/Add dialog */}
      <Dialog open={editingLink !== null} onOpenChange={() => setEditingLink(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLink?.index !== undefined
                ? isRTL ? "تعديل الرابط" : "Edit link"
                : isRTL ? "إضافة رابط" : "Add link"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Labels row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{isRTL ? "النص (إنجليزي)" : "Label (English)"}</Label>
                <Input
                  value={editingLink?.label ?? ""}
                  onChange={(e) => setEditingLink((l) => l ? { ...l, label: e.target.value } : l)}
                  placeholder="Shop"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{isRTL ? "النص (عربي)" : "Label (Arabic)"}</Label>
                <Input
                  dir="rtl"
                  value={editingLink?.labelAr ?? ""}
                  onChange={(e) => setEditingLink((l) => l ? { ...l, labelAr: e.target.value } : l)}
                  placeholder="تسوق"
                />
              </div>
            </div>

            {/* URL */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{isRTL ? "الرابط" : "Link URL"}</Label>
              <div className="relative">
                <div className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                  {editingLink?.to && isExternal(editingLink.to)
                    ? <ExternalLink className="h-3.5 w-3.5" />
                    : <Link2 className="h-3.5 w-3.5" />}
                </div>
                <Input
                  value={editingLink?.to ?? ""}
                  onChange={(e) => setEditingLink((l) => l ? { ...l, to: e.target.value } : l)}
                  placeholder="/collections/all"
                  dir="ltr"
                  className="ps-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? "مسار نسبي مثل /products أو رابط كامل مثل https://..."
                  : "A relative path like /products or a full URL like https://..."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLink(null)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
            <Button
              onClick={handleSaveLink}
              disabled={!editingLink?.label?.trim() || !editingLink?.to?.trim()}
            >
              {isRTL ? "حفظ" : "Save link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
