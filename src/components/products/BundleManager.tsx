/**
 * BundleManager — "Frequently Bought Together" management card.
 *
 * Embedded in the ProductEditor page. Allows merchants to:
 * - Search and add products to the bundle
 * - Set discount type/value per bundled product
 * - Toggle active/inactive per bundle item
 * - Drag-and-drop reorder
 * - Set a custom section title (EN + AR)
 * - Save all changes via the bulk-set endpoint
 *
 * Design: Matches the existing Zid/Shopify-style card UI in the editor.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  type ProductBundle,
  type BulkSetBundleItem,
  getBundlesForProduct,
  setBundlesForProduct,
} from "@/services/bundleApi";
import {
  listProducts,
  type ApiProductResponse,
} from "@/services/productApi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Package,
  Plus,
  X,
  GripVertical,
  Search,
  Loader2,
  Save,
  Percent,
  DollarSign,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";

// ── Types ────────────────────────────────────────────────────────────────

interface BundleItem {
  /** Existing bundle ID (null for new items) */
  id: string | null;
  bundled_product_id: string;
  product_name: string;
  product_price: number;
  product_image: string | null;
  product_in_stock: boolean;
  discount_type: "percentage" | "fixed" | "none";
  discount_value: number;
  is_active: boolean;
  position: number;
}

