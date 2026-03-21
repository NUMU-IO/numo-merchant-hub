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

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/[0.03] p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.04] rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{t("products.title")}</h1>
            <p className="text-[13px] text-muted-foreground">
              {language === "ar" ? "أدر منتجاتك ومخزونك" : "Manage your products and inventory"}
            </p>
          </div>

          {/* Quick stats pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-background/80 backdrop-blur-sm px-3 py-1.5">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold tabular-nums">{totalProducts}</span>
              <span className="text-[11px] text-muted-foreground">{language === "ar" ? "منتج" : "total"}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-500/5 px-3 py-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{publishedCount}</span>
              <span className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">{language === "ar" ? "منشور" : "live"}</span>
            </div>
            {lowStockCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-full border border-amber-200/60 dark:border-amber-800/40 bg-amber-500/5 px-3 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">{lowStockCount}</span>
                <span className="text-[11px] text-amber-600/70 dark:text-amber-400/70">{language === "ar" ? "مخزون منخفض" : "low stock"}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons row */}
        <div className="relative flex items-center gap-2 mt-5 pt-5 border-t border-border/40">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5 h-8 text-xs rounded-lg border-dashed">
            <Upload className="h-3.5 w-3.5" />
            {language === "ar" ? "استيراد" : "Import"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            const csv = exportProductsToCSV(productsList);
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "products_export.csv";
            a.click();
            URL.revokeObjectURL(url);
          }} className="gap-1.5 h-8 text-xs rounded-lg border-dashed">
            <Download className="h-3.5 w-3.5" />
            {language === "ar" ? "تصدير" : "Export"}
          </Button>
          <div className="flex-1" />
          <Button onClick={() => navigate("/products/new")} size="sm" className="gap-1.5 h-8 rounded-lg shadow-sm">
            <Plus className="h-3.5 w-3.5" />
            {t("products.addProduct")}
          </Button>
        </div>
      </div>

      {/* Filters + Table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("products.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ps-9 h-9 rounded-lg bg-muted/40 border-transparent focus:bg-background focus:border-border transition-colors"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[160px] h-9 rounded-lg bg-muted/40 border-transparent">
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
              <TabsList className="h-9 p-0.5 bg-muted/60">
                <TabsTrigger value="all" className="text-xs h-8 rounded-md px-3">{t("products.all")}</TabsTrigger>
                <TabsTrigger value="published" className="text-xs h-8 rounded-md px-3">{t("products.published")}</TabsTrigger>
                <TabsTrigger value="draft" className="text-xs h-8 rounded-md px-3">{t("products.draft")}</TabsTrigger>
                <TabsTrigger value="archived" className="text-xs h-8 rounded-md px-3">{t("products.archived")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="px-0 pt-4 pb-0">
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 mx-4 mb-3 rounded-lg bg-primary/[0.04] border border-primary/15 backdrop-blur-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                <span className="text-[11px] font-bold text-primary">{selectedIds.size}</span>
              </div>
              <span className="text-[13px] font-medium text-primary/80">
                {language === "ar" ? "محدد" : "selected"}
              </span>
              <div className="flex items-center gap-1.5 ms-auto">
                <Button variant="ghost" size="sm" disabled={bulkActionInProgress} onClick={() => handleBulkAction("publish")} className="gap-1.5 h-7 text-xs hover:bg-emerald-500/10 hover:text-emerald-700">
                  <Eye className="h-3.5 w-3.5" />
                  {language === "ar" ? "نشر" : "Publish"}
                </Button>
                <Button variant="ghost" size="sm" disabled={bulkActionInProgress} onClick={() => handleBulkAction("archive")} className="gap-1.5 h-7 text-xs hover:bg-amber-500/10 hover:text-amber-700">
                  <Archive className="h-3.5 w-3.5" />
                  {language === "ar" ? "أرشفة" : "Archive"}
                </Button>
                <div className="w-px h-4 bg-border/60" />
                <Button variant="ghost" size="sm" disabled={bulkActionInProgress} onClick={() => handleBulkAction("delete")} className="gap-1.5 h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  {language === "ar" ? "حذف" : "Delete"}
                </Button>
                {bulkActionInProgress && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-full border-2 border-muted" />
                <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
              <p className="text-xs text-muted-foreground">{language === "ar" ? "جارٍ التحميل..." : "Loading products..."}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
                <Package className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{t("products.noProducts")}</p>
                <p className="text-xs text-muted-foreground/70">{language === "ar" ? "ابدأ بإضافة أول منتج" : "Get started by adding your first product"}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/products/new")} className="gap-1.5 mt-1 rounded-lg">
                <Plus className="h-3.5 w-3.5" />
                {t("products.addProduct")}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-y border-border/40">
                    <TableHead className="w-12 ps-4">
                      <Checkbox
                        checked={filtered.length > 0 && selectedIds.size === filtered.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 w-14">{t("products.image")}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{t("products.name")}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{t("products.category")}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{t("products.price")}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{t("products.stock")}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{t("products.sold")}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{t("products.variants")}</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">{t("products.status")}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p, i) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer group/row transition-colors hover:bg-primary/[0.02]"
                      style={{ animationDelay: `${i * 20}ms` }}
                      onClick={() => navigate(`/products/${p.id}/edit`)}
                    >
                      <TableCell className="ps-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {p.image.startsWith("http") ? (
                          <img src={p.image} alt="" className="h-11 w-11 rounded-xl object-cover bg-muted ring-1 ring-border/30 transition-transform group-hover/row:scale-105" />
                        ) : (
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-muted/60 text-lg ring-1 ring-border/20">{p.image}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[140px]">
                          <p className="font-semibold text-[13px] leading-tight">{language === "ar" ? p.nameAr : p.name}</p>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">{p.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.categoryId ? (
                          <Badge variant="outline" className="gap-1 font-normal text-[11px] py-0.5 rounded-md border-border/50 bg-muted/30">
                            <Tag className="h-2.5 w-2.5" />
                            {apiCategories.find(c => c.id === p.categoryId)?.name || p.category || "—"}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-[13px] tabular-nums">{formatCurrency(p.price)}</p>
                          {p.compareAtPrice && (
                            <p className="text-[11px] text-muted-foreground/50 line-through tabular-nums">{formatCurrency(p.compareAtPrice)}</p>
                          )}
                        </div>
                      </TableCell>
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
                      <TableCell>
                        <span className="text-[13px] tabular-nums text-muted-foreground">{p.sold}</span>
                      </TableCell>
                      <TableCell>
                        {p.variants.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.variants.map(v => (
                              <span key={v.id} className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-muted/60 text-muted-foreground rounded-md px-1.5 py-0.5">
                                {language === "ar" ? v.nameAr : v.name}
                                <span className="text-foreground/70 font-semibold">{v.options.length}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-medium gap-1.5 rounded-md py-0.5 ${statusConfig[p.status].bg}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusConfig[p.status].dot}`} />
                          {t(`products.${p.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/products/${p.id}/edit`); }}>
                              <Pencil className="me-2 h-3.5 w-3.5" />
                              {t("products.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={async (e) => {
                              e.stopPropagation();
                              if (!storeId) return;
                              try {
                                const dup = await duplicateProduct(storeId, p.id);
                                toast.success(language === "ar" ? "تم نسخ المنتج" : "Product duplicated");
                                navigate(`/products/${dup.id}/edit`);
                              } catch (err) {
                                showError(err, language);
                              }
                            }}>
                              <Copy className="me-2 h-3.5 w-3.5" />
                              {language === "ar" ? "نسخ" : "Duplicate"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }} className="text-destructive focus:text-destructive">
                              <Trash2 className="me-2 h-3.5 w-3.5" />
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <p className="text-xs text-muted-foreground tabular-nums">
                {language === "ar"
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
