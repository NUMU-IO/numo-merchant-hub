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
  setProductImageAlt,
  apiToProduct,
  productToApiCreate,
  productToApiUpdate,
} from "@/services/productApi";
import { prepareImageForUpload } from "@/lib/image-validation";
import { updateStore } from "@/services/storeApi";
import {
  getProductLabels,
  updateProductLabels,
  type ProductLabel,
} from "@/services/productLabelsApi";
import { useTemplateOptions, DEFAULT_TEMPLATE_VALUE } from "@/hooks/useTemplateOptions";
import { VariantMatrix, type VariantCombination } from "@/components/products/VariantMatrix";
import {
  SizeChartEditor,
  EMPTY_SIZE_CHART,
  sanitizeChartForPersistence,
  sizeChartFromAttributes,
  type SizeChart,
} from "@/components/products/SizeChartEditor";
import { BundleManager } from "@/components/products/BundleManager";
import { MetafieldValuesCard } from "@/components/products/MetafieldValuesCard";
import { ManageLabelsDialog } from "@/components/products/ManageLabelsDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
  Minus, Pencil, ShoppingCart, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import { z } from "zod";

// ── Product label presets (v1: fixed bilingual text, no colors/icons) ──
const PRESET_LABELS: ProductLabel[] = [
  { key: "new", text_en: "New", text_ar: "جديد" },
  { key: "sale", text_en: "Sale", text_ar: "تخفيض" },
  { key: "bestseller", text_en: "Bestseller", text_ar: "الأكثر مبيعاً" },
  { key: "limited", text_en: "Limited", text_ar: "كمية محدودة" },
];

/** Sentinel for the "no label" select item (Radix forbids value=""). */
const NO_LABEL_VALUE = "__no_label__";

/** Slug for custom label keys — must satisfy the backend pattern
 *  `custom:[a-z0-9][a-z0-9_-]{0,47}`. Arabic-only names fall back to a
 *  timestamp slug so the key stays ASCII-stable. */
