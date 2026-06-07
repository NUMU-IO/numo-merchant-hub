import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  listMenus,
  upsertMenu,
  createMenu,
  deleteMenu,
  type MenuItem,
} from "@/services/menusApi";
import { LinkPickerButton } from "@/features/theme-editor-v3/components/inputs/LinkPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  Plus,
  Trash2,
  Pencil,
  Navigation2,
  Link2,
  Loader2,
  Save,
  ArrowUp,
  ArrowDown,
  CornerDownRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpTip } from "@/components/ui/help-tip";

const MAX_DEPTH = 3;

function genId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function blankItem(): MenuItem {
  return { id: genId(), label: { en: "", ar: "" }, url: "", type: "link", children: [] };
}

function isExternal(url: string) {
  return /^https?:\/\//.test((url || "").trim());
}

// ── Immutable nested-item helpers (path = array of sibling indices) ──────────
function updateSiblings(
  items: MenuItem[],
  parentPath: number[],
  fn: (sibs: MenuItem[]) => MenuItem[],
): MenuItem[] {
  if (parentPath.length === 0) return fn(items);
  const [head, ...rest] = parentPath;
  return items.map((it, i) =>
    i === head ? { ...it, children: updateSiblings(it.children ?? [], rest, fn) } : it,
  );
}

function updateAtPath(
  items: MenuItem[],
  path: number[],
  updater: (it: MenuItem) => MenuItem,
): MenuItem[] {
  const parent = path.slice(0, -1);
  const idx = path[path.length - 1];
  return updateSiblings(items, parent, (sibs) =>
    sibs.map((it, i) => (i === idx ? updater(it) : it)),
  );
}

function removeAtPath(items: MenuItem[], path: number[]): MenuItem[] {
  const parent = path.slice(0, -1);
  const idx = path[path.length - 1];
  return updateSiblings(items, parent, (sibs) => sibs.filter((_, i) => i !== idx));
}

function moveAtPath(items: MenuItem[], path: number[], dir: -1 | 1): MenuItem[] {
  const parent = path.slice(0, -1);
  const idx = path[path.length - 1];
  return updateSiblings(items, parent, (sibs) => {
    const target = idx + dir;
    if (target < 0 || target >= sibs.length) return sibs;
    const next = [...sibs];
    [next[idx], next[target]] = [next[target], next[idx]];
    return next;
  });
}

// Sensible defaults so an unseeded store is instantly usable (mirrors the
// backend's build_default_menus on store-create).
function defaultMenuSeed(handle: string): { title: Record<string, string>; items: MenuItem[] } {
  if (handle === "footer") {
    return {
      title: { en: "Footer", ar: "تذييل الصفحة" },
      items: [
        { id: genId(), label: { en: "Shipping", ar: "الشحن" }, url: "/shipping", type: "page", children: [] },
        { id: genId(), label: { en: "Returns", ar: "الإرجاع" }, url: "/returns", type: "page", children: [] },
        { id: genId(), label: { en: "FAQ", ar: "الأسئلة الشائعة" }, url: "/faq", type: "page", children: [] },
        { id: genId(), label: { en: "Track order", ar: "تتبّع الطلب" }, url: "/track", type: "page", children: [] },
      ],
    };
  }
  return {
    title: { en: "Main menu", ar: "القائمة الرئيسية" },
    items: [
      { id: genId(), label: { en: "Home", ar: "الرئيسية" }, url: "/", type: "home", children: [] },
      { id: genId(), label: { en: "Products", ar: "المنتجات" }, url: "/products", type: "catalog", children: [] },
      { id: genId(), label: { en: "About", ar: "من نحن" }, url: "/about", type: "page", children: [] },
      { id: genId(), label: { en: "Contact", ar: "اتصل بنا" }, url: "/contact", type: "page", children: [] },
    ],
  };
}

interface EditState {
  path: number[];
  labelEn: string;
  labelAr: string;
  url: string;
}

