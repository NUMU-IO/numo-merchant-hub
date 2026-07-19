/**
 * Settings → Custom fields (metafields).
 *
 * Merchant surface for DEFINING typed custom fields per resource type
 * (product / collection / page). Public definitions become bindable
 * dynamic sources in the V3 theme editor and reach storefronts; private
 * ones stay merchant-only. Values are set per product on the product page.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SettingsBreadcrumb } from "@/components/layout/SettingsBreadcrumb";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { showError } from "@/lib/show-error";
import { toast } from "sonner";
import {
  listMetafieldDefinitions,
  createMetafieldDefinition,
  deleteMetafieldDefinition,
  type MetafieldDefinition,
  type MetafieldOwnerType,
  type MetafieldType,
} from "@/services/metafieldsApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Tag } from "lucide-react";

const OWNER_TYPES: { value: MetafieldOwnerType; en: string; ar: string }[] = [
  { value: "product", en: "Product", ar: "المنتج" },
  { value: "collection", en: "Collection", ar: "المجموعة" },
  { value: "page", en: "Page", ar: "الصفحة" },
];

const FIELD_TYPES: { value: MetafieldType; en: string; ar: string }[] = [
  { value: "single_line_text", en: "Text", ar: "نص" },
  { value: "multi_line_text", en: "Multi-line text", ar: "نص متعدد الأسطر" },
  { value: "number", en: "Number", ar: "رقم" },
  { value: "boolean", en: "True / False", ar: "صح / خطأ" },
  { value: "url", en: "URL", ar: "رابط" },
  { value: "date", en: "Date", ar: "تاريخ" },
  { value: "json", en: "JSON", ar: "JSON" },
];

/** namespace.key must match the backend pattern (lowercase, dot-safe). */
function slugKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

