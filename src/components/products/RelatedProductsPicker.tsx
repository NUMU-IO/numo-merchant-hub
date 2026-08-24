/**
 * RelatedProductsPicker — choose which products show as "similar" on a PDP.
 *
 * The storefront generates similar products automatically from the same
 * category. A curated list replaces that outright, in the order arranged
 * here, so this is also where the order is set.
 *
 * The button that opened this used to have no `onClick` at all.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listProducts, type ApiProductResponse } from "@/services/productApi";
import { cn } from "@/lib/utils";

/** The API caps a curated list at 24; keep the UI honest about it. */
const MAX_RELATED = 24;

export interface RelatedProductsPickerProps {
  storeId: string | undefined;
  /** The product being edited — it must never recommend itself. */
  currentProductId: string | undefined;
  value: string[];
  onChange: (ids: string[]) => void;
  isAr: boolean;
}

export function RelatedProductsPicker({
  storeId,
  currentProductId,
  value,
  onChange,
  isAr,
}: RelatedProductsPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiProductResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Names for ids already chosen, so the summary reads as products rather
  // than as UUIDs when the dialog has never been opened.
  const [known, setKnown] = useState<Record<string, ApiProductResponse>>({});

  const selected = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    if (!open || !storeId) return;
    const hasQuery = query.trim().length > 0;
    // Debounce typing only — an empty query should fill the list the
    // instant the dialog opens.
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await listProducts(storeId, {
          ...(hasQuery ? { search: query } : {}),
          limit: 20,
        });
        const items = result.items.filter(p => p.id !== currentProductId);
        setResults(items);
        setKnown(prev => {
          const next = { ...prev };
          for (const item of items) next[item.id] = item;
          return next;
        });
      } catch {
        /* search failure leaves the previous results in place */
      } finally {
        setIsSearching(false);
      }
    }, hasQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, query, storeId, currentProductId]);

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onChange(value.filter(v => v !== id));
    } else if (value.length < MAX_RELATED) {
      onChange([...value, id]);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-muted-foreground">
          {value.length === 0
            ? isAr ? "تلقائي" : "Automatic"
            : isAr
              ? `${value.length} منتج مختار`
              : `${value.length} chosen`}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-[11px] rounded-lg"
          onClick={() => setOpen(true)}
          disabled={!storeId}
        >
          {isAr ? "اختيار المنتجات" : "Choose"}
        </Button>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(id => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-muted/60 ps-2.5 pe-1 py-0.5 text-[11px]"
            >
              <span className="max-w-[130px] truncate">
                {known[id]?.name ?? (isAr ? "منتج" : "Product")}
              </span>
              <button
                type="button"
                onClick={() => onChange(value.filter(v => v !== id))}
                aria-label={isAr ? "إزالة" : "Remove"}
                className="grid h-4 w-4 place-items-center rounded-full hover:bg-muted"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isAr ? "المنتجات المشابهة" : "Similar products"}
            </DialogTitle>
            <DialogDescription>
              {isAr
                ? "المنتجات المختارة تحل محل الاقتراحات التلقائية، وتظهر بنفس الترتيب."
                : "Chosen products replace the automatic suggestions, and show in this order."}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={isAr ? "ابحث عن منتج" : "Search products"}
              className="ps-9"
            />
          </div>

          <div className="max-h-[300px] space-y-1 overflow-y-auto">
            {isSearching && results.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-muted-foreground">
                {isAr ? "لا توجد نتائج" : "No products found"}
              </p>
            ) : (
              results.map(p => {
                const isSelected = selected.has(p.id);
                const atLimit = !isSelected && value.length >= MAX_RELATED;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    disabled={atLimit}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start transition-colors",
                      isSelected ? "bg-primary/10" : "hover:bg-muted/50",
                      atLimit && "opacity-40",
                    )}
                  >
                    <img
                      src={p.images?.[0] || ""}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-md bg-muted object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {p.name}
                    </span>
                    {isSelected && (
                      <span className="shrink-0 text-[10px] font-bold text-primary tabular-nums">
                        {value.indexOf(p.id) + 1}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              disabled={value.length === 0}
            >
              {isAr ? "رجوع للتلقائي" : "Back to automatic"}
            </Button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              {isAr ? "تم" : "Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
