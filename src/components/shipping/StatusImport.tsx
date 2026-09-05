/**
 * Import a courier's status sheet.
 *
 * A Tier 3 courier has no API, so the day's outcomes come back as a
 * spreadsheet. Two things this screen must get right:
 *
 * 1. **Nothing is applied until the merchant confirms.** The upload only
 *    previews; applying is a second, explicit action.
 * 2. **Rejected rows are shown, not summarised away.** A row count that
 *    quietly drops ten parcels is how a merchant discovers a problem a
 *    week later from a customer.
 *
 * The encoding the file turned out to be is surfaced too. These come out
 * of Excel on Windows machines in Egypt, and knowing it read as
 * Windows-1256 is what explains an odd-looking name.
 */

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StatusImportPreview, StatusImportResult } from "@/services/courierApi";

interface Props {
  isAr: boolean;
  preview: StatusImportPreview | null;
  result: StatusImportResult | null;
  uploading?: boolean;
  applying?: boolean;
  onUpload: (file: File) => void;
  onApply: () => void;
  onReset: () => void;
}

export const StatusImport = ({
  isAr,
  preview,
  result,
  uploading = false,
  applying = false,
  onUpload,
  onApply,
  onReset,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onUpload(file);
  };

  if (result) {
    return <ImportResult result={result} isAr={isAr} onReset={onReset} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[15px] font-extrabold tracking-tight">
          {isAr ? "استيراد حالات الشحنات" : "Import delivery statuses"}
        </h2>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {isAr
            ? "ارفع ملف الحالات اللي جالك من المندوب — هنوريك هيتغيّر إيه قبل ما نطبّق حاجة."
            : "Upload the sheet your courier sent — we'll show what changes before applying anything."}
        </p>
      </div>

      {!preview && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files);
          }}
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? "border-navy bg-navy/5" : "border-border"
          }`}
        >
          <FileUp className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-2 text-[13px] font-semibold">
            {isAr ? "اسحب الملف هنا" : "Drop the file here"}
          </p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {isAr
              ? "ملف CSV من إكسل — عربي أو إنجليزي، أي ترميز."
              : "A CSV from Excel — Arabic or English, any encoding."}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => pick(e.target.files)}
          />
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
            <Upload className="me-1.5 h-3.5 w-3.5" />
            {isAr ? "اختار ملف" : "Choose a file"}
          </Button>
        </div>
      )}

      {preview && (
        <ImportPreview
          preview={preview}
          isAr={isAr}
          applying={applying}
          onApply={onApply}
          onReset={onReset}
        />
      )}
    </div>
  );
};

const ImportPreview = ({
  preview,
  isAr,
  applying,
  onApply,
  onReset,
}: {
  preview: StatusImportPreview;
  isAr: boolean;
  applying: boolean;
  onApply: () => void;
  onReset: () => void;
}) => {
  const rejected = preview.rows.filter((r) => r.error);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Badge variant="secondary" className="text-[11px]">
          {preview.total} {isAr ? "صف" : "rows"}
        </Badge>
        <Badge className="bg-emerald-600 text-[11px] hover:bg-emerald-600">
          {preview.applicable} {isAr ? "هيتحدّث" : "will update"}
        </Badge>
        {preview.rejected > 0 && (
          <Badge variant="destructive" className="text-[11px]">
            {preview.rejected} {isAr ? "مش هيتحدّث" : "skipped"}
          </Badge>
        )}
        {/* Knowing it read as cp1256 is what explains an odd-looking name. */}
        <span className="ms-auto font-mono text-[10px] text-muted-foreground" dir="ltr">
          {preview.encoding}
        </span>
      </div>

      {rejected.length > 0 && (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-900 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            {isAr ? "الصفوف دي مش هتتحدّث" : "These rows won't be applied"}
          </p>
          <ul className="mt-2 space-y-1">
            {rejected.slice(0, 12).map((row) => (
              <li
                key={`${row.line}-${row.tracking_number}`}
                className="flex items-baseline gap-2 text-[11px]"
              >
                {/* The line number Excel shows, so it can be found and fixed. */}
                <span className="font-mono text-muted-foreground" dir="ltr">
                  {isAr ? `سطر ${row.line}` : `line ${row.line}`}
                </span>
                <span className="font-mono" dir="ltr">
                  {row.tracking_number || "—"}
                </span>
                <span className="text-amber-900/80 dark:text-amber-300/80">
                  {row.error}
                </span>
              </li>
            ))}
            {rejected.length > 12 && (
              <li className="text-[11px] text-muted-foreground">
                {isAr
                  ? `و${rejected.length - 12} صف كمان`
                  : `and ${rejected.length - 12} more`}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={applying || preview.applicable === 0} onClick={onApply}>
          {applying && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />}
          {isAr
            ? `طبّق ${preview.applicable} تحديث`
            : `Apply ${preview.applicable} updates`}
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset}>
          {isAr ? "ملف تاني" : "Different file"}
        </Button>
      </div>
    </div>
  );
};

const ImportResult = ({
  result,
  isAr,
  onReset,
}: {
  result: StatusImportResult;
  isAr: boolean;
  onReset: () => void;
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
      <p className="text-[12.5px] font-semibold text-emerald-900 dark:text-emerald-300">
        {isAr
          ? `تم تحديث ${result.applied.length} شحنة`
          : `${result.applied.length} shipments updated`}
      </p>
    </div>

    {result.skipped.length > 0 && (
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-[12px] font-semibold">
          {isAr
            ? `${result.skipped.length} شحنة مااتحدّثتش`
            : `${result.skipped.length} not updated`}
        </p>
        <ul className="mt-1.5 space-y-0.5">
          {result.skipped.slice(0, 10).map((row) => (
            <li key={row.tracking_number} className="text-[11px] text-muted-foreground">
              <span className="font-mono" dir="ltr">
                {row.tracking_number}
              </span>
              {" — "}
              {row.reason}
            </li>
          ))}
        </ul>
      </div>
    )}

    <Button size="sm" variant="outline" onClick={onReset}>
      {isAr ? "استورد ملف تاني" : "Import another file"}
    </Button>
  </div>
);
