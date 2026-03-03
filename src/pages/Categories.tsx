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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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

  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPosition, setFormPosition] = useState("0");
  const [formIsActive, setFormIsActive] = useState(true);

  // Delete
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
    setFormName("");
    setFormDescription("");
    setFormPosition("0");
    setFormIsActive(true);
    setEditingCategory(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormDescription(cat.description || "");
    setFormPosition(String(cat.position));
    setFormIsActive(cat.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!storeId || !formName.trim()) return;
    setIsSaving(true);
    try {
      if (editingCategory) {
        const data: UpdateCategoryData = {
          name: formName.trim(),
          description: formDescription.trim() || null,
          position: parseInt(formPosition) || 0,
          is_active: formIsActive,
        };
        await updateCategory(storeId, editingCategory.id, data);
        toast.success(isAr ? "تم تحديث الفئة" : "Category updated");
      } else {
        const data: CreateCategoryData = {
          name: formName.trim(),
          description: formDescription.trim() || null,
          position: parseInt(formPosition) || 0,
          is_active: formIsActive,
        };
        await createCategory(storeId, data);
        toast.success(isAr ? "تم إنشاء الفئة" : "Category created");
      }
      setDialogOpen(false);
      resetForm();
      fetchCategories();
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
      setDeleteTarget(null);
      fetchCategories();
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
      toast.success(
        cat.is_active
          ? (isAr ? "تم إلغاء تفعيل الفئة" : "Category deactivated")
          : (isAr ? "تم تفعيل الفئة" : "Category activated")
      );
      fetchCategories();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : (isAr ? "حدث خطأ" : "Something went wrong"));
    }
  };

  const totalProducts = categories.reduce((sum, c) => sum + c.product_count, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            {isAr ? "الفئات" : "Categories"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr ? "أدر فئات المنتجات في متجرك" : "Manage your product categories"}
          </p>
        </div>
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          {isAr ? "فئة جديدة" : "New Category"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{categories.length}</p>
              <p className="text-xs text-muted-foreground">{isAr ? "إجمالي الفئات" : "Total Categories"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalProducts}</p>
              <p className="text-xs text-muted-foreground">{isAr ? "منتجات مصنفة" : "Products Categorized"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-16">
              <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">
                {isAr ? "مفيش فئات لسه" : "No categories yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isAr ? "أنشئ أول فئة لتنظيم منتجاتك" : "Create your first category to organize products"}
              </p>
              <Button variant="outline" className="mt-4 gap-2" onClick={openAddDialog}>
                <Plus className="h-4 w-4" />
                {isAr ? "فئة جديدة" : "New Category"}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isAr ? "الاسم" : "Name"}</TableHead>
                  <TableHead>{isAr ? "الرابط" : "Slug"}</TableHead>
                  <TableHead className="text-center">{isAr ? "المنتجات" : "Products"}</TableHead>
                  <TableHead className="text-center">{isAr ? "الترتيب" : "Position"}</TableHead>
                  <TableHead className="text-center">{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="text-center">{isAr ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{cat.name}</span>
                      </div>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{cat.description}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{cat.slug}</code>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{cat.product_count}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {cat.position}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={cat.is_active ? "default" : "outline"}>
                        {cat.is_active ? (isAr ? "مفعّل" : "Active") : (isAr ? "معطّل" : "Inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleActive(cat)}
                          title={cat.is_active ? "Deactivate" : "Activate"}
                        >
                          {cat.is_active
                            ? <ToggleRight className="h-4 w-4 text-primary" />
                            : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(cat)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(cat)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? (isAr ? "تعديل الفئة" : "Edit Category")
                : (isAr ? "فئة جديدة" : "New Category")}
            </DialogTitle>
            <DialogDescription>
              {isAr ? "أضف أو عدل تفاصيل الفئة" : "Add or edit category details"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>{isAr ? "اسم الفئة" : "Category Name"} *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={isAr ? "مثلاً: إلكترونيات" : "e.g. Electronics"}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>{isAr ? "الوصف" : "Description"}</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={isAr ? "وصف اختياري للفئة" : "Optional description"}
                className="mt-1.5"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isAr ? "الترتيب" : "Position"}</Label>
                <Input
                  type="number"
                  min="0"
                  value={formPosition}
                  onChange={(e) => setFormPosition(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>{isAr ? "الحالة" : "Status"}</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-1.5 justify-start gap-2"
                  onClick={() => setFormIsActive(!formIsActive)}
                >
                  {formIsActive
                    ? <><ToggleRight className="h-4 w-4 text-primary" /> {isAr ? "مفعّل" : "Active"}</>
                    : <><ToggleLeft className="h-4 w-4 text-muted-foreground" /> {isAr ? "معطّل" : "Inactive"}</>}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formName.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingCategory ? (isAr ? "حفظ" : "Save") : (isAr ? "إنشاء" : "Create"))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? "حذف الفئة" : "Delete Category"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? `هل أنت متأكد من حذف "${deleteTarget?.name}"؟ لن يتم حذف المنتجات المرتبطة.`
                : `Are you sure you want to delete "${deleteTarget?.name}"? Associated products will not be deleted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? "حذف" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
