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
import { ResponsiveTable, MobileCardList, MobileCard } from "@/components/ui/responsive-table";
import { BarcodeScanner, isBarcodeScanSupported } from "@/components/scanner/BarcodeScanner";
import { ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
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
import { getStoreUrl } from "@/lib/storefront";

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
  const [scannerOpen, setScannerOpen] = useState(false);
  // Computed once: capability cannot change mid-session, and calling it in
  // render would re-probe on every keystroke in the search box.
  const [scanSupported] = useState(isBarcodeScanSupported);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProductStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  // Sort/view state — backed by URL-stable values that map straight to the
  // API's `sort_by`/`sort_order` query params (see backend's PRODUCT_SORT_FIELDS).
  // `newest` is encoded as `sort_by=created_at, sort_order=desc` below.
  type SortKey = "newest" | "oldest" | "name_asc" | "name_desc" | "price_asc" | "price_desc" | "stock_desc";
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
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
  }, [debouncedSearch, statusFilter, categoryFilter, sortKey]);

  const fetchProducts = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    try {
      const apiStatus = statusFilter === "all"
        ? undefined
        : statusFilter === "published" ? "active" : statusFilter;
      // Map the UX-level sort presets to the backend's (sort_by, sort_order)
      // pair. Keeping the mapping here (not in the API service) so future sort
      // presets can be added without changing the network contract.
      const sortMap: Record<typeof sortKey, { sort_by: string; sort_order: "asc" | "desc" }> = {
        newest:     { sort_by: "created_at", sort_order: "desc" },
        oldest:     { sort_by: "created_at", sort_order: "asc"  },
        name_asc:   { sort_by: "name",       sort_order: "asc"  },
        name_desc:  { sort_by: "name",       sort_order: "desc" },
        price_asc:  { sort_by: "price",      sort_order: "asc"  },
        price_desc: { sort_by: "price",      sort_order: "desc" },
        stock_desc: { sort_by: "quantity",   sort_order: "desc" },
      };
      const { sort_by, sort_order } = sortMap[sortKey];
      const result = await listProducts(storeId, {
        page: currentPage,
        limit: PAGE_SIZE,
        status: apiStatus,
        search: debouncedSearch || undefined,
        category_id: categoryFilter !== "all" ? categoryFilter : undefined,
        sort_by,
        sort_order,
      });
      setProductsList(result.items.map(apiToProduct));
      setTotalProducts(result.total);
      setTotalPages(result.total_pages);
    } catch (err) {
      showError(err, language);
    } finally {
      setIsLoading(false);
    }
  }, [storeId, currentPage, statusFilter, debouncedSearch, categoryFilter, sortKey, language]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  /**
   * Real per-status counts for the filter chips.
   *
   * These CANNOT be derived from `productsList`, which is one 20-item page of
   * whatever filter is currently applied. Doing that made the chips contradict
   * themselves: selecting "Draft" set `totalProducts` to the draft total (so
   * the "All" chip showed the draft count) while Active/Archived computed 0
   * from a page that by definition contained only drafts. Every chip except
   * the selected one read zero, which looks like an empty catalog.
   *
   * So: ask the server for each status with `limit=1` and read `total` off the
   * pagination envelope — four tiny requests, correct regardless of which chip
   * is active or which page you are on. Deliberately NOT keyed on
   * `statusFilter`; the whole point is that the counts don't move when you
   * change chips. Search and category DO apply, because a count that ignored
   * the active search would contradict the list next to it.
   */
  const [statusCounts, setStatusCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    const common = {
      page: 1,
      limit: 1,
      search: debouncedSearch || undefined,
      category_id: categoryFilter !== "all" ? categoryFilter : undefined,
    } as const;
    Promise.all([
      listProducts(storeId, { ...common }),
      listProducts(storeId, { ...common, status: "active" }),
      listProducts(storeId, { ...common, status: "draft" }),
      listProducts(storeId, { ...common, status: "archived" }),
    ])
      .then(([all, active, draft, archived]) => {
        if (cancelled) return;
        setStatusCounts({
          all: all.total,
          published: active.total,
          draft: draft.total,
          archived: archived.total,
        });
      })
      // Counts are a nicety; a failure here must not blank the page. The
      // chips fall back to hiding their badge rather than showing a wrong 0.
      .catch(() => {
        if (!cancelled) setStatusCounts(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, debouncedSearch, categoryFilter]);

  // Category filter is now server-side (was previously a client-side filter
  // over `productsList` which only ever saw the current 20-item page, so
  // products in matching categories on later pages were invisible).
  const filtered = productsList;

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

  // Both of these counted over `productsList` — one page of the CURRENT
  // filter — so neither ever described the catalog. `publishedCount` fed the
  // status chips and is replaced by the server-side `statusCounts` above;
  // `lowStockCount` was computed and never rendered anywhere.

  const isAr = language === "ar";

  /**
   * The chips are a STATUS filter, so every label has to name a status.
   * "Individual" / "المنتجات الفردية" named nothing — it mapped to
   * `published`, which the API calls `active`, and told the merchant nothing
   * about what they were about to see. Each chip now says what it filters to
   * and carries a one-line explanation on hover.
   */
  const statusTabs: {
    label: string;
    labelEn: string;
    hint: string;
    hintEn: string;
    value: "all" | ProductStatus;
  }[] = [
    {
      label: "الكل", labelEn: "All",
      hint: "كل المنتجات مهما كانت حالتها",
      hintEn: "Every product, whatever its status",
      value: "all",
    },
    {
      label: "نشط", labelEn: "Active",
      hint: "منشور وظاهر للعملاء في المتجر",
      hintEn: "Published and visible to shoppers in your store",
      value: "published",
    },
    {
      label: "مسودة", labelEn: "Draft",
      hint: "لسه بتشتغل عليه — مش ظاهر للعملاء",
      hintEn: "Still being worked on — not visible to shoppers",
      value: "draft",
    },
    {
      label: "مؤرشف", labelEn: "Archived",
      hint: "متشال من المتجر بس متمسحش",
      hintEn: "Removed from the store but not deleted",
      value: "archived",
    },
  ];

  // `null` while the counts are still loading (or if they failed) — the chip
  // renders without a badge rather than claiming zero.
  const tabCounts: Record<string, number> | null = statusCounts;

  return (
    <div className="space-y-5">
      {/* Souq page head — display title + subtitle */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className={`${isAr ? "text-right" : "text-left"}`}>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{t("products.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr ? "أضف وعدّل منتجاتك" : "Add and manage your catalog"}
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

      {/* Souq filter chips — navy when active, count in saffron */}
      <div
        className="flex items-center gap-2 flex-wrap"
        role="tablist"
        aria-label={isAr ? "تصفية حسب الحالة" : "Filter by status"}
      >
        {statusTabs.map(tab => {
          const isActive = statusFilter === tab.value;
          const count = tabCounts?.[tab.value];
          const name = isAr ? tab.label : tab.labelEn;
          const hint = isAr ? tab.hint : tab.hintEn;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-active={isActive}
              onClick={() => setStatusFilter(tab.value)}
              title={hint}
              // The count belongs in the accessible name — a screen reader
              // otherwise hears "Draft" whether there are none or ninety.
              aria-label={
                count === undefined
                  ? `${name} — ${hint}`
                  : `${name} (${count}) — ${hint}`
              }
              className="souq-chip"
            >
              {name}
              {count !== undefined && (
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center rounded-full text-[10px] tabular-nums font-extrabold min-w-[20px] h-5 px-1.5 bg-saffron text-navy-900"
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* What the current filter is actually showing. Without this the merchant
          has to infer it from which chip looks darker — and when a status has
          no products the table just reads "no products", which is easy to
          misread as "my catalog is gone" rather than "nothing is archived". */}
      {statusFilter !== "all" && !isLoading && (
        <p className="text-xs text-muted-foreground -mt-2">
          {(() => {
            const tab = statusTabs.find(x => x.value === statusFilter);
            if (!tab) return null;
            const n = tabCounts?.[statusFilter];
            const label = isAr ? tab.label : tab.labelEn;
            if (n === 0) {
              return isAr
                ? `مفيش منتجات في "${label}". ${tab.hint}.`
                : `No products in "${label}". ${tab.hintEn}.`;
            }
            return isAr
              ? `بتشوف منتجات "${label}" بس. ${tab.hint}.`
              : `Showing "${label}" products only. ${tab.hintEn}.`;
          })()}
          {" "}
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {isAr ? "اعرض الكل" : "Show all"}
          </button>
        </p>
      )}

      {/* ─── Search + filter bar ─── */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg shrink-0"
              aria-label={isAr ? "ترتيب" : "Sort"}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isAr ? "end" : "start"} className="w-48">
            <DropdownMenuLabel>{isAr ? "ترتيب حسب" : "Sort by"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={sortKey}
              onValueChange={(v) => setSortKey(v as typeof sortKey)}
            >
              <DropdownMenuRadioItem value="newest">{isAr ? "الأحدث أولاً" : "Newest first"}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="oldest">{isAr ? "الأقدم أولاً" : "Oldest first"}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name_asc">{isAr ? "الاسم (أ→ي)" : "Name (A–Z)"}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name_desc">{isAr ? "الاسم (ي→أ)" : "Name (Z–A)"}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="price_asc">{isAr ? "السعر (الأقل)" : "Price (low → high)"}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="price_desc">{isAr ? "السعر (الأعلى)" : "Price (high → low)"}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="stock_desc">{isAr ? "المخزون (الأكثر)" : "Stock (most first)"}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-lg shrink-0"
          aria-label={viewMode === "list" ? (isAr ? "عرض شبكي" : "Switch to grid view") : (isAr ? "عرض قائمة" : "Switch to list view")}
          aria-pressed={viewMode === "grid"}
          onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
          title={viewMode === "list" ? (isAr ? "عرض شبكي" : "Grid view") : (isAr ? "عرض قائمة" : "List view")}
        >
          {viewMode === "list" ? <LayoutGrid className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
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
        {/* Scan-to-find. Hidden where BarcodeDetector or a camera is missing —
            a permanently-dead button reads as a broken feature. The scanned
            code lands in the SAME search box, so it filters by barcode/SKU
            through the existing query path with no new endpoint. */}
        {scanSupported && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setScannerOpen(true)}
            aria-label={isAr ? "امسح باركود" : "Scan barcode"}
            title={isAr ? "امسح باركود" : "Scan barcode"}
            className="h-9 w-9 shrink-0 rounded-lg md:hidden"
          >
            <ScanLine className="h-4 w-4" />
          </Button>
        )}
      </div>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setScannerOpen(false);
          setSearch(code);
        }}
      />

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
            <div className="flex flex-col items-center justify-center py-20 gap-5">
              <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10">
                <Package className="h-12 w-12 text-primary/40" />
              </div>
              <div className="text-center space-y-2 max-w-md">
                <p className="text-lg font-semibold text-foreground">
                  {isAr ? "متجرك في انتظار المنتجات" : "Your store is waiting for products"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isAr
                    ? "أضف أول منتج وابدأ البيع. تقدر تضيف المنتجات يدوي أو تستوردها من إنستجرام أو ملف CSV."
                    : "Add your first product to start selling. You can add products manually or import them from Instagram or a CSV file."}
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => navigate("/products/new")} size="sm" className="gap-1.5 rounded-lg px-5 h-9 shadow-sm">
                  <Plus className="h-4 w-4" />
                  {isAr ? "أضف منتج" : "Add Product"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/social")} size="sm" className="gap-1.5 rounded-lg px-5 h-9">
                  {isAr ? "استيراد منتجات" : "Import Products"}
                </Button>
              </div>
            </div>
          ) : viewMode === "grid" ? (
            /* Souq product card grid — square thumb, name, sku, price,
               and a sage/terracotta stock progress bar that pops to
               terracotta when stock <= 10. Matches NHUB Products spec. */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
              {filtered.map((p) => {
                const low = p.stock > 0 && p.stock <= 10;
                const out = p.stock === 0;
                const stockPct = Math.min(100, Math.max(out ? 0 : 6, Math.round((p.stock / 120) * 100)));
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => navigate(`/products/${p.id}/edit`)}
                    className="group/card text-start rounded-2xl border border-border bg-card shadow-card hover-lift overflow-hidden flex flex-col"
                  >
                    <div className="relative aspect-square bg-muted">
                      {p.image.startsWith("http") ? (
                        <img src={p.image} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-5xl">{p.image}</span>
                      )}
                      <Badge variant="outline" className={`absolute top-2 ${isAr ? "left-2" : "right-2"} text-[10px] font-bold gap-1 rounded-full py-0.5 px-2 ${statusConfig[p.status].bg}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusConfig[p.status].dot}`} />
                        {t(`products.${p.status}`)}
                      </Badge>
                    </div>
                    <div className="p-3.5 flex-1 flex flex-col gap-2">
                      <div>
                        <p className="text-[14px] font-bold leading-tight line-clamp-2">{isAr ? p.nameAr : p.name}</p>
                        <p className="text-[11px] text-muted-foreground/70 font-mono truncate mt-0.5">{p.sku || "—"}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[15px] font-extrabold tabular-nums">{formatCurrency(p.price)}</span>
                        {p.compareAtPrice && (
                          <span className="text-[11px] tabular-nums text-muted-foreground line-through">{formatCurrency(p.compareAtPrice)}</span>
                        )}
                      </div>
                      {/* Stock progress bar — sage normal, terracotta low/out */}
                      <div className="mt-auto pt-1">
                        <div className="flex justify-between items-center text-[11px] mb-1.5">
                          <span className="text-muted-foreground">{t("products.stock")}</span>
                          <span className={`tabular-nums font-bold ${out ? "text-destructive" : low ? "text-terracotta" : "text-foreground"}`}>
                            {p.stock} {isAr ? "وحدة" : "units"}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${out ? "bg-destructive" : low ? "bg-terracotta" : "bg-sage"}`}
                            style={{ width: `${stockPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* List view. `viewMode` is a MERCHANT choice and defaults to
               "list", so on a phone this used to mean a 8-column table
               scrolling sideways. ResponsiveTable swaps in a card list below
               `md` while leaving the desktop table byte-identical. */
            <ResponsiveTable
              mobile={
                <MobileCardList className="p-3">
                  {filtered.map((p) => {
                    const outOfStock = p.stock === 0;
                    const lowStock = p.stock > 0 && p.stock < 20;
                    return (
                      <MobileCard
                        key={p.id}
                        selected={selectedIds.has(p.id)}
                        onClick={() => navigate(`/products/${p.id}/edit`)}
                        leading={
                          <Checkbox
                            checked={selectedIds.has(p.id)}
                            onCheckedChange={() => toggleSelect(p.id)}
                            aria-label={isAr ? "تحديد" : "Select"}
                          />
                        }
                        title={
                          <span className="flex items-center gap-2.5">
                            {p.image.startsWith("http") ? (
                              <img
                                src={p.image}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-lg bg-muted object-cover ring-1 ring-border/30"
                              />
                            ) : (
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-base ring-1 ring-border/20">
                                {p.image}
                              </span>
                            )}
                            <span className="truncate">{isAr ? p.nameAr : p.name}</span>
                          </span>
                        }
                        subtitle={<span className="font-mono">{p.sku || "—"}</span>}
                        trailing={formatCurrency(p.price)}
                        trailingMeta={
                          p.compareAtPrice ? (
                            <span className="line-through">{formatCurrency(p.compareAtPrice)}</span>
                          ) : null
                        }
                        badges={
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                              outOfStock
                                ? "border-destructive/30 bg-destructive/10 text-destructive"
                                : lowStock
                                  ? "border-amber-200/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  : "border-border bg-muted text-muted-foreground"
                            }`}
                          >
                            {(outOfStock || lowStock) && (
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${outOfStock ? "bg-destructive" : "bg-amber-500"}`}
                              />
                            )}
                            {t("products.stock")}: <span className="tabular-nums">{p.stock}</span>
                          </span>
                        }
                      />
                    );
                  })}
                </MobileCardList>
              }
            >
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
                      {t("products.profit")}
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

                      {/* Profit / Margin */}
                      <TableCell>
                        {p.costPrice != null ? (
                          (() => {
                            const profit = p.price - p.costPrice;
                            const margin = p.price > 0 ? (profit / p.price) * 100 : 0;
                            const positive = profit >= 0;
                            return (
                              <div>
                                <p className={`font-semibold text-[13px] tabular-nums ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                                  {formatCurrency(profit)}
                                </p>
                                <p className="text-[11px] text-muted-foreground/60 tabular-nums">
                                  {margin.toFixed(1)}%
                                </p>
                              </div>
                            );
                          })()
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigate(`/products/${p.id}/edit`); }}
                            className="text-[11px] text-muted-foreground/60 hover:text-primary underline-offset-2 hover:underline"
                          >
                            {t("products.setCost")}
                          </button>
                        )}
                      </TableCell>

                      {/* Status badge */}
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-medium gap-1.5 rounded-full py-0.5 px-2.5 ${statusConfig[p.status].bg}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusConfig[p.status].dot}`} />
                          {t(`products.${p.status}`)}
                        </Badge>
                      </TableCell>

                      {/* Actions: View on storefront + Edit + Delete + three-dot menu */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {currentStore?.subdomain && (
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              title={isAr ? "عرض في المتجر" : "View in storefront"}
                            >
                              <a
                                href={`${getStoreUrl(currentStore.subdomain).replace(/\/$/, "")}/product/${p.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={isAr ? "عرض في المتجر" : "View in storefront"}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
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
            </ResponsiveTable>
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
