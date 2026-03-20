import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { type Product, type ProductStatus, type ProductVariant } from "@/data/mock-products";
import { listCategories, type Category } from "@/services/categoryApi";
import {
  listProducts, createProduct as apiCreateProduct, updateProduct as apiUpdateProduct,
  deleteProduct as apiDeleteProduct, uploadProductImage, deleteProductImage,
  apiToProduct, productToApiCreate, productToApiUpdate,
  type PaginatedProducts,
} from "@/services/productApi";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ImagePlus, X, Tag, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { z } from "zod";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function validateImageMagicBytes(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // JPEG: FF D8 FF
  const isJPEG = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  // PNG: 89 50 4E 47
  const isPNG =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;

  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  const isWebP =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  return isJPEG || isPNG || isWebP;
}

const productSchema = z.object({
  name: z.string()
    .min(3, "اسم المنتج يجب أن يكون 3 أحرف على الأقل")
    .max(120, "اسم المنتج يجب ألا يتجاوز 120 حرفًا"),
  price: z.string()
    .min(1, "السعر مطلوب")
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, "السعر يجب أن يكون رقمًا موجبًا")
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "السعر يجب ألا يتجاوز خانتين عشريتين"),
  comparePrice: z.string()
    .refine((v) => v === "" || (!isNaN(Number(v)) && Number(v) >= 0), "سعر المقارنة يجب أن يكون رقمًا صحيحًا"),
  stock: z.string()
    .refine((v) => v === "" || (!isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0), "الكمية يجب أن تكون عددًا صحيحًا غير سالب"),
  description: z.string().max(2000, "الوصف يجب ألا يتجاوز 2000 حرف").optional().or(z.literal("")),
});

type FieldErrors = Record<string, string>;

const PAGE_SIZE = 20;