interface BundleManagerProps {
  /** The product being edited — null when creating a new product */
  productId: string | null;
  /** Whether the parent form is in edit mode */
  isEditMode: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatPrice(cents: number, lang: string): string {
  const val = cents / 100;
  return lang === "ar"
    ? `${val.toLocaleString("ar-EG")} ج.م`
    : `EGP ${val.toLocaleString()}`;
}

function calculateDiscountedPrice(
  price: number,
  discountType: string,
  discountValue: number,
): number {
  if (discountType === "percentage" && discountValue > 0) {
    return Math.max(0, price - Math.floor((price * discountValue) / 100));
  }
  if (discountType === "fixed" && discountValue > 0) {
    return Math.max(0, price - discountValue);
  }
  return price;
}

// ── Component ────────────────────────────────────────────────────────────

export function BundleManager({ productId, isEditMode }: BundleManagerProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  // ── State ──────────────────────────────────────────────────────────────
  const [bundles, setBundles] = useState<BundleItem[]>([]);
  const [sectionTitleEn, setSectionTitleEn] = useState("");
  const [sectionTitleAr, setSectionTitleAr] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Product search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ApiProductResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Drag state (simple index swap)
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // ── Load existing bundles ──────────────────────────────────────────────
  useEffect(() => {
    if (!storeId || !productId || !isEditMode) return;
    let cancelled = false;

    setIsLoading(true);
    getBundlesForProduct(storeId, productId)
      .then((data) => {
        if (cancelled) return;
        const items: BundleItem[] = data.map((b, idx) => ({
          id: b.id,
          bundled_product_id: b.bundled_product_id,
          product_name: b.bundled_product_name || "Unknown",
          product_price: b.bundled_product_price || 0,
          product_image: b.bundled_product_image || null,
          product_in_stock: b.bundled_product_in_stock ?? true,
          discount_type: b.discount_type,
          discount_value: b.discount_value,
          is_active: b.is_active,
          position: b.position ?? idx,
        }));
        setBundles(items);
        // Use section title from first bundle if available
        if (data.length > 0) {
          setSectionTitleEn(data[0].section_title_en || "");
          setSectionTitleAr(data[0].section_title_ar || "");
        }
      })
      .catch((err) => {
        if (!cancelled) console.error("Failed to load bundles:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [storeId, productId, isEditMode]);

  // ── Product search ─────────────────────────────────────────────────────
  // Empty search → list the store's most recent products as a "suggestions"
  // view so merchants can pick without having to guess product names. Typing
  // debounces and re-queries with the search term.
  useEffect(() => {
    if (!storeId) {
      setSearchResults([]);
      return;
    }

    const hasQuery = searchQuery.trim().length > 0;
    // Only debounce when the user is typing; an empty query should load
    // instantly when the picker opens.
    const delay = hasQuery ? 300 : 0;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await listProducts(storeId, {
          ...(hasQuery ? { search: searchQuery } : {}),
          limit: 20,
          status: "active",
        });
        // Filter out the current product and already-bundled products
        const bundledIds = new Set(bundles.map((b) => b.bundled_product_id));
        const filtered = result.items.filter(
          (p) => p.id !== productId && !bundledIds.has(p.id),
        );
        setSearchResults(filtered);
      } catch (err) {
        console.error("Product search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [searchQuery, storeId, productId, bundles]);

  // ── Actions ────────────────────────────────────────────────────────────

  const addProduct = useCallback(
    (product: ApiProductResponse) => {
      const newItem: BundleItem = {
        id: null,
        bundled_product_id: product.id,
        product_name: product.name,
        product_price: Math.round(parseFloat(product.price) * 100),
        product_image: product.images[0] || null,
        product_in_stock: product.is_in_stock,
        discount_type: "none",
        discount_value: 0,
        is_active: true,
        position: bundles.length,
      };
      setBundles((prev) => [...prev, newItem]);
      setIsDirty(true);
      setSearchQuery("");
      setSearchResults([]);
      setSearchOpen(false);
    },
    [bundles.length],
  );

  const removeBundle = useCallback((index: number) => {
    setBundles((prev) => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }, []);

  const updateBundleField = useCallback(
    (index: number, field: keyof BundleItem, value: unknown) => {
      setBundles((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, [field]: value } : item,
        ),
      );
      setIsDirty(true);
    },
    [],
  );

  // ── Drag & Drop ────────────────────────────────────────────────────────
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    setBundles((prev) => {
      const items = [...prev];
      const [dragged] = items.splice(dragIndex, 1);
      items.splice(index, 0, dragged);
      return items.map((item, i) => ({ ...item, position: i }));
    });
    setDragIndex(index);
    setIsDirty(true);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!storeId || !productId) return;

    setIsSaving(true);
    try {
      const bundleItems: BulkSetBundleItem[] = bundles.map((b, idx) => ({
        bundled_product_id: b.bundled_product_id,
        discount_type: b.discount_type,
        discount_value: b.discount_value,
        position: idx,
        is_active: b.is_active,
        section_title_en: sectionTitleEn || null,
        section_title_ar: sectionTitleAr || null,
      }));

      await setBundlesForProduct(storeId, {
        primary_product_id: productId,
        bundles: bundleItems,
      });

      setIsDirty(false);
      toast.success(
        isAr ? "تم حفظ الباندل بنجاح" : "Bundles saved successfully",
      );
    } catch (err) {
      showError(err, language);
    } finally {
      setIsSaving(false);
    }
  }, [storeId, productId, bundles, sectionTitleEn, sectionTitleAr, isAr, language]);

  // ── Computed ───────────────────────────────────────────────────────────
  const totalSavings = useMemo(() => {
    return bundles.reduce((acc, b) => {
      if (!b.is_active) return acc;
      const discounted = calculateDiscountedPrice(
        b.product_price,
        b.discount_type,
        b.discount_value,
      );
      return acc + (b.product_price - discounted);
    }, 0);
  }, [bundles]);

  // ── Render ─────────────────────────────────────────────────────────────

  // Don't show for new products (they need an ID first)
  if (!isEditMode || !productId) {
    return (
      <Card className="overflow-hidden opacity-60">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-bold">
              {isAr ? "اشتريهم مع بعض" : "Frequently Bought Together"}
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            {isAr
              ? "احفظ المنتج أولاً لإضافة باندل"
              : "Save the product first to add bundles"}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold">
              {isAr ? "اشتريهم مع بعض" : "Frequently Bought Together"}
            </CardTitle>
            {bundles.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5">
                {bundles.length}
              </Badge>
            )}
          </div>
          {isDirty && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="h-7 text-[11px] gap-1.5 rounded-lg"
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              {isAr ? "حفظ" : "Save"}
            </Button>
          )}
        </div>
        <CardDescription className="text-xs">
          {isAr
            ? "اختار المنتجات اللي تتعرض مع المنتج ده في صفحة التفاصيل"
            : "Select products to recommend alongside this product on its detail page"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Section Title Customization ── */}
        {bundles.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground">
                {isAr ? "عنوان القسم (EN)" : "Section Title (EN)"}
              </Label>
              <Input
                value={sectionTitleEn}
                onChange={(e) => {
                  setSectionTitleEn(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Frequently Bought Together"
                className="h-8 text-xs rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground">
                {isAr ? "عنوان القسم (AR)" : "Section Title (AR)"}
              </Label>
              <Input
                value={sectionTitleAr}
                onChange={(e) => {
                  setSectionTitleAr(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="كثيرًا ما يُشترى معًا"
                dir="rtl"
                className="h-8 text-xs rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border"
              />
            </div>
          </div>
        )}

        {/* ── Bundle Items List ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {bundles.map((bundle, index) => (
              <div
                key={`${bundle.bundled_product_id}-${index}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`group flex items-start gap-3 p-3 rounded-lg border transition-all ${
                  dragIndex === index
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-border/40 hover:border-border/80 bg-muted/10"
                } ${!bundle.is_active ? "opacity-50" : ""}`}
              >
                {/* Drag handle */}
                <div className="flex items-center pt-2 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>

                {/* Product image */}
                <div className="h-12 w-12 rounded-lg bg-muted/30 overflow-hidden shrink-0">
                  {bundle.product_image ? (
                    <img
                      src={bundle.product_image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                {/* Product info + controls */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {bundle.product_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {formatPrice(bundle.product_price, language)}
                        </span>
                        {!bundle.product_in_stock && (
                          <Badge
                            variant="destructive"
                            className="text-[9px] h-4"
                          >
                            {isAr ? "نفذ" : "Out of stock"}
                          </Badge>
                        )}
                        {bundle.discount_type !== "none" &&
                          bundle.discount_value > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] h-4 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                            >
                              <Sparkles className="h-2.5 w-2.5 me-0.5" />
                              {bundle.discount_type === "percentage"
                                ? `${bundle.discount_value}% off`
                                : `${formatPrice(bundle.discount_value, language)} off`}
                            </Badge>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={bundle.is_active}
                        onCheckedChange={(checked) =>
                          updateBundleField(index, "is_active", checked)
                        }
                        className="scale-75"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBundle(index)}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Discount controls */}
                  <div className="flex items-center gap-2">
                    <Select
                      value={bundle.discount_type}
                      onValueChange={(val) =>
                        updateBundleField(
                          index,
                          "discount_type",
                          val as "none" | "percentage" | "fixed",
                        )
                      }
                    >
                      <SelectTrigger className="h-7 w-[120px] text-[10px] rounded-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs">
                          {isAr ? "بدون خصم" : "No discount"}
                        </SelectItem>
                        <SelectItem value="percentage" className="text-xs">
                          <span className="flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            {isAr ? "نسبة مئوية" : "Percentage"}
                          </span>
                        </SelectItem>
                        <SelectItem value="fixed" className="text-xs">
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {isAr ? "مبلغ ثابت" : "Fixed amount"}
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {bundle.discount_type !== "none" && (
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={
                            bundle.discount_type === "percentage" ? 100 : 99999
                          }
                          value={bundle.discount_value || ""}
                          onChange={(e) =>
                            updateBundleField(
                              index,
                              "discount_value",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="h-7 w-20 text-[10px] rounded-md tabular-nums"
                          placeholder="0"
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {bundle.discount_type === "percentage"
                            ? "%"
                            : isAr
                              ? "قرش"
                              : "cents"}
                        </span>
                      </div>
                    )}

                    {bundle.discount_type !== "none" &&
                      bundle.discount_value > 0 && (
                        <span className="text-[10px] text-emerald-600 ms-auto tabular-nums">
                          →{" "}
                          {formatPrice(
                            calculateDiscountedPrice(
                              bundle.product_price,
                              bundle.discount_type,
                              bundle.discount_value,
                            ),
                            language,
                          )}
                        </span>
                      )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Add Product Button + Search ── */}
        {bundles.length < 10 && (
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full h-10 rounded-lg border-dashed text-xs gap-2 text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                {isAr ? "إضافة منتج للباندل" : "Add product to bundle"}
                <span className="text-[10px] text-muted-foreground/60">
                  ({bundles.length}/10)
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[360px] p-0"
              align="start"
              side="bottom"
            >
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      isAr ? "ابحث عن منتج..." : "Search products..."
                    }
                    className="h-9 ps-9 text-xs rounded-lg"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-[280px] overflow-y-auto">
                {isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="p-1.5">
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addProduct(product)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-start"
                      >
                        <div className="h-10 w-10 rounded-md bg-muted/30 overflow-hidden shrink-0">
                          {product.images[0] ? (
                            <img
                              src={product.images[0]}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <Package className="h-3.5 w-3.5 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {product.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground tabular-nums">
                            {formatPrice(
                              Math.round(parseFloat(product.price) * 100),
                              language,
                            )}
                          </p>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : searchQuery.trim() ? (
                  // A search was typed but returned nothing.
                  <div className="py-8 text-center">
                    <p className="text-xs text-muted-foreground">
                      {isAr ? "مفيش نتائج" : "No products found"}
                    </p>
                  </div>
                ) : (
                  // Nothing typed and list is empty (store has no other
                  // products — the only product is the primary one, or
                  // all other products are already bundled).
                  <div className="py-8 text-center">
                    <Search className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {isAr
                        ? "مفيش منتجات متاحة للإضافة"
                        : "No products available to add"}
                    </p>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* ── Summary ── */}
        {bundles.length > 0 && totalSavings > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
              {isAr ? "إجمالي التوفير للعميل" : "Total customer savings"}
            </span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatPrice(totalSavings, language)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
