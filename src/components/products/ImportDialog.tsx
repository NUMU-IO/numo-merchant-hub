import { useState, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { importProductsFromCSV, generateCSVTemplate, type ImportResult } from "@/services/productApi";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ImportDialog({ open, onOpenChange, onImportComplete }: ImportDialogProps) {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAr = language === "ar";

  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
    }
  };

  const handleDownloadTemplate = () => {
    const csv = generateCSVTemplate();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file || !storeId) return;
    setImporting(true);
    try {
      const text = await file.text();
      const r = await importProductsFromCSV(storeId, text);
      setResult(r);
      if (r.created > 0) {
        onImportComplete();
      }
    } finally {
      setImporting(false);
    }
  };

  const handleClose = (o: boolean) => {
    if (!o) {
      setFile(null);
      setResult(null);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">{isAr ? "استيراد منتجات" : "Import Products"}</DialogTitle>
          <DialogDescription className="text-xs">
            {isAr
              ? "ارفع ملف CSV لإضافة منتجات بالجملة"
              : "Upload a CSV file to bulk-add products"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template download */}
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-3 w-full p-3 rounded-xl border border-dashed border-border/60 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60 flex-shrink-0">
              <Download className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[13px] font-medium">{isAr ? "تحميل النموذج" : "Download Template"}</p>
              <p className="text-[11px] text-muted-foreground">{isAr ? "ملف CSV جاهز للتعبئة" : "Pre-formatted CSV file"}</p>
            </div>
          </button>

          {/* Drop zone */}
          {!result && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) {
                  setFile(f);
                  setResult(null);
                }
              }}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-all
                ${isDragOver ? "border-primary bg-primary/5 scale-[1.01]" : file ? "border-primary/40 bg-primary/[0.02]" : "border-border/60 bg-muted/20 hover:bg-muted/30"}`}
            >
              {file ? (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-semibold">{file.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isAr ? "تغيير الملف" : "Change file"}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
                    <Upload className="h-5 w-5 text-muted-foreground/60" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] text-muted-foreground">
                      {isAr ? "اسحب ملف CSV هنا" : "Drag a CSV file here"}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                      {isAr ? "أو اضغط للاختيار" : "or click to browse"}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelect} />

          {/* Results */}
          {result && (
            <div className="space-y-3">
              {/* Success/failure summary */}
              <div className="flex items-center gap-2">
                {result.created > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-800/40 px-3 py-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{result.created}</span>
                    <span className="text-[11px] text-emerald-600/70">{isAr ? "تم إضافته" : "created"}</span>
                  </div>
                )}
                {result.failed > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-xs font-semibold text-destructive">{result.failed}</span>
                    <span className="text-[11px] text-destructive/70">{isAr ? "فشل" : "failed"}</span>
                  </div>
                )}
              </div>

              {result.errors.length > 0 && (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-destructive/10 bg-destructive/[0.03] p-3 space-y-1.5">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <span className="text-destructive/60 tabular-nums flex-shrink-0">
                        {isAr ? `صف ${e.row}` : `Row ${e.row}`}
                      </span>
                      {e.name && <span className="text-foreground/70 truncate max-w-[100px]">{e.name}</span>}
                      <span className="text-destructive">{e.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button onClick={() => handleClose(false)} size="sm" className="rounded-lg text-xs min-w-[80px]">
              {isAr ? "تم" : "Done"}
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => handleClose(false)} className="rounded-lg text-xs">
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button size="sm" onClick={handleImport} disabled={!file || importing} className="gap-1.5 rounded-lg text-xs min-w-[100px]">
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {importing
                  ? (isAr ? "جارٍ الاستيراد..." : "Importing...")
                  : (isAr ? "استيراد" : "Import")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
