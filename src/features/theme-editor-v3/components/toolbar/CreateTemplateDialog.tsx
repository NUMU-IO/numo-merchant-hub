/**
 * CreateTemplateDialog — Template epic (customizer side).
 *
 * Lets a merchant duplicate a base template (product / collection / page)
 * into a Shopify-style alternate variant `<base>.<suffix>`. The variant is
 * added to the draft's `templates` map (via the store's `addTemplateVariant`),
 * so it autosaves + publishes like any other template and becomes assignable
 * from the resource editors' "Template" dropdown (`template_suffix`).
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCustomizerStore } from "../../store/customizerStore";
import type { EditorLocale } from "../../types";

// Base template types that support alternate variants and map 1:1 to a
// resource editor's `template_suffix` (product / collection / page).
const VARIANT_BASES: { value: string; label: Record<EditorLocale, string> }[] = [
  { value: "product", label: { en: "Product", ar: "المنتج" } },
  { value: "collection", label: { en: "Collection", ar: "المجموعة" } },
  { value: "page", label: { en: "Page", ar: "صفحة" } },
];

// Mirror of the suffix rule enforced in the store + resource editors.
const SUFFIX_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselect the base type (usually derived from the current activePage). */
  defaultBase?: string;
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  defaultBase,
}: CreateTemplateDialogProps) {
  const locale = useCustomizerStore((s) => s.locale);
  const draft = useCustomizerStore((s) => s.draft);
  const addTemplateVariant = useCustomizerStore((s) => s.addTemplateVariant);
  const isAr = locale === "ar";

  const [base, setBase] = useState(
    VARIANT_BASES.some((b) => b.value === defaultBase)
      ? (defaultBase as string)
      : "product",
  );
  const [suffix, setSuffix] = useState("");

  const clean = suffix.trim().toLowerCase();
  const newKey = `${base}.${clean}`;
  const valid = SUFFIX_RE.test(clean);
  const exists = valid && Boolean(draft?.templates?.[newKey]);

  const handleCreate = () => {
    if (!valid || exists) return;
    const key = addTemplateVariant(base, clean);
    if (key) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isAr ? "rtl" : "ltr"} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isAr ? "إنشاء قالب بديل" : "Create template variant"}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? "انسخ قالبًا أساسيًا إلى نسخة باسم لاحقة، ثم عيّنها لمنتج أو مجموعة أو صفحة."
              : "Duplicate a base template into a named variant, then assign it to a product, collection, or page."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isAr ? "القالب الأساسي" : "Base template"}
            </Label>
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VARIANT_BASES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label[locale]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isAr ? "اللاحقة" : "Suffix"}
            </Label>
            <Input
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="wholesale"
              dir="ltr"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="opacity-60">{isAr ? "المفتاح:" : "Key:"}</span>
              <span className="font-mono text-foreground/70">
                {base}.{clean || "…"}
              </span>
            </p>
            {clean.length > 0 && !valid && (
              <p className="text-[11px] text-destructive">
                {isAr
                  ? "أحرف إنجليزية صغيرة وأرقام وشرطات فقط (تبدأ بحرف/رقم، حتى 32 حرفًا)."
                  : "Lowercase letters, numbers and hyphens only (start alphanumeric, up to 32 chars)."}
              </p>
            )}
            {exists && (
              <p className="text-[11px] text-destructive">
                {isAr ? "هذا القالب موجود بالفعل." : "That template already exists."}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={handleCreate} disabled={!valid || exists}>
            {isAr ? "إنشاء" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
