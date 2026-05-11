/**
 * PagesAndHoursPanel — three editors that ship together in the
 * "Pages & Hours" tab of StoreSettings:
 *
 *   1. Footer Sections — add/remove/edit footer columns and links.
 *      Saved into `theme_settings.footer.sections`.
 *   2. Shipping & Delivery page — delivery areas, schedule notes,
 *      free-shipping threshold, contact toggle.
 *      Saved into `theme_settings.shipping`.
 *   3. Business Hours — per-day open/close, closed toggle, timezone.
 *      Saved as a top-level `business_hours` field on the store.
 */
import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────

export interface FooterSectionLink {
  label: string;
  label_ar?: string;
  to: string;
}

export interface FooterSection {
  id: string;
  title: string;
  title_ar?: string;
  links: FooterSectionLink[];
}

export interface DeliveryArea {
  id: string;
  name: string;
  name_ar?: string;
  days_min?: number;
  days_max?: number;
  cost_min?: number;
  cost_max?: number;
}

export interface ScheduleNote {
  id: string;
  text: string;
  text_ar?: string;
}

export interface ShippingPageConfig {
  title?: string;
  title_ar?: string;
  intro?: string;
  intro_ar?: string;
  delivery_areas?: DeliveryArea[];
  schedule_notes?: ScheduleNote[];
  free_shipping_threshold?: number | null;
  show_contact_section?: boolean;
}

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface BusinessHoursDay {
  open?: string;
  close?: string;
  closed?: boolean;
}

export interface BusinessHours {
  timezone?: string;
  days?: Partial<Record<DayKey, BusinessHoursDay>>;
}

const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const DAY_LABELS: Record<DayKey, { en: string; ar: string }> = {
  mon: { en: "Monday", ar: "الإثنين" },
  tue: { en: "Tuesday", ar: "الثلاثاء" },
  wed: { en: "Wednesday", ar: "الأربعاء" },
  thu: { en: "Thursday", ar: "الخميس" },
  fri: { en: "Friday", ar: "الجمعة" },
  sat: { en: "Saturday", ar: "السبت" },
  sun: { en: "Sunday", ar: "الأحد" },
};

const TIME_OPTIONS = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

const TIMEZONE_OPTIONS = [
  "Africa/Cairo",
  "Africa/Casablanca",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Beirut",
  "Asia/Amman",
  "Europe/Istanbul",
  "Europe/London",
  "UTC",
];

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ─── Footer Sections editor ───────────────────────────────────────────────

interface FooterSectionsEditorProps {
  sections: FooterSection[];
  onChange: (sections: FooterSection[]) => void;
  language: "ar" | "en";
}