const Products = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  // Categories from API
  const [apiCategories, setApiCategories] = useState<Category[]>([]);

  // Product list state (API-driven)
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProductStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [validatingImage, setValidatingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Stable object URLs for pending file previews — revoked on cleanup
  const pendingPreviews = useMemo(() => pendingFiles.map(f => URL.createObjectURL(f)), [pendingFiles]);
  useEffect(() => {
    return () => { pendingPreviews.forEach(url => URL.revokeObjectURL(url)); };
  }, [pendingPreviews]);

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

  // Fetch categories from API
  useEffect(() => {
    if (!storeId) return;
    listCategories(storeId).then(setApiCategories).catch(() => {});
  }, [storeId]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  // Fetch products from API
  const fetchProducts = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    try {
      const apiStatus = statusFilter === "all"
        ? undefined
        : statusFilter === "published" ? "active" : statusFilter;
      const result = await listProducts(storeId, {
        page: currentPage,
        limit: PAGE_SIZE,
        status: apiStatus,
        search: debouncedSearch || undefined,
      });
      setProductsList(result.items.map(apiToProduct));
      setTotalProducts(result.total);
      setTotalPages(result.total_pages);
    } catch (err) {
      showError(err, language);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, currentPage, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Client-side category filter by category ID
  const filtered = categoryFilter === "all"
    ? productsList
    : productsList.filter((p) => p.categoryId === categoryFilter);

  const formatCurrency = (val: number) =>
    language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  const statusColor: Record<ProductStatus, string> = {
    published: "bg-primary/10 text-primary",
    draft: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    archived: "bg-muted text-muted-foreground",
  };

  const resetForm = () => {
    setFormName(""); setFormNameAr(""); setFormDesc(""); setFormDescAr("");
    setFormPrice(""); setFormComparePrice(""); setFormStock("");
    setFormStatus("draft"); setFormCategory(""); setFormVariants([]);
    setFormImages([]); setPendingFiles([]);
    setEditingProduct(null); setFieldErrors({}); setImageError(null);
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
    setFormStock(String(p.stock)); setFormStatus(p.status); setFormCategory(p.categoryId || "");
    setFormImages(p.images.filter(img => img !== "📦"));
    setFormVariants(p.variants.map(v => ({
      name: v.name, nameAr: v.nameAr,
      options: v.options.join(", "), optionsAr: v.optionsAr.join(", "),
    })));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!storeId || isSaving) return;
    setFieldErrors({});

    const result = productSchema.safeParse({
      name: formName,
      price: formPrice,
      comparePrice: formComparePrice,
      stock: formStock,
      description: formDesc,
    });

    if (!result.success) {
      const errs: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setIsSaving(true);

    const variants: ProductVariant[] = formVariants
      .filter(v => v.name && v.options)
      .map((v, i) => ({
        id: `v-${Date.now()}-${i}`,
        name: v.name, nameAr: v.nameAr,
        options: v.options.split(",").map(o => o.trim()).filter(Boolean),
        optionsAr: v.optionsAr.split(",").map(o => o.trim()).filter(Boolean),
      }));

    const cat = apiCategories.find(c => c.id === formCategory);

    try {
      if (editingProduct) {
        const payload = productToApiUpdate({
          name: formName, nameAr: formNameAr,
          description: formDesc, descriptionAr: formDescAr,
          price: Number(formPrice),
          compareAtPrice: formComparePrice ? Number(formComparePrice) : undefined,
          stock: Number(formStock),
          status: formStatus,
          categoryId: formCategory || undefined,
          category: cat?.name || "", categoryAr: cat?.name || "",
          variants,
          images: formImages.length > 0 ? formImages : undefined,
        });
        const updated = await apiUpdateProduct(storeId, editingProduct.id, payload);
        setProductsList(prev => prev.map(p => p.id === editingProduct.id ? apiToProduct(updated) : p));
        toast.success(t("products.productUpdated"));
      } else {
        const payload = productToApiCreate({
          name: formName, nameAr: formNameAr,
          description: formDesc, descriptionAr: formDescAr,
          price: Number(formPrice),
          compareAtPrice: formComparePrice ? Number(formComparePrice) : undefined,
          stock: Number(formStock),
          status: formStatus,
          categoryId: formCategory || undefined,
          category: cat?.name || "", categoryAr: cat?.name || "",
          variants,
        });
        const created = await apiCreateProduct(storeId, payload);
        // Upload pending images for the newly created product
        for (const file of pendingFiles) {
          try {
            await uploadProductImage(storeId, created.id, file);
          } catch { /* image upload failure is non-blocking */ }
        }
        fetchProducts();
        toast.success(language === "ar" ? "المنتج اتضاف!" : "Product added successfully!");
      }
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      showError(err, language);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !storeId || isDeleting) return;
    setIsDeleting(true);
    try {
      await apiDeleteProduct(storeId, deleteTarget.id);
      setProductsList(prev => prev.filter(p => p.id !== deleteTarget.id));
      setTotalProducts(prev => prev - 1);
      toast.success(t("products.productDeleted"));
    } catch (err) {
      showError(err, language);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storeId) return;
    setImageError(null);

    // Size check (synchronous)
    if (file.size > MAX_FILE_SIZE) {
      setImageError("حجم الصورة يجب أن لا يتجاوز 5 ميجابايت");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // MIME type check (basic)
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setImageError("نوع الملف غير مدعوم. يرجى رفع صورة بصيغة JPG أو PNG أو WebP فقط");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Magic bytes check (async — reads first 12 bytes of the file)
    setValidatingImage(true);
    try {
      const isValidImage = await validateImageMagicBytes(file);
      if (!isValidImage) {
        setImageError("نوع الملف غير مدعوم. يرجى رفع صورة بصيغة JPG أو PNG أو WebP فقط");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    } finally {
      setValidatingImage(false);
    }

    if (editingProduct) {
      // Upload directly for existing products
      setUploadingImage(true);
      try {
        const result = await uploadProductImage(storeId, editingProduct.id, file);
        setFormImages(prev => [...prev, result.url]);
        setProductsList(prev => prev.map(p =>
          p.id === editingProduct.id
            ? { ...p, images: [...p.images.filter(img => img !== "📦"), result.url], image: result.url }
            : p
        ));
        toast.success(language === "ar" ? "الصورة اترفعت!" : "Image uploaded!");
      } catch (err) {
        showError(err, language);
      } finally {
        setUploadingImage(false);
      }
    } else {
      // Queue files for new products — will upload after creation
      setPendingFiles(prev => [...prev, file]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageDelete = async (imageUrl: string) => {
    if (!storeId || !editingProduct) return;
    try {
      await deleteProductImage(storeId, editingProduct.id, imageUrl);
      setFormImages(prev => prev.filter(url => url !== imageUrl));
      toast.success(language === "ar" ? "الصورة اتمسحت" : "Image removed");
    } catch (err) {
      showError(err, language);
    }
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
          <p className="text-sm text-muted-foreground">{totalProducts} {language === "ar" ? "منتج" : "products"}</p>
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
                  {apiCategories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | ProductStatus)}>
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
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
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
                        {p.image.startsWith("http") ? (
                          <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover bg-muted" />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">{p.image}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{language === "ar" ? p.nameAr : p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.categoryId ? (
                          <Badge variant="outline" className="gap-1 font-normal">
                            <Tag className="h-3 w-3" />
                            {apiCategories.find(c => c.id === p.categoryId)?.name || p.category || "—"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="outline" size="sm" disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" />
                {language === "ar" ? "السابق" : "Previous"}
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {language === "ar" ? `صفحة ${currentPage} من ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
              </span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)} className="gap-1">
                {language === "ar" ? "التالي" : "Next"}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <DialogHeader>
            <DialogTitle>{editingProduct ? t("products.editProductTitle") : t("products.addProductTitle")}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "أدخل تفاصيل المنتج" : "Enter product details"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2">
            {/* Image Upload */}
            <div className="grid gap-2">
              <Label>{t("products.images")}</Label>
              <div className="flex gap-3 flex-wrap">
                {/* Existing uploaded images (edit mode) */}
                {formImages.map((url) => (
                  <div key={url} className="relative group">
                    <img src={url} alt="" className="h-24 w-24 rounded-lg object-cover bg-muted" />
                    {editingProduct && (
                      <button
                        type="button"
                        onClick={() => handleImageDelete(url)}
                        className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {/* Pending file previews (new product) */}
                {!editingProduct && pendingPreviews.map((previewUrl, i) => (
                  <div key={i} className="relative group">
                    <img src={previewUrl} alt="" className="h-24 w-24 rounded-lg object-cover bg-muted" />
                    <button
                      type="button"
                      onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {/* Upload button — always visible */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage || validatingImage}
                  className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {(uploadingImage || validatingImage) ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="h-6 w-6 mb-1" />
                      <span className="text-[10px]">{t("products.uploadImages")}</span>
                    </>
                  )}
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
              {validatingImage && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {language === "ar" ? "جارٍ التحقق من الصورة..." : "Validating image..."}
                </div>
              )}
              {imageError && <p className="text-xs text-destructive">{imageError}</p>}
              {!editingProduct && pendingFiles.length === 0 && !imageError && (
                <p className="text-xs text-muted-foreground">{t("products.uploadHint")}</p>
              )}
            </div>

            <Separator />

            {/* Name */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("products.productName")} (EN)</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Product name" className={fieldErrors.name ? "border-destructive" : ""} />
                {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
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
                <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Description" rows={2} className={fieldErrors.description ? "border-destructive" : ""} />
                {fieldErrors.description && <p className="text-xs text-destructive">{fieldErrors.description}</p>}
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
                <Input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="0" className={fieldErrors.price ? "border-destructive" : ""} />
                {fieldErrors.price && <p className="text-xs text-destructive">{fieldErrors.price}</p>}
              </div>
              <div className="grid gap-2">
                <Label>{t("products.compareAtPrice")}</Label>
                <Input type="number" value={formComparePrice} onChange={e => setFormComparePrice(e.target.value)} placeholder="0" className={fieldErrors.comparePrice ? "border-destructive" : ""} />
                {fieldErrors.comparePrice && <p className="text-xs text-destructive">{fieldErrors.comparePrice}</p>}
              </div>
              <div className="grid gap-2">
                <Label>{t("products.stock")}</Label>
                <Input type="number" value={formStock} onChange={e => setFormStock(e.target.value)} placeholder="0" className={fieldErrors.stock ? "border-destructive" : ""} />
                {fieldErrors.stock && <p className="text-xs text-destructive">{fieldErrors.stock}</p>}
              </div>
            </div>

            {/* Category & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("products.category")}</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger><SelectValue placeholder={language === "ar" ? "اختر فئة" : "Select category"} /></SelectTrigger>
                  <SelectContent>
                    {apiCategories.filter(c => c.is_active).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
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
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("products.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Products;
