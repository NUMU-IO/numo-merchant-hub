import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { showError } from "@/lib/show-error";
import {
  executeCustomerImport,
  previewCustomerImport,
  type CustomerImportPreview,
  type CustomerImportResult,
  type CustomerTargetField,
} from "@/services/customerImportApi";

// Fields the server understands; order matters for the UI picker.
const TARGET_FIELDS: CustomerTargetField[] = [
  "name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "accepts_marketing",
  "notes",
  "tags",
];

const FIELD_LABELS: Record<CustomerTargetField, { en: string; ar: string }> = {
  name: { en: "Full name", ar: "الاسم الكامل" },
  first_name: { en: "First name", ar: "الاسم الأول" },
  last_name: { en: "Last name", ar: "اسم العائلة" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  phone: { en: "Phone", ar: "رقم الموبايل" },
  accepts_marketing: { en: "Accepts marketing", ar: "يقبل التسويق" },
  notes: { en: "Notes", ar: "ملاحظات" },
  tags: { en: "Tags (comma-separated)", ar: "وسوم (مفصولة بفواصل)" },
};

type Phase = "idle" | "preview" | "result";

export default function CustomerImport() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CustomerImportPreview | null>(null);
  const [mapping, setMapping] = useState<Record<string, CustomerTargetField | "">>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CustomerImportResult | null>(null);

  // Server-side requirement: a name (full or first) AND a contact (email or phone).
  const missingRequired = useMemo<string[]>(() => {
    if (phase !== "preview") return [];
    const chosen = new Set(
      Object.values(mapping).filter(Boolean) as CustomerTargetField[],
    );
    const missing: string[] = [];
    if (!chosen.has("name") && !chosen.has("first_name")) {
      missing.push(isAr ? "الاسم (كامل أو أول)" : "Name (full or first)");
    }
    if (!chosen.has("email") && !chosen.has("phone")) {
      missing.push(isAr ? "الإيميل أو الموبايل" : "Email or phone");
    }
    return missing;
  }, [phase, mapping, isAr]);

  const handleFileSelected = async (f: File | null) => {
    if (!f || !storeId) return;
    setFile(f);
    setSubmitting(true);
    try {
      const data = await previewCustomerImport(storeId, f);
      setPreview(data);
      // Seed mapping from the server's suggestion; empty string = unmapped.
      // Guard against the server ever suggesting the same target twice —
      // execute's mapping reversal would silently drop one column.
      const seed: Record<string, CustomerTargetField | ""> = {};
      const used = new Set<CustomerTargetField>();
      for (const col of data.columns) {
        const target = (data.suggested_mapping[col] as CustomerTargetField | null) ?? "";
        seed[col] = target && !used.has(target) ? target : "";
        if (seed[col]) used.add(seed[col] as CustomerTargetField);
      }
      setMapping(seed);
      setPhase("preview");
    } catch (err) {
      showError(err, language);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecute = async () => {
    if (!storeId || !file) return;
    if (missingRequired.length > 0) {
      toast.error(
        isAr
          ? `حقول مطلوبة ناقصة: ${missingRequired.join("، ")}`
          : `Missing required fields: ${missingRequired.join(", ")}`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await executeCustomerImport(storeId, file, mapping, true);
      setResult(res);
      setPhase("result");
      if (res.created > 0) {
        // The list query has a long staleTime — without this, "Go to
        // customers" shows the cached pre-import list.
        queryClient.invalidateQueries({ queryKey: ["customers", storeId] });
        toast.success(
          isAr
            ? `تم استيراد ${res.created} عميل`
            : `Imported ${res.created} customer${res.created === 1 ? "" : "s"}`,
        );
      }
    } catch (err) {
      showError(err, language);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setPhase("idle");
    setFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
  };

  if (!storeId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {isAr ? "اختار متجر أولاً" : "Select a store first"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-2">
      <div>
        <Link
          to="/customers"
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isAr ? "العملاء" : "Customers"}
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
          {isAr ? "استيراد العملاء" : "Import customers"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAr
            ? "ارفع ملف CSV من إكسل أو جوجل شيتس. هنعرض لك أول كام صف عشان تتأكد قبل الاستيراد الفعلي. العملاء المكررين (بنفس الإيميل) بيتخطوا تلقائياً."
            : "Upload a CSV exported from Excel or Google Sheets. You'll preview the column mapping before anything gets imported. Duplicates (same email) are skipped automatically."}
        </p>
      </div>

      {/* ── IDLE ─────────────────────────────────────────────────────── */}
      {phase === "idle" && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm font-medium">
            {isAr ? "ارفع ملف CSV" : "Upload a CSV file"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isAr
              ? "حتى ٥٠٠٠ صف. من إكسل اختار File → Save As → CSV."
              : "Up to 5,000 rows. In Excel: File → Save As → CSV."}
          </p>
          <label className="mt-5 inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                // Clear the input so re-picking the SAME file after a
                // reset/failed preview still fires onChange.
                e.target.value = "";
                handleFileSelected(f);
              }}
            />
            <Button asChild variant="outline" disabled={submitting}>
              <span className="inline-flex cursor-pointer items-center gap-2">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isAr ? "اختر ملف" : "Choose file"}
              </span>
            </Button>
          </label>
        </div>
      )}

      {/* ── PREVIEW / MAPPING ────────────────────────────────────────── */}
      {phase === "preview" && preview && (
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">
                {isAr ? "طابق كل عمود بحقل عندنا" : "Map each column to a field"}
              </p>
              <button
                type="button"
                onClick={reset}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {isAr ? "ملف آخر" : "Different file"}
              </button>
            </div>
            <div className="space-y-2">
              {preview.columns.map((col) => (
                <div
                  key={col}
                  className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]"
                >
                  <div className="truncate rounded-md bg-muted/40 px-3 py-2 font-mono text-xs">
                    {col}
                  </div>
                  <div className="hidden text-muted-foreground sm:block">→</div>
                  <Select
                    value={mapping[col] || "__skip__"}
                    onValueChange={(v) =>
                      setMapping((m) => ({
                        ...m,
                        [col]: v === "__skip__" ? "" : (v as CustomerTargetField),
                      }))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={isAr ? "(تجاهل)" : "(skip)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip__">
                        {isAr ? "(تجاهل)" : "(skip this column)"}
                      </SelectItem>
                      {TARGET_FIELDS.map((f) => {
                        const inUseElsewhere = Object.entries(mapping).some(
                          ([c, v]) => c !== col && v === f,
                        );
                        return (
                          <SelectItem
                            key={f}
                            value={f}
                            disabled={inUseElsewhere}
                          >
                            {isAr ? FIELD_LABELS[f].ar : FIELD_LABELS[f].en}
                            {inUseElsewhere ? " ·" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {preview.sample_rows.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <Label className="mb-2 block text-xs font-semibold text-muted-foreground">
                {isAr ? "أول صفوف للمراجعة" : "First rows for review"}
              </Label>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b text-start">
                      {preview.columns.map((c) => (
                        <th key={c} className="px-2 py-1.5 text-start font-medium">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample_rows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {preview.columns.map((c) => (
                          <td key={c} className="max-w-[160px] truncate px-2 py-1.5 text-muted-foreground">
                            {row[c] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {missingRequired.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              {isAr ? "حقول مطلوبة لسه ناقصة: " : "Still missing required fields: "}
              <span className="font-medium">{missingRequired.join(isAr ? "، " : ", ")}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={reset} disabled={submitting}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleExecute}
              disabled={submitting || missingRequired.length > 0}
            >
              {submitting ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : null}
              {isAr ? "استورد العملاء" : "Import customers"}
            </Button>
          </div>
        </div>
      )}

      {/* ── RESULT ───────────────────────────────────────────────────── */}
      {phase === "result" && result && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              {result.created > 0 ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {isAr
                    ? `تم إنشاء ${result.created} من ${result.total_rows}`
                    : `Created ${result.created} of ${result.total_rows}`}
                </p>
                {result.skipped > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {isAr
                      ? `${result.skipped} صف تخطاه النظام`
                      : `${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <Label className="mb-2 block text-xs font-semibold text-muted-foreground">
                {isAr ? "الصفوف اللي اتخطت" : "Skipped rows"}
              </Label>
              <div className="max-h-72 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-1.5 text-start font-medium">
                        {isAr ? "صف" : "Row"}
                      </th>
                      <th className="px-2 py-1.5 text-start font-medium">
                        {isAr ? "السبب" : "Reason"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e) => (
                      <tr key={e.row} className="border-b last:border-0">
                        <td className="px-2 py-1.5 font-mono text-muted-foreground">
                          {e.row}
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {e.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              {isAr ? "استيراد ملف آخر" : "Import another file"}
            </Button>
            <Button onClick={() => navigate("/customers")}>
              {isAr ? "للعملاء" : "Go to customers"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
