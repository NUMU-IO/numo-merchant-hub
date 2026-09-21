/**
 * Product requests — what shoppers asked the store to find for them.
 *
 * The storefront's request form writes these (a title, an ISBN, photos of a
 * cover from somewhere else). This is where the merchant works through them:
 * read it, reach the shopper by email, WhatsApp or phone, and move it along
 * as they go. Each one is a lead with a price attached, so the page is built
 * around answering rather than around bookkeeping — the contact buttons are
 * the loudest thing on a card.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  PRODUCT_REQUEST_STATUSES,
  deleteProductRequest,
  listProductRequests,
  updateProductRequest,
  type ProductRequest,
  type ProductRequestStatus,
} from "@/services/productRequestApi";

const STATUS_STYLE: Record<ProductRequestStatus, string> = {
  new: "bg-saffron/20 text-saffron-700 dark:text-saffron",
  contacted: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  sourced: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
};

const LABEL: Record<ProductRequestStatus, { en: string; ar: string }> = {
  new: { en: "New", ar: "جديد" },
  contacted: { en: "Contacted", ar: "تم التواصل" },
  sourced: { en: "Found", ar: "تم إيجاده" },
  closed: { en: "Closed", ar: "مغلق" },
};

/** Digits only — what a wa.me link needs. */
const waNumber = (phone: string) => phone.replace(/[^\d]/g, "");

export default function ProductRequestsPage() {
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const storeId = currentStore?.id;

  const [items, setItems] = useState<ProductRequest[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [filter, setFilter] = useState<ProductRequestStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async (status: ProductRequestStatus | "all") => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await listProductRequests(storeId, {
        status: status === "all" ? undefined : status,
        limit: 100,
      });
      setItems(data.items);
      setNewCount(data.new_count);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isAr
            ? "تعذّر تحميل الطلبات"
            : "Could not load requests",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, filter]);

  const patch = async (
    request: ProductRequest,
    changes: { status?: ProductRequestStatus; note?: string },
  ) => {
    if (!storeId) return;
    setBusyId(request.id);
    // Optimistic: the merchant is clicking through a list, and a round-trip
    // per click would make the status buttons feel broken.
    const before = items;
    setItems((rows) =>
      rows.map((row) => (row.id === request.id ? { ...row, ...changes } : row)),
    );
    try {
      const saved = await updateProductRequest(storeId, request.id, changes);
      setItems((rows) => rows.map((row) => (row.id === saved.id ? saved : row)));
      if (changes.status) {
        setNewCount((count) =>
          changes.status === "new"
            ? count + (request.status === "new" ? 0 : 1)
            : Math.max(0, count - (request.status === "new" ? 1 : 0)),
        );
      }
    } catch (error) {
      setItems(before);
      toast.error(
        error instanceof Error
          ? error.message
          : isAr
            ? "تعذّر الحفظ"
            : "Could not save",
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (request: ProductRequest) => {
    if (!storeId) return;
    setBusyId(request.id);
    try {
      await deleteProductRequest(storeId, request.id);
      setItems((rows) => rows.filter((row) => row.id !== request.id));
      if (request.status === "new") setNewCount((count) => Math.max(0, count - 1));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isAr
            ? "تعذّر الحذف"
            : "Could not delete",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">
          {isAr ? "طلبات المنتجات" : "Product requests"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "الكتب اللي الزباين طلبوا منك تجيبها من الفورم في المتجر."
            : "What shoppers asked you to find, from the request form on your storefront."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "secondary" : "ghost"}
          onClick={() => setFilter("all")}
        >
          {isAr ? "الكل" : "All"}
          {newCount > 0 && (
            <span className="ms-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-saffron px-1.5 text-[11px] font-bold text-navy-900">
              {newCount}
            </span>
          )}
        </Button>
        {PRODUCT_REQUEST_STATUSES.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={filter === status ? "secondary" : "ghost"}
            onClick={() => setFilter(status)}
          >
            {isAr ? LABEL[status].ar : LABEL[status].en}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">
              {isAr ? "مفيش طلبات هنا" : "Nothing here yet"}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {isAr
                ? "لما زبون يبعت طلب من فورم «بتدور على كتاب معيّن؟» هيظهر هنا."
                : "When a shopper sends the “looking for a specific book?” form, it lands here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              isAr={isAr}
              busy={busyId === request.id}
              onPatch={(changes) => void patch(request, changes)}
              onDelete={() => void remove(request)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  isAr,
  busy,
  onPatch,
  onDelete,
}: {
  request: ProductRequest;
  isAr: boolean;
  busy: boolean;
  onPatch: (changes: { status?: ProductRequestStatus; note?: string }) => void;
  onDelete: () => void;
}) {
  const [note, setNote] = useState(request.note ?? "");
  const [shot, setShot] = useState<string | null>(null);
  const when = new Date(request.created_at);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{request.name}</span>
              <Badge
                variant="outline"
                className={`border-0 text-[11px] ${STATUS_STYLE[request.status]}`}
              >
                {LABEL[request.status]?.[isAr ? "ar" : "en"] ?? request.status}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {when.toLocaleString(isAr ? "ar-EG" : undefined)}
              {request.source_url && (
                <>
                  {" · "}
                  <a
                    href={request.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    {isAr ? "الصفحة" : "Page"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={`mailto:${request.email}`}>
                <Mail className="me-1.5 h-3.5 w-3.5" />
                {isAr ? "إيميل" : "Email"}
              </a>
            </Button>
            {request.phone && (
              <>
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`https://wa.me/${waNumber(request.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="me-1.5 h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`tel:${request.phone}`}>
                    <Phone className="me-1.5 h-3.5 w-3.5" />
                    {isAr ? "اتصال" : "Call"}
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>

        <p className="whitespace-pre-wrap text-sm">{request.details}</p>

        <p className="text-xs text-muted-foreground">
          {request.email}
          {request.phone ? ` · ${request.phone}` : ""}
        </p>

        {request.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {request.images.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setShot(src)}
                className="h-20 w-20 overflow-hidden rounded-lg ring-1 ring-border/60 transition-transform hover:scale-[1.03]"
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
          {PRODUCT_REQUEST_STATUSES.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={request.status === status ? "secondary" : "ghost"}
              disabled={busy}
              onClick={() => onPatch({ status })}
            >
              {isAr ? LABEL[status].ar : LABEL[status].en}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onDelete}
            className="ms-auto text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              isAr ? "ملاحظة داخلية (الزبون مش بيشوفها)" : "Internal note (the shopper never sees this)"
            }
            rows={2}
            className="text-sm"
          />
          {note !== (request.note ?? "") && (
            <Button size="sm" disabled={busy} onClick={() => onPatch({ note })}>
              {busy ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {isAr ? "احفظ الملاحظة" : "Save note"}
            </Button>
          )}
        </div>
      </CardContent>

      {shot && (
        // Full-size look at one photo. A plain overlay rather than a dialog:
        // the only thing it does is show the picture and close again.
        <button
          type="button"
          onClick={() => setShot(null)}
          aria-label={isAr ? "إغلاق" : "Close"}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
        >
          <img
            src={shot}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </button>
      )}
    </Card>
  );
}
