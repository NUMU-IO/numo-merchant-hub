import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { products as initialProducts, categories, type Product, type ProductStatus, type ProductVariant } from "@/data/mock-products";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ImagePlus, X, Tag } from "lucide-react";
import { toast } from "sonner";

const Products = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [productsList, setProductsList] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProductStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formNameAr, setFormNameAr] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDescAr, setFormDescAr] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formComparePrice, setFormComparePrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formStatus, setFormStatus] = useState<ProductStatus>("draft");
  const [formCategory, setFormCategory] = useState("Clothing");
  const [formVariants, setFormVariants] = useState<{ name: string; nameAr: string; options: string; optionsAr: string }[]>([]);

  const formatCurrency = (val: number) =>
    language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  const filtered = productsList.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.nameAr.includes(search);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchCategory = categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  const statusColor: Record<ProductStatus, string> = {
    published: "bg-primary/10 text-primary",
    draft: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    archived: "bg-muted text-muted-foreground",
  };

  const resetForm = () => {
    setFormName(""); setFormNameAr(""); setFormDesc(""); setFormDescAr("");
    setFormPrice(""); setFormComparePrice(""); setFormStock("");
    setFormStatus("draft"); setFormCategory("Clothing"); setFormVariants([]);
    setEditingProduct(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name); setFormNameAr(p.nameAr);
    setFormDesc(p.description); setFormDescAr(p.descriptionAr);
    setFormPrice(String(p.price)); setFormComparePrice(p.compareAtPrice ? String(p.compareAtPrice) : "");
    setFormStock(String(p.stock)); setFormStatus(p.status); setFormCategory(p.category);
    setFormVariants(p.variants.map(v => ({
      name: v.name, nameAr: v.nameAr,
      options: v.options.join(", "), optionsAr: v.optionsAr.join(", "),
    })));
    setDialogOpen(true);
  };

  const handleSave = () => {
    const variants: ProductVariant[] = formVariants
      .filter(v => v.name && v.options)
      .map((v, i) => ({
        id: `v-${Date.now()}-${i}`,
        name: v.name, nameAr: v.nameAr,
        options: v.options.split(",").map(o => o.trim()).filter(Boolean),
        optionsAr: v.optionsAr.split(",").map(o => o.trim()).filter(Boolean),
      }));

    const cat = categories.find(c => c.en === formCategory);

    if (editingProduct) {
      setProductsList(prev => prev.map(p => p.id === editingProduct.id ? {
        ...p, name: formName, nameAr: formNameAr, description: formDesc, descriptionAr: formDescAr,
        price: Number(formPrice), compareAtPrice: formComparePrice ? Number(formComparePrice) : undefined,
        stock: Number(formStock), status: formStatus, category: formCategory,
        categoryAr: cat?.ar || formCategory, variants,
      } : p));
      toast.success(language === "ar" ? t("products.productUpdated") : t("products.productUpdated"));
    } else {
      const newProduct: Product = {
        id: `P${String(productsList.length + 1).padStart(3, "0")}`,
        name: formName, nameAr: formNameAr, description: formDesc, descriptionAr: formDescAr,
        price: Number(formPrice), compareAtPrice: formComparePrice ? Number(formComparePrice) : undefined,
        stock: Number(formStock), status: formStatus,
        category: formCategory, categoryAr: cat?.ar || formCategory,
        sku: `NEW-${Date.now()}`, image: "📦", images: ["📦"], sold: 0, variants,
      };
      setProductsList(prev => [newProduct, ...prev]);
      toast.success(language === "ar" ? "المنتج اتضاف!" : "Product added successfully!");
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setProductsList(prev => prev.filter(p => p.id !== deleteTarget.id));
    toast.success(t("products.productDeleted"));
    setDeleteTarget(null);
  };

  const addVariantRow = () => {
    setFormVariants(prev => [...prev, { name: "", nameAr: "", options: "", optionsAr: "" }]);
  };

  const updateVariant = (idx: number, field: string, value: string) => {
    setFormVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
  };

  const removeVariant = (idx: number) => {
    setFormVariants(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("products.title")}</h1>
          <p className="text-sm text-muted-foreground">{productsList.length} {language === "ar" ? "منتج" : "products"}</p>
        </div>
        <Button onClick={openAddDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("products.addProduct")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder={t("products.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("products.allCategories")}</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.en} value={c.en}>{language === "ar" ? c.ar : c.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">{t("products.all")}</TabsTrigger>
                <TabsTrigger value="published">{t("products.published")}</TabsTrigger>
                <TabsTrigger value="draft">{t("products.draft")}</TabsTrigger>
                <TabsTrigger value="archived">{t("products.archived")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t("products.noProducts")}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("products.image")}</TableHead>
                    <TableHead>{t("products.name")}</TableHead>
                    <TableHead>{t("products.category")}</TableHead>
                    <TableHead>{t("products.price")}</TableHead>
                    <TableHead>{t("products.stock")}</TableHead>
                    <TableHead>{t("products.sold")}</TableHead>
                    <TableHead>{t("products.variants")}</TableHead>
                    <TableHead>{t("products.status")}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">{p.image}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{language === "ar" ? p.nameAr : p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1 font-normal">
                          <Tag className="h-3 w-3" />
                          {language === "ar" ? p.categoryAr : p.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{formatCurrency(p.price)}</p>
                          {p.compareAtPrice && (
                            <p className="text-xs text-muted-foreground line-through">{formatCurrency(p.compareAtPrice)}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={p.stock < 20 ? "text-destructive font-medium" : ""}>
                          {p.stock}
                        </span>
                      </TableCell>
                      <TableCell>{p.sold}</TableCell>
                      <TableCell>
                        {p.variants.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.variants.map(v => (
                              <Badge key={v.id} variant="secondary" className="text-xs font-normal">
                                {language === "ar" ? v.nameAr : v.name}: {v.options.length}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColor[p.status]}>
                          {t(`products.${p.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(p)}>
                              <Pencil className="me-2 h-4 w-4" />
                              {t("products.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteTarget(p)} className="text-destructive">
                              <Trash2 className="me-2 h-4 w-4" />
                              {t("products.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? t("products.editProductTitle") : t("products.addProductTitle")}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "أدخل تفاصيل المنتج" : "Enter product details"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* Image Upload Placeholder */}
            <div className="grid gap-2">
              <Label>{t("products.images")}</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
                >
                  <ImagePlus className="h-6 w-6 mb-1" />
                  <span className="text-[10px]">{t("products.uploadImages")}</span>
                </button>
                {editingProduct && (
                  <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-muted text-3xl">
                    {editingProduct.image}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("products.uploadHint")}</p>
            </div>

            <Separator />

            {/* Name */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("products.productName")} (EN)</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Product name" />
              </div>
              <div className="grid gap-2">
                <Label>{t("products.productName")} (AR)</Label>
                <Input value={formNameAr} onChange={e => setFormNameAr(e.target.value)} placeholder="اسم المنتج" dir="rtl" />
              </div>
            </div>

            {/* Description */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("products.description")} (EN)</Label>
                <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Description" rows={2} />
              </div>
              <div className="grid gap-2">
                <Label>{t("products.description")} (AR)</Label>
                <Textarea value={formDescAr} onChange={e => setFormDescAr(e.target.value)} placeholder="الوصف" rows={2} dir="rtl" />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>{t("products.price")}</Label>
                <Input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label>{t("products.compareAtPrice")}</Label>
                <Input type="number" value={formComparePrice} onChange={e => setFormComparePrice(e.target.value)} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label>{t("products.stock")}</Label>
                <Input type="number" value={formStock} onChange={e => setFormStock(e.target.value)} placeholder="0" />
              </div>
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("products.category")}</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.en} value={c.en}>{language === "ar" ? c.ar : c.en}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("products.status")}</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as ProductStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t("products.draft")}</SelectItem>
                    <SelectItem value="published">{t("products.published")}</SelectItem>
                    <SelectItem value="archived">{t("products.archived")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Variants */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t("products.variants")}</Label>
                <Button type="button" variant="outline" size="sm" onClick={addVariantRow} className="gap-1">
                  <Plus className="h-3 w-3" />
                  {t("products.addVariant")}
                </Button>
              </div>
              {formVariants.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "مفيش متغيرات — زي المقاس أو اللون" : "No variants — e.g. Size, Color"}
                </p>
              )}
              {formVariants.map((v, idx) => (
                <div key={idx} className="grid gap-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{language === "ar" ? "متغير" : "Variant"} {idx + 1}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeVariant(idx)} className="h-7 text-destructive">
                      <X className="h-3 w-3 me-1" />
                      {t("products.removeVariant")}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder={language === "ar" ? "مثلاً: المقاس" : "e.g. Size"} value={v.name} onChange={e => updateVariant(idx, "name", e.target.value)} />
                    <Input placeholder={language === "ar" ? "مثلاً: المقاس" : "e.g. المقاس"} value={v.nameAr} onChange={e => updateVariant(idx, "nameAr", e.target.value)} dir="rtl" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="S, M, L, XL" value={v.options} onChange={e => updateVariant(idx, "options", e.target.value)} />
                    <Input placeholder="S, M, L, XL" value={v.optionsAr} onChange={e => updateVariant(idx, "optionsAr", e.target.value)} dir="rtl" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              {t("products.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={!formName || !formPrice}>
              {t("products.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("products.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("products.confirmDeleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("products.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("products.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Products;
