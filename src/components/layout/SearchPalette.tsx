import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import {
  Package, ShoppingCart, Users, Settings, BarChart3, FolderOpen,
  Megaphone, Receipt, Plus, Store, Palette, Loader2,
} from "lucide-react";
import { listProducts } from "@/services/productApi";
import { listOrders } from "@/services/orderApi";
import { listCustomers } from "@/services/customerApi";

type SearchScope = "all" | "products" | "orders" | "customers";

interface SearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchPalette({ open, onOpenChange }: SearchPaletteProps) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isAr = language === "ar";

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; image: string }[]>([]);
  const [orders, setOrders] = useState<{ id: string; order_number: string; customer_name: string | null; total: number }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setScope("all");
      setProducts([]);
      setOrders([]);
      setCustomers([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || !storeId) {
      setProducts([]);
      setOrders([]);
      setCustomers([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const promises: Promise<unknown>[] = [];

        if (scope === "all" || scope === "products") {
          promises.push(
            listProducts(storeId, { limit: 5, search: query }).then(r =>
              setProducts(r.items.map(p => ({ id: p.id, name: p.name, sku: p.sku || "", image: p.images?.[0] || "" })))
            ).catch(() => setProducts([]))
          );
        } else { setProducts([]); }

        if (scope === "all" || scope === "orders") {
          promises.push(
            listOrders(storeId, { limit: 5, search: query }).then(r =>
              setOrders(r.items.map(o => ({ id: o.id, order_number: o.order_number, customer_name: o.customer_name, total: o.total })))
            ).catch(() => setOrders([]))
          );
        } else { setOrders([]); }

        if (scope === "all" || scope === "customers") {
          promises.push(
            listCustomers(storeId, { limit: 5, query }).then(r =>
              setCustomers(r.items.map(c => ({ id: c.id, full_name: c.full_name, email: c.email })))
            ).catch(() => setCustomers([]))
          );
        } else { setCustomers([]); }

        await Promise.allSettled(promises);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, storeId, scope]);

  const go = useCallback((path: string) => {
    onOpenChange(false);
    navigate(path);
  }, [navigate, onOpenChange]);

  const hasResults = products.length > 0 || orders.length > 0 || customers.length > 0;

  const scopeTabs: { value: SearchScope; label: string; icon: React.ElementType }[] = [
    { value: "all", label: isAr ? "الكل" : "All", icon: BarChart3 },
    { value: "products", label: isAr ? "منتجات" : "Products", icon: Package },
    { value: "orders", label: isAr ? "طلبات" : "Orders", icon: ShoppingCart },
    { value: "customers", label: isAr ? "عملاء" : "Customers", icon: Users },
  ];

  const formatCurrency = (cents: number) => {
    const val = cents / 100;
    return isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={
          scope === "products" ? (isAr ? "ابحث في المنتجات..." : "Search products...")
          : scope === "orders" ? (isAr ? "ابحث في الطلبات..." : "Search orders...")
          : scope === "customers" ? (isAr ? "ابحث في العملاء..." : "Search customers...")
          : (isAr ? "ابحث عن منتجات، طلبات، عملاء..." : "Search products, orders, customers...")
        }
        value={query}
        onValueChange={setQuery}
      />

      {/* Scope tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/40">
        {scopeTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setScope(tab.value)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                scope === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="h-3 w-3" />
              {tab.label}
            </button>
          );
        })}
        {searching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ms-auto" />}
      </div>

      <CommandList className="max-h-[400px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {query.trim() && !searching && !hasResults && (
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-sm">{isAr ? "لا توجد نتائج" : "No results found"}</p>
              <p className="text-xs text-muted-foreground">{isAr ? "جرّب كلمات مختلفة" : "Try different keywords"}</p>
            </div>
          </CommandEmpty>
        )}

        {/* Products */}
        {products.length > 0 && (
          <CommandGroup heading={isAr ? "المنتجات" : "Products"}>
            {products.map(p => (
              <CommandItem key={p.id} onSelect={() => go(`/products/${p.id}/edit`)} className="gap-3 rounded-lg py-2.5">
                {p.image ? (
                  <img src={p.image} alt="" className="h-8 w-8 rounded-md object-cover bg-muted shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{p.name}</p>
                  {p.sku && <p className="text-[11px] text-muted-foreground font-mono">{p.sku}</p>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Orders */}
        {orders.length > 0 && (
          <CommandGroup heading={isAr ? "الطلبات" : "Orders"}>
            {orders.map(o => (
              <CommandItem key={o.id} onSelect={() => go("/orders")} className="gap-3 rounded-lg py-2.5">
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono">{o.order_number}</p>
                  {o.customer_name && <p className="text-[11px] text-muted-foreground">{o.customer_name}</p>}
                </div>
                <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">{formatCurrency(o.total)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Customers */}
        {customers.length > 0 && (
          <CommandGroup heading={isAr ? "العملاء" : "Customers"}>
            {customers.map(c => (
              <CommandItem key={c.id} onSelect={() => go("/customers")} className="gap-3 rounded-lg py-2.5">
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-primary">{c.full_name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{c.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.email}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Quick navigation — only when empty query */}
        {!query.trim() && (
          <>
            <CommandGroup heading={isAr ? "إجراءات سريعة" : "Quick Actions"}>
              <CommandItem onSelect={() => go("/products/new")} className="gap-3 rounded-lg">
                <Plus className="h-4 w-4 text-muted-foreground" />
                <span>{isAr ? "منتج جديد" : "Add new product"}</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/create-store")} className="gap-3 rounded-lg">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span>{isAr ? "متجر جديد" : "Create new store"}</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading={isAr ? "الصفحات" : "Pages"}>
              <CommandItem onSelect={() => go("/")} className="gap-3 rounded-lg">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span>{isAr ? "لوحة التحكم" : "Dashboard"}</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/orders")} className="gap-3 rounded-lg">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <span>{isAr ? "الطلبات" : "Orders"}</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/products")} className="gap-3 rounded-lg">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>{isAr ? "المنتجات" : "Products"}</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/categories")} className="gap-3 rounded-lg">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span>{isAr ? "الفئات" : "Categories"}</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/customers")} className="gap-3 rounded-lg">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{isAr ? "العملاء" : "Customers"}</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/invoices")} className="gap-3 rounded-lg">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span>{isAr ? "الفواتير" : "Invoices"}</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/marketing")} className="gap-3 rounded-lg">
                <Megaphone className="h-4 w-4 text-muted-foreground" />
                <span>{isAr ? "التسويق" : "Marketing"}</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/store")} className="gap-3 rounded-lg">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <span>{isAr ? "تخصيص المتجر" : "Store Settings"}</span>
              </CommandItem>
              <CommandItem onSelect={() => go("/settings")} className="gap-3 rounded-lg">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>{isAr ? "الإعدادات" : "Settings"}</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
