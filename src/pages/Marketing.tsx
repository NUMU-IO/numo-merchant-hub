import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Megaphone, Plus, Loader2, Pencil, Trash2, Tag, Truck, Percent,
  Copy, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight, Search,
  Package, FolderOpen, Zap, ShoppingBag,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { listCoupons, createCoupon, updateCoupon, deleteCoupon } from "@/services/couponApi";
import type { Coupon, CreateCouponData, UpdateCouponData } from "@/services/couponApi";
import { listUpsellRules, createUpsellRule, updateUpsellRule, deleteUpsellRule } from "@/services/upsellApi";
import type { UpsellRule, CreateUpsellRule } from "@/services/upsellApi";
import { listProducts } from "@/services/productApi";
import type { ApiProductResponse } from "@/services/productApi";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";

const PAGE_SIZE = 20;

type AppliesTo = "all" | "products" | "categories";

interface CategoryOption {
  id: string;
  name: string;
}

export default function Marketing() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<"percentage" | "fixed" | "free_shipping">("percentage");
  const [formValue, setFormValue] = useState("");
  const [formMinOrder, setFormMinOrder] = useState("");
  const [formMaxDiscount, setFormMaxDiscount] = useState("");
  const [formUsageLimit, setFormUsageLimit] = useState("");
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");

  // Targeting state
  const [formAppliesTo, setFormAppliesTo] = useState<AppliesTo>("all");
  const [formSelectedProductIds, setFormSelectedProductIds] = useState<string[]>([]);
  const [formSelectedCategoryIds, setFormSelectedCategoryIds] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<ApiProductResponse[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [targetingSearch, setTargetingSearch] = useState("");

  // ── Upsell state ──
  const [activeTab, setActiveTab] = useState("coupons");
  const [upsellRules, setUpsellRules] = useState<UpsellRule[]>([]);
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [upsellDialogOpen, setUpsellDialogOpen] = useState(false);
  const [editingUpsell, setEditingUpsell] = useState<UpsellRule | null>(null);
  const [upsellDeleteTarget, setUpsellDeleteTarget] = useState<UpsellRule | null>(null);
  const [upsellSaving, setUpsellSaving] = useState(false);
  const [upsellDeleting, setUpsellDeleting] = useState(false);

  // Upsell form state
  const [upsellName, setUpsellName] = useState("");
  const [upsellTriggerType, setUpsellTriggerType] = useState<"any" | "product" | "category" | "cart_value">("any");
  const [upsellOfferProductId, setUpsellOfferProductId] = useState("");
  const [upsellDiscountType, setUpsellDiscountType] = useState<"percentage" | "fixed" | "none">("percentage");
  const [upsellDiscountValue, setUpsellDiscountValue] = useState("");
  const [upsellHeadlineAr, setUpsellHeadlineAr] = useState("");
  const [upsellHeadlineEn, setUpsellHeadlineEn] = useState("");
  const [upsellPriority, setUpsellPriority] = useState("0");
  const [upsellMaxUses, setUpsellMaxUses] = useState("");
  const [upsellMinCartValue, setUpsellMinCartValue] = useState("");
  const [upsellTriggerProductIds, setUpsellTriggerProductIds] = useState<string[]>([]);
  const [upsellProductSearch, setUpsellProductSearch] = useState("");

  // Derive unique categories from products (prefer category_id, fallback to attribute names)
  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const seen = new Map<string, string>();
    for (const p of allProducts) {
      const catName = p.attributes?.categoryName || p.attributes?.categoryNameAr;
      if (p.category_id) {
        if (!seen.has(p.category_id)) seen.set(p.category_id, catName ? String(catName) : p.category_id);
      } else if (catName) {
        const key = String(catName).trim();
        if (key && !seen.has(key)) seen.set(key, key);
      }
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [allProducts]);

  // Resolve selected categories → matching product IDs (for saving)
  const productIdsForSelectedCategories = useMemo(() => {
    if (formSelectedCategoryIds.length === 0) return [];
    const catSet = new Set(formSelectedCategoryIds);
    return allProducts
      .filter((p) => {
        if (p.category_id && catSet.has(p.category_id)) return true;
        const catName = (p.attributes?.categoryName || p.attributes?.categoryNameAr || "").toString().trim();
        return catName && catSet.has(catName);
      })
      .map((p) => p.id);
  }, [allProducts, formSelectedCategoryIds]);

  const fetchCoupons = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    try {
      const params: { page: number; limit: number; is_active?: boolean } = {
        page: currentPage,
        limit: PAGE_SIZE,
      };
      if (statusFilter === "active") params.is_active = true;
      if (statusFilter === "inactive") params.is_active = false;

      const result = await listCoupons(storeId, params);
      setCoupons(result.items);
      setTotal(result.total);
      setTotalPages(result.total_pages);
    } catch (err) {
      console.error("Failed to fetch coupons:", err);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, currentPage, statusFilter]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  // Fetch products when dialog opens
  const fetchProducts = useCallback(async () => {
    if (!storeId || allProducts.length > 0) return;
    setProductsLoading(true);
    try {
      const result = await listProducts(storeId, { limit: 100 });
      setAllProducts(result.items);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setProductsLoading(false);
    }
  }, [storeId, allProducts.length]);

  const resetForm = () => {
    setFormCode("");
    setFormType("percentage");
    setFormValue("");
    setFormMinOrder("");
    setFormMaxDiscount("");
    setFormUsageLimit("");
    setFormValidFrom("");
    setFormValidUntil("");
    setFormAppliesTo("all");
    setFormSelectedProductIds([]);
    setFormSelectedCategoryIds([]);
    setTargetingSearch("");
    setEditingCoupon(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
    fetchProducts();
  };

  const openEditDialog = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormCode(coupon.code);
    setFormType(coupon.coupon_type);
    setFormValue(coupon.value);
    setFormMinOrder(coupon.min_order_amount || "");
    setFormMaxDiscount(coupon.max_discount_amount || "");
    setFormUsageLimit(coupon.usage_limit ? String(coupon.usage_limit) : "");
    setFormValidFrom(coupon.valid_from ? coupon.valid_from.slice(0, 16) : "");
    setFormValidUntil(coupon.valid_until ? coupon.valid_until.slice(0, 16) : "");

    // Targeting
    if (coupon.applicable_product_ids && coupon.applicable_product_ids.length > 0) {
      setFormAppliesTo("products");
      setFormSelectedProductIds(coupon.applicable_product_ids);
      setFormSelectedCategoryIds([]);
    } else if (coupon.applicable_category_ids && coupon.applicable_category_ids.length > 0) {
      setFormAppliesTo("categories");
      setFormSelectedCategoryIds(coupon.applicable_category_ids);
      setFormSelectedProductIds([]);
    } else {
      setFormAppliesTo("all");
      setFormSelectedProductIds([]);
      setFormSelectedCategoryIds([]);
    }
    setTargetingSearch("");

    setDialogOpen(true);
    fetchProducts();
  };

  const handleSave = async () => {
    if (!storeId || !formCode.trim() || (formType !== "free_shipping" && !formValue)) return;
    setIsSaving(true);
    try {
      // Build targeting: if categories selected, check if they are real UUIDs (category_id)
      // or attribute-derived names. Real UUIDs go as category_ids, names resolve to product IDs.
      let targetProductIds: string[] | null = null;
      let targetCategoryIds: string[] | null = null;
      if (formAppliesTo === "products" && formSelectedProductIds.length > 0) {
        targetProductIds = formSelectedProductIds;
      } else if (formAppliesTo === "categories" && formSelectedCategoryIds.length > 0) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const allUuids = formSelectedCategoryIds.every((id) => uuidRegex.test(id));
        if (allUuids) {
          targetCategoryIds = formSelectedCategoryIds;
        } else {
          targetProductIds = productIdsForSelectedCategories;
        }
      }
      const targeting = {
        applicable_product_ids: targetProductIds,
        applicable_category_ids: targetCategoryIds,
      };

      if (editingCoupon) {
        const data: UpdateCouponData = {
          code: formCode.trim().toUpperCase(),
          coupon_type: formType,
          value: formType === "free_shipping" ? 0 : parseFloat(formValue),
          min_order_amount: formMinOrder ? parseFloat(formMinOrder) : null,
          max_discount_amount: formMaxDiscount ? parseFloat(formMaxDiscount) : null,
          usage_limit: formUsageLimit ? parseInt(formUsageLimit) : null,
          valid_from: formValidFrom ? new Date(formValidFrom).toISOString() : null,
          valid_until: formValidUntil ? new Date(formValidUntil).toISOString() : null,
          ...targeting,
        };
        await updateCoupon(storeId, editingCoupon.id, data);
        toast.success(isAr ? "تم تحديث الكوبون" : "Coupon updated");
      } else {
        const data: CreateCouponData = {
          code: formCode.trim().toUpperCase(),
          coupon_type: formType,
          value: formType === "free_shipping" ? 0 : parseFloat(formValue),
          min_order_amount: formMinOrder ? parseFloat(formMinOrder) : null,
          max_discount_amount: formMaxDiscount ? parseFloat(formMaxDiscount) : null,
          usage_limit: formUsageLimit ? parseInt(formUsageLimit) : null,
          valid_from: formValidFrom ? new Date(formValidFrom).toISOString() : null,
          valid_until: formValidUntil ? new Date(formValidUntil).toISOString() : null,
          ...targeting,
        };
        await createCoupon(storeId, data);
        toast.success(isAr ? "تم إنشاء الكوبون" : "Coupon created");
      }
      setDialogOpen(false);
      resetForm();
      fetchCoupons();
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
      await deleteCoupon(storeId, deleteTarget.id);
      toast.success(isAr ? "تم حذف الكوبون" : "Coupon deleted");
      setDeleteTarget(null);
      fetchCoupons();
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (coupon: Coupon) => {
    if (!storeId) return;
    try {
      await updateCoupon(storeId, coupon.id, { is_active: !coupon.is_active });
      toast.success(isAr
        ? (coupon.is_active ? "تم تعطيل الكوبون" : "تم تفعيل الكوبون")
        : (coupon.is_active ? "Coupon deactivated" : "Coupon activated"));
      fetchCoupons();
    } catch (err: unknown) {
      showError(err, language);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(isAr ? "تم نسخ الكود" : "Code copied");
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "percentage": return <Percent className="h-3.5 w-3.5" />;
      case "fixed": return <Tag className="h-3.5 w-3.5" />;
      case "free_shipping": return <Truck className="h-3.5 w-3.5" />;
      default: return <Tag className="h-3.5 w-3.5" />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "percentage": return isAr ? "نسبة" : "Percentage";
      case "fixed": return isAr ? "مبلغ ثابت" : "Fixed Amount";
      case "free_shipping": return isAr ? "شحن مجاني" : "Free Shipping";
      default: return type;
    }
  };

  const formatValue = (coupon: Coupon) => {
    switch (coupon.coupon_type) {
      case "percentage": return `${coupon.value}%`;
      case "fixed": return isAr ? `${coupon.value} ج.م` : `EGP ${coupon.value}`;
      case "free_shipping": return isAr ? "شحن مجاني" : "Free Shipping";
      default: return coupon.value;
    }
  };

  const toggleProductId = (id: string) => {
    setFormSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleCategoryId = (id: string) => {
    setFormSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const filteredProducts = useMemo(() => {
    if (!targetingSearch.trim()) return allProducts;
    const q = targetingSearch.toLowerCase();
    return allProducts.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
    );
  }, [allProducts, targetingSearch]);

  const filteredCategories = useMemo(() => {
    if (!targetingSearch.trim()) return categoryOptions;
    const q = targetingSearch.toLowerCase();
    return categoryOptions.filter((c) => c.name.toLowerCase().includes(q));
  }, [categoryOptions, targetingSearch]);

  const activeCount = coupons.filter((c) => c.is_active && !c.is_expired).length;
  const totalUsage = coupons.reduce((sum, c) => sum + c.usage_count, 0);

  // ── Upsell helpers ──

  const fetchUpsellRules = useCallback(async () => {
    if (!storeId) return;
    setUpsellLoading(true);
    try {
      const rules = await listUpsellRules(storeId);
      setUpsellRules(Array.isArray(rules) ? rules : []);
    } catch (err) {
      console.error("Failed to fetch upsell rules:", err);
    } finally {
      setUpsellLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (activeTab === "upsells") {
      fetchUpsellRules();
    }
  }, [activeTab, fetchUpsellRules]);

  const resetUpsellForm = () => {
    setUpsellName("");
    setUpsellTriggerType("any");
    setUpsellOfferProductId("");
    setUpsellDiscountType("percentage");
    setUpsellDiscountValue("");
    setUpsellHeadlineAr("");
    setUpsellHeadlineEn("");
    setUpsellPriority("0");
    setUpsellMaxUses("");
    setUpsellMinCartValue("");
    setUpsellTriggerProductIds([]);
    setUpsellProductSearch("");
    setEditingUpsell(null);
  };

  const openUpsellAddDialog = () => {
    resetUpsellForm();
    setUpsellDialogOpen(true);
    fetchProducts();
  };

  const openUpsellEditDialog = (rule: UpsellRule) => {
    setEditingUpsell(rule);
    setUpsellName(rule.name);
    setUpsellTriggerType(rule.trigger_type);
    setUpsellOfferProductId(rule.offer_product_id);
    setUpsellDiscountType(rule.discount_type);
    setUpsellDiscountValue(rule.discount_type === "none" ? "" : String(rule.discount_value));
    setUpsellHeadlineAr(rule.headline_ar || "");
    setUpsellHeadlineEn(rule.headline_en || "");
    setUpsellPriority(String(rule.priority));
    setUpsellMaxUses(rule.max_uses ? String(rule.max_uses) : "");
    setUpsellMinCartValue(rule.trigger_min_cart_value ? String(rule.trigger_min_cart_value) : "");
    setUpsellTriggerProductIds(rule.trigger_product_ids || []);
    setUpsellProductSearch("");
    setUpsellDialogOpen(true);
    fetchProducts();
  };

  const handleUpsellSave = async () => {
    if (!storeId || !upsellName.trim() || !upsellOfferProductId) return;
    setUpsellSaving(true);
    try {
      const data: CreateUpsellRule = {
        name: upsellName.trim(),
        trigger_type: upsellTriggerType,
        offer_product_id: upsellOfferProductId,
        discount_type: upsellDiscountType,
        discount_value: upsellDiscountType === "none" ? 0 : parseFloat(upsellDiscountValue) || 0,
        priority: parseInt(upsellPriority) || 0,
        max_uses: upsellMaxUses ? parseInt(upsellMaxUses) : null,
        headline_ar: upsellHeadlineAr || undefined,
        headline_en: upsellHeadlineEn || undefined,
      };
      if (upsellTriggerType === "product") {
        data.trigger_product_ids = upsellTriggerProductIds;
      }
      if (upsellTriggerType === "cart_value") {
        data.trigger_min_cart_value = parseFloat(upsellMinCartValue) || 0;
      }

      if (editingUpsell) {
        await updateUpsellRule(storeId, editingUpsell.id, data);
        toast.success(isAr ? "تم تحديث العرض" : "Upsell updated");
      } else {
        await createUpsellRule(storeId, data);
        toast.success(isAr ? "تم إنشاء العرض" : "Upsell created");
      }
      setUpsellDialogOpen(false);
      resetUpsellForm();
      fetchUpsellRules();
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setUpsellSaving(false);
    }
  };

  const handleUpsellDelete = async () => {
    if (!storeId || !upsellDeleteTarget) return;
    setUpsellDeleting(true);
    try {
      await deleteUpsellRule(storeId, upsellDeleteTarget.id);
      toast.success(isAr ? "تم حذف العرض" : "Upsell deleted");
      setUpsellDeleteTarget(null);
      fetchUpsellRules();
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setUpsellDeleting(false);
    }
  };

  const handleUpsellToggle = async (rule: UpsellRule) => {
    if (!storeId) return;
    try {
      await updateUpsellRule(storeId, rule.id, { is_active: !rule.is_active });
      toast.success(isAr
        ? (rule.is_active ? "تم تعطيل العرض" : "تم تفعيل العرض")
        : (rule.is_active ? "Upsell deactivated" : "Upsell activated"));
      fetchUpsellRules();
    } catch (err: unknown) {
      showError(err, language);
    }
  };

  const triggerTypeLabel = (type: string) => {
    switch (type) {
      case "any": return isAr ? "أي طلب" : "Any Order";
      case "product": return isAr ? "منتج محدد" : "Specific Product";
      case "category": return isAr ? "فئة محددة" : "Specific Category";
      case "cart_value": return isAr ? "قيمة السلة" : "Cart Value";
      default: return type;
    }
  };

  const upsellDiscountLabel = (rule: UpsellRule) => {
    switch (rule.discount_type) {
      case "percentage": return `${rule.discount_value}%`;
      case "fixed": return isAr ? `${rule.discount_value} ج.م` : `EGP ${rule.discount_value}`;
      case "none": return isAr ? "بدون خصم" : "No discount";
      default: return "";
    }
  };

  const filteredUpsellProducts = useMemo(() => {
    if (!upsellProductSearch.trim()) return allProducts;
    const q = upsellProductSearch.toLowerCase();
    return allProducts.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
    );
  }, [allProducts, upsellProductSearch]);

  const getProductName = (productId: string) => {
    const product = allProducts.find((p) => p.id === productId);
    return product?.name || productId.slice(0, 8) + "...";
  };

  const appliesToLabel = (coupon: Coupon) => {
    if (coupon.applicable_product_ids && coupon.applicable_product_ids.length > 0) {
      const count = coupon.applicable_product_ids.length;
      return isAr ? `${count} منتج` : `${count} product${count > 1 ? "s" : ""}`;
    }
    if (coupon.applicable_category_ids && coupon.applicable_category_ids.length > 0) {
      const count = coupon.applicable_category_ids.length;
      return isAr ? `${count} فئة` : `${count} categor${count > 1 ? "ies" : "y"}`;
    }
    return isAr ? "الكل" : "All";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            {t("nav.marketing")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr ? "أدر كوبونات الخصم وعروض ما بعد الشراء" : "Manage coupons and post-purchase upsells"}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="coupons" className="gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            {isAr ? "الكوبونات" : "Coupons"}
          </TabsTrigger>
          <TabsTrigger value="upsells" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            {isAr ? "عروض ما بعد الشراء" : "Upsells"}
          </TabsTrigger>
        </TabsList>

        {/* ═══════ COUPONS TAB ═══════ */}
        <TabsContent value="coupons" className="space-y-6 mt-4">

      <div className="flex justify-end">
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          {isAr ? "كوبون جديد" : "New Coupon"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{isAr ? "إجمالي الكوبونات" : "Total Coupons"}</p>
            <p className="text-2xl font-bold mt-1">{isLoading ? "—" : total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{isAr ? "كوبونات نشطة" : "Active Coupons"}</p>
            <p className="text-2xl font-bold mt-1">{isLoading ? "—" : activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{isAr ? "إجمالي الاستخدام" : "Total Usage"}</p>
            <p className="text-2xl font-bold mt-1">{isLoading ? "—" : totalUsage}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {(["all", "active", "inactive"] as const).map((f) => (
          <Button
            key={f}
            variant={statusFilter === f ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter(f); setCurrentPage(1); }}
          >
            {f === "all" ? (isAr ? "الكل" : "All")
              : f === "active" ? (isAr ? "نشط" : "Active")
              : (isAr ? "غير نشط" : "Inactive")}
          </Button>
        ))}
      </div>

      {/* Coupon Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {isAr ? "مفيش كوبونات لسه" : "No coupons yet"}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isAr ? "الكود" : "Code"}</TableHead>
                    <TableHead>{isAr ? "النوع" : "Type"}</TableHead>
                    <TableHead>{isAr ? "القيمة" : "Value"}</TableHead>
                    <TableHead>{isAr ? "ينطبق على" : "Applies To"}</TableHead>
                    <TableHead>{isAr ? "الاستخدام" : "Usage"}</TableHead>
                    <TableHead>{isAr ? "الصلاحية" : "Validity"}</TableHead>
                    <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-bold bg-muted px-2 py-0.5 rounded">{coupon.code}</code>
                          <button onClick={() => copyCode(coupon.code)} className="text-muted-foreground hover:text-foreground">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          {typeIcon(coupon.coupon_type)}
                          {typeLabel(coupon.coupon_type)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatValue(coupon)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {appliesToLabel(coupon)}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {coupon.usage_count}{coupon.usage_limit ? `/${coupon.usage_limit}` : ""}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {coupon.valid_until
                          ? new Date(coupon.valid_until).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric", year: "numeric" })
                          : (isAr ? "بدون حد" : "No limit")}
                      </TableCell>
                      <TableCell>
                        {coupon.is_expired ? (
                          <Badge variant="outline" className="text-xs">{isAr ? "منتهي" : "Expired"}</Badge>
                        ) : coupon.is_active ? (
                          <Badge variant="default" className="text-xs">{isAr ? "نشط" : "Active"}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">{isAr ? "معطل" : "Inactive"}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleActive(coupon)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title={coupon.is_active ? (isAr ? "تعطيل" : "Deactivate") : (isAr ? "تفعيل" : "Activate")}
                          >
                            {coupon.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => openEditDialog(coupon)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(coupon)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    {isAr
                      ? `صفحة ${currentPage} من ${totalPages} (${total} كوبون)`
                      : `Page ${currentPage} of ${totalPages} (${total} coupons)`}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        {/* ═══════ UPSELLS TAB ═══════ */}
        <TabsContent value="upsells" className="space-y-6 mt-4">

      <div className="flex justify-end">
        <Button className="gap-2" onClick={openUpsellAddDialog}>
          <Plus className="h-4 w-4" />
          {isAr ? "عرض جديد" : "New Upsell"}
        </Button>
      </div>

      {/* Upsell Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{isAr ? "إجمالي العروض" : "Total Rules"}</p>
            <p className="text-2xl font-bold mt-1">{upsellLoading ? "—" : upsellRules.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{isAr ? "عروض نشطة" : "Active Rules"}</p>
            <p className="text-2xl font-bold mt-1">{upsellLoading ? "—" : upsellRules.filter((r) => r.is_active).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{isAr ? "إجمالي الاستخدام" : "Total Uses"}</p>
            <p className="text-2xl font-bold mt-1">{upsellLoading ? "—" : upsellRules.reduce((sum, r) => sum + r.uses_count, 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Upsell Rules Table */}
      <Card>
        <CardContent className="p-0">
          {upsellLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : upsellRules.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>{isAr ? "مفيش عروض لسه" : "No upsell rules yet"}</p>
              <p className="text-xs mt-1">{isAr ? "أنشئ عرض لعرض منتجات إضافية بعد الشراء" : "Create a rule to show products after checkout"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isAr ? "الاسم" : "Name"}</TableHead>
                  <TableHead>{isAr ? "المحفز" : "Trigger"}</TableHead>
                  <TableHead>{isAr ? "المنتج المعروض" : "Offer Product"}</TableHead>
                  <TableHead>{isAr ? "الخصم" : "Discount"}</TableHead>
                  <TableHead>{isAr ? "الاستخدام" : "Uses"}</TableHead>
                  <TableHead>{isAr ? "الأولوية" : "Priority"}</TableHead>
                  <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upsellRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {triggerTypeLabel(rule.trigger_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-[150px]">
                      {getProductName(rule.offer_product_id)}
                    </TableCell>
                    <TableCell className="font-medium">{upsellDiscountLabel(rule)}</TableCell>
                    <TableCell className="tabular-nums">
                      {rule.uses_count}{rule.max_uses ? `/${rule.max_uses}` : ""}
                    </TableCell>
                    <TableCell className="tabular-nums">{rule.priority}</TableCell>
                    <TableCell>
                      {rule.is_active ? (
                        <Badge variant="default" className="text-xs">{isAr ? "نشط" : "Active"}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">{isAr ? "معطل" : "Inactive"}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleUpsellToggle(rule)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title={rule.is_active ? (isAr ? "تعطيل" : "Deactivate") : (isAr ? "تفعيل" : "Activate")}
                        >
                          {rule.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => openUpsellEditDialog(rule)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setUpsellDeleteTarget(rule)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

        </TabsContent>
      </Tabs>

      {/* ═══════ UPSELL CREATE/EDIT DIALOG ═══════ */}
      <Dialog open={upsellDialogOpen} onOpenChange={(open) => { if (!open) { setUpsellDialogOpen(false); resetUpsellForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUpsell ? (isAr ? "تعديل العرض" : "Edit Upsell") : (isAr ? "عرض جديد" : "New Upsell")}</DialogTitle>
            <DialogDescription>
              {isAr ? "اعرض منتجات إضافية بخصم بعد الشراء" : "Show discounted products after checkout"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{isAr ? "اسم العرض" : "Rule Name"}</Label>
              <Input
                value={upsellName}
                onChange={(e) => setUpsellName(e.target.value)}
                placeholder={isAr ? "مثال: عرض الإكسسوارات" : "e.g. Accessories upsell"}
                className="mt-1"
              />
            </div>

            <div>
              <Label>{isAr ? "نوع المحفز" : "Trigger Type"}</Label>
              <Select value={upsellTriggerType} onValueChange={(v) => setUpsellTriggerType(v as "any" | "product" | "category" | "cart_value")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{isAr ? "أي طلب" : "Any Order"}</SelectItem>
                  <SelectItem value="product">{isAr ? "منتج محدد" : "Specific Product"}</SelectItem>
                  <SelectItem value="category">{isAr ? "فئة محددة" : "Specific Category"}</SelectItem>
                  <SelectItem value="cart_value">{isAr ? "قيمة السلة" : "Cart Value"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {upsellTriggerType === "cart_value" && (
              <div>
                <Label>{isAr ? "الحد الأدنى لقيمة السلة (قرش)" : "Min Cart Value (cents)"}</Label>
                <Input type="number" value={upsellMinCartValue} onChange={(e) => setUpsellMinCartValue(e.target.value)} className="mt-1" dir="ltr" min="0" />
              </div>
            )}

            {upsellTriggerType === "product" && (
              <div>
                <Label>{isAr ? "المنتجات المحفزة" : "Trigger Products"}</Label>
                <div className="mt-1 space-y-2">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={upsellProductSearch}
                      onChange={(e) => setUpsellProductSearch(e.target.value)}
                      placeholder={isAr ? "ابحث عن منتج..." : "Search products..."}
                      className="pr-9"
                    />
                  </div>
                  {upsellTriggerProductIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {isAr ? `${upsellTriggerProductIds.length} منتج محدد` : `${upsellTriggerProductIds.length} selected`}
                    </p>
                  )}
                  <div className="border rounded-md max-h-36 overflow-y-auto">
                    {productsLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredUpsellProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">{isAr ? "لا توجد منتجات" : "No products found"}</p>
                    ) : (
                      filteredUpsellProducts.map((product) => (
                        <label
                          key={product.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                        >
                          <Checkbox
                            checked={upsellTriggerProductIds.includes(product.id)}
                            onCheckedChange={() => {
                              setUpsellTriggerProductIds((prev) =>
                                prev.includes(product.id)
                                  ? prev.filter((id) => id !== product.id)
                                  : [...prev, product.id]
                              );
                            }}
                          />
                          <span className="text-sm truncate flex-1">{product.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>{isAr ? "المنتج المعروض" : "Offer Product"}</Label>
              <Select value={upsellOfferProductId} onValueChange={setUpsellOfferProductId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={isAr ? "اختر منتج..." : "Select product..."} />
                </SelectTrigger>
                <SelectContent>
                  {allProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isAr ? "نوع الخصم" : "Discount Type"}</Label>
                <Select value={upsellDiscountType} onValueChange={(v) => setUpsellDiscountType(v as "percentage" | "fixed" | "none")}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">{isAr ? "نسبة مئوية" : "Percentage"}</SelectItem>
                    <SelectItem value="fixed">{isAr ? "مبلغ ثابت" : "Fixed Amount"}</SelectItem>
                    <SelectItem value="none">{isAr ? "بدون خصم" : "No Discount"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {upsellDiscountType !== "none" && (
                <div>
                  <Label>{upsellDiscountType === "percentage" ? (isAr ? "نسبة الخصم (%)" : "Discount (%)") : (isAr ? "مبلغ الخصم" : "Discount Amount")}</Label>
                  <Input type="number" value={upsellDiscountValue} onChange={(e) => setUpsellDiscountValue(e.target.value)} className="mt-1" dir="ltr" min="0" />
                </div>
              )}
            </div>

            <div>
              <Label>{isAr ? "العنوان بالعربي" : "Arabic Headline"}</Label>
              <Input value={upsellHeadlineAr} onChange={(e) => setUpsellHeadlineAr(e.target.value)} className="mt-1" placeholder={isAr ? "مثال: عرض خاص لك!" : "e.g. Special offer for you!"} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isAr ? "الأولوية" : "Priority"}</Label>
                <Input type="number" value={upsellPriority} onChange={(e) => setUpsellPriority(e.target.value)} className="mt-1" dir="ltr" min="0" />
              </div>
              <div>
                <Label>{isAr ? "حد الاستخدام" : "Max Uses"}</Label>
                <Input type="number" value={upsellMaxUses} onChange={(e) => setUpsellMaxUses(e.target.value)} className="mt-1" dir="ltr" min="1" placeholder={isAr ? "بلا حد" : "Unlimited"} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUpsellDialogOpen(false); resetUpsellForm(); }}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleUpsellSave} disabled={upsellSaving || !upsellName.trim() || !upsellOfferProductId}>
              {upsellSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingUpsell ? (isAr ? "تحديث" : "Update") : (isAr ? "إنشاء" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upsell Delete Confirmation */}
      <AlertDialog open={!!upsellDeleteTarget} onOpenChange={(open) => { if (!open) setUpsellDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? "حذف العرض؟" : "Delete Upsell?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? `هل أنت متأكد من حذف العرض "${upsellDeleteTarget?.name}"؟ لا يمكن التراجع عن هذا.`
                : `Are you sure you want to delete upsell "${upsellDeleteTarget?.name}"? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpsellDelete} disabled={upsellDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {upsellDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? "حذف" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? (isAr ? "تعديل الكوبون" : "Edit Coupon") : (isAr ? "كوبون جديد" : "New Coupon")}</DialogTitle>
            <DialogDescription>
              {isAr ? "أنشئ كوبون خصم لعملائك" : "Create a discount coupon for your customers"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{isAr ? "كود الكوبون" : "Coupon Code"}</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="SUMMER25"
                className="mt-1 font-mono uppercase"
                dir="ltr"
              />
            </div>
            <div>
              <Label>{isAr ? "نوع الخصم" : "Discount Type"}</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as "percentage" | "fixed" | "free_shipping")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">{isAr ? "نسبة مئوية" : "Percentage"}</SelectItem>
                  <SelectItem value="fixed">{isAr ? "مبلغ ثابت" : "Fixed Amount"}</SelectItem>
                  <SelectItem value="free_shipping">{isAr ? "شحن مجاني" : "Free Shipping"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formType !== "free_shipping" && (
              <div>
                <Label>{formType === "percentage" ? (isAr ? "نسبة الخصم (%)" : "Discount (%)") : (isAr ? "مبلغ الخصم" : "Discount Amount")}</Label>
                <Input type="number" value={formValue} onChange={(e) => setFormValue(e.target.value)} className="mt-1" dir="ltr" min="0" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isAr ? "حد أدنى للطلب" : "Min Order"}</Label>
                <Input type="number" value={formMinOrder} onChange={(e) => setFormMinOrder(e.target.value)} className="mt-1" dir="ltr" min="0" placeholder={isAr ? "اختياري" : "Optional"} />
              </div>
              {formType === "percentage" && (
                <div>
                  <Label>{isAr ? "أقصى خصم" : "Max Discount"}</Label>
                  <Input type="number" value={formMaxDiscount} onChange={(e) => setFormMaxDiscount(e.target.value)} className="mt-1" dir="ltr" min="0" placeholder={isAr ? "اختياري" : "Optional"} />
                </div>
              )}
              <div>
                <Label>{isAr ? "حد الاستخدام" : "Usage Limit"}</Label>
                <Input type="number" value={formUsageLimit} onChange={(e) => setFormUsageLimit(e.target.value)} className="mt-1" dir="ltr" min="1" placeholder={isAr ? "بلا حد" : "Unlimited"} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isAr ? "يبدأ من" : "Valid From"}</Label>
                <Input type="datetime-local" value={formValidFrom} onChange={(e) => setFormValidFrom(e.target.value)} className="mt-1" dir="ltr" />
              </div>
              <div>
                <Label>{isAr ? "ينتهي في" : "Valid Until"}</Label>
                <Input type="datetime-local" value={formValidUntil} onChange={(e) => setFormValidUntil(e.target.value)} className="mt-1" dir="ltr" />
              </div>
            </div>

            {/* Targeting Section */}
            <div className="border-t pt-4">
              <Label className="text-sm font-semibold">{isAr ? "ينطبق على" : "Applies To"}</Label>
              <div className="flex items-center gap-2 mt-2">
                {(["all", "products", "categories"] as const).map((opt) => (
                  <Button
                    key={opt}
                    type="button"
                    variant={formAppliesTo === opt ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setFormAppliesTo(opt);
                      setTargetingSearch("");
                    }}
                  >
                    {opt === "all" && <Tag className="h-3.5 w-3.5" />}
                    {opt === "products" && <Package className="h-3.5 w-3.5" />}
                    {opt === "categories" && <FolderOpen className="h-3.5 w-3.5" />}
                    {opt === "all"
                      ? (isAr ? "كل المنتجات" : "All Products")
                      : opt === "products"
                        ? (isAr ? "منتجات محددة" : "Specific Products")
                        : (isAr ? "فئات محددة" : "Specific Categories")}
                  </Button>
                ))}
              </div>

              {/* Product Selector */}
              {formAppliesTo === "products" && (
                <div className="mt-3 space-y-2">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={targetingSearch}
                      onChange={(e) => setTargetingSearch(e.target.value)}
                      placeholder={isAr ? "ابحث عن منتج..." : "Search products..."}
                      className="pr-9"
                    />
                  </div>
                  {formSelectedProductIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {isAr ? `${formSelectedProductIds.length} منتج محدد` : `${formSelectedProductIds.length} selected`}
                    </p>
                  )}
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    {productsLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {isAr ? "لا توجد منتجات" : "No products found"}
                      </p>
                    ) : (
                      filteredProducts.map((product) => (
                        <label
                          key={product.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                        >
                          <Checkbox
                            checked={formSelectedProductIds.includes(product.id)}
                            onCheckedChange={() => toggleProductId(product.id)}
                          />
                          {product.images?.[0] && (
                            <img src={product.images[0]} alt="" className="w-8 h-8 rounded object-cover" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            {product.sku && <p className="text-xs text-muted-foreground">{product.sku}</p>}
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap" dir="ltr">
                            {product.price} {product.price_currency}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Category Selector */}
              {formAppliesTo === "categories" && (
                <div className="mt-3 space-y-2">
                  {categoryOptions.length === 0 && !productsLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-md">
                      {isAr ? "لا توجد فئات. أضف فئات للمنتجات أولاً" : "No categories found. Add categories to your products first."}
                    </p>
                  ) : (
                    <>
                      {categoryOptions.length > 5 && (
                        <div className="relative">
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={targetingSearch}
                            onChange={(e) => setTargetingSearch(e.target.value)}
                            placeholder={isAr ? "ابحث عن فئة..." : "Search categories..."}
                            className="pr-9"
                          />
                        </div>
                      )}
                      {formSelectedCategoryIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {isAr
                            ? `${formSelectedCategoryIds.length} فئة محددة (${productIdsForSelectedCategories.length} منتج)`
                            : `${formSelectedCategoryIds.length} selected (${productIdsForSelectedCategories.length} product${productIdsForSelectedCategories.length !== 1 ? "s" : ""})`}
                        </p>
                      )}
                      <div className="border rounded-md max-h-48 overflow-y-auto">
                        {productsLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          filteredCategories.map((cat) => {
                            const count = allProducts.filter((p) => {
                              if (p.category_id === cat.id) return true;
                              const cn = (p.attributes?.categoryName || p.attributes?.categoryNameAr || "").toString().trim();
                              return cn === cat.id;
                            }).length;
                            return (
                              <label
                                key={cat.id}
                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted cursor-pointer border-b last:border-b-0"
                              >
                                <Checkbox
                                  checked={formSelectedCategoryIds.includes(cat.id)}
                                  onCheckedChange={() => toggleCategoryId(cat.id)}
                                />
                                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium flex-1">{cat.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {count} {isAr ? "منتج" : count === 1 ? "product" : "products"}
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formCode.trim() || (formType !== "free_shipping" && !formValue)}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCoupon ? (isAr ? "تحديث" : "Update") : (isAr ? "إنشاء" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? "حذف الكوبون؟" : "Delete Coupon?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? `هل أنت متأكد من حذف الكوبون "${deleteTarget?.code}"؟ لا يمكن التراجع عن هذا.`
                : `Are you sure you want to delete coupon "${deleteTarget?.code}"? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isAr ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? "حذف" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
