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
import {
  Megaphone, Plus, Loader2, Pencil, Trash2, Tag, Truck, Percent,
  Copy, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight, Search,
  Package, FolderOpen,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { listCoupons, createCoupon, updateCoupon, deleteCoupon } from "@/services/couponApi";
import type { Coupon, CreateCouponData, UpdateCouponData } from "@/services/couponApi";
import { listProducts } from "@/services/productApi";
import type { ApiProductResponse } from "@/services/productApi";
import { toast } from "sonner";

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
      toast.error(err instanceof Error ? err.message : (isAr ? "حصل خطأ" : "Something went wrong"));
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
      toast.error(err instanceof Error ? err.message : (isAr ? "حصل خطأ" : "Something went wrong"));
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
      toast.error(err instanceof Error ? err.message : (isAr ? "حصل خطأ" : "Something went wrong"));
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
            {isAr ? "أدر كوبونات الخصم الخاصة بمتجرك" : "Manage your store discount coupons"}
          </p>
        </div>
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
