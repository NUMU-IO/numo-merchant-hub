/**
 * LinkPicker — Shopify-style "choose a destination" replacement for
 * the bare URL input in `url`-type settings.
 *
 * Why this exists: merchants type things like "shop" or "products" into
 * the URL field, then can't figure out why their button doesn't work.
 * Shopify solved this years ago — a link picker that lets the merchant
 * pick FROM A LIST (products, collections, pages, common destinations)
 * and produces the right URL behind the scenes. Raw URL input stays as
 * a fallback for off-site links.
 *
 * **Stored value contract:**
 *   The stored setting value remains a plain URL string. That means:
 *     - "/cart" for a cart link
 *     - "/product/<id>" for a product
 *     - "/pages/<slug>" for a CMS page
 *     - "https://example.com" for an external link
 *     - "mailto:hello@store.com" for email
 *     - "tel:+201234567890" for a phone link
 *     - "https://wa.me/201234567890" for WhatsApp
 *
 *   This is critical: existing themes that consume the URL via plain
 *   `href` keep working. The picker is purely an authoring affordance.
 *
 * **Resolution back into the picker:**
 *   When opening the dialog, we sniff the current value to default to
 *   the right tab (e.g. "/product/abc" → opens on the Product tab with
 *   abc resolved). Best-effort; falls back to External URL when the
 *   shape doesn't match anything.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Link2,
  Globe,
  ShoppingBag,
  FolderOpen,
  FileText,
  Mail,
  Phone,
  MessageCircle,
  Home,
  Search,
  Loader2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { listProducts } from "@/services/productApi";
import { listCategories } from "@/services/categoryApi";
import { getStore } from "@/services/storeApi";
import type { EditorLocale } from "../../types";

// ─── Common shortcuts ─────────────────────────────────────────────────

interface CommonRoute {
  id: string;
  url: string;
  label: { en: string; ar: string };
  icon: typeof Home;
}

const COMMON_ROUTES: CommonRoute[] = [
  { id: "home", url: "/", label: { en: "Home", ar: "الرئيسية" }, icon: Home },
  {
    id: "all-products",
    url: "/products",
    label: { en: "All products", ar: "كل المنتجات" },
    icon: ShoppingBag,
  },
  {
    id: "cart",
    url: "/cart",
    label: { en: "Cart", ar: "السلة" },
    icon: ShoppingBag,
  },
  {
    id: "contact",
    url: "/contact",
    label: { en: "Contact", ar: "تواصل" },
    icon: Phone,
  },
  {
    id: "about",
    url: "/about",
    label: { en: "About", ar: "عن المتجر" },
    icon: FileText,
  },
  {
    id: "faq",
    url: "/faq",
    label: { en: "FAQ", ar: "الأسئلة الشائعة" },
    icon: FileText,
  },
];

// ─── Tab definitions ──────────────────────────────────────────────────

type TabId =
  | "common"
  | "product"
  | "collection"
  | "page"
  | "external"
  | "email"
  | "phone"
  | "whatsapp";

const TAB_ORDER: TabId[] = [
  "common",
  "product",
  "collection",
  "page",
  "external",
  "email",
  "phone",
  "whatsapp",
];

const TAB_LABELS: Record<TabId, { en: string; ar: string; icon: typeof Home }> = {
  common: { en: "Common", ar: "شائعة", icon: Home },
  product: { en: "Product", ar: "منتج", icon: ShoppingBag },
  collection: { en: "Collection", ar: "مجموعة", icon: FolderOpen },
  page: { en: "Page", ar: "صفحة", icon: FileText },
  external: { en: "External URL", ar: "رابط خارجي", icon: Globe },
  email: { en: "Email", ar: "بريد", icon: Mail },
  phone: { en: "Phone", ar: "هاتف", icon: Phone },
  whatsapp: { en: "WhatsApp", ar: "واتساب", icon: MessageCircle },
};

// ─── Value sniffing — pick the right tab for an existing value ──────

function sniffTab(value: string): TabId {
  if (!value) return "common";
  if (value.startsWith("mailto:")) return "email";
  if (value.startsWith("tel:")) return "phone";
  if (value.startsWith("https://wa.me/") || value.startsWith("https://api.whatsapp.com/"))
    return "whatsapp";
  if (value.startsWith("/product/")) return "product";
  if (value.startsWith("/products?collection=") || value.startsWith("/collections/")) {
    return "collection";
  }
  if (value.startsWith("/pages/")) return "page";
  if (value.startsWith("http://") || value.startsWith("https://")) return "external";
  // Single-segment relative URLs ("/cart", "/products", "/about") — match
  // against the common routes list before falling back.
  if (COMMON_ROUTES.some((r) => r.url === value)) return "common";
  return "external";
}

// ─── Trigger button ──────────────────────────────────────────────────

/**
 * Public entry point used by SettingInputV3's `url` case. Shows the
 * current target as a chip + opens the picker dialog on click. The
 * underlying stored value is always a plain URL string.
 */
