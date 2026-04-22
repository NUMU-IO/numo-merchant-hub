import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { type ProductStatus, type ProductVariant } from "@/data/mock-products";
import { listCategories, type Category } from "@/services/categoryApi";
import {
  getProduct,
  createProduct as apiCreateProduct,
  updateProduct as apiUpdateProduct,
  uploadProductImage,
  deleteProductImage,
  apiToProduct,
  productToApiCreate,
  productToApiUpdate,
} from "@/services/productApi";
import { prepareImageForUpload } from "@/lib/image-validation";
import { updateStore } from "@/services/storeApi";
import { VariantMatrix, type VariantCombination } from "@/components/products/VariantMatrix";
import {
  SizeChartEditor,
  EMPTY_SIZE_CHART,
  sanitizeChartForPersistence,
  sizeChartFromAttributes,
  type SizeChart,
} from "@/components/products/SizeChartEditor";
import { BundleManager } from "@/components/products/BundleManager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Plus, X, ImagePlus, Loader2, Save, Undo2, Layers, Hash,
  Minus, ShoppingCart, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { z } from "zod";

// ── Color variant helpers ──────────────────────────────────────────────

/** Is this variant a color swatch variant? Matches "color"/"colour"/"اللون". */
function isColorVariant(name: string, nameAr?: string): boolean {
  const n = (name || "").toLowerCase();
  if (n.includes("color") || n.includes("colour")) return true;
  const ar = (nameAr || "");
  return ar.includes("لون");
}

/**
 * Fallback hex for common color names (EN + AR) when the merchant hasn't
 * explicitly picked one. Keeps older products from showing grey swatches.
 */
const COLOR_NAME_TO_HEX: Record<string, string> = {
  red: "#e11d48", blue: "#2563eb", green: "#16a34a", black: "#111111",
  white: "#fafafa", grey: "#737373", gray: "#737373", navy: "#1e3a8a",
  brown: "#8b4513", beige: "#d4b896", tan: "#d2b48c", yellow: "#eab308",
  orange: "#f97316", purple: "#a855f7", pink: "#ec4899", gold: "#d4af37",
  silver: "#c0c0c0",
  "أحمر": "#e11d48", "أزرق": "#2563eb", "أخضر": "#16a34a", "أسود": "#111111",
  "أبيض": "#fafafa", "رمادي": "#737373", "كحلي": "#1e3a8a", "بني": "#8b4513",
  "بيج": "#d4b896", "تان": "#d2b48c", "أصفر": "#eab308", "برتقالي": "#f97316",
  "بنفسجي": "#a855f7", "وردي": "#ec4899", "ذهبي": "#d4af37", "فضي": "#c0c0c0",
};

function defaultHexForName(name: string): string {
  return COLOR_NAME_TO_HEX[(name || "").trim().toLowerCase()]
    || COLOR_NAME_TO_HEX[(name || "").trim()]
    || "#888888";
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
  costPrice: z.string()
    .refine((v) => v === "" || (!isNaN(Number(v)) && Number(v) >= 0), "تكلفة الوحدة يجب أن تكون رقمًا صحيحًا")
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "تكلفة الوحدة يجب ألا تتجاوز خانتين عشريتين"),
  stock: z.string()
    .refine((v) => v === "" || (!isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0), "الكمية يجب أن تكون عددًا صحيحًا غير سالب"),
  description: z.string().max(2000, "الوصف يجب ألا يتجاوز 2000 حرف").optional().or(z.literal("")),
});

type FieldErrors = Record<string, string>;