function labelSlug(textEn: string): string {
  const slug = textEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
  return slug || `label-${Date.now().toString(36)}`;
}

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
  const [formBrand, setFormBrand] = useState("");
  const [imageAlts, setImageAlts] = useState<Record<string, string>>({});
  const [formSeoTitle, setFormSeoTitle] = useState("");
  const [formNoindex, setFormNoindex] = useState(false);
  const [formCanonical, setFormCanonical] = useState("");
  const [formSitemapExclude, setFormSitemapExclude] = useState(false);
  const [formSeoDesc, setFormSeoDesc] = useState("");
  const [formMetaCatalogId, setFormMetaCatalogId] = useState("");
  const [formSlug, setFormSlug] = useState("");
  // Alternate storefront template ("template_suffix"). null = default template.
  const [formTemplateSuffix, setFormTemplateSuffix] = useState<string | null>(null);
  // Product label — the selected label travels denormalized on the product
  // (attributes.label); customLabels are the store's reusable definitions.
  const [formLabel, setFormLabel] = useState<ProductLabel | null>(null);
  const [customLabels, setCustomLabels] = useState<ProductLabel[]>([]);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [manageLabelsOpen, setManageLabelsOpen] = useState(false);
  const [newLabelEn, setNewLabelEn] = useState("");
  const [newLabelAr, setNewLabelAr] = useState("");
  const [creatingLabel, setCreatingLabel] = useState(false);
  const { options: templateOptions } = useTemplateOptions("product");
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
  // Wave C — merged variant model. `hasOptions` is the Shopify-style opt-in
  // ("This product has options, like size or color"); OFF = simple product,
  // no variant UI at all. `variantsTouched` gates whether the save sends the
  // canonical options/variants payload — an untouched section is OMITTED so
  // a description-only save can never overwrite stock that changed on the
  // server (orders, adjustments) since the page loaded.
  const [hasOptions, setHasOptions] = useState(false);
  const [variantsTouched, setVariantsTouched] = useState(false);
  // Product SKU (Inventory block). Blank on create → the backend generates
  // a stable `SKU-XXXXXXXX` code; shown read-only-ish after save.
  const [formSku, setFormSku] = useState("");
  const [sizeChart, setSizeChart] = useState<SizeChart>({ ...EMPTY_SIZE_CHART });
  // When true, checkout ignores stock-zero and lets the order go through
  // (stock will show negative). Persisted on attributes.continue_selling_when_out_of_stock.
  const [continueSellingOutOfStock, setContinueSellingOutOfStock] = useState(false);
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
    if (!storeId) return;
    getProductLabels(storeId).then(setCustomLabels).catch(() => {});
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
        setFormBrand(api.brand || "");
        setImageAlts((api.image_alts as Record<string, string>) || {});
        setFormSeoTitle(api.seo_title || "");
        setFormNoindex(Boolean(api.robots_noindex));
        setFormCanonical(api.canonical_url || "");
        setFormSitemapExclude(Boolean(api.sitemap_exclude));
        setFormSeoDesc(api.seo_description || "");
        setFormMetaCatalogId(api.meta_catalog_id || "");
        setFormSlug(api.slug || "");
        setFormTemplateSuffix(api.template_suffix ?? null);
        setFormSku(api.sku || "");
        // Wave C — load axes + matrix from the CANONICAL model (top-level
        // options + variant rows), not the retired attributes pipeline.
        // Presentation decoration (Arabic names, swatch hex, per-option
        // images) lives under attributes.variant_meta; legacy products
        // fall back to the old attributes.variants shape for decoration
        // only. Rows with empty option_values (the default variant of a
        // simple product) are not options — they stay out of the matrix.
        const attrs = api.attributes as Record<string, unknown>;
        const metaAxes = (
          (attrs?.variant_meta as { axes?: unknown } | undefined)?.axes ??
          attrs?.variants
        ) as
          | {
              name?: string; nameAr?: string;
              optionsAr?: string[]; hexValues?: string[]; imageValues?: string[];
            }[]
          | undefined;
        const canonicalOptions = (api.options || []).filter(o => o.name);
        setHasOptions(canonicalOptions.length > 0);
        setFormVariants(
          canonicalOptions.map((o, i) => {
            const meta = Array.isArray(metaAxes)
              ? metaAxes.find(m => m?.name === o.name) ?? metaAxes[i]
              : undefined;
            return {
              name: o.name,
              nameAr: meta?.nameAr || "",
              options: (o.values || []).join(", "),
              optionsAr: Array.isArray(meta?.optionsAr) ? meta.optionsAr.join(", ") : "",
              hexValues: Array.isArray(meta?.hexValues) ? meta.hexValues : undefined,
              imageValues: Array.isArray(meta?.imageValues) ? meta.imageValues : undefined,
            };
          }),
        );
        setVariantCombinations(
          (api.variants || [])
            .filter(v => v.option_values && Object.keys(v.option_values).length > 0)
            .map(v => ({
              options: v.option_values,
              price: v.price || "",
              stock: String(v.inventory_quantity ?? 0),
              sku: v.sku || "",
              enabled: true,
            })),
        );
        setSizeChart(sizeChartFromAttributes(api.attributes));
        setContinueSellingOutOfStock(
          Boolean((api.attributes as Record<string, unknown>)?.continue_selling_when_out_of_stock),
        );
        const rawLabel = (api.attributes as Record<string, unknown>)?.label as
          | { key?: unknown; text_en?: unknown; text_ar?: unknown }
          | undefined;
        if (rawLabel && typeof rawLabel.key === "string" && rawLabel.key) {
          setFormLabel({
            key: rawLabel.key,
            text_en: typeof rawLabel.text_en === "string" ? rawLabel.text_en : "",
            text_ar: typeof rawLabel.text_ar === "string" ? rawLabel.text_ar : "",
          });
        } else {
          setFormLabel(null);
        }
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
    setVariantsTouched(true);
  };

  const updateVariant = (idx: number, field: string, value: string) => {
    setFormVariants(prev => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v));
    setVariantsTouched(true);
  };

  const removeVariant = (idx: number) => {
    setFormVariants(prev => prev.filter((_, i) => i !== idx));
    setVariantsTouched(true);
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
    // ── Wave C: canonical variant payload ──
    // Only when the merchant TOUCHED the variants section. Toggle ON with
    // valid axes → axes + enabled matrix rows (blank per-row SKUs are
    // auto-generated server-side). Toggle OFF after touching → explicit
    // empty arrays, which removes the option variants server-side and
    // recreates the simple default variant. Untouched → undefined (the
    // save leaves server variant rows completely alone).
    const parsedAxes = formVariants
      .filter(v => v.name.trim() && v.options.trim())
      .map((v, i) => ({
        name: v.name.trim(),
        position: i,
        values: v.options.split(",").map(o => o.trim()).filter(Boolean),
      }));
    const wantsOptions = hasOptions && parsedAxes.length > 0;
    const mappedComboRows = variantCombinations
      .filter(c => c.enabled && Object.keys(c.options || {}).length > 0)
      .map(c => ({
        option_values: c.options,
        price: Number(c.price) > 0 ? Number(c.price) : Number(formPrice),
        inventory_quantity: Math.max(0, parseInt(c.stock, 10) || 0),
        ...(c.sku.trim() ? { sku: c.sku.trim() } : {}),
      }));
    const canonicalOptions = variantsTouched
      ? (wantsOptions ? parsedAxes : [])
      : undefined;
    const canonicalVariants = variantsTouched
      ? (wantsOptions ? mappedComboRows : [])
      : undefined;
    // Presentation decoration (Arabic axis names, swatch hex, per-option
    // images) rides attributes.variant_meta — a key the server bridge
    // ignores. NEVER write attributes.variants / variant_combinations:
    // those re-activate the retired legacy pipeline.
    const variantMeta = wantsOptions
      ? {
          axes: formVariants
            .filter(v => v.name.trim() && v.options.trim())
            .map(v => {
              const parsedOptions = v.options.split(",").map(o => o.trim()).filter(Boolean);
              const isColor = isColorVariant(v.name, v.nameAr);
              return {
                name: v.name.trim(),
                nameAr: v.nameAr,
                optionsAr: v.optionsAr.split(",").map(o => o.trim()).filter(Boolean),
                ...(isColor
                  ? {
                      hexValues: parsedOptions.map(
                        (opt, j) => v.hexValues?.[j] || defaultHexForName(opt),
                      ),
                      imageValues: parsedOptions.map((_, j) => v.imageValues?.[j] || ""),
                    }
                  : {}),
              };
            }),
        }
      : null;

    const cat = apiCategories.find(c => c.id === formCategory);

    try {
      if (isEditMode && productId) {
        const payload = productToApiUpdate({
          name: formName,
          // Omit rather than send "" — attributes are replaced wholesale, so a
          // blank field must not overwrite Arabic written elsewhere (CSV import).
          nameAr: formNameAr.trim() || undefined,
          description: formDesc,
          descriptionAr: formDescAr.trim() || undefined,
          price: Number(formPrice),
          compareAtPrice: formComparePrice ? Number(formComparePrice) : undefined,
          costPrice: formCostPrice ? Number(formCostPrice) : undefined,
          stock: Number(formStock),
          status: formStatus,
          categoryId: formCategory || undefined,
          category: cat?.name || "", categoryAr: cat?.name || "",
          sku: formSku.trim() || undefined,
          variants: [],
          options: canonicalOptions,
          serverVariants: canonicalVariants,
          images: formImages.length > 0 ? formImages : undefined,
          brand: formBrand.trim() || undefined,
          seoTitle: formSeoTitle || undefined,
          robotsNoindex: formNoindex,
          canonicalUrl: formCanonical.trim() || undefined,
          sitemapExclude: formSitemapExclude,
          seoDescription: formSeoDesc || undefined,
          metaCatalogId: formMetaCatalogId || undefined,
          slug: formSlug || undefined,
          templateSuffix: formTemplateSuffix,
        });
        if (variantMeta && payload.attributes) {
          (payload.attributes as Record<string, unknown>).variant_meta = variantMeta;
        }
        const cleanedChart = sanitizeChartForPersistence(sizeChart);
        if (cleanedChart && payload.attributes) {
          (payload.attributes as Record<string, unknown>).size_chart = cleanedChart;
        }
        if (payload.attributes) {
          (payload.attributes as Record<string, unknown>).continue_selling_when_out_of_stock = continueSellingOutOfStock;
        }
        // Label rides in attributes; omitting the key clears it server-side
        // (the update replaces attributes wholesale).
        if (formLabel && payload.attributes) {
          (payload.attributes as Record<string, unknown>).label = formLabel;
        }
        await apiUpdateProduct(storeId, productId, payload);
        toast.success(t("products.productUpdated"));
      } else {
        const payload = productToApiCreate({
          name: formName,
          // Omit rather than send "" — attributes are replaced wholesale, so a
          // blank field must not overwrite Arabic written elsewhere (CSV import).
          nameAr: formNameAr.trim() || undefined,
          description: formDesc,
          descriptionAr: formDescAr.trim() || undefined,
          price: Number(formPrice),
          compareAtPrice: formComparePrice ? Number(formComparePrice) : undefined,
          costPrice: formCostPrice ? Number(formCostPrice) : undefined,
          stock: Number(formStock),
          status: formStatus,
          categoryId: formCategory || undefined,
          category: cat?.name || "", categoryAr: cat?.name || "",
          sku: formSku.trim() || undefined,
          variants: [],
          // Create sends the canonical model whenever the toggle is on —
          // no dirty-gating needed (there's no server state to protect).
          options: wantsOptions ? parsedAxes : undefined,
          serverVariants: wantsOptions ? mappedComboRows : undefined,
          brand: formBrand.trim() || undefined,
          seoTitle: formSeoTitle || undefined,
          robotsNoindex: formNoindex,
          canonicalUrl: formCanonical.trim() || undefined,
          sitemapExclude: formSitemapExclude,
          seoDescription: formSeoDesc || undefined,
          metaCatalogId: formMetaCatalogId || undefined,
          slug: formSlug || undefined,
          templateSuffix: formTemplateSuffix,
        });
        if (variantMeta && payload.attributes) {
          (payload.attributes as Record<string, unknown>).variant_meta = variantMeta;
        }
        const cleanedChart = sanitizeChartForPersistence(sizeChart);
        if (cleanedChart && payload.attributes) {
          (payload.attributes as Record<string, unknown>).size_chart = cleanedChart;
        }
        if (payload.attributes) {
          (payload.attributes as Record<string, unknown>).continue_selling_when_out_of_stock = continueSellingOutOfStock;
        }
        if (formLabel && payload.attributes) {
          (payload.attributes as Record<string, unknown>).label = formLabel;
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
  }, [storeId, isSaving, formName, formNameAr, formDesc, formDescAr, formPrice, formComparePrice, formCostPrice, formStock, formStatus, formCategory, formVariants, formImages, pendingFiles, isEditMode, productId, apiCategories, language, navigate, t, formBrand, formSeoTitle, formSeoDesc, formNoindex, formCanonical, formSitemapExclude, formMetaCatalogId, formSlug, formTemplateSuffix, variantCombinations, sizeChart, continueSellingOutOfStock, formLabel, formSku, hasOptions, variantsTouched]);

  const allLabels = useMemo(
    () => [...PRESET_LABELS, ...customLabels],
    [customLabels],
  );

  const handleLabelSelect = (value: string) => {
    if (value === NO_LABEL_VALUE) {
      setFormLabel(null);
      return;
    }
    // Denormalize the text at selection time — later renames of the
    // definition don't back-propagate to this product (v1 trade-off).
    const found = allLabels.find((l) => l.key === value);
    setFormLabel(found ? { ...found } : null);
  };

  const handleCreateLabel = async () => {
    if (!storeId || creatingLabel) return;
    const textEn = newLabelEn.trim();
    const textAr = newLabelAr.trim();
    if (!textEn) {
      toast.error(
        language === "ar" ? "الاسم الإنجليزي مطلوب" : "English name is required",
      );
      return;
    }
    const taken = new Set(allLabels.map((l) => l.key));
    let key = `custom:${labelSlug(textEn)}`;
    let n = 2;
    while (taken.has(key)) key = `custom:${labelSlug(textEn)}-${n++}`;
    const newLabel: ProductLabel = { key, text_en: textEn, text_ar: textAr };
    setCreatingLabel(true);
    try {
      const saved = await updateProductLabels(storeId, [
        ...customLabels,
        newLabel,
      ]);
      setCustomLabels(saved);
      setFormLabel({ ...newLabel });
      setLabelDialogOpen(false);
      setNewLabelEn("");
      setNewLabelAr("");
      toast.success(language === "ar" ? "تم إنشاء الملصق" : "Label created");
    } catch (err) {
      showError(err, language);
    } finally {
      setCreatingLabel(false);
    }
  };

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
              <Input value={formNameAr} onChange={e => setFormNameAr(e.target.value)} placeholder={formName.trim() || "اسم المنتج"} dir="rtl" className="h-10 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border" />
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
              <Textarea value={formDescAr} onChange={e => setFormDescAr(e.target.value)} placeholder={formDesc.trim() || "وصف المنتج..."} rows={4} dir="rtl" className="rounded-lg resize-none bg-muted/30 border-transparent focus:bg-background focus:border-border" />
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
              <div key={url} className="space-y-1.5">
                <div className="relative group aspect-square">
                  <img src={url} alt={imageAlts[url] || ""} className="h-full w-full rounded-xl object-cover bg-muted ring-1 ring-border/20" />
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
                {isEditMode && productId && (
                  <Input
                    value={imageAlts[url] ?? ""}
                    onChange={(e) => setImageAlts(prev => ({ ...prev, [url]: e.target.value }))}
                    onBlur={(e) => {
                      void setProductImageAlt(storeId, productId, url, e.target.value)
                        .catch(err => showError(err, language));
                    }}
                    placeholder={language === "ar" ? "وصف الصورة" : "Describe this image"}
                    maxLength={250}
                    className="h-7 text-[11px] rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border"
                  />
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

          {/* SKU (Inventory) — the code that identifies this product on
              labels, feeds, and imports. Blank on a NEW product → the
              platform generates a stable one at save time. */}
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              {language === "ar" ? "كود التخزين (SKU)" : "SKU"}
            </Label>
            <Input
              value={formSku}
              onChange={(e) => setFormSku(e.target.value)}
              placeholder={language === "ar" ? "اتركه فارغًا ليتم توليده تلقائيًا" : "Leave empty to auto-generate"}
              dir="ltr"
              className="h-10 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground/60">
              {language === "ar"
                ? "كود فريد يعرّف المنتج في المخزون والفواتير والاستيراد. لا يتغير تلقائيًا بعد إنشائه."
                : "Unique code identifying this product in inventory, invoices, and imports. Never regenerated once set."}
            </p>
          </div>

          {/* Oversell toggle */}
          <label className="mt-3 flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <input
              type="checkbox"
              checked={continueSellingOutOfStock}
              onChange={(e) => setContinueSellingOutOfStock(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-primary"
            />
            <div className="flex-1">
              <div className="text-[13px] font-medium">
                {language === "ar"
                  ? "استمر في البيع حتى لو نفد المخزون"
                  : "Continue selling when out of stock"}
              </div>
              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                {language === "ar"
                  ? "الطلبات هتقبل حتى لو الكمية صفر. الرصيد هيظهر بالسالب."
                  : "Orders will be accepted even when stock reaches zero. Inventory may go negative."}
              </p>
            </div>
          </label>

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

      {/* ── Template (قالب العرض) ── */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">{language === "ar" ? "قالب العرض" : "Template"}</CardTitle>
          <CardDescription className="text-xs">
            {language === "ar"
              ? "اختر قالب عرض بديل لهذا المنتج. القوالب تُنشأ من محرر الثيم."
              : "Pick an alternate storefront template for this product. Variants are created in the theme editor."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={formTemplateSuffix ?? DEFAULT_TEMPLATE_VALUE}
            onValueChange={(v) => setFormTemplateSuffix(v === DEFAULT_TEMPLATE_VALUE ? null : v)}
          >
            <SelectTrigger className="h-10 rounded-lg bg-muted/30 border-transparent">
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
        </CardContent>
      </Card>

      {/* ── Product Label (ملصق المنتج) ── */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-bold">{language === "ar" ? "ملصق المنتج" : "Product Label"}</CardTitle>
          <CardDescription className="text-xs">
            {language === "ar"
              ? "شارة نصية تظهر على كارت المنتج في المتجر"
              : "A text badge shown on the product card in your storefront"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Select value={formLabel?.key ?? NO_LABEL_VALUE} onValueChange={handleLabelSelect}>
              <SelectTrigger className="h-10 rounded-lg bg-muted/30 border-transparent flex-1"><SelectValue placeholder={language === "ar" ? "اختر..." : "Choose..."} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_LABEL_VALUE}>{language === "ar" ? "بدون ملصق" : "None"}</SelectItem>
                {PRESET_LABELS.map((l) => (
                  <SelectItem key={l.key} value={l.key}>{language === "ar" ? l.text_ar : l.text_en}</SelectItem>
                ))}
                {customLabels.map((l) => (
                  <SelectItem key={l.key} value={l.key}>{language === "ar" ? (l.text_ar || l.text_en) : l.text_en}</SelectItem>
                ))}
                {/* Orphaned label (definition deleted/renamed) — keep it
                    selectable so reopening the product doesn't blank the UI. */}
                {formLabel && !allLabels.some((l) => l.key === formLabel.key) && (
                  <SelectItem value={formLabel.key}>
                    {language === "ar" ? (formLabel.text_ar || formLabel.text_en) : formLabel.text_en}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-10 rounded-lg px-4 text-xs shrink-0"
              onClick={() => setLabelDialogOpen(true)}
            >
              {language === "ar" ? "إنشاء" : "Create"}
            </Button>
            {customLabels.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-10 w-10 rounded-lg p-0 shrink-0"
                onClick={() => setManageLabelsOpen(true)}
                title={language === "ar" ? "إدارة الملصقات" : "Manage labels"}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {storeId && (
        <ManageLabelsDialog
          open={manageLabelsOpen}
          onOpenChange={setManageLabelsOpen}
          storeId={storeId}
          labels={customLabels}
          language={language}
          onSaved={(saved) => {
            setCustomLabels(saved);
            // Keep the selected label in sync: the backend already
            // propagated renames/deletes to products, so the form must not
            // write stale text back on the next product save.
            if (formLabel?.key.startsWith("custom:")) {
              const updated = saved.find((l) => l.key === formLabel.key);
              setFormLabel(updated ? { ...updated } : null);
            }
          }}
        />
      )}

      <Dialog open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "ملصق جديد" : "New label"}</DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "ملصق مخصص قابل لإعادة الاستخدام يظهر على كارت المنتج."
                : "A reusable custom label shown on product cards."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="label-name-en">{language === "ar" ? "الاسم (إنجليزي)" : "Name (EN)"}</Label>
              <Input
                id="label-name-en"
                value={newLabelEn}
                onChange={(e) => setNewLabelEn(e.target.value)}
                maxLength={80}
                placeholder="Eid Offer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="label-name-ar">{language === "ar" ? "الاسم (عربي)" : "Name (AR)"}</Label>
              <Input
                id="label-name-ar"
                dir="rtl"
                value={newLabelAr}
                onChange={(e) => setNewLabelAr(e.target.value)}
                maxLength={80}
                placeholder="عرض العيد"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCreateLabel} disabled={creatingLabel || !newLabelEn.trim()}>
              {creatingLabel
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : (language === "ar" ? "حفظ" : "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Label className="text-xs font-medium text-muted-foreground">{language === "ar" ? "الماركة" : "Brand"}</Label>
            <Input value={formBrand} onChange={(e) => setFormBrand(e.target.value)} placeholder={language === "ar" ? "الشركة المصنّعة" : "Manufacturer"} className="h-10 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border" />
            <p className="text-[11px] text-muted-foreground">{language === "ar" ? "يظهر في نتائج البحث وكتالوج الإعلانات. لو فاضي، هيتحسب باسم المتجر." : "Used in search results and your ads catalog. Left empty, your store name is assumed."}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{language === "ar" ? "عنوان الصفحة" : "Page Title"}</Label>
            <Input value={formSeoTitle} onChange={(e) => setFormSeoTitle(e.target.value)} placeholder={formName || (language === "ar" ? "عنوان المنتج" : "Product title")} className="h-10 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{language === "ar" ? "وصف الصفحة" : "Meta Description"}</Label>
            <Textarea value={formSeoDesc} onChange={(e) => setFormSeoDesc(e.target.value)} placeholder={language === "ar" ? "وصف قصير يظهر في نتائج البحث" : "Short description for search results"} rows={2} className="rounded-lg resize-none bg-muted/30 border-transparent focus:bg-background focus:border-border" />
          </div>
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-medium text-muted-foreground">{language === "ar" ? "الرابط الأساسي (Canonical)" : "Canonical URL"}</Label>
            <Input value={formCanonical} onChange={(e) => setFormCanonical(e.target.value)} placeholder="https://…" dir="ltr" className="h-10 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border" />
            <p className="text-[11px] text-muted-foreground">{language === "ar" ? "سيبها فاضية غير لو الصفحة دي نسخة من صفحة تانية." : "Leave empty unless this page duplicates another one."}</p>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1">
            <div>
              <p className="text-xs font-medium">{language === "ar" ? "إخفاء من نتائج البحث" : "Hide from search results"}</p>
              <p className="text-[11px] text-muted-foreground">{language === "ar" ? "الصفحة هتفضل شغالة، بس مش هتظهر في جوجل." : "The page still works — it just won't appear in Google."}</p>
            </div>
            <Switch checked={formNoindex} onCheckedChange={setFormNoindex} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium">{language === "ar" ? "استبعاد من خريطة الموقع" : "Leave out of sitemap"}</p>
              <p className="text-[11px] text-muted-foreground">{language === "ar" ? "بيحصل تلقائيًا لو أخفيت الصفحة من نتائج البحث." : "Happens automatically when the page is hidden from search."}</p>
            </div>
            <Switch checked={formSitemapExclude || formNoindex} disabled={formNoindex} onCheckedChange={setFormSitemapExclude} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{language === "ar" ? "رابط المنتج" : "URL Slug"}</Label>
            <Input value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder={language === "ar" ? "رابط-المنتج" : "product-slug"} dir="ltr" className="h-10 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border font-mono text-xs" />
          </div>
          {/* Meta Commerce Catalog product ID — used as content_ids on
              storefront Pixel events so Meta dynamic ads can match
              conversions to a catalog row. Optional; falls back to our
              internal product UUID when blank. */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-[#1877F2] text-white text-[9px] font-bold shrink-0">f</span>
              {language === "ar" ? "معرف المنتج في كتالوج Meta" : "Meta Catalog Product ID"}
            </Label>
            <Input
              value={formMetaCatalogId}
              onChange={(e) => setFormMetaCatalogId(e.target.value)}
              placeholder={language === "ar" ? "اختياري — اتركه فارغًا للاستخدام التلقائي" : "Optional — leave blank to auto-use product ID"}
              dir="ltr"
              className="h-10 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {language === "ar"
                ? "إذا قمت بمزامنة كتالوج منتجاتك مع Meta Business Manager، أضف معرف المنتج هنا للسماح بإعلانات المنتجات الديناميكية بمطابقة عمليات الشراء بصف الكتالوج."
                : "If you've synced your product catalog to Meta Business Manager, paste the Catalog product ID here so dynamic-product-ads can match conversions to a catalog row."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Variants (Wave C: single merged editor, Shopify-style opt-in) ── */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold">{language === "ar" ? "المتغيرات" : "Variants"}</CardTitle>
              <CardDescription className="text-xs">
                {language === "ar"
                  ? "هذا المنتج له خيارات، مثل المقاس أو اللون"
                  : "This product has options, like size or color"}
              </CardDescription>
            </div>
            <Switch
              checked={hasOptions}
              onCheckedChange={(on) => {
                setHasOptions(on);
                setVariantsTouched(true);
                if (on && formVariants.length === 0) {
                  addVariantRow();
                }
              }}
              aria-label={language === "ar" ? "تفعيل خيارات المنتج" : "Enable product options"}
            />
          </div>
        </CardHeader>
        {hasOptions && (
        <CardContent>
          {isEditMode && !variantsTouched && variantCombinations.length > 0 && (
            <p className="mb-3 text-[11px] text-muted-foreground/70">
              {language === "ar"
                ? "أسعار ومخزون التركيبات محمّلة من السيرفر — التعديلات هنا تُحفظ عند الضغط على حفظ."
                : "Combination prices and stock are loaded from the server — edits here are applied when you save."}
            </p>
          )}
          <div className="mb-3 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={addVariantRow} className="gap-1 h-8 text-xs rounded-lg">
              <Plus className="h-3 w-3" />
              {t("products.addVariant")}
            </Button>
          </div>
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
                    {/* ── Quick-pick presets ── */}
                    {/* Only show on a brand-new empty row so the chips aren't
                        visual noise once the merchant has started filling it. */}
                    {!v.name.trim() && !v.nameAr.trim() && !v.options.trim() && !v.optionsAr.trim() && (() => {
                      const presets = [
                        { en: "Size", ar: "المقاس", options_en: "S, M, L, XL", options_ar: "S, M, L, XL" },
                        { en: "Color", ar: "اللون", options_en: "Red, Blue, Black, White", options_ar: "أحمر, أزرق, أسود, أبيض" },
                        { en: "Material", ar: "الخامة", options_en: "", options_ar: "" },
                      ];
                      return (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground/70 me-1">
                            {language === "ar" ? "ابدأ بسرعة:" : "Quick start:"}
                          </span>
                          {presets.map((p) => (
                            <button
                              key={p.en}
                              type="button"
                              onClick={() => {
                                setFormVariants(prev => prev.map((vv, i) =>
                                  i === idx
                                    ? { ...vv, name: p.en, nameAr: p.ar, options: p.options_en, optionsAr: p.options_ar }
                                    : vv,
                                ));
                              }}
                              className="h-7 px-2.5 rounded-md bg-muted/50 hover:bg-muted text-[11px] font-medium text-foreground/80 hover:text-foreground transition-colors"
                            >
                              {language === "ar" ? p.ar : p.en}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

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
                        <Input
                          placeholder={isColorVariant(v.name, v.nameAr) ? "Red, Blue, Black" : "S, M, L, XL"}
                          value={v.options}
                          onChange={e => updateVariant(idx, "options", e.target.value)}
                          className="h-9 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground/70">{language === "ar" ? "الخيارات (AR)" : "Options (AR)"}</Label>
                        <Input
                          placeholder={isColorVariant(v.name, v.nameAr) ? "أحمر, أزرق, أسود" : "S, M, L, XL"}
                          value={v.optionsAr}
                          onChange={e => updateVariant(idx, "optionsAr", e.target.value)}
                          dir="rtl"
                          className="h-9 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border text-sm"
                        />
                      </div>
                    </div>

                    {/* ── Color variant hint when options are empty ── */}
                    {/* Covers the UX gap where a merchant names a variant
                        "Color" but leaves the options placeholder untouched
                        and wonders why no swatch picker appeared. */}
                    {isColorVariant(v.name, v.nameAr) && !v.options.trim() && (
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground">
                        {language === "ar"
                          ? "اكتب أسماء الألوان بالأعلى (مثلاً: أحمر، أزرق، أسود) عشان تظهر خانات اختيار اللون لكل واحد."
                          : "Type color names above (e.g., Red, Blue, Black) to get a swatch + image picker per color."}
                      </div>
                    )}

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

          {/* Variant Matrix — per-combination price / stock / SKU. A blank
              per-row SKU is auto-generated by the backend at save time.
              Note: the matrix re-syncs missing combinations on load, so
              what's displayed is exactly what a save persists (WYSIWYG). */}
          {formVariants.some(v => v.name.trim() && v.options.trim()) && (
            <>
              <Separator className="my-5" />
              <VariantMatrix
                variants={formVariants}
                combinations={variantCombinations}
                onCombinationsChange={(next) => {
                  setVariantCombinations(next);
                  setVariantsTouched(true);
                }}
                defaultPrice={formPrice}
              />
              <p className="mt-2 text-[10px] text-muted-foreground/60">
                {language === "ar"
                  ? "اترك خانة SKU فارغة لأي تركيبة ليتم توليد كود فريد لها تلقائيًا عند الحفظ."
                  : "Leave a combination's SKU blank to auto-generate a unique code on save."}
              </p>
            </>
          )}
        </CardContent>
        )}
        {!hasOptions && isEditMode && variantsTouched && variantCombinations.length > 0 && (
          <CardContent>
            <p className="text-[11px] text-amber-600">
              {language === "ar"
                ? "تم إيقاف الخيارات — سيتم حذف كل المتغيرات عند الحفظ ويعود المنتج منتجًا بسيطًا."
                : "Options turned off — saving will remove all variants and return this to a simple product."}
            </p>
          </CardContent>
        )}
      </Card>

      {/* ── Frequently Bought Together ── */}
      <BundleManager productId={productId ?? null} isEditMode={isEditMode} />

      {/* ── Custom fields (metafields) ── */}
      <MetafieldValuesCard storeId={storeId} productId={productId} isEditMode={isEditMode} />

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
                <img src={previewImage} alt="" className="h-full w-full object-contain transition-all duration-300" />
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
