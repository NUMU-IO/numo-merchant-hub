import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { listTemplates, type WhatsAppTemplate } from "@/services/templatesApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppTemplatePreview } from "@/components/whatsapp/WhatsAppTemplatePreview";
import { toast } from "sonner";
import { Search, Plus, Eye, RefreshCw, FileText } from "lucide-react";

type StatusFilter = "ALL" | "APPROVED" | "PENDING" | "REJECTED";

const STATUS_FILTERS: Array<{ key: StatusFilter; en: string; ar: string }> = [
  { key: "ALL", en: "All", ar: "الكل" },
  { key: "APPROVED", en: "Approved", ar: "معتمد" },
  { key: "PENDING", en: "Pending", ar: "قيد المراجعة" },
  { key: "REJECTED", en: "Rejected", ar: "مرفوض" },
];

// Short body preview — the first BODY component's text.
function templateBody(t: WhatsAppTemplate): string {
  const body = t.components?.find((c) => c.type === "BODY");
  return body?.text || "";
}

function statusBadgeClass(s: string): string {
  switch (s) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "PENDING":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
    case "REJECTED":
      return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function WhatsAppTemplates() {
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const navigate = useNavigate();
  const storeId = currentStore?.id;

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await listTemplates(storeId);
      setTemplates(res.templates);
    } catch {
      toast.error(isAr ? "فشل تحميل القوالب" : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [storeId, isAr]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { ALL: templates.length, APPROVED: 0, PENDING: 0, REJECTED: 0 };
    for (const t of templates) {
      if (t.status === "APPROVED") c.APPROVED++;
      else if (t.status === "PENDING") c.PENDING++;
      else if (t.status === "REJECTED") c.REJECTED++;
    }
    return c;
  }, [templates]);

  const filtered = useMemo(
    () =>
      templates.filter((t) => {
        const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [templates, search, statusFilter]
  );

  return (
    <>
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6" dir={dir}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isAr ? "قوالب واتساب" : "WhatsApp templates"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAr
                ? "القوالب التي اعتمدتها Meta لرسائلك — عاينها كما يراها العميل."
                : "The Meta-approved templates behind your messages — preview them exactly as a customer sees them."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadTemplates} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              {isAr ? "تحديث" : "Refresh"}
            </Button>
            <Button size="sm" onClick={() => navigate("/channels/whatsapp/templates/new")} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {isAr ? "قالب جديد" : "New"}
            </Button>
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {isAr ? f.ar : f.en}
                <span className={`tabular-nums ${active ? "opacity-80" : "opacity-60"}`}>{counts[f.key]}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={isAr ? "ابحث عن قالب..." : "Search templates..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Gallery */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
              <FileText className="h-8 w-8 mb-3 opacity-40" />
              <p>{isAr ? "لا توجد قوالب مطابقة." : "No matching templates."}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setPreviewTemplate(t)}
                className="group flex flex-col gap-2 rounded-xl border p-4 text-start transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t.category} · {t.language}
                  </span>
                  <Badge className={`border-0 text-[10px] ${statusBadgeClass(t.status)}`} variant="secondary">
                    {t.status}
                  </Badge>
                </div>
                <p className="font-medium text-sm truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-3 min-h-[2.5rem]">{templateBody(t)}</p>
                <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <Eye className="h-3.5 w-3.5" />
                  {isAr ? "معاينة" : "Preview"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {previewTemplate && (
        <WhatsAppTemplatePreview
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          isAr={isAr}
        />
      )}
    </>
  );
}