export function LinkPickerButton({
  value,
  locale,
  onChange,
  storeId,
  placeholder,
}: {
  value: string;
  locale: EditorLocale;
  onChange: (next: string) => void;
  storeId?: string;
  placeholder?: string;
}) {
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);

  // Friendly label for the current value — "Product: Red shirt" beats
  // "/product/abc-123" in the trigger UI. We only compute a friendly
  // label for the well-known patterns; everything else displays the raw
  // URL.
  const friendly = useMemo(() => describeValue(value, isAr), [value, isAr]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "w-full justify-start gap-2 text-start font-normal",
          !value && "text-muted-foreground",
        )}
        onClick={() => setOpen(true)}
      >
        <Link2 className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">
          {value ? friendly : placeholder || (isAr ? "اختر وجهة..." : "Choose destination…")}
        </span>
        {value && (
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            aria-label={isAr ? "مسح" : "Clear"}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </Button>
      <LinkPickerDialog
        open={open}
        onOpenChange={setOpen}
        value={value}
        onChange={onChange}
        locale={locale}
        storeId={storeId}
      />
    </>
  );
}

function describeValue(value: string, isAr: boolean): string {
  if (!value) return "";
  if (value.startsWith("mailto:")) return value.slice("mailto:".length);
  if (value.startsWith("tel:")) return value.slice("tel:".length);
  if (value.startsWith("https://wa.me/")) {
    return `WhatsApp: ${value.slice("https://wa.me/".length)}`;
  }
  const common = COMMON_ROUTES.find((r) => r.url === value);
  if (common) return common.label[isAr ? "ar" : "en"];
  // Generic short-form for product/collection/page paths.
  if (value.startsWith("/product/")) return `${isAr ? "منتج" : "Product"}: ${value.slice("/product/".length)}`;
  if (value.startsWith("/collections/")) return `${isAr ? "مجموعة" : "Collection"}: ${value.slice("/collections/".length)}`;
  if (value.startsWith("/pages/")) return `${isAr ? "صفحة" : "Page"}: ${value.slice("/pages/".length)}`;
  return value;
}

// ─── The dialog ──────────────────────────────────────────────────────

