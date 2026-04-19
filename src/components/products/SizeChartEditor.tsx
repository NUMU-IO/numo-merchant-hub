/**
 * Per-product size chart editor.
 *
 * Stored inside `product.attributes.size_chart`. Shape:
 *   {
 *     enabled: boolean,
 *     column_headers: string[],   // measurement columns; "Size" is implicit first
 *     rows: [{ size: string, values: string[] }],
 *     unit?: "cm" | "in",
 *     notes?: string,
 *     image_url?: string,
 *   }
 *
 * Merchant UX priorities:
 *   - Toggle the whole thing on/off from one switch.
 *   - Start from a preset template (apparel, shoes, kids) so the merchant
 *     sees a real grid instead of an empty editor.
 *   - In-place editing of column headers and cells — no popups.
 */

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePlus, Loader2, Plus, Ruler, Trash2, Upload, X } from "lucide-react";

/** What the storefront should do with this product:
 *   "default" — fall back to the store-level default chart (if any)
 *   "custom"  — use the chart data on this product
 *   "off"     — hide the button even if a store default exists
 */
export type SizeChartMode = "default" | "custom" | "off";

export interface SizeChart {
  /**
   * Legacy boolean kept for backwards compat with rows already on disk
   * before we added explicit `mode`. New writes always set both. Storefront
   * resolver treats `enabled: false` with no `mode` as "off".
   */
  enabled: boolean;
  mode: SizeChartMode;
  column_headers: string[];
  rows: Array<{ size: string; values: string[] }>;
  unit: "cm" | "in";
  notes: string;
  image_url: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const EMPTY_SIZE_CHART: SizeChart = {
  enabled: false,
  mode: "default",
  column_headers: [],
  rows: [],
  unit: "cm",
  notes: "",
  image_url: "",
};

/** Presets give merchants a running start. */
// eslint-disable-next-line react-refresh/only-export-components
export const SIZE_CHART_PRESETS: Record<string, SizeChart> = {
  apparel: {
    enabled: true,
    unit: "cm",
    column_headers: ["Chest", "Waist", "Hip"],
    rows: [
      { size: "XS", values: ["82", "62", "88"] },
      { size: "S", values: ["86", "66", "92"] },
      { size: "M", values: ["92", "72", "98"] },
      { size: "L", values: ["98", "78", "104"] },
      { size: "XL", values: ["104", "84", "110"] },
    ],
    notes: "Measurements are of the body, not the garment. Tolerance ±2 cm.",
    image_url: "",
  },
  shoes: {
    enabled: true,
    unit: "cm",
    column_headers: ["EU", "US", "UK"],
    rows: [
      { size: "36", values: ["36", "5", "3"] },
      { size: "37", values: ["37", "6", "4"] },
      { size: "38", values: ["38", "7", "5"] },
      { size: "39", values: ["39", "8", "6"] },
      { size: "40", values: ["40", "9", "7"] },
      { size: "41", values: ["41", "10", "8"] },
      { size: "42", values: ["42", "11", "9"] },
    ],
    notes: "",
    image_url: "",
  },
  kids: {
    enabled: true,
    unit: "cm",
    column_headers: ["Height", "Chest", "Waist"],
    rows: [
      { size: "2-3y", values: ["92-98", "54", "52"] },
      { size: "4-5y", values: ["104-110", "58", "54"] },
      { size: "6-7y", values: ["116-122", "62", "56"] },
      { size: "8-9y", values: ["128-134", "66", "58"] },
    ],
    notes: "",
    image_url: "",
  },
};

function coerceChart(raw: unknown): SizeChart {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SIZE_CHART };
  const r = raw as Record<string, unknown>;
  const enabled = r.enabled === true;
  // Mode: prefer explicit; derive from legacy `enabled` + content for
  // objects written before the `mode` field existed.
  const rawMode = typeof r.mode === "string" ? r.mode : "";
  const rows = Array.isArray(r.rows)
    ? (r.rows as unknown[]).map((row) => {
        const rec = (row ?? {}) as Record<string, unknown>;
        return {
          size: typeof rec.size === "string" ? rec.size : "",
          values: Array.isArray(rec.values)
            ? (rec.values as unknown[]).map((v) => (typeof v === "string" ? v : String(v ?? "")))
            : [],
        };
      })
    : [];
  let mode: SizeChartMode;
  if (rawMode === "default" || rawMode === "custom" || rawMode === "off") {
    mode = rawMode;
  } else if (!enabled) {
    mode = "off";
  } else if (rows.length > 0) {
    mode = "custom";
  } else {
    mode = "default";
  }
  return {
    enabled,
    mode,
    column_headers: Array.isArray(r.column_headers)
      ? (r.column_headers.filter((c) => typeof c === "string") as string[])
      : [],
    rows,
    unit: r.unit === "in" ? "in" : "cm",
    notes: typeof r.notes === "string" ? r.notes : "",
    image_url: typeof r.image_url === "string" ? r.image_url : "",
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function sanitizeChartForPersistence(chart: SizeChart): SizeChart | null {
  // "default" mode (which is the implicit state for every new product)
  // only needs to persist if the merchant has flipped to a non-default
  // mode — otherwise we'd bloat every product's JSON with an effectively
  // empty object.
  if (chart.mode === "default") {
    // Merchant hasn't customized anything. Don't write a size_chart blob.
    const untouched =
      chart.column_headers.length === 0 &&
      chart.rows.length === 0 &&
      chart.notes.trim() === "" &&
      chart.image_url.trim() === "";
    if (untouched) return null;
  }

  if (chart.mode === "off") {
    // All we need downstream is "don't show the button". Drop the rest
    // so toggling back to default later doesn't resurrect stale cells.
    return {
      enabled: false,
      mode: "off",
      column_headers: [],
      rows: [],
      unit: chart.unit,
      notes: "",
      image_url: "",
    };
  }

  // mode === "custom" → keep the real data, truncate-align row values
  // to the current header count so orphan cells left over from deleted
  // columns don't stick around.
  const cleanedHeaders = chart.column_headers.map((c) => c.trim()).filter((c) => c !== "");
  return {
    enabled: true,
    mode: "custom",
    column_headers: cleanedHeaders,
    rows: chart.rows
      .filter((r) => r.size.trim() !== "" || r.values.some((v) => v.trim() !== ""))
      .map((r) => ({
        size: r.size.trim(),
        values: r.values.slice(0, cleanedHeaders.length).map((v) => v.trim()),
      })),
    unit: chart.unit,
    notes: chart.notes.trim(),
    image_url: chart.image_url.trim(),
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function sizeChartFromAttributes(attributes: unknown): SizeChart {
  if (!attributes || typeof attributes !== "object") return { ...EMPTY_SIZE_CHART };
  const raw = (attributes as Record<string, unknown>).size_chart;
  return coerceChart(raw);
}

export function SizeChartEditor({
  value,
  onChange,
  isAr,
  /** Hide the "Use store default" mode — useful when this editor is being
   * used to EDIT the store default itself, since it can't fall back to
   * itself. When omitted, all three modes are shown. */
  variant = "product",
  /** Called when the merchant clicks "Edit store default" in product mode.
   * Parent is expected to open a dialog that re-uses this component in
   * variant="store-default" mode. */
  onEditStoreDefault,
  /** Upload handler for the illustration image. Receives the picked File,
   * returns a hosted URL. When omitted, the image slot falls back to a
   * plain URL input so tests / storybook / offline demos still work. */
  onUploadImage,
}: {
  value: SizeChart;
  onChange: (next: SizeChart) => void;
  isAr: boolean;
  variant?: "product" | "store-default";
  onEditStoreDefault?: () => void;
  onUploadImage?: (file: File) => Promise<string>;
}) {
  const set = (patch: Partial<SizeChart>) => onChange({ ...value, ...patch });
  const setMode = (mode: SizeChartMode) => {
    // Flipping to custom should implicitly enable; flipping to off clears
    // `enabled` so older consumers that only looked at that flag still
    // behave correctly.
    onChange({ ...value, mode, enabled: mode === "custom" });
  };

  const addColumn = () => set({
    column_headers: [...value.column_headers, ""],
    rows: value.rows.map((r) => ({ ...r, values: [...r.values, ""] })),
  });

  const removeColumn = (i: number) => set({
    column_headers: value.column_headers.filter((_, idx) => idx !== i),
    rows: value.rows.map((r) => ({
      ...r,
      values: r.values.filter((_, idx) => idx !== i),
    })),
  });

  const setColumn = (i: number, v: string) => set({
    column_headers: value.column_headers.map((c, idx) => (idx === i ? v : c)),
  });

  const addRow = () => set({
    rows: [...value.rows, { size: "", values: value.column_headers.map(() => "") }],
  });

  const removeRow = (i: number) => set({
    rows: value.rows.filter((_, idx) => idx !== i),
  });

  const setRowSize = (i: number, v: string) => set({
    rows: value.rows.map((r, idx) => (idx === i ? { ...r, size: v } : r)),
  });

  const setCell = (rowIdx: number, colIdx: number, v: string) => set({
    rows: value.rows.map((r, i) =>
      i === rowIdx
        ? {
            ...r,
            values: Array.from(
              { length: Math.max(value.column_headers.length, r.values.length) },
              (_, k) => (k === colIdx ? v : r.values[k] ?? ""),
            ),
          }
        : r,
    ),
  });

  const loadPreset = (key: keyof typeof SIZE_CHART_PRESETS) => {
    const preset = SIZE_CHART_PRESETS[key];
    onChange({ ...preset, enabled: true, mode: "custom" });
  };

  const showModeSelector = variant === "product";
  const showTableEditor = variant === "store-default" || value.mode === "custom";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Ruler className="h-4 w-4 text-muted-foreground" />
          {isAr ? "جدول المقاسات" : "Size Chart"}
        </CardTitle>
        <CardDescription className="text-xs mt-0.5">
          {variant === "store-default"
            ? isAr
              ? "هذا الجدول هو الافتراضي لكل المنتجات اللي مش محددة جدول خاص."
              : "This chart is the default used by every product set to 'Use store default'."
            : isAr
            ? "تحكم في ظهور زر جدول المقاسات على صفحة هذا المنتج."
            : "Choose how this product shows (or hides) the Size Chart button on the storefront."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {showModeSelector && (
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                {
                  mode: "default" as const,
                  label: isAr ? "افتراضي المتجر" : "Store default",
                  desc: isAr ? "استخدم جدول المتجر" : "Use the store-wide chart",
                },
                {
                  mode: "custom" as const,
                  label: isAr ? "خاص بهذا المنتج" : "Custom",
                  desc: isAr ? "جدول خاص بهذا المنتج" : "Unique chart for this product",
                },
                {
                  mode: "off" as const,
                  label: isAr ? "إخفاء" : "Hide",
                  desc: isAr ? "لا تظهر الزر" : "No size chart button",
                },
              ]
            ).map((opt) => {
              const active = value.mode === opt.mode;
              return (
                <button
                  type="button"
                  key={opt.mode}
                  onClick={() => setMode(opt.mode)}
                  className={`text-start rounded-lg border px-3 py-2.5 transition-colors ${
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className={`text-[12px] font-semibold ${active ? "text-primary" : ""}`}>
                    {opt.label}
                  </div>
                  <div className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug">
                    {opt.desc}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {showModeSelector && value.mode === "default" && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground flex items-center justify-between gap-3">
            <span>
              {isAr
                ? "سيظهر الجدول الافتراضي للمتجر على صفحة هذا المنتج."
                : "The store-wide default chart will show on this product."}
            </span>
            {onEditStoreDefault && (
              <Button type="button" size="sm" variant="outline" onClick={onEditStoreDefault}>
                {isAr ? "تعديل الجدول الافتراضي" : "Edit store default"}
              </Button>
            )}
          </div>
        )}

        {showModeSelector && value.mode === "off" && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
            {isAr
              ? "زر جدول المقاسات مخفي تمامًا على هذا المنتج."
              : "The Size Chart button is hidden on this product, even if a store default exists."}
          </div>
        )}

        {showTableEditor && (
          <div className="space-y-4">
          {/* Preset loader + unit */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">
              {isAr ? "ابدأ من قالب:" : "Start from a preset:"}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => loadPreset("apparel")}>
              {isAr ? "ملابس" : "Apparel"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => loadPreset("shoes")}>
              {isAr ? "أحذية" : "Shoes"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => loadPreset("kids")}>
              {isAr ? "أطفال" : "Kids"}
            </Button>
            <div className="ms-auto flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground">{isAr ? "الوحدة" : "Unit"}</Label>
              <Select value={value.unit} onValueChange={(u) => set({ unit: u as "cm" | "in" })}>
                <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cm">cm</SelectItem>
                  <SelectItem value="in">in</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px]">
                <tr>
                  <th className="px-2 py-2 text-start font-semibold text-muted-foreground uppercase tracking-wider w-24">
                    {isAr ? "المقاس" : "Size"}
                  </th>
                  {value.column_headers.map((c, i) => (
                    <th key={i} className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <Input
                          value={c}
                          onChange={(e) => setColumn(i, e.target.value)}
                          placeholder={isAr ? "اسم العمود" : "Column name"}
                          className="h-7 text-xs"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeColumn(i)}
                          aria-label="Remove column"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-2 w-24">
                    <Button type="button" size="sm" variant="outline" onClick={addColumn} className="h-7 text-[11px]">
                      <Plus className="h-3 w-3 me-1" />
                      {isAr ? "عمود" : "Col"}
                    </Button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {value.rows.length === 0 ? (
                  <tr>
                    <td colSpan={value.column_headers.length + 2} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      {isAr ? "لا توجد صفوف بعد — اضغط \"+ صف\" للبدء." : "No rows yet — click \"+ Row\" to add the first size."}
                    </td>
                  </tr>
                ) : (
                  value.rows.map((r, ri) => (
                    <tr key={ri}>
                      <td className="px-2 py-1.5">
                        <Input
                          value={r.size}
                          onChange={(e) => setRowSize(ri, e.target.value)}
                          placeholder={isAr ? "م" : "S"}
                          className="h-8 text-xs font-semibold"
                        />
                      </td>
                      {value.column_headers.map((_, ci) => (
                        <td key={ci} className="px-2 py-1.5">
                          <Input
                            value={r.values[ci] ?? ""}
                            onChange={(e) => setCell(ri, ci, e.target.value)}
                            className="h-8 text-xs"
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-center">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeRow(ri)}
                          aria-label="Remove row"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <Plus className="h-3.5 w-3.5 me-1.5" />
            {isAr ? "صف" : "Row"}
          </Button>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">{isAr ? "ملاحظات (اختياري)" : "Notes (optional)"}</Label>
            <Textarea
              value={value.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={2}
              placeholder={isAr ? "مثلاً: قياسات الجسم، هامش ±٢ سم." : "e.g. Body measurements, tolerance ±2 cm."}
              className="text-xs resize-none"
            />
          </div>

          {/* Illustration image — upload preferred, URL fallback */}
          <IllustrationImageField
            value={value.image_url}
            onChange={(url) => set({ image_url: url })}
            onUploadImage={onUploadImage}
            isAr={isAr}
          />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * File-picker illustration slot. When `onUploadImage` is provided we render
 * a proper drop-zone tile (upload → preview → remove). When it isn't (tests,
 * storybook), we degrade to a plain URL input so the component stays pure.
 */
function IllustrationImageField({
  value,
  onChange,
  onUploadImage,
  isAr,
}: {
  value: string;
  onChange: (url: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  isAr: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => fileRef.current?.click();

  const onFile = async (file: File) => {
    setError(null);
    if (!onUploadImage) return;
    if (!file.type.startsWith("image/")) {
      setError(isAr ? "الملف لازم يكون صورة." : "File must be an image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(isAr ? "حجم الصورة أكبر من ٥ ميجا." : "Image must be under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      onChange(url);
    } catch (err) {
      setError((err as Error)?.message || (isAr ? "فشل الرفع." : "Upload failed."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const uploadMode = !!onUploadImage;

  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">
        {isAr ? "صورة توضيحية (اختياري)" : "Illustration image (optional)"}
      </Label>

      {!uploadMode ? (
        // Fallback: plain URL input when no uploader wired up.
        <>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
            dir="ltr"
            className="text-xs"
          />
          {value ? (
            <img
              src={value}
              alt=""
              className="mt-2 max-h-40 rounded border border-border object-contain bg-muted/30"
              onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
            />
          ) : null}
        </>
      ) : value ? (
        // Already uploaded — preview + remove/replace controls.
        <div className="relative rounded-md border border-border bg-muted/30 p-2">
          <img
            src={value}
            alt=""
            className="mx-auto max-h-48 rounded object-contain"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
          <div className="flex gap-2 justify-end mt-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={pick}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5 me-1.5" />
              )}
              {isAr ? "استبدال" : "Replace"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange("")}
              disabled={uploading}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5 me-1.5" />
              {isAr ? "إزالة" : "Remove"}
            </Button>
          </div>
        </div>
      ) : (
        // Empty — drop-zone tile.
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-md border-2 border-dashed border-border bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:border-primary/40 hover:text-foreground transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
          <span className="text-[11px] font-medium">
            {uploading
              ? isAr ? "جاري الرفع…" : "Uploading…"
              : isAr ? "ارفع صورة الجدول" : "Upload chart image"}
          </span>
          <span className="text-[10px] text-muted-foreground/80">
            {isAr ? "PNG / JPG / WEBP · حتى ٥ ميجا" : "PNG / JPG / WEBP · up to 5 MB"}
          </span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />

      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
