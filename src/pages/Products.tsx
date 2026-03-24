import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { type Product, type ProductStatus } from "@/data/mock-products";
import { listCategories, type Category } from "@/services/categoryApi";
import {
  listProducts, deleteProduct as apiDeleteProduct,
  apiToProduct, exportProductsToCSV, bulkProductAction, duplicateProduct,
  type BulkAction,
} from "@/services/productApi";
import { ImportDialog } from "@/components/products/ImportDialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus, Search, MoreHorizontal, Pencil, Trash2, Tag, Loader2,
  ChevronLeft, ChevronRight, Upload, Download, Archive, Eye, Copy,
  Package, TrendingUp, AlertTriangle,
  ArrowUpDown, ListFilter, LayoutGrid, LayoutList,
} from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";

const PAGE_SIZE = 20;

const Products = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [apiCategories, setApiCategories] = useState<Category[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProductStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  };

  const handleBulkAction = async (action: BulkAction) => {
    if (!storeId || selectedIds.size === 0) return;
    setBulkActionInProgress(true);
    try {
      const result = await bulkProductAction(storeId, action, Array.from(selectedIds));
      const actionLabel = action === "publish" ? (language === "ar" ? "نشر" : "published")
        : action === "archive" ? (language === "ar" ? "أرشفة" : "archived")
        : (language === "ar" ? "حذف" : "deleted");
      toast.success(`${result.succeeded} ${language === "ar" ? "منتج تم" : "products"} ${actionLabel}`);
      if (result.failed > 0) {
        toast.error(`${result.failed} ${language === "ar" ? "فشل" : "failed"}`);
      }
      setSelectedIds(new Set());
      fetchProducts();
    } catch (err) {
      showError(err, language);
    } finally {
      setBulkActionInProgress(false);
    }
  };

  useEffect(() => {
    if (!storeId) return;
    listCategories(storeId).then(setApiCategories).catch(() => {});
  }, [storeId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

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

  const filtered = categoryFilter === "all"
    ? productsList
    : productsList.filter((p) => p.categoryId === categoryFilter);

  const formatCurrency = (val: number) =>
    language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  const statusConfig: Record<ProductStatus, { bg: string; dot: string }> = {
    published: { bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40", dot: "bg-emerald-500" },
    draft: { bg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40", dot: "bg-amber-500" },
    archived: { bg: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200/60 dark:border-zinc-700/40", dot: "bg-zinc-400" },
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

  const publishedCount = productsList.filter(p => p.status === "published").length;
  const lowStockCount = productsList.filter(p => p.stock < 20 && p.stock > 0).length;

  const isAr = language === "ar";

  const statusTabs: { label: string; labelEn: string; value: "all" | ProductStatus }[] = [
    { label: "الكل", labelEn: "All", value: "all" },
    { label: "المنتجات الفردية", labelEn: "Individual", value: "published" },
    { label: "مسودة", labelEn: "Draft", value: "draft" },
    { label: "مؤرشف", labelEn: "Archived", value: "archived" },
  ];

  const tabCounts: Record<string, number> = {
    all: totalProducts,
    published: publishedCount,
    draft: productsList.filter(p => p.status === "draft").length,
    archived: productsList.filter(p => p.status === "archived").length,
  };

  return (
    <div className="space-y-5">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4">
        {/* Right side (title) — visually on the right in RTL */}
        <div className={`space-y-0.5 ${isAr ? "text-right" : "text-left"}`}>
          <h1 className="text-2xl font-bold tracking-tight">{t("products.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {isAr ? "جميع منتجات متجرك هنا" : "All your store products are here"}
          </p>
        </div>

        {/* Left side (actions) */}
        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isAr ? "start" : "end"} className="w-44">
              <DropdownMenuItem onClick={() => setImportOpen(true)}>
                <Upload className="me-2 h-3.5 w-3.5" />
                {isAr ? "استيراد" : "Import"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const csv = exportProductsToCSV(productsList);
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "products_export.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}>
                <Download className="me-2 h-3.5 w-3.5" />
                {isAr ? "تصدير" : "Export"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => navigate("/products/new")} size="sm" className="gap-1.5 h-9 rounded-lg shadow-sm px-4">
            <Plus className="h-4 w-4" />
            {isAr ? "إنشاء" : "Create"}
          </Button>
        </div>
      </div>

      {/* ─── Status pill tabs ─── */}
      <div className="flex items-center gap-2 flex-wrap">
        {statusTabs.map(tab => {
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors border
                ${isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                }`}
            >
              {isAr ? tab.label : tab.labelEn}
              <span className={`inline-flex items-center justify-center rounded-full text-[11px] tabular-nums min-w-[20px] h-5 px-1.5
                ${isActive
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
                }`}>
                {tabCounts[tab.value] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Search + filter bar ─── */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg shrink-0">
          <ArrowUpDown className="h-4 w-4" />
        </Button>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-auto h-9 rounded-lg gap-1.5 border-border text-muted-foreground hover:text-foreground">
            <ListFilter className="h-4 w-4 shrink-0" />
            <SelectValue placeholder={isAr ? "تصفية" : "Filter"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("products.allCategories")}</SelectItem>
            {apiCategories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg shrink-0">
          <LayoutList className="h-4 w-4" />
        </Button>
        <div className="relative flex-1 max-w-sm ms-auto">
          <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("products.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pe-9 h-9 rounded-lg bg-muted/40 border-transparent focus:bg-background focus:border-border transition-colors"
          />
        </div>
      </div>

      {/* ─── Table card ─── */}
      <Card className="overflow-hidden border-border/60">
        <CardContent className="px-0 pt-0 pb-0">
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 mx-4 mt-3 mb-1 rounded-lg bg-primary/[0.04] border border-primary/15 backdrop-blur-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                <span className="text-[11px] font-bold text-primary">{selectedIds.size}</span>
              </div>
              <span className="text-[13px] font-medium text-primary/80">
                {isAr ? "محدد" : "selected"}
              </span>
              <div className="flex items-center gap-1.5 ms-auto">
                <Button variant="ghost" size="sm" disabled={bulkActionInProgress} onClick={() => handleBulkAction("publish")} className="gap-1.5 h-7 text-xs hover:bg-emerald-500/10 hover:text-emerald-700">
                  <Eye className="h-3.5 w-3.5" />
                  {isAr ? "نشر" : "Publish"}
                </Button>
                <Button variant="ghost" size="sm" disabled={bulkActionInProgress} onClick={() => handleBulkAction("archive")} className="gap-1.5 h-7 text-xs hover:bg-amber-500/10 hover:text-amber-700">
                  <Archive className="h-3.5 w-3.5" />
                  {isAr ? "أرشفة" : "Archive"}
                </Button>
                <div className="w-px h-4 bg-border/60" />
                <Button variant="ghost" size="sm" disabled={bulkActionInProgress} onClick={() => handleBulkAction("delete")} className="gap-1.5 h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  {isAr ? "حذف" : "Delete"}
                </Button>
                {bulkActionInProgress && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">{isAr ? "جارٍ التحميل..." : "Loading products..."}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted/40">
                <Package className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-base font-semibold text-foreground">
                  {isAr ? "لم يتم إضافة منتج بعد" : "No products added yet"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isAr ? "ابدأ بإضافة أول منتج لمتجرك" : "Get started by adding your first product"}
                </p>
              </div>
              <Button onClick={() => navigate("/products/new")} size="sm" className="gap-1.5 rounded-lg px-5 h-9 shadow-sm">
                <Plus className="h-4 w-4" />
                {isAr ? "أضف منتجك الأول" : "Add your first product"}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
                    <TableHead className="w-12 ps-4">
                      <Checkbox
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                      {isAr ? "المنتج" : "Product"}
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                      {t("products.stock")}
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                      {t("products.price")}
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                      {t("products.status")}
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 w-[120px]">
                      {isAr ? "الإجراءات" : "Actions"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p, i) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer group/row transition-colors hover:bg-muted/40"
                      style={{ animationDelay: `${i * 20}ms` }}
                      onClick={() => navigate(`/products/${p.id}/edit`)}
                    >
                      {/* Checkbox */}
                      <TableCell className="ps-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                        />
                      </TableCell>

                      {/* Product name + SKU + image */}
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-[200px]">
                          {p.image.startsWith("http") ? (
                            <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover bg-muted ring-1 ring-border/30 shrink-0" />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/60 text-base ring-1 ring-border/20 shrink-0">{p.image}</span>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-[13px] leading-tight truncate">{isAr ? p.nameAr : p.name}</p>
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono truncate">{p.sku || "—"}</p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Quantity */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {p.stock < 20 && p.stock > 0 && (
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          )}
                          {p.stock === 0 && (
                            <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                          )}
                          <span className={`text-[13px] tabular-nums font-medium ${p.stock === 0 ? "text-destructive" : p.stock < 20 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                            {p.stock}
                          </span>
                        </div>
                      </TableCell>

                      {/* Price + Currency */}
                      <TableCell>
                        <div>
                          <p className="font-semibold text-[13px] tabular-nums">{formatCurrency(p.price)}</p>
                          {p.compareAtPrice && (
                            <p className="text-[11px] text-muted-foreground/50 line-through tabular-nums">{formatCurrency(p.compareAtPrice)}</p>
                          )}
                        </div>
                      </TableCell>

                      {/* Status badge */}
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-medium gap-1.5 rounded-full py-0.5 px-2.5 ${statusConfig[p.status].bg}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusConfig[p.status].dot}`} />
                          {t(`products.${p.status}`)}
                        </Badge>
                      </TableCell>

                      {/* Actions: Edit + Delete + three-dot menu */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => navigate(`/products/${p.id}/edit`)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isAr ? "start" : "end"} className="w-40">
                              <DropdownMenuItem onClick={() => navigate(`/products/${p.id}/edit`)}>
                                <Pencil className="me-2 h-3.5 w-3.5" />
                                {t("products.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => {
                                if (!storeId) return;
                                try {
                                  const dup = await duplicateProduct(storeId, p.id);
                                  toast.success(isAr ? "تم نسخ المنتج" : "Product duplicated");
                                  navigate(`/products/${dup.id}/edit`);
                                } catch (err) {
                                  showError(err, language);
                                }
                              }}>
                                <Copy className="me-2 h-3.5 w-3.5" />
                                {isAr ? "نسخ" : "Duplicate"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleteTarget(p)} className="text-destructive focus:text-destructive">
                                <Trash2 className="me-2 h-3.5 w-3.5" />
                                {t("products.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <p className="text-xs text-muted-foreground tabular-nums">
                {isAr
                  ? `عرض ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, totalProducts)} من ${totalProducts}`
                  : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, totalProducts)} of ${totalProducts}`}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "ghost"}
                      size="icon"
                      className={`h-8 w-8 rounded-lg text-xs ${currentPage === page ? "shadow-sm" : ""}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("products.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("products.confirmDeleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">{t("products.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg">
              {isDeleting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("products.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImportComplete={fetchProducts} />
    </div>
  );
};

export default Products;