const ProductEditor = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isEditMode = !!productId;

  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [apiCategories, setApiCategories] = useState<Category[]>([]);
  const [formName, setFormName] = useState("");
  const [formNameAr, setFormNameAr] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDescAr, setFormDescAr] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formComparePrice, setFormComparePrice] = useState("");
  const [formCostPrice, setFormCostPrice] = useState("");
  const [formStock, setFormStock] = useState("");
  const [formStatus, setFormStatus] = useState<ProductStatus>("draft");
  const [formCategory, setFormCategory] = useState("");
  const [formSeoTitle, setFormSeoTitle] = useState("");
  const [formSeoDesc, setFormSeoDesc] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formVariants, setFormVariants] = useState<{
    name: string;
    nameAr: string;
    options: string;
    optionsAr: string;
    /** Aligned to parsed `options` by index; only present for color variants. */
    hexValues?: string[];
    imageValues?: string[];
  }[]>([]);
  const [variantCombinations, setVariantCombinations] = useState<VariantCombination[]>([]);
  const [sizeChart, setSizeChart] = useState<SizeChart>({ ...EMPTY_SIZE_CHART });
  // Store-level default chart. Fetched lazily when the merchant opens the
  // "Edit store default" dialog from within the product's size-chart card.
  const [storeDefaultChart, setStoreDefaultChart] = useState<SizeChart>({
    ...EMPTY_SIZE_CHART,
    mode: "custom",
  });
  const [showStoreDefaultDialog, setShowStoreDefaultDialog] = useState(false);
  const [savingStoreDefault, setSavingStoreDefault] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formImages, setFormImages] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [validatingImage, setValidatingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [previewIdx, setPreviewIdx] = useState(0);

  const pendingPreviews = useMemo(() => pendingFiles.map(f => URL.createObjectURL(f)), [pendingFiles]);
  useEffect(() => {
    return () => { pendingPreviews.forEach(url => URL.revokeObjectURL(url)); };
  }, [pendingPreviews]);

  useEffect(() => {
    if (!storeId) return;
    listCategories(storeId).then(setApiCategories).catch(() => {});
  }, [storeId]);

  useEffect(() => {
    if (!storeId || !productId) return;
    setIsLoadingProduct(true);
    getProduct(storeId, productId)
      .then((api) => {
        const p = apiToProduct(api);
        setFormName(p.name);
        setFormNameAr(p.nameAr);
        setFormDesc(p.description);
        setFormDescAr(p.descriptionAr);
        setFormPrice(String(p.price));
        setFormComparePrice(p.compareAtPrice ? String(p.compareAtPrice) : "");
        setFormCostPrice(p.costPrice ? String(p.costPrice) : "");
        setFormStock(String(p.stock));
        setFormStatus(p.status);
        setFormCategory(p.categoryId || "");
        setFormImages(p.images.filter(img => img !== "📦"));
        setFormSeoTitle(api.seo_title || "");
        setFormSeoDesc(api.seo_description || "");
        setFormSlug(api.slug || "");
        setFormVariants(p.variants.map(v => ({
          name: v.name, nameAr: v.nameAr,
          options: v.options.join(", "), optionsAr: v.optionsAr.join(", "),
          hexValues: v.hexValues,
          imageValues: v.imageValues,
        })));
        const rawCombos = (api.attributes as Record<string, unknown>)?.variant_combinations;
        if (Array.isArray(rawCombos)) {
          setVariantCombinations(rawCombos as VariantCombination[]);
        }
        setSizeChart(sizeChartFromAttributes(api.attributes));
      })
      .catch((err) => {
        showError(err, language);
        navigate("/products");
      })
      .finally(() => setIsLoadingProduct(false));
  }, [storeId, productId, language, navigate]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !storeId) return;
    setImageError(null);
    setValidatingImage(true);
    let fileToUpload: File;
    try {
      const result = await prepareImageForUpload(rawFile);
      if (result.error) {
        setImageError(result.error);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      fileToUpload = result.file;
    } finally {
      setValidatingImage(false);
    }
    if (isEditMode && productId) {
      setUploadingImage(true);
      try {
        const result = await uploadProductImage(storeId, productId, fileToUpload);
        setFormImages(prev => [...prev, result.url]);
        toast.success(language === "ar" ? "الصورة اترفعت!" : "Image uploaded!");
      } catch (err) {
        showError(err, language);
      } finally {
        setUploadingImage(false);
      }
    } else {
      setPendingFiles(prev => [...prev, fileToUpload]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageDelete = async (imageUrl: string) => {
    if (!storeId || !productId) return;
    try {
      await deleteProductImage(storeId, productId, imageUrl);
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

  const handleSave = useCallback(async () => {
    if (!storeId || isSaving) return;
    setFieldErrors({});

    const result = productSchema.safeParse({
      name: formName,
      price: formPrice,
      comparePrice: formComparePrice,
      costPrice: formCostPrice,
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
      .map((v, i) => {
        const parsedOptions = v.options.split(",").map(o => o.trim()).filter(Boolean);
        const parsedOptionsAr = v.optionsAr.split(",").map(o => o.trim()).filter(Boolean);
        const isColor = isColorVariant(v.name, v.nameAr);
        // Align per-option metadata to parsedOptions; drop stale entries
        // beyond the current option count, pad missing ones with defaults.
        const hexValues = isColor
          ? parsedOptions.map((opt, j) => v.hexValues?.[j] || defaultHexForName(opt))
          : undefined;
        const imageValues = isColor
          ? parsedOptions.map((_, j) => v.imageValues?.[j] || "")
          : undefined;
        return {
          id: `v-${Date.now()}-${i}`,
          name: v.name, nameAr: v.nameAr,
          options: parsedOptions,
          optionsAr: parsedOptionsAr,
          hexValues,
          imageValues,
        };
      });

    const cat = apiCategories.find(c => c.id === formCategory);

    try {
      if (isEditMode && productId) {
        const payload = productToApiUpdate({
          name: formName, nameAr: formNameAr,
          description: formDesc, descriptionAr: formDescAr,
          price: Number(formPrice),
          compareAtPrice: formComparePrice ? Number(formComparePrice) : undefined,
          costPrice: formCostPrice ? Number(formCostPrice) : undefined,
          stock: Number(formStock),
          status: formStatus,
          categoryId: formCategory || undefined,
          category: cat?.name || "", categoryAr: cat?.name || "",
          variants,
          images: formImages.length > 0 ? formImages : undefined,
          seoTitle: formSeoTitle || undefined,
          seoDescription: formSeoDesc || undefined,
          slug: formSlug || undefined,
        });
        if (variantCombinations.length > 0 && payload.attributes) {
          (payload.attributes as Record<string, unknown>).variant_combinations = variantCombinations;
        }
        const cleanedChart = sanitizeChartForPersistence(sizeChart);
        if (cleanedChart && payload.attributes) {
          (payload.attributes as Record<string, unknown>).size_chart = cleanedChart;
        }
        await apiUpdateProduct(storeId, productId, payload);
        toast.success(t("products.productUpdated"));
      } else {
        const payload = productToApiCreate({
          name: formName, nameAr: formNameAr,
          description: formDesc, descriptionAr: formDescAr,
          price: Number(formPrice),
          compareAtPrice: formComparePrice ? Number(formComparePrice) : undefined,
          costPrice: formCostPrice ? Number(formCostPrice) : undefined,
          stock: Number(formStock),
          status: formStatus,
          categoryId: formCategory || undefined,
          category: cat?.name || "", categoryAr: cat?.name || "",
          variants,
          seoTitle: formSeoTitle || undefined,
          seoDescription: formSeoDesc || undefined,
          slug: formSlug || undefined,
        });
        if (variantCombinations.length > 0 && payload.attributes) {
          (payload.attributes as Record<string, unknown>).variant_combinations = variantCombinations;
        }
        const cleanedChart = sanitizeChartForPersistence(sizeChart);
        if (cleanedChart && payload.attributes) {
          (payload.attributes as Record<string, unknown>).size_chart = cleanedChart;
        }
        const created = await apiCreateProduct(storeId, payload);
        for (const file of pendingFiles) {
          try {
            await uploadProductImage(storeId, created.id, file);
          } catch { /* image upload failure is non-blocking */ }
        }
        toast.success(language === "ar" ? "المنتج اتضاف!" : "Product added successfully!");
      }
      navigate("/products");
    } catch (err) {
      showError(err, language);
    } finally {
      setIsSaving(false);
    }
  }, [storeId, isSaving, formName, formNameAr, formDesc, formDescAr, formPrice, formComparePrice, formCostPrice, formStock, formStatus, formCategory, formVariants, formImages, pendingFiles, isEditMode, productId, apiCategories, language, navigate, t, formSeoTitle, formSeoDesc, formSlug, variantCombinations, sizeChart]);

  if (isLoadingProduct) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">{language === "ar" ? "جارٍ تحميل المنتج..." : "Loading product..."}</p>
      </div>
    );
  }

  const totalImages = formImages.length + pendingPreviews.length;

  // Preview data
  const allPreviewImages = [...formImages, ...pendingPreviews];
  const previewImage = allPreviewImages[previewIdx] || allPreviewImages[0] || null;
  const previewName = (language === "ar" ? formNameAr : formName) || (language === "ar" ? "اسم المنتج" : "Product name");
  const previewDesc = (language === "ar" ? formDescAr : formDesc) || "";
  const previewPrice = formPrice ? Number(formPrice) : 0;
  const previewCompare = formComparePrice ? Number(formComparePrice) : 0;
  const previewCat = apiCategories.find(c => c.id === formCategory);
  const previewVariants = formVariants.filter(v => v.name.trim() && v.options.trim());
  const formatPreviewPrice = (val: number) =>
    language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  return (
    <div className="p-6 max-w-[1100px] mx-auto pb-24">
      {/* Header — Zid style */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/products")} className="h-8 w-8 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">
            {isEditMode
              ? (language === "ar" ? "تعديل المنتج" : "Edit Product")
              : (language === "ar" ? "منتج فردي" : "New Product")}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={isSaving} size="sm" className="h-8 text-xs rounded-lg gap-1.5">
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {language === "ar" ? "حفظ المنتج" : "Save Product"}
        </Button>
      </div>

      <div className="flex gap-6">
      {/* Left: Form */}
      <div className="flex-1 min-w-0 space-y-5 max-w-3xl">

      {/* Basic Info */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold">{language === "ar" ? "معلومات المنتج" : "Product Information"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("products.productName")} (EN) *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Product name" className={`h-10 rounded-lg ${fieldErrors.name ? "border-destructive ring-1 ring-destructive/20" : "bg-muted/30 border-transparent focus:bg-background focus:border-border"}`} />
              {fieldErrors.name && <p className="text-[11px] text-destructive flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-destructive" />{fieldErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("products.productName")} (AR)</Label>
              <Input value={formNameAr} onChange={e => setFormNameAr(e.target.value)} placeholder="اسم المنتج" dir="rtl" className="h-10 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("products.description")} (EN)</Label>
              <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Describe your product..." rows={4} className={`rounded-lg resize-none ${fieldErrors.description ? "border-destructive ring-1 ring-destructive/20" : "bg-muted/30 border-transparent focus:bg-background focus:border-border"}`} />
              {fieldErrors.description && <p className="text-[11px] text-destructive">{fieldErrors.description}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("products.description")} (AR)</Label>
              <Textarea value={formDescAr} onChange={e => setFormDescAr(e.target.value)} placeholder="وصف المنتج..." rows={4} dir="rtl" className="rounded-lg resize-none bg-muted/30 border-transparent focus:bg-background focus:border-border" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Media */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">{language === "ar" ? "رفع صور المنتجات" : "Product Images"}</CardTitle>
            </div>
            {totalImages > 0 && (
              <Badge variant="secondary" className="text-[10px] rounded-md">{totalImages} {language === "ar" ? "صورة" : "images"}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {formImages.map((url) => (
              <div key={url} className="relative group aspect-square">
                <img src={url} alt="" className="h-full w-full rounded-xl object-cover bg-muted ring-1 ring-border/20" />
                {isEditMode && (
                  <button
                    type="button"
                    onClick={() => handleImageDelete(url)}
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-lg bg-black/60 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
            {!isEditMode && pendingPreviews.map((previewUrl, i) => (
              <div key={i} className="relative group aspect-square">
                <img src={previewUrl} alt="" className="h-full w-full rounded-xl object-cover bg-muted ring-1 ring-border/20" />
                <button
                  type="button"
                  onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-lg bg-black/60 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-black/80"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {/* Upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage || validatingImage}
              className="aspect-square flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 text-muted-foreground transition-all hover:bg-muted/40 hover:border-border disabled:opacity-50 cursor-pointer"
            >
              {(uploadingImage || validatingImage) ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="h-5 w-5" />
                  <span className="text-[9px] font-medium">{language === "ar" ? "إضافة" : "Add"}</span>
                </>
              )}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
          {validatingImage && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-3">
              <Loader2 className="h-3 w-3 animate-spin" />
              {language === "ar" ? "جارٍ التحقق من الصورة..." : "Validating image..."}
            </div>
          )}
          {imageError && (
            <div className="flex items-center gap-1.5 mt-3 text-[11px] text-destructive">
              <span className="h-1 w-1 rounded-full bg-destructive" />
              {imageError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing & Inventory */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold">{language === "ar" ? "الكميات في المخزون" : "Pricing & Inventory"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("products.price")} (EGP) *</Label>
              <div className="relative">
                <Input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="0.00" className={`h-10 rounded-lg ps-8 ${fieldErrors.price ? "border-destructive ring-1 ring-destructive/20" : "bg-muted/30 border-transparent focus:bg-background focus:border-border"}`} />
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 font-medium">$</span>
              </div>
              {fieldErrors.price && <p className="text-[11px] text-destructive">{fieldErrors.price}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("products.compareAtPrice")}</Label>
              <div className="relative">
                <Input type="number" value={formComparePrice} onChange={e => setFormComparePrice(e.target.value)} placeholder="0.00" className={`h-10 rounded-lg ps-8 ${fieldErrors.comparePrice ? "border-destructive ring-1 ring-destructive/20" : "bg-muted/30 border-transparent focus:bg-background focus:border-border"}`} />
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 font-medium">$</span>
              </div>
              {fieldErrors.comparePrice && <p className="text-[11px] text-destructive">{fieldErrors.comparePrice}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("products.costPrice")}</Label>
              <div className="relative">
                <Input type="number" value={formCostPrice} onChange={e => setFormCostPrice(e.target.value)} placeholder="0.00" className={`h-10 rounded-lg ps-8 ${fieldErrors.costPrice ? "border-destructive ring-1 ring-destructive/20" : "bg-muted/30 border-transparent focus:bg-background focus:border-border"}`} />
                <span className="absolute start-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 font-medium">$</span>
              </div>
              {fieldErrors.costPrice ? (
                <p className="text-[11px] text-destructive">{fieldErrors.costPrice}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground/60">
                  {language === "ar" ? "اختياري — ليحسب صافي الربح" : "Optional — used to compute profit"}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("products.stock")}</Label>
              <div className="relative">
                <Input type="number" value={formStock} onChange={e => setFormStock(e.target.value)} placeholder="0" className={`h-10 rounded-lg ps-8 ${fieldErrors.stock ? "border-destructive ring-1 ring-destructive/20" : "bg-muted/30 border-transparent focus:bg-background focus:border-border"}`} />
                <Hash className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
              {fieldErrors.stock && <p className="text-[11px] text-destructive">{fieldErrors.stock}</p>}
            </div>
          </div>

          {/* Live profit / margin preview */}
          {(() => {
            const priceNum = Number(formPrice);
            const costNum = Number(formCostPrice);
            if (!formPrice || !formCostPrice || isNaN(priceNum) || isNaN(costNum) || priceNum <= 0 || costNum < 0) {
              return null;
            }
            const profit = priceNum - costNum;
            const margin = priceNum > 0 ? (profit / priceNum) * 100 : 0;
            const positive = profit >= 0;
            return (
              <div className={`mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border px-3 py-2 text-[11px] ${positive ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                <span className="font-medium">
                  {language === "ar" ? "ربح الوحدة:" : "Profit / unit:"}{" "}
                  <span className="font-bold tabular-nums">{formatPreviewPrice(profit)}</span>
                </span>
                <span className="font-medium">
                  {language === "ar" ? "هامش الربح:" : "Margin:"}{" "}
                  <span className="font-bold tabular-nums">{margin.toFixed(1)}%</span>
                </span>
                {!positive && (
                  <span className="font-medium">
                    {language === "ar" ? "تحذير: التكلفة أعلى من السعر" : "Warning: cost exceeds price"}
                  </span>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Organization */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold">{language === "ar" ? "تصنيفات المنتجات" : "Organization"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("products.category")}</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="h-10 rounded-lg bg-muted/30 border-transparent"><SelectValue placeholder={language === "ar" ? "اختر فئة" : "Select category"} /></SelectTrigger>
                <SelectContent>
                  {apiCategories.filter(c => c.is_active).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{t("products.status")}</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as ProductStatus)}>
                <SelectTrigger className="h-10 rounded-lg bg-muted/30 border-transparent"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">
                    <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{t("products.draft")}</span>
                  </SelectItem>
                  <SelectItem value="published">
                    <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t("products.published")}</span>
                  </SelectItem>
                  <SelectItem value="archived">
                    <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />{t("products.archived")}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Product Label (ملصق المنتج) ── */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold">{language === "ar" ? "ملصق المنتج" : "Product Label"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Select>
              <SelectTrigger className="h-10 rounded-lg bg-muted/30 border-transparent flex-1"><SelectValue placeholder={language === "ar" ? "اختر..." : "Choose..."} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">{language === "ar" ? "جديد" : "New"}</SelectItem>
                <SelectItem value="sale">{language === "ar" ? "تخفيض" : "Sale"}</SelectItem>
                <SelectItem value="bestseller">{language === "ar" ? "الأكثر مبيعاً" : "Bestseller"}</SelectItem>
                <SelectItem value="limited">{language === "ar" ? "كمية محدودة" : "Limited"}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-10 rounded-lg px-4 text-xs shrink-0">{language === "ar" ? "إنشاء" : "Create"}</Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Product Display (عرض المنتج) ── */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">{language === "ar" ? "عرض المنتج" : "Product Display"}</CardTitle>
          <CardDescription className="text-xs">{language === "ar" ? "عرض المنتج على المتجر" : "Show product on storefront"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={formStatus} onValueChange={(v) => setFormStatus(v as ProductStatus)}>
            <SelectTrigger className="h-10 rounded-lg bg-muted/30 border-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="published"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{language === "ar" ? "ظاهر" : "Visible"}</span></SelectItem>
              <SelectItem value="draft"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{language === "ar" ? "إخفاء" : "Hidden"}</span></SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* ── Similar Products (تخصيص المنتجات المشابهة) ── */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">{language === "ar" ? "تخصيص المنتجات المشابهة" : "Similar Products"}</CardTitle>
          <CardDescription className="text-xs">{language === "ar" ? "يتم توليد المنتجات المشابهة تلقائياً، ولكن يمكنك تخصيصها حسب رغبتك." : "Similar products are auto-generated, but you can customize them."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs">{language === "ar" ? "اختيار المنتجات" : "Choose products"}</span>
            <Button variant="outline" size="sm" className="h-7 text-[11px] rounded-lg">{language === "ar" ? "اختيار المنتجات" : "Select"}</Button>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-3 flex items-start gap-2">
            <span className="text-primary text-sm mt-0.5">ⓘ</span>
            <p className="text-[11px] text-muted-foreground">{language === "ar" ? "يمكنك إدارة إعدادات المنتجات المشابهة من خلال خصائص المنتج" : "Manage similar products settings from product properties"}</p>
          </div>
        </CardContent>
      </Card>

      {/* ── SEO (تحسين محركات البحث) ── */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">{language === "ar" ? "تحسين محركات البحث" : "SEO Optimization"}</CardTitle>
          <CardDescription className="text-xs">{language === "ar" ? "سيساعد هذا منتجاتك في الوصول إلى المزيد من العملاء عبر محركات البحث المختلفة والذكاء الاصطناعي." : "Help your products reach more customers through search engines and AI."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{language === "ar" ? "عنوان الصفحة" : "Page Title"}</Label>
            <Input value={formSeoTitle} onChange={(e) => setFormSeoTitle(e.target.value)} placeholder={formName || (language === "ar" ? "عنوان المنتج" : "Product title")} className="h-10 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{language === "ar" ? "وصف الصفحة" : "Meta Description"}</Label>
            <Textarea value={formSeoDesc} onChange={(e) => setFormSeoDesc(e.target.value)} placeholder={language === "ar" ? "وصف قصير يظهر في نتائج البحث" : "Short description for search results"} rows={2} className="rounded-lg resize-none bg-muted/30 border-transparent focus:bg-background focus:border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{language === "ar" ? "رابط المنتج" : "URL Slug"}</Label>
            <Input value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder={language === "ar" ? "رابط-المنتج" : "product-slug"} dir="ltr" className="h-10 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border font-mono text-xs" />
          </div>
        </CardContent>
      </Card>

      {/* Variants */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">{language === "ar" ? "خيارات المنتج" : "Product Options"}</CardTitle>
              <CardDescription className="text-xs">{language === "ar" ? "مثل المقاس أو اللون" : "e.g. Size, Color"}</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addVariantRow} className="gap-1 h-8 text-xs rounded-lg">
              <Plus className="h-3 w-3" />
              {t("products.addVariant")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {formVariants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
                <Layers className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-[13px] text-muted-foreground/70 text-center">
                {language === "ar" ? "مفيش متغيرات لسه" : "No variants yet"}
              </p>
              <p className="text-[11px] text-muted-foreground/50 text-center">
                {language === "ar" ? "اضغط \"إضافة متغير\" لإضافة مقاس أو لون" : "Add variants like Size or Color"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {formVariants.map((v, idx) => (
                <div key={idx} className="rounded-xl border border-border/60 bg-muted/[0.03] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/40">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">{idx + 1}</span>
                      <span className="text-xs font-medium">{v.name || (language === "ar" ? "متغير جديد" : "New variant")}</span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeVariant(idx)} className="h-7 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                      <X className="h-3 w-3 me-1" />
                      {language === "ar" ? "حذف" : "Remove"}
                    </Button>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground/70">{language === "ar" ? "الاسم (EN)" : "Name (EN)"}</Label>
                        <Input placeholder="e.g. Size" value={v.name} onChange={e => updateVariant(idx, "name", e.target.value)} className="h-9 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground/70">{language === "ar" ? "الاسم (AR)" : "Name (AR)"}</Label>
                        <Input placeholder="المقاس" value={v.nameAr} onChange={e => updateVariant(idx, "nameAr", e.target.value)} dir="rtl" className="h-9 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground/70">{language === "ar" ? "الخيارات (EN)" : "Options (EN)"}</Label>
                        <Input placeholder="S, M, L, XL" value={v.options} onChange={e => updateVariant(idx, "options", e.target.value)} className="h-9 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground/70">{language === "ar" ? "الخيارات (AR)" : "Options (AR)"}</Label>
                        <Input placeholder="S, M, L, XL" value={v.optionsAr} onChange={e => updateVariant(idx, "optionsAr", e.target.value)} dir="rtl" className="h-9 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border text-sm" />
                      </div>
                    </div>

                    {/* ── Color swatch + image picker (only for color variants) ── */}
                    {isColorVariant(v.name, v.nameAr) && v.options.trim() && (() => {
                      const parsedOptions = v.options.split(",").map(o => o.trim()).filter(Boolean);
                      const uploadedImages = formImages; // merchant's product images, pickable
                      return (
                        <div className="pt-3 border-t border-border/40 space-y-2">
                          <Label className="text-[11px] font-medium text-muted-foreground/80">
                            {language === "ar" ? "لون وصورة لكل اختيار" : "Swatch + image per option"}
                          </Label>
                          <div className="space-y-1.5">
                            {parsedOptions.map((optName, optIdx) => {
                              const currentHex = v.hexValues?.[optIdx] || defaultHexForName(optName);
                              const currentImage = v.imageValues?.[optIdx] || "";
                              return (
                                <div key={optIdx} className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/50 p-2">
                                  <input
                                    type="color"
                                    value={currentHex}
                                    aria-label={`Color for ${optName}`}
                                    onChange={(e) => {
                                      setFormVariants(prev => prev.map((vv, i) => {
                                        if (i !== idx) return vv;
                                        const next = [...(vv.hexValues || parsedOptions.map((o) => defaultHexForName(o)))];
                                        next[optIdx] = e.target.value;
                                        return { ...vv, hexValues: next };
                                      }));
                                    }}
                                    className="h-8 w-10 rounded-md border border-border cursor-pointer bg-transparent shrink-0"
                                  />
                                  <span className="text-xs font-medium flex-1 min-w-0 truncate">{optName}</span>
                                  <Select
                                    value={currentImage || "__none__"}
                                    onValueChange={(value) => {
                                      setFormVariants(prev => prev.map((vv, i) => {
                                        if (i !== idx) return vv;
                                        const next = [...(vv.imageValues || parsedOptions.map(() => ""))];
                                        next[optIdx] = value === "__none__" ? "" : value;
                                        return { ...vv, imageValues: next };
                                      }));
                                    }}
                                  >
                                    <SelectTrigger className="h-8 w-48 text-[11px] shrink-0">
                                      <SelectValue placeholder={language === "ar" ? "صورة (اختياري)" : "Image (optional)"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">
                                        {language === "ar" ? "بدون صورة" : "No image"}
                                      </SelectItem>
                                      {uploadedImages.map((url, i) => (
                                        <SelectItem key={url} value={url}>
                                          {language === "ar" ? `صورة ${i + 1}` : `Image ${i + 1}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {currentImage ? (
                                    <img src={currentImage} alt="" className="h-8 w-8 rounded-md object-cover shrink-0 ring-1 ring-border/40" />
                                  ) : (
                                    <div
                                      className="h-8 w-8 rounded-md shrink-0 ring-1 ring-border/40"
                                      style={{ backgroundColor: currentHex }}
                                    />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {uploadedImages.length === 0 && (
                            <p className="text-[11px] text-muted-foreground/60">
                              {language === "ar"
                                ? "ارفع صور المنتج فوق عشان تقدر تربطها بالألوان."
                                : "Upload product images above to link them to colors."}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Variant Matrix */}
          {formVariants.some(v => v.name.trim() && v.options.trim()) && (
            <>
              <Separator className="my-5" />
              <VariantMatrix
                variants={formVariants}
                combinations={variantCombinations}
                onCombinationsChange={setVariantCombinations}
                defaultPrice={formPrice}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Frequently Bought Together ── */}
      <BundleManager productId={productId ?? null} isEditMode={isEditMode} />

      {/* ── Size Chart ── */}
      <SizeChartEditor
        value={sizeChart}
        onChange={setSizeChart}
        isAr={language === "ar"}
        onUploadImage={
          storeId
            ? async (file) => (await uploadStoreAsset(storeId, file, "section_image")).url
            : undefined
        }
        onEditStoreDefault={() => {
          // Seed the dialog with whatever's currently stored at
          // currentStore.settings.size_chart. Pulling it here (on open)
          // instead of at mount keeps the initial product page load
          // cheap for merchants who never touch store defaults.
          const raw = (currentStore?.settings as Record<string, unknown> | null)?.size_chart;
          setStoreDefaultChart(
            raw ? { ...sizeChartFromAttributes({ size_chart: raw }), mode: "custom" } : { ...EMPTY_SIZE_CHART, mode: "custom" },
          );
          setShowStoreDefaultDialog(true);
        }}
      />

      </div>

      {/* Right: Live Preview */}
      <div className="hidden lg:block w-[360px] shrink-0">
        <div className="sticky top-20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[12px] font-medium text-muted-foreground">{language === "ar" ? "معاينة المنتج" : "Storefront Preview"}</p>
            </div>
            <Badge variant="outline" className="text-[9px] text-muted-foreground border-border/50">LIVE</Badge>
          </div>

          <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
            {/* Image area */}
            <div className="aspect-[4/3] bg-muted/20 relative overflow-hidden">
              {previewImage ? (
                <img src={previewImage} alt="" className="h-full w-full object-cover transition-all duration-300" />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground/20">
                  <ImagePlus className="h-12 w-12" />
                  <span className="text-[11px]">{language === "ar" ? "أضف صورة للمنتج" : "Add product images"}</span>
                </div>
              )}

              {/* Overlays */}
              {formStatus !== "published" && (
                <Badge variant="secondary" className="absolute top-2.5 start-2.5 text-[9px] bg-background/80 backdrop-blur-sm shadow-sm">
                  {t(`products.${formStatus}`)}
                </Badge>
              )}
              {previewCompare > 0 && previewPrice > 0 && previewCompare > previewPrice && (
                <Badge className="absolute top-2.5 end-2.5 text-[10px] bg-red-500 text-white border-0 shadow-sm">
                  {language === "ar" ? "خصم" : "SALE"} {Math.round(((previewCompare - previewPrice) / previewCompare) * 100)}%
                </Badge>
              )}
            </div>

            {/* Thumbnails */}
            {allPreviewImages.length > 1 && (
              <div className="flex gap-1.5 px-3 py-2 border-b border-border/30 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {allPreviewImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewIdx(i)}
                    className={`h-10 w-10 rounded-md overflow-hidden shrink-0 ring-1 transition-all ${
                      i === previewIdx ? "ring-foreground ring-2" : "ring-border/40 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="p-4 space-y-3">
              {/* Category breadcrumb */}
              {previewCat && (
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">{previewCat.name}</p>
              )}

              {/* Name */}
              <h3 className="text-[16px] font-bold leading-snug tracking-tight">{previewName}</h3>

              {/* Rating mock */}
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map(s => (
                    <svg key={s} className={`h-3 w-3 ${s <= 4 ? "text-amber-400 fill-amber-400" : "text-muted/60 fill-muted/60"}`} viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground">(0 {language === "ar" ? "تقييم" : "reviews"})</span>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-2.5 pt-1">
                {previewPrice > 0 ? (
                  <>
                    <span className="text-xl font-bold tabular-nums tracking-tight">{formatPreviewPrice(previewPrice)}</span>
                    {previewCompare > 0 && previewCompare > previewPrice && (
                      <span className="text-[13px] text-muted-foreground/50 line-through tabular-nums">{formatPreviewPrice(previewCompare)}</span>
                    )}
                  </>
                ) : (
                  <span className="text-xl font-bold text-muted-foreground/25 tabular-nums">{formatPreviewPrice(0)}</span>
                )}
              </div>

              {/* Description */}
              {previewDesc && (
                <p className="text-[12px] text-muted-foreground/70 leading-relaxed line-clamp-2">{previewDesc}</p>
              )}

              {/* Variants */}
              {previewVariants.length > 0 && (
                <div className="space-y-3 pt-1 border-t border-border/30">
                  {previewVariants.map((v, i) => {
                    const opts = v.options.split(",").map(o => o.trim()).filter(Boolean);
                    return (
                      <div key={i} className="pt-2">
                        <p className="text-[11px] font-medium mb-2">{language === "ar" ? v.nameAr || v.name : v.name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {opts.map((opt, j) => (
                            <button
                              key={j}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                                j === 0
                                  ? "border-foreground bg-foreground text-background shadow-sm"
                                  : "border-border/60 hover:border-foreground/40"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quantity + Cart */}
              <div className="flex items-center gap-2 pt-3">
                <div className="flex items-center border border-border/60 rounded-lg">
                  <button className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center text-[13px] font-semibold tabular-nums">1</span>
                  <button className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button className="flex-1 h-10 rounded-lg bg-foreground text-background flex items-center justify-center gap-2 text-[13px] font-semibold shadow-sm">
                  <ShoppingCart className="h-4 w-4" />
                  {language === "ar" ? "أضف للسلة" : "Add to Cart"}
                </button>
              </div>

              {/* Stock + shipping info */}
              <div className="space-y-1.5 pt-2 border-t border-border/30">
                {formStock && Number(formStock) > 0 && (
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${Number(formStock) < 20 ? "bg-amber-500" : "bg-emerald-500"}`} />
                    <span className={`text-[11px] ${Number(formStock) < 20 ? "text-amber-600" : "text-emerald-600"}`}>
                      {Number(formStock) < 20
                        ? (language === "ar" ? `باقي ${formStock} فقط!` : `Only ${formStock} left!`)
                        : (language === "ar" ? "متوفر" : "In stock")}
                    </span>
                  </div>
                )}
                {formStock && Number(formStock) === 0 && (
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    <span className="text-[11px] text-red-600">{language === "ar" ? "نفذت الكمية" : "Out of stock"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      </div>{/* end flex gap-6 */}

      {/* ── Store-default size-chart dialog ──
         Opened from the Size Chart card when the merchant is in "Store
         default" mode. We edit the store default in-place here so they
         don't have to navigate away from the product they're working on. */}
      <Dialog open={showStoreDefaultDialog} onOpenChange={setShowStoreDefaultDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="text-base">
              {language === "ar" ? "تعديل جدول المقاسات الافتراضي" : "Edit store-default size chart"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {language === "ar"
                ? "هذا الجدول بيظهر على كل منتج ما عدا اللي عنده جدول خاص."
                : "Used on every product set to \"Store default\". Overridden per-product when needed."}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <SizeChartEditor
              value={storeDefaultChart}
              onChange={setStoreDefaultChart}
              isAr={language === "ar"}
              variant="store-default"
              onUploadImage={
                storeId
                  ? async (file) => (await uploadStoreAsset(storeId, file, "section_image")).url
                  : undefined
              }
            />
          </div>
          <DialogFooter className="px-6 pb-5 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowStoreDefaultDialog(false)}
              disabled={savingStoreDefault}
            >
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!storeId) return;
                setSavingStoreDefault(true);
                try {
                  const cleaned = sanitizeChartForPersistence({
                    ...storeDefaultChart,
                    // Force custom so sanitize keeps the data even if
                    // the merchant didn't touch the mode picker in the
                    // hidden-mode editor.
                    mode: "custom",
                  });
                  await updateStore(storeId, {
                    settings: {
                      size_chart: cleaned ?? null,
                    },
                  });
                  toast.success(language === "ar" ? "تم الحفظ" : "Store default saved");
                  setShowStoreDefaultDialog(false);
                } catch (err) {
                  showError(err, language);
                } finally {
                  setSavingStoreDefault(false);
                }
              }}
              disabled={savingStoreDefault}
            >
              {savingStoreDefault ? (
                <Loader2 className="h-4 w-4 me-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 me-2" />
              )}
              {language === "ar" ? "حفظ الافتراضي" : "Save default"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductEditor;