export function FooterSectionsEditor({ sections, onChange, language }: FooterSectionsEditorProps) {
  const ar = language === "ar";

  const addSection = () =>
    onChange([
      ...sections,
      { id: newId(), title: ar ? "قسم جديد" : "New Section", title_ar: "", links: [] },
    ]);
  const removeSection = (id: string) => onChange(sections.filter((s) => s.id !== id));
  const updateSection = (id: string, patch: Partial<FooterSection>) =>
    onChange(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const moveSection = (id: string, dir: -1 | 1) => {
    const idx = sections.findIndex((s) => s.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const addLink = (sectionId: string) =>
    onChange(
      sections.map((s) =>
        s.id === sectionId
          ? { ...s, links: [...s.links, { label: "", to: "/" }] }
          : s,
      ),
    );
  const updateLink = (sectionId: string, idx: number, patch: Partial<FooterSectionLink>) =>
    onChange(
      sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              links: s.links.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
            }
          : s,
      ),
    );
  const removeLink = (sectionId: string, idx: number) =>
    onChange(
      sections.map((s) =>
        s.id === sectionId
          ? { ...s, links: s.links.filter((_, i) => i !== idx) }
          : s,
      ),
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ar ? "أقسام الفوتر" : "Footer Sections"}</CardTitle>
        <CardDescription>
          {ar
            ? "اترك الحقل فارغاً لاستخدام الأقسام الافتراضية (متجر / مساعدة / تابعنا)."
            : "Leave empty to use the default Shop / Help / Follow columns. Otherwise these replace them."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {ar ? "لا توجد أقسام مخصصة." : "No custom sections yet."}
          </p>
        )}
        {sections.map((section, i) => (
          <div key={section.id} className="border rounded-lg p-4 space-y-3 bg-card">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button
                  type="button"
                  className="p-1 hover:bg-muted rounded"
                  disabled={i === 0}
                  onClick={() => moveSection(section.id, -1)}
                  aria-label="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  className="p-1 hover:bg-muted rounded"
                  disabled={i === sections.length - 1}
                  onClick={() => moveSection(section.id, 1)}
                  aria-label="Move down"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{ar ? "العنوان (إنجليزي)" : "Title (English)"}</Label>
                  <Input
                    value={section.title}
                    onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    placeholder="Shop"
                  />
                </div>
                <div>
                  <Label className="text-xs">{ar ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
                  <Input
                    value={section.title_ar || ""}
                    onChange={(e) => updateSection(section.id, { title_ar: e.target.value })}
                    placeholder="المتجر"
                    dir="rtl"
                  />
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeSection(section.id)}
                aria-label="Remove section"
              >
                <Trash2 size={16} />
              </Button>
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              {section.links.map((link, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <Label className="text-[10px] uppercase">{ar ? "النص (EN)" : "Label (EN)"}</Label>
                    <Input
                      value={link.label}
                      onChange={(e) => updateLink(section.id, idx, { label: e.target.value })}
                      placeholder="All Products"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase">{ar ? "النص (AR)" : "Label (AR)"}</Label>
                    <Input
                      value={link.label_ar || ""}
                      onChange={(e) => updateLink(section.id, idx, { label_ar: e.target.value })}
                      placeholder="كل المنتجات"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase">URL</Label>
                    <Input
                      value={link.to}
                      onChange={(e) => updateLink(section.id, idx, { to: e.target.value })}
                      placeholder="/products"
                    />
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeLink(section.id, idx)}
                    aria-label="Remove link"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addLink(section.id)}
              >
                <Plus size={14} className="mr-1" />
                {ar ? "إضافة رابط" : "Add link"}
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addSection}>
          <Plus size={16} className="mr-1" />
          {ar ? "إضافة قسم" : "Add section"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Shipping page editor ─────────────────────────────────────────────────

interface ShippingPageEditorProps {
  config: ShippingPageConfig;
  onChange: (config: ShippingPageConfig) => void;
  language: "ar" | "en";
}

export function ShippingPageEditor({ config, onChange, language }: ShippingPageEditorProps) {
  const ar = language === "ar";
  const areas = config.delivery_areas || [];
  const notes = config.schedule_notes || [];

  const update = (patch: Partial<ShippingPageConfig>) => onChange({ ...config, ...patch });

  const addArea = () =>
    update({
      delivery_areas: [
        ...areas,
        {
          id: newId(),
          name: "",
          days_min: 2,
          days_max: 4,
          cost_min: 30,
          cost_max: 50,
        },
      ],
    });
  const updateArea = (id: string, patch: Partial<DeliveryArea>) =>
    update({
      delivery_areas: areas.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  const removeArea = (id: string) =>
    update({ delivery_areas: areas.filter((a) => a.id !== id) });

  const addNote = () =>
    update({ schedule_notes: [...notes, { id: newId(), text: "" }] });
  const updateNote = (id: string, patch: Partial<ScheduleNote>) =>
    update({
      schedule_notes: notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
  const removeNote = (id: string) =>
    update({ schedule_notes: notes.filter((n) => n.id !== id) });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ar ? "صفحة الشحن والتوصيل" : "Shipping & Delivery Page"}</CardTitle>
        <CardDescription>
          {ar
            ? "تخصيص محتوى صفحة /shipping. اترك الحقول فارغة لاستخدام القيم الافتراضية."
            : "Customize the /shipping page. Leave blank to use defaults."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>{ar ? "العنوان (EN)" : "Title (EN)"}</Label>
            <Input
              value={config.title || ""}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Shipping & Delivery"
            />
          </div>
          <div>
            <Label>{ar ? "العنوان (AR)" : "Title (AR)"}</Label>
            <Input
              value={config.title_ar || ""}
              onChange={(e) => update({ title_ar: e.target.value })}
              placeholder="الشحن والتوصيل"
              dir="rtl"
            />
          </div>
          <div>
            <Label>{ar ? "وصف قصير (EN)" : "Intro (EN)"}</Label>
            <Input
              value={config.intro || ""}
              onChange={(e) => update({ intro: e.target.value })}
              placeholder="We deliver to all governorates..."
            />
          </div>
          <div>
            <Label>{ar ? "وصف قصير (AR)" : "Intro (AR)"}</Label>
            <Input
              value={config.intro_ar || ""}
              onChange={(e) => update({ intro_ar: e.target.value })}
              placeholder="نوصل لكل المحافظات..."
              dir="rtl"
            />
          </div>
        </div>

        <div>
          <Label className="text-sm font-semibold">{ar ? "مناطق التوصيل" : "Delivery Areas"}</Label>
          <div className="mt-2 space-y-3">
            {areas.map((a) => (
              <div key={a.id} className="border rounded-lg p-3 space-y-2 bg-card">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    value={a.name}
                    onChange={(e) => updateArea(a.id, { name: e.target.value })}
                    placeholder={ar ? "اسم المنطقة (EN)" : "Area name (EN)"}
                  />
                  <Input
                    value={a.name_ar || ""}
                    onChange={(e) => updateArea(a.id, { name_ar: e.target.value })}
                    placeholder={ar ? "اسم المنطقة (AR)" : "Area name (AR)"}
                    dir="rtl"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[10px]">{ar ? "أيام (من)" : "Days (min)"}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={a.days_min ?? ""}
                      onChange={(e) =>
                        updateArea(a.id, {
                          days_min: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">{ar ? "أيام (إلى)" : "Days (max)"}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={a.days_max ?? ""}
                      onChange={(e) =>
                        updateArea(a.id, {
                          days_max: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">EGP {ar ? "(من)" : "(min)"}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={a.cost_min ?? ""}
                      onChange={(e) =>
                        updateArea(a.id, {
                          cost_min: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-[10px]">EGP {ar ? "(إلى)" : "(max)"}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={a.cost_max ?? ""}
                      onChange={(e) =>
                        updateArea(a.id, {
                          cost_max: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeArea(a.id)}
                  className="text-destructive"
                >
                  <Trash2 size={14} className="mr-1" /> {ar ? "حذف" : "Remove"}
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addArea}>
              <Plus size={14} className="mr-1" /> {ar ? "إضافة منطقة" : "Add area"}
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-sm font-semibold">{ar ? "ملاحظات الجدول" : "Schedule Notes"}</Label>
          <div className="mt-2 space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <Input
                  value={n.text}
                  onChange={(e) => updateNote(n.id, { text: e.target.value })}
                  placeholder={ar ? "ملاحظة (EN)" : "Note (EN)"}
                />
                <Input
                  value={n.text_ar || ""}
                  onChange={(e) => updateNote(n.id, { text_ar: e.target.value })}
                  placeholder={ar ? "ملاحظة (AR)" : "Note (AR)"}
                  dir="rtl"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeNote(n.id)}
                  aria-label="Remove note"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addNote}>
              <Plus size={14} className="mr-1" /> {ar ? "إضافة ملاحظة" : "Add note"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div>
            <Label>{ar ? "حد الشحن المجاني (EGP)" : "Free shipping threshold (EGP)"}</Label>
            <Input
              type="number"
              min={0}
              value={config.free_shipping_threshold ?? ""}
              onChange={(e) =>
                update({
                  free_shipping_threshold:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="500"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {ar ? "اتركه فارغاً لإخفاء البطاقة." : "Leave blank to hide the banner."}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={config.show_contact_section !== false}
              onCheckedChange={(v) => update({ show_contact_section: v !== false })}
            />
            <span className="text-sm">
              {ar ? "إظهار قسم تواصل معنا" : "Show contact section"}
            </span>
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Business hours editor ────────────────────────────────────────────────

interface BusinessHoursEditorProps {
  hours: BusinessHours;
  onChange: (hours: BusinessHours) => void;
  language: "ar" | "en";
}

export function BusinessHoursEditor({ hours, onChange, language }: BusinessHoursEditorProps) {
  const ar = language === "ar";
  const days = hours.days || {};

  const updateDay = useCallback(
    (key: DayKey, patch: Partial<BusinessHoursDay>) => {
      const current = (days[key] || {}) as BusinessHoursDay;
      onChange({
        ...hours,
        days: { ...days, [key]: { ...current, ...patch } },
      });
    },
    [hours, days, onChange],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ar ? "ساعات العمل" : "Business Hours"}</CardTitle>
        <CardDescription>
          {ar
            ? "تظهر هذه الساعات في الفوتر لكل القوالب التي تدعمها، مع شارة \"مفتوح الآن\" / \"مغلق\"."
            : "These hours show in the storefront footer of every theme that supports them, with a live \"Open now\" / \"Closed\" badge."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>{ar ? "المنطقة الزمنية" : "Timezone"}</Label>
          <select
            aria-label={ar ? "المنطقة الزمنية" : "Timezone"}
            value={hours.timezone || "Africa/Cairo"}
            onChange={(e) => onChange({ ...hours, timezone: e.target.value })}
            className="mt-1 w-full md:w-72 h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          {DAY_KEYS.map((key) => {
            const d = (days[key] || {}) as BusinessHoursDay;
            const isClosed = !!d.closed;
            return (
              <div
                key={key}
                className="grid grid-cols-1 md:grid-cols-[110px_1fr_1fr_auto] gap-2 items-center border rounded-md p-2 bg-card"
              >
                <span className="font-semibold text-sm">
                  {ar ? DAY_LABELS[key].ar : DAY_LABELS[key].en}
                </span>
                <select
                  aria-label={`${ar ? DAY_LABELS[key].ar : DAY_LABELS[key].en} ${ar ? "وقت الفتح" : "open time"}`}
                  disabled={isClosed}
                  value={d.open || "09:00"}
                  onChange={(e) => updateDay(key, { open: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`${ar ? DAY_LABELS[key].ar : DAY_LABELS[key].en} ${ar ? "وقت الإغلاق" : "close time"}`}
                  disabled={isClosed}
                  value={d.close || "22:00"}
                  onChange={(e) => updateDay(key, { close: e.target.value })}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={isClosed}
                    onCheckedChange={(v) => updateDay(key, { closed: v === true })}
                  />
                  <span className="text-sm">{ar ? "مغلق" : "Closed"}</span>
                </label>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Container ────────────────────────────────────────────────────────────

interface PagesAndHoursPanelProps {
  language: "ar" | "en";
  footerSections: FooterSection[];
  onFooterSectionsChange: (s: FooterSection[]) => void;
  shippingConfig: ShippingPageConfig;
  onShippingConfigChange: (c: ShippingPageConfig) => void;
  businessHours: BusinessHours;
  onBusinessHoursChange: (h: BusinessHours) => void;
  isSaving: boolean;
  onSave: () => void;
}

export function PagesAndHoursPanel(props: PagesAndHoursPanelProps) {
  const ar = props.language === "ar";
  return (
    <div className="space-y-6">
      <div className="settings-section-header">
        <h2>{ar ? "الصفحات وساعات العمل" : "Pages & Business Hours"}</h2>
        <p>
          {ar
            ? "تحرير محتوى الفوتر وصفحة الشحن وساعات العمل التي يراها العميل."
            : "Edit the footer columns, the Shipping & Delivery page, and the business hours your customers see."}
        </p>
      </div>

      <FooterSectionsEditor
        sections={props.footerSections}
        onChange={props.onFooterSectionsChange}
        language={props.language}
      />

      <ShippingPageEditor
        config={props.shippingConfig}
        onChange={props.onShippingConfigChange}
        language={props.language}
      />

      <BusinessHoursEditor
        hours={props.businessHours}
        onChange={props.onBusinessHoursChange}
        language={props.language}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={props.onSave} disabled={props.isSaving}>
          {props.isSaving
            ? ar
              ? "جارٍ الحفظ..."
              : "Saving..."
            : ar
              ? "حفظ التغييرات"
              : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