export default function SettingsMetafields() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [ownerType, setOwnerType] = useState<MetafieldOwnerType>("product");
  const [fieldType, setFieldType] = useState<MetafieldType>("single_line_text");
  const [name, setName] = useState("");
  const [namespace, setNamespace] = useState("custom");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [keyTouched, setKeyTouched] = useState(false);

  // Auto-derive key from name until the merchant edits it directly.
  useEffect(() => {
    if (!keyTouched) setKey(slugKey(name));
  }, [name, keyTouched]);

  const { data: definitions = [], isLoading } = useQuery({
    queryKey: ["metafield-definitions", storeId],
    queryFn: () => listMetafieldDefinitions(storeId!),
    enabled: !!storeId,
  });

  const grouped = useMemo(() => {
    const out: Record<MetafieldOwnerType, MetafieldDefinition[]> = {
      product: [], collection: [], page: [],
    };
    for (const d of definitions) out[d.owner_type]?.push(d);
    return out;
  }, [definitions]);

  const create = useMutation({
    mutationFn: () =>
      createMetafieldDefinition(storeId!, {
        owner_type: ownerType,
        namespace: slugKey(namespace) || "custom",
        key: slugKey(key),
        type: fieldType,
        name: name.trim(),
        description: description.trim() || undefined,
        is_public: isPublic,
      }),
    onSuccess: () => {
      toast.success(isAr ? "تم إنشاء الحقل" : "Field created");
      qc.invalidateQueries({ queryKey: ["metafield-definitions", storeId] });
      setDialogOpen(false);
      setName(""); setKey(""); setDescription(""); setKeyTouched(false);
    },
    onError: (err) => showError(err, language),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMetafieldDefinition(storeId!, id),
    onSuccess: () => {
      toast.success(isAr ? "تم الحذف" : "Field deleted");
      qc.invalidateQueries({ queryKey: ["metafield-definitions", storeId] });
    },
    onError: (err) => showError(err, language),
  });

  const canSubmit = name.trim().length > 0 && slugKey(key).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SettingsBreadcrumb current={isAr ? "الحقول المخصصة" : "Custom fields"} />
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
            {isAr ? "الحقول المخصصة" : "Custom fields"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {isAr
              ? "عرّف حقول بيانات إضافية لمنتجاتك ومجموعاتك وصفحاتك. الحقول العامة يمكن ربطها في محرر الثيم وتظهر في المتجر؛ الحقول الخاصة تبقى داخلية فقط."
              : "Define extra data fields for products, collections and pages. Public fields can be bound in the theme editor and shown on your storefront; private fields stay internal."}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5 shrink-0" disabled={!storeId}>
          <Plus className="h-4 w-4" />
          {isAr ? "حقل جديد" : "New field"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : definitions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
              <Tag className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              {isAr ? "لا توجد حقول مخصصة بعد" : "No custom fields yet"}
            </p>
            <p className="text-[13px] text-muted-foreground/70 max-w-sm">
              {isAr
                ? "مثال: \"درجة الحرارة\" لمنتجات الطعام، أو \"مدة الضمان\" للإلكترونيات."
                : "e.g. \"Spice level\" for food products, or \"Warranty months\" for electronics."}
            </p>
          </CardContent>
        </Card>
      ) : (
        OWNER_TYPES.map((ot) =>
          grouped[ot.value].length === 0 ? null : (
            <Card key={ot.value}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{isAr ? ot.ar : ot.en}</CardTitle>
                <CardDescription className="text-xs">
                  {grouped[ot.value].length} {isAr ? "حقل" : "field(s)"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {grouped[ot.value].map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/[0.03] px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{d.name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {FIELD_TYPES.find((t) => t.value === d.type)?.[isAr ? "ar" : "en"] ?? d.type}
                        </Badge>
                        {d.is_public ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-600/30">
                            {isAr ? "عام" : "Public"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                            {isAr ? "خاص" : "Private"}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">{d.namespace}.{d.key}</span>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => remove.mutate(d.id)}
                      disabled={remove.isPending}
                      aria-label={isAr ? "حذف الحقل" : "Delete field"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ),
        )
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isAr ? "حقل مخصص جديد" : "New custom field"}</DialogTitle>
            <DialogDescription>
              {isAr ? "عرّف حقل بيانات إضافي لمواردك." : "Define an extra data field for your resources."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{isAr ? "النوع (المورد)" : "Applies to"}</Label>
                <Select value={ownerType} onValueChange={(v) => setOwnerType(v as MetafieldOwnerType)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OWNER_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{isAr ? o.ar : o.en}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isAr ? "نوع البيانات" : "Data type"}</Label>
                <Select value={fieldType} onValueChange={(v) => setFieldType(v as MetafieldType)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{isAr ? t.ar : t.en}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isAr ? "الاسم" : "Name"}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isAr ? "مثال: مدة الضمان" : "e.g. Warranty months"} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{isAr ? "النطاق (namespace)" : "Namespace"}</Label>
                <Input value={namespace} onChange={(e) => setNamespace(e.target.value)} dir="ltr" className="h-9 font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isAr ? "المفتاح (key)" : "Key"}</Label>
                <Input value={key} onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }} dir="ltr" className="h-9 font-mono text-xs" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/70 -mt-1.5">
              {isAr ? "المعرّف: " : "Identifier: "}<span className="font-mono">{slugKey(namespace) || "custom"}.{slugKey(key) || "…"}</span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">{isAr ? "الوصف (اختياري)" : "Description (optional)"}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="resize-none" />
            </div>
            <label className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-primary" />
              <div>
                <div className="text-[13px] font-medium">{isAr ? "عام (يظهر في المتجر)" : "Public (visible on storefront)"}</div>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  {isAr
                    ? "الحقول العامة يمكن ربطها في محرر الثيم. الحقول الخاصة تبقى داخلية ولا تصل للعملاء أبداً."
                    : "Public fields can be bound in the theme editor. Private fields stay internal and never reach shoppers."}
                </p>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{isAr ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={() => create.mutate()} disabled={!canSubmit || create.isPending} className="gap-1.5">
              {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isAr ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