function LinkPickerDialog({
  open,
  onOpenChange,
  value,
  onChange,
  locale,
  storeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (next: string) => void;
  locale: EditorLocale;
  storeId?: string;
}) {
  const isAr = locale === "ar";
  const [tab, setTab] = useState<TabId>(() => sniffTab(value));

  // Re-sniff every time the dialog re-opens so editing an existing
  // value lands on the right tab without needing to manually pick.
  useEffect(() => {
    if (open) setTab(sniffTab(value));
  }, [open, value]);

  function commit(next: string) {
    onChange(next);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{isAr ? "اختر وجهة" : "Choose destination"}</DialogTitle>
        </DialogHeader>

        {/* Tab strip — horizontal scroll on narrow screens. */}
        <div
          role="tablist"
          aria-label={isAr ? "نوع الوجهة" : "Destination type"}
          className="flex flex-wrap gap-1 border-b pb-2"
        >
          {TAB_ORDER.map((id) => {
            const t = TAB_LABELS[id];
            const isActive = tab === id;
            const Icon = t.icon;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive ? "true" : "false"}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t[isAr ? "ar" : "en"]}</span>
              </button>
            );
          })}
        </div>

        {/* Tab body */}
        <div className="max-h-[60vh] overflow-y-auto">
          {tab === "common" && (
            <CommonTab onPick={commit} isAr={isAr} current={value} />
          )}
          {tab === "product" && storeId && (
            <ProductTab
              onPick={commit}
              isAr={isAr}
              storeId={storeId}
              current={value}
            />
          )}
          {tab === "collection" && storeId && (
            <CollectionTab
              onPick={commit}
              isAr={isAr}
              storeId={storeId}
              current={value}
            />
          )}
          {tab === "page" && storeId && (
            <PageTab onPick={commit} isAr={isAr} storeId={storeId} current={value} />
          )}
          {tab === "external" && (
            <ExternalTab onPick={commit} isAr={isAr} current={value} />
          )}
          {tab === "email" && (
            <EmailTab onPick={commit} isAr={isAr} current={value} />
          )}
          {tab === "phone" && (
            <PhoneTab onPick={commit} isAr={isAr} current={value} />
          )}
          {tab === "whatsapp" && (
            <WhatsAppTab onPick={commit} isAr={isAr} current={value} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Per-tab bodies ──────────────────────────────────────────────────

function CommonTab({
  onPick,
  isAr,
  current,
}: {
  onPick: (url: string) => void;
  isAr: boolean;
  current: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 p-1">
      {COMMON_ROUTES.map((r) => {
        const Icon = r.icon;
        const isSelected = current === r.url;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onPick(r.url)}
            className={cn(
              "flex items-center gap-2 rounded-md border p-3 text-start text-sm transition-colors",
              isSelected
                ? "border-primary bg-primary/5"
                : "hover:border-primary/40 hover:bg-muted/50",
            )}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">{r.label[isAr ? "ar" : "en"]}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {r.url}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ProductTab({
  onPick,
  isAr,
  storeId,
  current,
}: {
  onPick: (url: string) => void;
  isAr: boolean;
  storeId: string;
  current: string;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Array<{ id: string; name?: string; slug?: string; primary_image?: string | null }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listProducts(storeId, { search: query, limit: 20 })
      .then((res) => {
        if (cancelled) return;
        const list = ((res as { items?: unknown[]; products?: unknown[] }).items ??
          (res as { products?: unknown[] }).products ??
          []) as typeof items;
        setItems(list);
      })
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [storeId, query]);

  return (
    <div className="p-1 space-y-2">
      <div className="relative">
        <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isAr ? "ابحث عن منتج..." : "Search products…"}
          className="ps-8 h-9"
          autoFocus
        />
      </div>
      {loading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      {!loading && items.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {isAr ? "لا توجد منتجات." : "No products found."}
        </p>
      )}
      <ul className="space-y-1">
        {items.map((p) => {
          const url = `/product/${p.slug ?? p.id}`;
          const isSelected = current === url;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(url)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border p-2 text-start text-sm transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/40 hover:bg-muted/50",
                )}
              >
                {p.primary_image ? (
                  <img
                    src={p.primary_image}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded bg-muted" />
                )}
                <span className="flex-1 truncate">{p.name ?? p.id}</span>
                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[40%]">
                  {url}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CollectionTab({
  onPick,
  isAr,
  storeId,
  current,
}: {
  onPick: (url: string) => void;
  isAr: boolean;
  storeId: string;
  current: string;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Array<{ id: string; name: string; slug?: string; image_url?: string | null }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCategories(storeId)
      .then((list) => {
        if (cancelled) return;
        setItems(list as typeof items);
      })
      .catch(() => !cancelled && setItems([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.slug ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="p-1 space-y-2">
      <div className="relative">
        <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isAr ? "ابحث عن مجموعة..." : "Search collections…"}
          className="ps-8 h-9"
          autoFocus
        />
      </div>
      {loading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {isAr ? "لا توجد مجموعات." : "No collections found."}
        </p>
      )}
      <ul className="space-y-1">
        {filtered.map((c) => {
          // Storefront routes collections via /products?collection=<slug>
          // when there's no dedicated /collections/<slug> page. Empire
          // V3 supports both; we emit the path-segment form which
          // matches the bazaar's middleware routing.
          const slug = c.slug ?? c.id;
          const url = `/collections/${slug}`;
          const isSelected = current === url;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(url)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border p-2 text-start text-sm transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/40 hover:bg-muted/50",
                )}
              >
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <FolderOpen className="h-5 w-5 text-muted-foreground mx-1.5" />
                )}
                <span className="flex-1 truncate">{c.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[40%]">
                  {url}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface StorePage {
  id: string;
  title: string;
  titleAr?: string;
  slug: string;
  published?: boolean;
}

function PageTab({
  onPick,
  isAr,
  storeId,
  current,
}: {
  onPick: (url: string) => void;
  isAr: boolean;
  storeId: string;
  current: string;
}) {
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<StorePage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getStore(storeId)
      .then((store) => {
        if (cancelled) return;
        const list =
          (((store as { settings?: { pages?: unknown[] } }).settings?.pages ??
            []) as StorePage[]);
        setPages(list);
      })
      .catch(() => !cancelled && setPages([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return pages;
    return pages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.titleAr ?? "").toLowerCase().includes(q) ||
        p.slug.includes(q),
    );
  }, [pages, query]);

  return (
    <div className="p-1 space-y-2">
      <div className="relative">
        <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={isAr ? "ابحث عن صفحة..." : "Search pages…"}
          className="ps-8 h-9"
          autoFocus
        />
      </div>
      {loading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {isAr
            ? "لا توجد صفحات. أضف صفحة من إعدادات المتجر."
            : "No pages found. Add pages from store settings."}
        </p>
      )}
      <ul className="space-y-1">
        {filtered.map((p) => {
          const url = `/pages/${p.slug}`;
          const isSelected = current === url;
          const title = isAr && p.titleAr ? p.titleAr : p.title;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(url)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border p-2 text-start text-sm transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/40 hover:bg-muted/50",
                )}
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{title}</span>
                {p.published === false && (
                  <span className="text-[10px] text-amber-600">
                    {isAr ? "مخفي" : "hidden"}
                  </span>
                )}
                <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[40%]">
                  {url}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ExternalTab({
  onPick,
  isAr,
  current,
}: {
  onPick: (url: string) => void;
  isAr: boolean;
  current: string;
}) {
  const [url, setUrl] = useState(
    current.startsWith("http") ? current : "",
  );
  const valid = /^https?:\/\/.+\..+/i.test(url);
  return (
    <div className="space-y-3 p-1">
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "أدخل رابطًا كاملاً يبدأ بـ https://"
          : "Enter a full URL starting with https://"}
      </p>
      <Input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com/page"
        autoFocus
      />
      <Button
        type="button"
        disabled={!valid}
        onClick={() => onPick(url)}
        className="w-full"
      >
        {isAr ? "تطبيق" : "Apply external URL"}
      </Button>
      {!valid && url.length > 0 && (
        <p className="text-xs text-destructive">
          {isAr
            ? "الرابط غير صالح. يجب أن يبدأ بـ http:// أو https://"
            : "Invalid URL — must start with http:// or https://"}
        </p>
      )}
    </div>
  );
}

function EmailTab({
  onPick,
  isAr,
  current,
}: {
  onPick: (url: string) => void;
  isAr: boolean;
  current: string;
}) {
  const initial = current.startsWith("mailto:") ? current.slice(7) : "";
  const [email, setEmail] = useState(initial);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return (
    <div className="space-y-3 p-1">
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "ينتج رابط `mailto:` يفتح بريد الزائر."
          : "Produces a mailto: link that opens the customer's email app."}
      </p>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="hello@store.com"
        autoFocus
      />
      <Button
        type="button"
        disabled={!valid}
        onClick={() => onPick(`mailto:${email}`)}
        className="w-full"
      >
        {isAr ? "تطبيق" : "Apply email link"}
      </Button>
    </div>
  );
}

function PhoneTab({
  onPick,
  isAr,
  current,
}: {
  onPick: (url: string) => void;
  isAr: boolean;
  current: string;
}) {
  const initial = current.startsWith("tel:") ? current.slice(4) : "";
  const [phone, setPhone] = useState(initial);
  // Phone validation is intentionally loose — international formats
  // vary; we accept anything with at least 7 digits.
  const digits = phone.replace(/\D/g, "");
  const valid = digits.length >= 7;
  return (
    <div className="space-y-3 p-1">
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "ينتج رابط `tel:` يفتح طلب الاتصال على هاتف الزائر."
          : "Produces a tel: link that opens the customer's dialer."}
      </p>
      <Input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+201234567890"
        autoFocus
        dir="ltr"
      />
      <Button
        type="button"
        disabled={!valid}
        onClick={() => onPick(`tel:${phone.trim()}`)}
        className="w-full"
      >
        {isAr ? "تطبيق" : "Apply phone link"}
      </Button>
    </div>
  );
}

function WhatsAppTab({
  onPick,
  isAr,
  current,
}: {
  onPick: (url: string) => void;
  isAr: boolean;
  current: string;
}) {
  // Reuse the same phone-extract logic.
  const initial = current.startsWith("https://wa.me/")
    ? current.slice("https://wa.me/".length)
    : "";
  const [phone, setPhone] = useState(initial);
  const [message, setMessage] = useState("");
  // WhatsApp wants E.164 digits — no leading + (wa.me strips it).
  const digits = phone.replace(/\D/g, "");
  const valid = digits.length >= 8;
  const url = (() => {
    if (!valid) return "";
    const base = `https://wa.me/${digits}`;
    if (!message.trim()) return base;
    return `${base}?text=${encodeURIComponent(message.trim())}`;
  })();
  return (
    <div className="space-y-3 p-1">
      <p className="text-xs text-muted-foreground">
        {isAr
          ? "ينتج رابط WhatsApp يفتح محادثة جديدة. أدخل الرقم بصيغة دولية بدون +."
          : "Produces a WhatsApp link that opens a chat. Enter the number in international format (no +)."}
      </p>
      <Input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="201234567890"
        autoFocus
        dir="ltr"
      />
      <Input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          isAr ? "رسالة مسبقة (اختياري)" : "Pre-filled message (optional)"
        }
      />
      <Button
        type="button"
        disabled={!valid}
        onClick={() => valid && onPick(url)}
        className="w-full"
      >
        {isAr ? "تطبيق" : "Apply WhatsApp link"}
      </Button>
    </div>
  );
}
