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
  Megaphone, Receipt, FileText, Plus, Store, Palette,
} from "lucide-react";
import { listProducts } from "@/services/productApi";
import { listOrders } from "@/services/orderApi";
import { listCustomers } from "@/services/customerApi";

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
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [orders, setOrders] = useState<{ id: string; order_number: string; customer_name: string | null }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [searching, setSearching] = useState(false);

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
        const [prodResult, orderResult, custResult] = await Promise.allSettled([
          listProducts(storeId, { limit: 5, search: query }),
          listOrders(storeId, { limit: 5, search: query }),
          listCustomers(storeId, { limit: 5, query }),
        ]);

        if (prodResult.status === "fulfilled") {
          setProducts(prodResult.value.items.map(p => ({ id: p.id, name: p.name, sku: p.sku || "" })));
        }
        if (orderResult.status === "fulfilled") {
          setOrders(orderResult.value.items.map(o => ({ id: o.id, order_number: o.order_number, customer_name: o.customer_name })));
        }
        if (custResult.status === "fulfilled") {
          setCustomers(custResult.value.items.map(c => ({ id: c.id, full_name: c.full_name, email: c.email })));
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, storeId]);

  const go = useCallback((path: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(path);
  }, [navigate, onOpenChange]);

  const hasResults = products.length > 0 || orders.length > 0 || customers.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={isAr ? "ابحث عن منتجات، طلبات، عملاء..." : "Search products, orders, customers..."}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim() && !searching && !hasResults && (
          <CommandEmpty>{isAr ? "لا توجد نتائج" : "No results found."}</CommandEmpty>
        )}

        {/* Search results */}
        {products.length > 0 && (
          <CommandGroup heading={isAr ? "المنتجات" : "Products"}>
            {products.map(p => (
              <CommandItem key={p.id} onSelect={() => go(`/products/${p.id}/edit`)} className="gap-3 rounded-lg">
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{p.name}</p>
                  {p.sku && <p className="text-[11px] text-muted-foreground font-mono">{p.sku}</p>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {orders.length > 0 && (
          <CommandGroup heading={isAr ? "الطلبات" : "Orders"}>
            {orders.map(o => (
              <CommandItem key={o.id} onSelect={() => go("/orders")} className="gap-3 rounded-lg">
                <ShoppingCart className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono">{o.order_number}</p>
                  {o.customer_name && <p className="text-[11px] text-muted-foreground">{o.customer_name}</p>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {customers.length > 0 && (
          <CommandGroup heading={isAr ? "العملاء" : "Customers"}>
            {customers.map(c => (
              <CommandItem key={c.id} onSelect={() => go("/customers")} className="gap-3 rounded-lg">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{c.full_name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.email}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Quick navigation — always visible */}
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
