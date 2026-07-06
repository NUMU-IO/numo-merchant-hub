/**
 * ManageLabelsDialog — edit/delete the store's reusable custom product
 * labels (settings.product_labels). Built-in presets are fixed and never
 * appear here. Saving PUTs the full list; the backend fans the changes out
 * to labeled products (rename → text propagated, delete → label stripped
 * so products fall back to "no label").
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  updateProductLabels,
  type ProductLabel,
} from "@/services/productLabelsApi";

interface EditableRow extends ProductLabel {
  deleted: boolean;
}

interface ManageLabelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  labels: ProductLabel[];
  /** Called with the server-confirmed list after a successful save. */
  onSaved: (labels: ProductLabel[]) => void;
  language: string;
}

export function ManageLabelsDialog({
  open,
  onOpenChange,
  storeId,
  labels,
  onSaved,
  language,
}: ManageLabelsDialogProps) {
  const isAr = language === "ar";
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Re-seed the working copy every time the dialog opens.
  useEffect(() => {
    if (open) {
      setRows(labels.map((l) => ({ ...l, deleted: false })));
    }
  }, [open, labels]);

  const patchRow = (key: string, patch: Partial<EditableRow>) => {
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const handleSave = async () => {
    if (saving) return;
    const kept = rows.filter((row) => !row.deleted);
    const invalid = kept.find((row) => !row.text_en.trim());
    if (invalid) {
      toast.error(
        isAr ? "الاسم الإنجليزي مطلوب لكل ملصق" : "Every label needs an English name",
      );
      return;
    }
    setSaving(true);
    try {
      const saved = await updateProductLabels(
        storeId,
        kept.map(({ key, text_en, text_ar }) => ({
          key,
          text_en: text_en.trim(),
          text_ar: text_ar.trim(),
        })),
      );
      onSaved(saved);
      onOpenChange(false);
      toast.success(isAr ? "تم حفظ الملصقات" : "Labels saved");
    } catch (err) {
      showError(err, language);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isAr ? "إدارة الملصقات" : "Manage labels"}</DialogTitle>
          <DialogDescription>
            {isAr
              ? "تعديل الاسم يُحدَّث تلقائياً على كل المنتجات المستخدمة له، وحذف الملصق يزيله منها."
              : "Renames update every product using the label; deleting removes it from those products."}
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {isAr ? "لا توجد ملصقات مخصصة بعد" : "No custom labels yet"}
          </p>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pe-1">
            {rows.map((row) => (
              <div
                key={row.key}
                className={`flex items-center gap-2 rounded-lg border p-2 ${
                  row.deleted ? "opacity-50 bg-muted/30" : ""
                }`}
              >
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <Input
                    value={row.text_en}
                    onChange={(e) => patchRow(row.key, { text_en: e.target.value })}
                    maxLength={80}
                    disabled={row.deleted}
                    placeholder={isAr ? "إنجليزي" : "English"}
                    aria-label={isAr ? "الاسم (إنجليزي)" : "Name (EN)"}
                  />
                  <Input
                    dir="rtl"
                    value={row.text_ar}
                    onChange={(e) => patchRow(row.key, { text_ar: e.target.value })}
                    maxLength={80}
                    disabled={row.deleted}
                    placeholder={isAr ? "عربي" : "Arabic"}
                    aria-label={isAr ? "الاسم (عربي)" : "Name (AR)"}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => patchRow(row.key, { deleted: !row.deleted })}
                  title={
                    row.deleted
                      ? isAr ? "تراجع" : "Undo"
                      : isAr ? "حذف" : "Delete"
                  }
                >
                  {row.deleted ? (
                    <Undo2 className="h-4 w-4" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={handleSave} disabled={saving || rows.length === 0}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isAr ? (
              "حفظ التغييرات"
            ) : (
              "Save changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