export default function OnlineStoreNavigation() {
  const { isRTL } = useLanguage();
  const locale: "en" | "ar" = isRTL ? "ar" : "en";
  const { currentStore } = useDashboardStore();
  const queryClient = useQueryClient();
  const storeId = currentStore?.id ?? "";

  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [title, setTitle] = useState<{ en: string; ar: string }>({ en: "", ar: "" });
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [creating, setCreating] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const [newTitleEn, setNewTitleEn] = useState("");
  const seededRef = useRef<string | null>(null);

  const { data: menus, isLoading } = useQuery({
    queryKey: ["menus", storeId],
    queryFn: () => listMenus(storeId),
    enabled: !!storeId,
  });

  // Pick a default selected menu once menus load.
  useEffect(() => {
    if (!menus || selectedHandle !== null) return;
    if (menus.length > 0) {
      const pick = menus.find((m) => m.handle === "main-menu") ?? menus[0];
      setSelectedHandle(pick.handle);
    }
  }, [menus, selectedHandle]);

  // Seed the editable draft from the selected menu. Reseeds on menu switch
  // and on fresh data (post-save refetch); local edits are only discarded by
  // an explicit menu switch.
  useEffect(() => {
    if (!menus || selectedHandle === null) return;
    const m = menus.find((x) => x.handle === selectedHandle);
    if (!m) return;
    if (seededRef.current === selectedHandle && isDirty) return;
    seededRef.current = selectedHandle;
    setTitle({ en: m.title?.en ?? "", ar: m.title?.ar ?? "" });
    setItems(structuredClone(m.items ?? []));
    setIsDirty(false);
  }, [menus, selectedHandle, isDirty]);

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertMenu(storeId, selectedHandle as string, {
        title: { en: title.en, ar: title.ar },
        items,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus", storeId] });
      toast.success(isRTL ? "تم حفظ القائمة" : "Menu saved");
      setIsDirty(false);
    },
    onError: (err) => showError(err),
  });

  const createMutation = useMutation({
    mutationFn: (handle: string) => {
      const seed = defaultMenuSeed(handle);
      return createMenu(storeId, {
        handle,
        title: handle === "main-menu" || handle === "footer" ? seed.title : { en: newTitleEn || handle },
        items: handle === "main-menu" || handle === "footer" ? seed.items : [],
      });
    },
    onSuccess: (menu) => {
      queryClient.invalidateQueries({ queryKey: ["menus", storeId] });
      setSelectedHandle(menu.handle);
      seededRef.current = null;
      setCreating(false);
      setNewHandle("");
      setNewTitleEn("");
      toast.success(isRTL ? "تم إنشاء القائمة" : "Menu created");
    },
    onError: (err) => showError(err),
  });

  const deleteMutation = useMutation({
    mutationFn: (handle: string) => deleteMenu(storeId, handle),
    onSuccess: (_d, handle) => {
      queryClient.invalidateQueries({ queryKey: ["menus", storeId] });
      if (selectedHandle === handle) {
        setSelectedHandle(null);
        seededRef.current = null;
      }
      toast.success(isRTL ? "تم حذف القائمة" : "Menu deleted");
    },
    onError: (err) => showError(err),
  });

  const markDirty = () => setIsDirty(true);

  // ── Item mutations ──
  function addRootItem() {
    setItems((prev) => [...prev, blankItem()]);
    markDirty();
  }
  function addChild(path: number[]) {
    setItems((prev) =>
      updateAtPath(prev, path, (it) => ({
        ...it,
        children: [...(it.children ?? []), blankItem()],
      })),
    );
    markDirty();
  }
  function removeItem(path: number[]) {
    setItems((prev) => removeAtPath(prev, path));
    markDirty();
  }
  function moveItem(path: number[], dir: -1 | 1) {
    setItems((prev) => moveAtPath(prev, path, dir));
    markDirty();
  }
  function openEdit(path: number[], it: MenuItem) {
    setEditing({
      path,
      labelEn: it.label?.en ?? "",
      labelAr: it.label?.ar ?? "",
      url: it.url ?? "",
    });
  }
  function saveEdit() {
    if (!editing) return;
    const { path, labelEn, labelAr, url } = editing;
    setItems((prev) =>
      updateAtPath(prev, path, (it) => ({
        ...it,
        label: { en: labelEn, ar: labelAr },
        url,
      })),
    );
    setEditing(null);
    markDirty();
  }

  const selectedMenu = menus?.find((m) => m.handle === selectedHandle) ?? null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
            {isRTL ? "التنقل" : "Navigation"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isRTL
              ? "أنشئ قوائم يمكن لثيمك عرضها في الرأس والتذييل"
              : "Build menus your theme shows in the header and footer"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isDirty && (
            <Badge
              variant="outline"
              className="text-[10px] text-amber-600 border-amber-300 dark:border-amber-700 dark:text-amber-400"
            >
              {isRTL ? "تغييرات غير محفوظة" : "Unsaved changes"}
            </Badge>
          )}
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading || !isDirty || !selectedHandle}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 me-1.5" />
            )}
            {isRTL ? "حفظ" : "Save"}
          </Button>
        </div>
      </div>

      <HelpTip title={isRTL ? "كيف تبني قوائمك؟" : "How menus work"}>
        <ul className="list-disc list-inside space-y-1">
          <li>{isRTL ? "‏«main-menu» تظهر في رأس المتجر و«footer» في التذييل — ويمكنك إنشاء قوائم مخصّصة." : "main-menu shows in your header, footer in the footer — and you can add custom menus."}</li>
          <li>{isRTL ? "أضف عناصر فرعية لإنشاء قوائم منسدلة (حتى ٣ مستويات)." : "Add sub-items to build dropdowns (up to 3 levels deep)."}</li>
          <li>{isRTL ? "كل عنصر له عنوان إنجليزي وعربي ووجهة تختارها من منتقي الروابط." : "Each item has an English + Arabic label and a destination you pick from the link picker."}</li>
          <li>{isRTL ? "اضغط «حفظ» لتطبيق التغييرات على واجهة متجرك." : "Click Save to apply changes to your storefront."}</li>
        </ul>
      </HelpTip>

      {/* Menu selector tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(menus ?? []).map((m) => (
          <button
            key={m.handle}
            onClick={() => setSelectedHandle(m.handle)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              selectedHandle === m.handle
                ? "border-primary bg-primary/10 font-medium text-foreground"
                : "border-input text-muted-foreground hover:border-primary/40",
            )}
          >
            {m.title?.[locale] || m.title?.en || m.handle}
            <span className="ms-1.5 font-mono text-[10px] text-muted-foreground/60">
              {m.handle}
            </span>
          </button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-primary"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-3.5 w-3.5 me-1" />
          {isRTL ? "قائمة جديدة" : "Create menu"}
        </Button>
      </div>

      {/* Empty state — no menus yet (e.g. existing store before seeding) */}
      {!isLoading && (menus ?? []).length === 0 && (
        <div className="rounded-2xl border bg-card flex flex-col items-center py-10 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-3">
            <Navigation2 className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium mb-0.5">{isRTL ? "لا توجد قوائم بعد" : "No menus yet"}</p>
          <p className="text-xs text-muted-foreground mb-4">
            {isRTL ? "ابدأ بقائمة الرأس والتذييل الافتراضية" : "Start with a default header + footer menu"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => createMutation.mutate("main-menu")} disabled={createMutation.isPending}>
              {isRTL ? "إنشاء القائمة الرئيسية" : "Create main menu"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => createMutation.mutate("footer")} disabled={createMutation.isPending}>
              {isRTL ? "إنشاء التذييل" : "Create footer"}
            </Button>
          </div>
        </div>
      )}

      {/* Selected menu editor */}
      {selectedHandle && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/20">
            <div className="flex items-center gap-2 min-w-0">
              <Navigation2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={title[locale]}
                onChange={(e) => {
                  const v = e.target.value;
                  setTitle((t) => ({ ...t, [locale]: v }));
                  markDirty();
                }}
                dir={isRTL ? "rtl" : "ltr"}
                placeholder={isRTL ? "اسم القائمة" : "Menu title"}
                className="h-8 max-w-[220px]"
              />
              <span className="font-mono text-[10px] text-muted-foreground/60 shrink-0">
                {selectedHandle}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-primary" onClick={addRootItem}>
                <Plus className="h-3.5 w-3.5 me-1" />
                {isRTL ? "إضافة عنصر" : "Add item"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 px-0 text-muted-foreground hover:text-destructive"
                title={isRTL ? "حذف القائمة" : "Delete menu"}
                onClick={() => {
                  if (selectedMenu && confirm(isRTL ? `حذف القائمة «${selectedHandle}»؟` : `Delete the "${selectedHandle}" menu?`)) {
                    deleteMutation.mutate(selectedHandle);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center py-10 px-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted mb-3">
                <Link2 className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {isRTL ? "لا توجد عناصر — أضف أول رابط" : "No items — add your first link"}
              </p>
              <Button variant="outline" size="sm" onClick={addRootItem}>
                <Plus className="h-3.5 w-3.5 me-1.5" />
                {isRTL ? "إضافة عنصر" : "Add item"}
              </Button>
            </div>
          ) : (
            <ul className="py-1">
              {items.map((it, i) => (
                <MenuItemRow
                  key={it.id ?? i}
                  item={it}
                  path={[i]}
                  depth={1}
                  locale={locale}
                  isRTL={isRTL}
                  onEdit={openEdit}
                  onAddChild={addChild}
                  onRemove={removeItem}
                  onMove={moveItem}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Item edit dialog */}
      <Dialog open={editing !== null} onOpenChange={() => setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? "تعديل العنصر" : "Edit item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{isRTL ? "النص (إنجليزي)" : "Label (English)"}</Label>
                <Input
                  value={editing?.labelEn ?? ""}
                  onChange={(e) => setEditing((s) => (s ? { ...s, labelEn: e.target.value } : s))}
                  placeholder="Shop"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{isRTL ? "النص (عربي)" : "Label (Arabic)"}</Label>
                <Input
                  dir="rtl"
                  value={editing?.labelAr ?? ""}
                  onChange={(e) => setEditing((s) => (s ? { ...s, labelAr: e.target.value } : s))}
                  placeholder="تسوق"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{isRTL ? "الوجهة" : "Destination"}</Label>
              <LinkPickerButton
                value={editing?.url ?? ""}
                locale={locale}
                storeId={storeId}
                onChange={(next) => setEditing((s) => (s ? { ...s, url: next } : s))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={saveEdit} disabled={!editing?.labelEn?.trim()}>
              {isRTL ? "حفظ" : "Save item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create menu dialog */}
      <Dialog open={creating} onOpenChange={() => setCreating(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? "قائمة جديدة" : "Create menu"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{isRTL ? "المعرّف (handle)" : "Handle"}</Label>
              <Input
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="main-menu"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? "‏«main-menu» للرأس و«footer» للتذييل، أو أي معرّف مخصّص."
                  : "Use main-menu for the header, footer for the footer, or any custom handle."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{isRTL ? "العنوان" : "Title"}</Label>
              <Input
                value={newTitleEn}
                onChange={(e) => setNewTitleEn(e.target.value)}
                placeholder={isRTL ? "قائمتي" : "My menu"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => createMutation.mutate(newHandle.trim())}
              disabled={!newHandle.trim() || createMutation.isPending}
            >
              {isRTL ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Recursive item row ───────────────────────────────────────────────────────
function MenuItemRow({
  item,
  path,
  depth,
  locale,
  isRTL,
  onEdit,
  onAddChild,
  onRemove,
  onMove,
}: {
  item: MenuItem;
  path: number[];
  depth: number;
  locale: "en" | "ar";
  isRTL: boolean;
  onEdit: (path: number[], it: MenuItem) => void;
  onAddChild: (path: number[]) => void;
  onRemove: (path: number[]) => void;
  onMove: (path: number[], dir: -1 | 1) => void;
}) {
  const label = item.label?.[locale] || item.label?.en || (isRTL ? "(بدون عنوان)" : "(untitled)");
  const children = item.children ?? [];
  return (
    <>
      <li
        className="group flex items-center gap-2 px-4 py-2 border-b last:border-b-0 hover:bg-muted/20"
        style={{ paddingInlineStart: `${1 + (depth - 1) * 1.5}rem` }}
      >
        <div className="shrink-0 text-muted-foreground/40">
          {isExternal(item.url) ? (
            <ExternalLink className="h-3.5 w-3.5" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight truncate">{label}</p>
          <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{item.url || "—"}</p>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="sm" className="h-7 w-7 px-0" title="Move up" onClick={() => onMove(path, -1)}>
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 px-0" title="Move down" onClick={() => onMove(path, 1)}>
            <ArrowDown className="h-3 w-3" />
          </Button>
          {depth < MAX_DEPTH && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 px-0"
              title={isRTL ? "إضافة عنصر فرعي" : "Add sub-item"}
              onClick={() => onAddChild(path)}
            >
              <CornerDownRight className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 px-0" onClick={() => onEdit(path, item)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 px-0 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(path)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </li>
      {children.map((child, i) => (
        <MenuItemRow
          key={child.id ?? i}
          item={child}
          path={[...path, i]}
          depth={depth + 1}
          locale={locale}
          isRTL={isRTL}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onRemove={onRemove}
          onMove={onMove}
        />
      ))}
    </>
  );
}
