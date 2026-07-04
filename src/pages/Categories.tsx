import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { prepareImageForUpload } from "@/lib/image-validation";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FolderOpen, Plus, Loader2, Pencil, Trash2, Package, ToggleLeft, ToggleRight,
  Search, ChevronRight, ChevronDown, ImagePlus, X, GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listCategories, createCategory, updateCategory, deleteCategory, uploadCategoryImage,
  type Category, type CreateCategoryData, type UpdateCategoryData,
} from "@/services/categoryApi";
import { useTemplateOptions, DEFAULT_TEMPLATE_VALUE } from "@/hooks/useTemplateOptions";

function getCatName(cat: Category, lang: string): string {
  if (lang === "ar") {
    const nameAr = (cat.extra_data as Record<string, string> | null)?.name_ar;
    return nameAr || cat.name;
  }
  return cat.name;
}

function getCatDesc(cat: Category, lang: string): string | null {
  if (lang === "ar") {
    const descAr = (cat.extra_data as Record<string, string> | null)?.description_ar;
    return descAr || cat.description;
  }
  return cat.description;
}

interface CategoryNodeProps {
  cat: Category;
  children: Category[];
  allCategories: Category[];
  language: string;
  isAr: boolean;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onToggleActive: (cat: Category) => void;
  depth?: number;
  sortable?: boolean;
}

