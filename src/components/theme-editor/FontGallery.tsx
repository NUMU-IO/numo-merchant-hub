import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FONT_CATALOG,
  CATEGORY_LABELS,
  buildGoogleFontsUrl,
  type FontCategory,
  type FontOption,
} from "@/data/font-catalog";

interface FontGalleryProps {
  label: string;
  value: string;
  onChange: (family: string) => void;
  language?: "en" | "ar";
  filter?: FontCategory[];
}

const CATEGORY_ORDER: FontCategory[] = ["arabic", "latin-sans", "latin-serif", "display", "mono"];

let didPreload = false;
function usePreloadCatalog() {
  useEffect(() => {
    if (didPreload) return;
    didPreload = true;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = buildGoogleFontsUrl(FONT_CATALOG);
    link.setAttribute("data-numu-font-catalog", "true");
    document.head.appendChild(link);
  }, []);
}

export function FontGallery({ label, value, onChange, language = "en", filter }: FontGalleryProps) {
  usePreloadCatalog();

  const categories = useMemo(
    () => CATEGORY_ORDER.filter((c) => !filter || filter.includes(c)),
    [filter]
  );
  const [activeTab, setActiveTab] = useState<FontCategory>(() => {
    const current = FONT_CATALOG.find((f) => f.family === value);
    return current?.category ?? categories[0];
  });

  const fontsByCategory = useMemo(() => {
    const map: Record<FontCategory, FontOption[]> = {
      "arabic": [], "latin-sans": [], "latin-serif": [], "display": [], "mono": [],
    };
    for (const f of FONT_CATALOG) map[f.category].push(f);
    return map;
  }, []);

  const visibleFonts = fontsByCategory[activeTab] ?? [];

  return (
    <div className="grid gap-2.5">
      {/* Header: label + current family name */}
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[12px] font-medium">{label}</Label>
        <span
          className="text-[11px] text-muted-foreground truncate max-w-[140px]"
          title={value}
          style={{ fontFamily: `'${value}', sans-serif` }}
        >
          {value}
        </span>
      </div>

      {/* Compact preview: "Ag" in the font + sample sentence */}
      <div className="rounded-md border bg-muted/30 px-3 py-3 text-center overflow-hidden">
        <p
          className="text-4xl leading-none"
          style={{ fontFamily: `'${value}', sans-serif` }}
        >
          Ag
        </p>
        <p
          className="mt-2 line-clamp-2 text-[13px] leading-snug"
          style={{ fontFamily: `'${value}', sans-serif` }}
        >
          {language === "ar" ? "أهلاً وسهلاً بكم" : "The quick brown fox"}
        </p>
      </div>

      {/* Category selector — Select works at any width */}
      <Select value={activeTab} onValueChange={(v) => setActiveTab(v as FontCategory)}>
        <SelectTrigger className="h-8 text-[12px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat} value={cat} className="text-[12px]">
              {language === "ar" ? CATEGORY_LABELS[cat].ar : CATEGORY_LABELS[cat].en}
              <span className="ms-2 text-[10px] text-muted-foreground">
                ({fontsByCategory[cat].length})
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Font tiles — single column in sidebar, stays readable at any width */}
      <div className="grid grid-cols-1 gap-1.5 max-h-[280px] overflow-y-auto pr-1">
        {visibleFonts.map((f) => {
          const isSelected = f.family === value;
          return (
            <button
              key={f.family}
              type="button"
              onClick={() => onChange(f.family)}
              className={cn(
                "relative w-full rounded-md border bg-background px-3 py-2 text-left transition-all min-w-0",
                "hover:border-primary/60 hover:shadow-sm",
                isSelected && "border-primary ring-2 ring-primary/30"
              )}
            >
              {isSelected && (
                <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-primary" />
              )}
              <span
                className="block truncate text-base leading-tight pe-5"
                style={{ fontFamily: `'${f.family}', ${f.fallback}` }}
              >
                {f.family}
              </span>
              <span
                className="mt-0.5 block truncate text-[10px] text-muted-foreground pe-5"
                style={{ fontFamily: `'${f.family}', ${f.fallback}` }}
              >
                {language === "ar" && f.sample.ar ? f.sample.ar : f.sample.en}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
