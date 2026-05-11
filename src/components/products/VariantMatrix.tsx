import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Copy, Grid3X3 } from "lucide-react";

export interface VariantCombination {
  options: Record<string, string>;
  price: string;
  stock: string;
  sku: string;
  enabled: boolean;
}

interface VariantDef {
  name: string;
  nameAr: string;
  options: string;
  optionsAr: string;
}

interface VariantMatrixProps {
  variants: VariantDef[];
  combinations: VariantCombination[];
  onCombinationsChange: (combinations: VariantCombination[]) => void;
  defaultPrice?: string;
}

function cartesianProduct(variants: { name: string; values: string[] }[]): Record<string, string>[] {
  if (variants.length === 0) return [];
  const [first, ...rest] = variants;
  if (rest.length === 0) {
    return first.values.map(v => ({ [first.name]: v }));
  }
  const restCombos = cartesianProduct(rest);
  return first.values.flatMap(v =>
    restCombos.map(combo => ({ [first.name]: v, ...combo }))
  );
}

function comboKey(options: Record<string, string>): string {
  return Object.entries(options).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v).join("/");
}

export function VariantMatrix({ variants, combinations, onCombinationsChange, defaultPrice = "" }: VariantMatrixProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const parsedVariants = useMemo(() =>
    variants
      .filter(v => v.name.trim() && v.options.trim())
      .map(v => ({
        name: v.name.trim(),
        values: v.options.split(",").map(o => o.trim()).filter(Boolean),
      })),
    [variants]
  );

  const allCombos = useMemo(() => cartesianProduct(parsedVariants), [parsedVariants]);

  useEffect(() => {
    if (allCombos.length === 0) {
      if (combinations.length > 0) onCombinationsChange([]);
      return;
    }
    const existingByKey = new Map(combinations.map(c => [comboKey(c.options), c]));
    const newCombinations = allCombos.map(options => {
      const key = comboKey(options);
      const existing = existingByKey.get(key);
      return existing
        ? { ...existing, options }
        : { options, price: defaultPrice, stock: "", sku: "", enabled: true };
    });
    const oldKeys = combinations.map(c => comboKey(c.options)).join(",");
    const newKeys = newCombinations.map(c => comboKey(c.options)).join(",");
    if (oldKeys !== newKeys) {
      onCombinationsChange(newCombinations);
    }
  }, [allCombos]);

  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");

  if (allCombos.length === 0) return null;

  const variantNames = parsedVariants.map(v => v.name);

  const updateCombo = (index: number, field: keyof VariantCombination, value: string | boolean) => {
    const updated = [...combinations];
    updated[index] = { ...updated[index], [field]: value };
    onCombinationsChange(updated);
  };

  const applyToAll = (field: "price" | "stock", value: string) => {
    onCombinationsChange(combinations.map(c => ({ ...c, [field]: value })));
  };

  const enabledCount = combinations.filter(c => c.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Grid3X3 className="h-4 w-4 text-muted-foreground" />
        <span className="text-[13px] font-semibold">
          {isAr ? "مصفوفة المتغيرات" : "Variant Combinations"}
        </span>
        <Badge variant="secondary" className="text-[10px] rounded-md ms-1">
          {enabledCount}/{combinations.length}
        </Badge>
      </div>

      {/* Bulk apply row */}
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/40">
        <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap font-medium">
          {isAr ? "تطبيق على الكل:" : "Bulk apply:"}
        </span>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder={isAr ? "السعر" : "Price"}
            value={bulkPrice}
            onChange={(e) => setBulkPrice(e.target.value)}
            className="h-7 w-20 text-[11px] rounded-md bg-background border-border/50"
          />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md hover:bg-primary/10" onClick={() => { if (bulkPrice) applyToAll("price", bulkPrice); }}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <div className="w-px h-4 bg-border/40" />
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder={isAr ? "المخزون" : "Stock"}
            value={bulkStock}
            onChange={(e) => setBulkStock(e.target.value)}
            className="h-7 w-20 text-[11px] rounded-md bg-background border-border/50"
          />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-md hover:bg-primary/10" onClick={() => { if (bulkStock) applyToAll("stock", bulkStock); }}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-xl border border-border/50 bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
              {variantNames.map(name => (
                <TableHead key={name} className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">{name}</TableHead>
              ))}
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">{isAr ? "السعر" : "Price"}</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">{isAr ? "المخزون" : "Stock"}</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">SKU</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {combinations.map((combo, i) => (
              <TableRow key={comboKey(combo.options)} className={`transition-opacity ${!combo.enabled ? "opacity-30" : "hover:bg-muted/20"}`}>
                {variantNames.map(name => (
                  <TableCell key={name} className="py-2">
                    <span className="inline-flex items-center text-[11px] font-medium bg-muted/50 rounded-md px-2 py-0.5">
                      {combo.options[name]}
                    </span>
                  </TableCell>
                ))}
                <TableCell className="py-2">
                  <Input
                    type="number"
                    value={combo.price}
                    onChange={(e) => updateCombo(i, "price", e.target.value)}
                    className="h-7 w-20 text-[11px] rounded-md bg-muted/20 border-transparent focus:bg-background focus:border-border tabular-nums"
                    disabled={!combo.enabled}
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    type="number"
                    value={combo.stock}
                    onChange={(e) => updateCombo(i, "stock", e.target.value)}
                    className="h-7 w-16 text-[11px] rounded-md bg-muted/20 border-transparent focus:bg-background focus:border-border tabular-nums"
                    disabled={!combo.enabled}
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    value={combo.sku}
                    onChange={(e) => updateCombo(i, "sku", e.target.value)}
                    className="h-7 w-24 text-[11px] rounded-md bg-muted/20 border-transparent focus:bg-background focus:border-border font-mono"
                    placeholder="Auto"
                    disabled={!combo.enabled}
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Switch
                    checked={combo.enabled}
                    onCheckedChange={(v) => updateCombo(i, "enabled", v)}
                    className="scale-75"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