function CategoryNode({
  cat, children, allCategories, language, isAr, expanded, onToggleExpand,
  onEdit, onDelete, onToggleActive, depth = 0, sortable = false,
}: CategoryNodeProps) {
  const hasChildren = children.length > 0;
  const isExpanded = expanded.has(cat.id);
  const desc = getCatDesc(cat, language);

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: cat.id, disabled: !sortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all group
          ${depth === 0 ? "border-border/50 bg-card hover:shadow-sm" : "border-transparent hover:bg-muted/30"}
          ${!cat.is_active ? "opacity-50" : ""}
          ${isDragging ? "shadow-lg ring-2 ring-primary/20" : ""}`}
        style={{ marginLeft: depth > 0 ? depth * 28 : 0 }}
      >
        {/* Drag handle */}
        {sortable && (
          <button
            type="button"
            className="h-7 w-5 flex items-center justify-center rounded cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Tree connector for children */}
        {depth > 0 && (
          <div className="w-3 h-px bg-border/60 flex-shrink-0" />
        )}

        {/* Expand/collapse */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpand(cat.id)}
            className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors flex-shrink-0"
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <div className="w-6 flex-shrink-0" />
        )}

        {/* Image or icon */}
        {cat.image_url ? (
          <img src={cat.image_url} alt="" className="h-9 w-9 rounded-lg object-cover bg-muted ring-1 ring-border/20 flex-shrink-0" />
        ) : (
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="h-4 w-4 text-primary/70" />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold truncate leading-tight">{getCatName(cat, language)}</p>
          </div>
          {desc && <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{desc}</p>}
        </div>

        {/* Product count */}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground/50 flex-shrink-0 tabular-nums">
          <Package className="h-3 w-3" />
          <span>{cat.product_count}</span>
        </div>

        {/* Status */}
        <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cat.is_active ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />

        {/* Actions (visible on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => onToggleActive(cat)}>
            {cat.is_active ? <ToggleRight className="h-3.5 w-3.5 text-emerald-600" /> : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => onEdit(cat)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive/60 hover:text-destructive" onClick={() => onDelete(cat)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-0.5 space-y-0.5 relative">
          {/* Vertical connector line */}
          <div className="absolute top-0 bottom-2 bg-border/40 w-px" style={{ left: (depth + 1) * 28 + 16 }} />
          {children.map((child) => {
            const grandchildren = allCategories.filter(c => c.parent_id === child.id);
            return (
              <CategoryNode
                key={child.id}
                cat={child}
                children={grandchildren}
                allCategories={allCategories}
                language={language}
                isAr={isAr}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleActive={onToggleActive}
                depth={depth + 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Categories() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formNameAr, setFormNameAr] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDescriptionAr, setFormDescriptionAr] = useState("");
  const [formPosition, setFormPosition] = useState("0");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formParentId, setFormParentId] = useState<string>("none");
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
  // Alternate storefront template ("template_suffix"). null = default template.
  const [formTemplateSuffix, setFormTemplateSuffix] = useState<string | null>(null);
  const { options: templateOptions } = useTemplateOptions("collection");
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    try {
      const result = await listCategories(storeId);
      setCategories(result);
    } catch (err) {
      console.error("Error fetching categories:", err);
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const resetForm = () => {
    setFormName(""); setFormNameAr(""); setFormDescription(""); setFormDescriptionAr("");
    setFormPosition("0"); setFormIsActive(true); setFormParentId("none");
    setFormImageUrl(null); setFormTemplateSuffix(null); setEditingCategory(null);
  };

  const openAddDialog = () => { resetForm(); setDialogOpen(true); };

  const openEditDialog = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormNameAr((cat.extra_data as Record<string, string> | null)?.name_ar || "");
    setFormDescription(cat.description || "");
    setFormDescriptionAr((cat.extra_data as Record<string, string> | null)?.description_ar || "");
    setFormPosition(String(cat.position));
    setFormIsActive(cat.is_active);
    setFormParentId(cat.parent_id || "none");
    setFormImageUrl(cat.image_url);
    setFormTemplateSuffix(cat.template_suffix ?? null);
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !storeId || !editingCategory) return;
    const prepared = await prepareImageForUpload(rawFile);
    if (prepared.error) {
      toast.error(prepared.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploadingImage(true);
    try {
      const updated = await uploadCategoryImage(storeId, editingCategory.id, prepared.file);
      setFormImageUrl(updated.image_url);
      setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, image_url: updated.image_url } : c));
      toast.success(isAr ? "الصورة اترفعت!" : "Image uploaded!");
    } catch (err) {
      showError(err, language);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!storeId || !formName.trim()) return;
    setIsSaving(true);
    const extra_data: Record<string, string> = {};
    if (formNameAr.trim()) extra_data.name_ar = formNameAr.trim();
    if (formDescriptionAr.trim()) extra_data.description_ar = formDescriptionAr.trim();
    try {
      if (editingCategory) {
        const data: UpdateCategoryData = {
          name: formName.trim(), description: formDescription.trim() || null,
          position: parseInt(formPosition) || 0, is_active: formIsActive,
          parent_id: formParentId === "none" ? null : formParentId,
          extra_data: Object.keys(extra_data).length > 0 ? extra_data : undefined,
          template_suffix: formTemplateSuffix,
        };
        await updateCategory(storeId, editingCategory.id, data);
        toast.success(isAr ? "تم تحديث الفئة" : "Category updated");
      } else {
        const data: CreateCategoryData = {
          name: formName.trim(), description: formDescription.trim() || null,
          position: parseInt(formPosition) || 0, is_active: formIsActive,
          parent_id: formParentId === "none" ? null : formParentId,
          extra_data: Object.keys(extra_data).length > 0 ? extra_data : undefined,
          template_suffix: formTemplateSuffix,
        };
        await createCategory(storeId, data);
        toast.success(isAr ? "تم إنشاء الفئة" : "Category created");
      }
      setDialogOpen(false); resetForm(); fetchCategories();
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!storeId || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCategory(storeId, deleteTarget.id);
      toast.success(isAr ? "تم حذف الفئة" : "Category deleted");
      setDeleteTarget(null); fetchCategories();
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (cat: Category) => {
    if (!storeId) return;
    try {
      await updateCategory(storeId, cat.id, { is_active: !cat.is_active });
      toast.success(cat.is_active ? (isAr ? "تم إلغاء تفعيل الفئة" : "Category deactivated") : (isAr ? "تم تفعيل الفئة" : "Category activated"));
      fetchCategories();
    } catch (err: unknown) {
      showError(err, language);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const filteredCategories = searchQuery.trim()
    ? categories.filter(c => {
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q)
          || c.slug.toLowerCase().includes(q)
          || ((c.extra_data as Record<string, string> | null)?.name_ar || "").includes(q)
          || (c.description || "").toLowerCase().includes(q);
      })
    : categories;

  const rootCategories = filteredCategories.filter(c => !c.parent_id);
  const childrenOf = (parentId: string) => filteredCategories.filter(c => c.parent_id === parentId);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !storeId) return;
    const oldIndex = rootCategories.findIndex(c => c.id === active.id);
    const newIndex = rootCategories.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(rootCategories, oldIndex, newIndex);
    setCategories(prev => {
      const nonRoot = prev.filter(c => c.parent_id !== null);
      return [...reordered.map((c, i) => ({ ...c, position: i })), ...nonRoot];
    });
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].position !== i) {
        try { await updateCategory(storeId, reordered[i].id, { position: i }); } catch { /* best-effort */ }
      }
    }
    toast.success(isAr ? "تم تحديث الترتيب" : "Order updated");
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalProducts = categories.reduce((sum, c) => sum + c.product_count, 0);
  const activeCount = categories.filter(c => c.is_active).length;

  const getDescendantIds = (catId: string): string[] => {
    const ch = categories.filter(c => c.parent_id === catId);
    return ch.flatMap(c => [c.id, ...getDescendantIds(c.id)]);
  };
  const excludedIds = editingCategory ? new Set([editingCategory.id, ...getDescendantIds(editingCategory.id)]) : new Set<string>();
  const availableParents = categories.filter(c => !excludedIds.has(c.id));

  return (
    <div className="space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.03] p-6">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/[0.04] rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "الفئات" : "Categories"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isAr ? "نظّم منتجاتك في فئات" : "Organize your products into categories"}
            </p>
          </div>

          {/* Stats pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 backdrop-blur-sm px-3 py-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold tabular-nums">{categories.length}</span>
              <span className="text-[11px] text-muted-foreground">{isAr ? "فئة" : "total"}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-500/5 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{activeCount}</span>
              <span className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">{isAr ? "مفعّل" : "active"}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 backdrop-blur-sm px-3 py-1.5">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold tabular-nums">{totalProducts}</span>
              <span className="text-[11px] text-muted-foreground">{isAr ? "منتج" : "products"}</span>
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-2 mt-5 pt-5 border-t border-border/40">
          {categories.length > 0 && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                placeholder={isAr ? "بحث في الفئات..." : "Search categories..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9 h-8 text-xs rounded-lg bg-background/60 border-border/40 backdrop-blur-sm"
              />
            </div>
          )}
          <div className="flex-1" />
          <Button size="sm" className="gap-1.5 h-8 rounded-lg shadow-sm" onClick={openAddDialog}>
            <Plus className="h-3.5 w-3.5" />
            {isAr ? "فئة جديدة" : "New Category"}
          </Button>
        </div>
      </div>

      {/* Category Tree */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2 border-muted" />
            <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-xs text-muted-foreground">{isAr ? "جارٍ التحميل..." : "Loading categories..."}</p>
        </div>
      ) : categories.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
                <FolderOpen className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium">{isAr ? "مفيش فئات لسه" : "No categories yet"}</p>
                <p className="text-xs text-muted-foreground/70">{isAr ? "أنشئ أول فئة لتنظيم منتجاتك" : "Create your first category to organize products"}</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-lg mt-1" onClick={openAddDialog}>
                <Plus className="h-3.5 w-3.5" />
                {isAr ? "فئة جديدة" : "New Category"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : filteredCategories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Search className="h-6 w-6 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground/60">{isAr ? "لا توجد نتائج" : "No results found"}</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rootCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {rootCategories.map((cat) => (
                <CategoryNode
                  key={cat.id}
                  cat={cat}
                  children={childrenOf(cat.id)}
                  allCategories={filteredCategories}
                  language={language}
                  isAr={isAr}
                  expanded={expanded}
                  onToggleExpand={toggleExpand}
                  onEdit={openEditDialog}
                  onDelete={setDeleteTarget}
                  onToggleActive={handleToggleActive}
                  sortable
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
            <DialogTitle>
              {editingCategory ? (isAr ? "تعديل الفئة" : "Edit Category") : (isAr ? "فئة جديدة" : "New Category")}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {isAr ? "أضف أو عدل تفاصيل الفئة" : "Add or edit category details"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Image */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{isAr ? "صورة الفئة" : "Category Image"}</Label>
              <div className="flex items-center gap-4">
                {formImageUrl ? (
                  <img src={formImageUrl} alt="" className="h-20 w-20 rounded-xl object-cover bg-muted ring-1 ring-border/20" />
                ) : (
                  <div className="h-20 w-20 rounded-xl bg-muted/50 border-2 border-dashed border-border/60 flex items-center justify-center">
                    <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingImage || !editingCategory}
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2 h-9 rounded-lg"
                  >
                    {uploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {isAr ? "رفع صورة" : "Upload Image"}
                  </Button>
                  {!editingCategory && (
                    <p className="text-xs text-muted-foreground">{isAr ? "يمكنك رفع صورة بعد الإنشاء" : "You can upload an image after creating"}</p>
                  )}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
            </div>

            <Separator />

            {/* Name EN / AR */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{isAr ? "اسم الفئة" : "Category Name"}</Label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? "الإنجليزي" : "English"} *</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Electronics" className="h-10 rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? "العربي" : "Arabic"}</Label>
                  <Input value={formNameAr} onChange={(e) => setFormNameAr(e.target.value)} placeholder="مثلاً: إلكترونيات" dir="rtl" className="h-10 rounded-lg" />
                </div>
              </div>
            </div>

            {/* Description EN / AR */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{isAr ? "الوصف" : "Description"}</Label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? "الإنجليزي" : "English"}</Label>
                  <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder={isAr ? "اختياري" : "Optional description"} className="rounded-lg resize-none" rows={3} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{isAr ? "العربي" : "Arabic"}</Label>
                  <Textarea value={formDescriptionAr} onChange={(e) => setFormDescriptionAr(e.target.value)} placeholder={isAr ? "اختياري" : "وصف اختياري"} dir="rtl" className="rounded-lg resize-none" rows={3} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Parent category */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{isAr ? "الفئة الأم" : "Parent Category"}</Label>
              <Select value={formParentId} onValueChange={setFormParentId}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder={isAr ? "بدون أم (فئة رئيسية)" : "None (root category)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{isAr ? "بدون أم (فئة رئيسية)" : "None (root category)"}</SelectItem>
                  {availableParents.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isAr ? "اختر فئة أم لجعل هذه فئة فرعية" : "Select a parent to make this a subcategory"}
              </p>
            </div>

            {/* Template (alternate storefront template) */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{isAr ? "قالب العرض" : "Template"}</Label>
              <Select
                value={formTemplateSuffix ?? DEFAULT_TEMPLATE_VALUE}
                onValueChange={(v) => setFormTemplateSuffix(v === DEFAULT_TEMPLATE_VALUE ? null : v)}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((opt) => (
                    <SelectItem
                      key={opt.value ?? DEFAULT_TEMPLATE_VALUE}
                      value={opt.value ?? DEFAULT_TEMPLATE_VALUE}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isAr ? "قالب بديل لصفحة الفئة. تُنشأ القوالب من محرر الثيم." : "Alternate template for this collection page. Variants are created in the theme editor."}
              </p>
            </div>

            {/* Position & Status */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{isAr ? "الترتيب" : "Sort Position"}</Label>
                <Input type="number" min="0" value={formPosition} onChange={(e) => setFormPosition(e.target.value)} className="h-10 rounded-lg" />
                <p className="text-xs text-muted-foreground">{isAr ? "رقم أصغر = يظهر أولاً" : "Lower number appears first"}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{isAr ? "الحالة" : "Visibility"}</Label>
                <div className="flex items-center gap-3 h-10">
                  <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
                  <span className={`text-sm ${formIsActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {formIsActive ? (isAr ? "مفعّل — ظاهر في المتجر" : "Active — visible in store") : (isAr ? "معطّل — مخفي" : "Inactive — hidden")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
            <Button variant="ghost" className="rounded-lg" onClick={() => { setDialogOpen(false); resetForm(); }}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button className="rounded-lg min-w-[100px]" onClick={handleSave} disabled={isSaving || !formName.trim()}>
              {isSaving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {editingCategory ? (isAr ? "حفظ التغييرات" : "Save Changes") : (isAr ? "إنشاء الفئة" : "Create Category")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">{isAr ? "حذف الفئة" : "Delete Category"}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {isAr
                ? `هل أنت متأكد من حذف "${deleteTarget?.name}"؟ لن يتم حذف المنتجات المرتبطة.`
                : `Are you sure you want to delete "${deleteTarget?.name}"? Associated products will not be deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg text-xs">{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg text-xs">
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (isAr ? "حذف" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
