/**
 * Custom-field (metafield) values on the product editor.
 *
 * Renders one typed input per PRODUCT-owner definition the store has
 * declared, seeded with the product's current values, and upserts changed
 * values (or unsets cleared ones) on save. Self-contained and edit-mode
 * only — it needs a persisted productId to own values against, mirroring
 * BundleManager / VariantsEditor.
 */
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import { toast } from "sonner";
import {
  listMetafieldDefinitions,
  listOwnerMetafieldValues,
  setOwnerMetafieldValue,
  unsetOwnerMetafieldValue,
  type MetafieldDefinition,
} from "@/services/metafieldsApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Tag } from "lucide-react";

interface Props {
  storeId: string | undefined;
  productId: string | undefined;
  isEditMode: boolean;
}

/** Stringify a stored value for the text/number/date/json inputs. */
function toInputString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function MetafieldValuesCard({ storeId, productId, isEditMode }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [definitions, setDefinitions] = useState<MetafieldDefinition[]>([]);
  const [values, setValues] = useState<Record<string, string>>({}); // definition.id → raw string
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!storeId || !productId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [defs, vals] = await Promise.all([
          listMetafieldDefinitions(storeId, "product"),
          listOwnerMetafieldValues(storeId, "product", productId),
        ]);
        if (cancelled) return;
        setDefinitions(defs);
        const byDef: Record<string, string> = {};
        for (const v of vals) {
          const def = defs.find((d) => d.namespace === v.namespace && d.key === v.key);
          if (def) byDef[def.id] = toInputString(v.value);
        }
        setValues(byDef);
      } catch (err) {
        if (!cancelled) showError(err, language);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId, productId, language]);

  // Snapshot of what was loaded, to compute the diff on save.
  const [initial, setInitial] = useState<Record<string, string>>({});
  useEffect(() => { setInitial(values); /* eslint-disable-next-line */ }, [loading]);

  const dirty = useMemo(
    () => definitions.some((d) => (values[d.id] ?? "") !== (initial[d.id] ?? "")),
    [definitions, values, initial],
  );

  const handleSave = async () => {
    if (!storeId || !productId || saving) return;
    setSaving(true);
    try {
      for (const d of definitions) {
        const next = (values[d.id] ?? "").trim();
        const prev = (initial[d.id] ?? "").trim();
        if (next === prev) continue;
        if (next === "") {
          await unsetOwnerMetafieldValue(storeId, "product", productId, d.namespace, d.key);
        } else {
          // The backend validates + coerces against the declared type; a
          // bad value (e.g. non-number) returns 422 with a clear message.
          const parsed =
            d.type === "number" ? Number(next)
            : d.type === "boolean" ? next === "true"
            : d.type === "json" ? JSON.parse(next)
            : next;
          await setOwnerMetafieldValue(storeId, "product", productId, {
            namespace: d.namespace, key: d.key, value: parsed,
          });
        }
      }
      setInitial(values);
      toast.success(isAr ? "تم حفظ الحقول المخصصة" : "Custom fields saved");
    } catch (err) {
      showError(err, language);
    } finally {
      setSaving(false);
    }
  };

  if (!isEditMode) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            {isAr ? "الحقول المخصصة" : "Custom fields"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {isAr ? "احفظ المنتج أولاً لإضافة الحقول المخصصة" : "Save the product first to add custom fields"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (definitions.length === 0) return null; // no product custom fields defined — hide entirely

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" />
              {isAr ? "الحقول المخصصة" : "Custom fields"}
            </CardTitle>
            <CardDescription className="text-xs">
              {isAr ? "قيم إضافية معرّفة في الإعدادات ← الحقول المخصصة" : "Extra values defined in Settings → Custom fields"}
            </CardDescription>
          </div>
          <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={!dirty || saving}>
            {saving && <Loader2 className="h-3 w-3 animate-spin me-1" />}
            {isAr ? "حفظ" : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {definitions.map((d) => (
          <div key={d.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium">{d.name}</Label>
              {!d.is_public && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">
                  {isAr ? "خاص" : "Private"}
                </Badge>
              )}
            </div>
            {d.type === "multi_line_text" || d.type === "json" ? (
              <Textarea
                value={values[d.id] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [d.id]: e.target.value }))}
                rows={2}
                dir={d.type === "json" ? "ltr" : undefined}
                className={`resize-none rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border ${d.type === "json" ? "font-mono text-xs" : ""}`}
                placeholder={d.description ?? ""}
              />
            ) : d.type === "boolean" ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values[d.id] === "true"}
                  onChange={(e) => setValues((p) => ({ ...p, [d.id]: e.target.checked ? "true" : "false" }))}
                  className="h-4 w-4 rounded accent-primary"
                />
                <span className="text-xs text-muted-foreground">{d.description ?? (isAr ? "مفعّل" : "Enabled")}</span>
              </label>
            ) : (
              <Input
                value={values[d.id] ?? ""}
                onChange={(e) => setValues((p) => ({ ...p, [d.id]: e.target.value }))}
                type={d.type === "number" ? "number" : d.type === "date" ? "date" : d.type === "url" ? "url" : "text"}
                dir={d.type === "url" ? "ltr" : undefined}
                className="h-9 rounded-lg bg-muted/30 border-transparent focus:bg-background focus:border-border text-sm"
                placeholder={d.description ?? ""}
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
