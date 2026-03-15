import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { toast } from "sonner";
import {
  FolderOpen, Plus, Loader2, Pencil, Trash2, Package, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listCategories, createCategory, updateCategory, deleteCategory,
  type Category, type CreateCategoryData, type UpdateCategoryData,
} from "@/services/categoryApi";

export default function Categories() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPosition, setFormPosition] = useState("0");
  const [formIsActive, setFormIsActive] = useState(true);
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
    setFormName(""); setFormDescription(""); setFormPosition("0"); setFormIsActive(true); setEditingCategory(null);
  };

  const openAddDialog = () => { resetForm(); setDialogOpen(true); };
  const openEditDialog = (cat: Category) => {
    setEditingCategory(cat); setFormName(cat.name); setFormDescription(cat.description || "");
    setFormPosition(String(cat.position)); setFormIsActive(cat.is_active); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!storeId || !formName.trim()) return;
    setIsSaving(true);
    try {
      if (editingCategory) {
        const data: UpdateCategoryData = { name: formName.trim(), description: formDescription.trim() || null, position: parseInt(formPosition) || 0, is_active: formIsActive };
        await updateCategory(storeId, editingCategory.id, data);
        toast.success(isAr ? "تم تحديث الفئة" : "Category updated");
      } else {
        const data: CreateCategoryData = { name: formName.trim(), description: formDescription.trim() || null, position: parseInt(formPosition) || 0, is_active: formIsActive };
        await createCategory(storeId, data);
        toast.success(isAr ? "تم إنشاء الفئة" : "Category created");
      }
      setDialogOpen(false); resetForm(); fetchCategories();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : (isAr ? "حدث خطأ" : "Something went wrong"));
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
      toast.error(err instanceof Error ? err.message : (isAr ? "حدث خطأ" : "Something went wrong"));
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
      toast.error(err instanceof Error ? err.message : (isAr ? "حدث خطأ" : "Something went wrong"));
    }
  };

  const totalProducts = categories.reduce((sum, c) => sum + c.product_count, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{isAr ? "الفئات" : "Categories"}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {isAr ? "أدر فئات المنتجات في متجرك" : "Manage your product categories"}
          </p>
        </div>
        <Button className="gap-1.5 h-8 text-xs rounded-lg" onClick={openAddDialog}>
          <Plus className="h-3.5 w-3.5" />
          {isAr ? "فئة جديدة" : "New Category"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: isAr ? "إجمالي الفئات" : "Total Categories", value: categories.length, icon: FolderOpen, bg: "bg-blue-500/8 dark:bg-blue-500/15", iconColor: "text-blue-600 dark:text-blue-400" },
          { label: isAr ? "منتجات مصنفة" : "Products Categorized", value: totalProducts, icon: Package, bg: "bg-emerald-500/8 dark:bg-emerald-500/15", iconColor: "text-emerald-600 dark:text-emerald-400" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : categories.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-12">
            <EmptyState
              icon={FolderOpen}
              title={isAr ? "مفيش فئات لسه" : "No categories yet"}
              description={isAr ? "أنشئ أول فئة لتنظيم منتجاتك" : "Create your first category to organize products"}
            />
            <div className="flex justify-center mt-4">
              <Button variant="outline" className="gap-1.5 text-xs rounded-lg" onClick={openAddDialog}>
                <Plus className="h-3.5 w-3.5" />
                {isAr ? "فئة جديدة" : "New Category"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Card key={cat.id} className={`border-border/60 hover:shadow-md transition-all duration-200 group ${!cat.is_active ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center">
                      <FolderOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold">{cat.name}</p>
                      <code className="text-[10px] text-muted-foreground bg-muted px-1 rounded">{cat.slug}</code>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] border ${cat.is_active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "bg-muted text-muted-foreground border-border"}`}>
                    {cat.is_active ? (isAr ? "مفعّل" : "Active") : (isAr ? "معطّل" : "Inactive")}
                  </Badge>
                </div>
                {cat.description && (
                  <p className="text-[12px] text-muted-foreground line-clamp-2 mb-3">{cat.description}</p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Package className="h-3 w-3" />
                    <span>{cat.product_count} {isAr ? "منتج" : "products"}</span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => handleToggleActive(cat)} aria-label={cat.is_active ? (isAr ? "تعطيل الفئة" : "Deactivate category") : (isAr ? "تفعيل الفئة" : "Activate category")}>
                      {cat.is_active ? <ToggleRight className="h-3.5 w-3.5 text-primary" /> : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEditDialog(cat)} aria-label={isAr ? "تعديل الفئة" : "Edit category"}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive" onClick={() => setDeleteTarget(cat)} aria-label={isAr ? "حذف الفئة" : "Delete category"}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingCategory ? (isAr ? "تعديل الفئة" : "Edit Category") : (isAr ? "فئة جديدة" : "New Category")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isAr ? "أضف أو عدل تفاصيل الفئة" : "Add or edit category details"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">{isAr ? "اسم الفئة" : "Category Name"} *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={isAr ? "مثلاً: إلكترونيات" : "e.g. Electronics"} className="mt-1.5 rounded-lg" />
            </div>
            <div>
              <Label className="text-xs">{isAr ? "الوصف" : "Description"}</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder={isAr ? "وصف اختياري" : "Optional description"} className="mt-1.5 rounded-lg" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">{isAr ? "الترتيب" : "Position"}</Label>
                <Input type="number" min="0" value={formPosition} onChange={(e) => setFormPosition(e.target.value)} className="mt-1.5 rounded-lg" />
              </div>
              <div>
                <Label className="text-xs">{isAr ? "الحالة" : "Status"}</Label>
                <div className="flex items-center gap-2 mt-2.5">
                  <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
                  <span className="text-xs text-muted-foreground">{formIsActive ? (isAr ? "مفعّل" : "Active") : (isAr ? "معطّل" : "Inactive")}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => { setDialogOpen(false); resetForm(); }}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button size="sm" className="rounded-lg" onClick={handleSave} disabled={isSaving || !formName.trim()}>
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (editingCategory ? (isAr ? "حفظ" : "Save") : (isAr ? "إنشاء" : "Create"))}
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
