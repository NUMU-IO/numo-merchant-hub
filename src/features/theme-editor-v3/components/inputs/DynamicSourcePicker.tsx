/**
 * DynamicSourcePicker — the popover that lets a merchant bind a
 * section setting to a live store value instead of typing a literal.
 *
 * Pairs with the SDK's `useResolvedSettings(instance)` hook on the
 * theme side: the merchant clicks the "{}" toggle next to a setting,
 * picks (e.g.) "Product → Title", and the customizer writes
 *   { __numu_source: "product.title" }
 * into the draft. When the storefront renders that section inside a
 * `<ProductProvider>`, the SDK resolves the ref back to the active
 * product's name.
 *
 * Filtering rules:
 *  1. **By setting type** — text/textarea/richtext can bind to text
 *     fields; image_picker can bind to image fields. Everything else
 *     hides the toggle entirely.
 *  2. **By active template** — `product.*` sources only show on
 *     templates where a product is in context (`product`, `product/*`).
 *     Collection sources only on `collection`/`category` templates.
 *     `store.*` sources are always visible.
 *
 * The picker doesn't try to resolve the value here — it only writes the
 * ref. The host storefront's runtime resolver decides whether the bind
 * succeeds at render time (the preview will show the resolved value
 * immediately on save, because the customizer pipes the draft through
 * the iframe's `applyDraft` channel).
 */

import { useEffect, useRef, useState, useMemo } from "react";
import type { SettingDefinition, EditorLocale } from "../../types";
import { Button } from "@/components/ui/button";
import { Braces, ChevronDown, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Source catalog ─────────────────────────────────────────────────────────

/**
 * One bindable source. The `compatible` matrix decides which setting
 * types can use this source — keeping it on the source (rather than
 * a per-type whitelist on the input) means new sources only need to be
 * declared in one place.
 */
interface SourceDef {
  /** Stored as `{ __numu_source: <path> }` */
  path: string;
  /** Resource group — used to filter by active template + render the
   *  category header in the picker. */
  group: "product" | "collection" | "store";
  /** Display name in EN/AR. */
  label: { en: string; ar: string };
  /** Short description shown under the label. */
  description?: { en: string; ar: string };
  /** Compatible setting types for this source. */
  compatible: ReadonlyArray<string>;
}

// Compatibility constants — duplicating these as inline arrays would
// make the catalog noisy. Themes only see the resolved value, not the
// catalog, so the labels here are merchant-facing.
const TEXT_TYPES = ["text", "textarea", "richtext", "inline_richtext"] as const;
const IMAGE_TYPES = ["image_picker"] as const;
// Phase 3.4 — bind beyond text/image. Numeric sources (price, count) bind to
// number/range/text settings; slug/handle sources bind to url/text. The
// setting still stores the resolved scalar; the SDK's resolveSourcePath
// already resolves these paths, so no theme rebuild is needed.
const NUMBER_TYPES = ["number", "range", "text"] as const;
const URL_TYPES = ["url", "text"] as const;

const SOURCES: ReadonlyArray<SourceDef> = [
  // ── Product ────────────────────────────────────────────────────────
  {
    path: "product.title",
    group: "product",
    label: { en: "Product → Title", ar: "المنتج ← الاسم" },
    description: {
      en: "The active product's name.",
      ar: "اسم المنتج الحالي.",
    },
    compatible: TEXT_TYPES,
  },
  {
    path: "product.description",
    group: "product",
    label: { en: "Product → Description", ar: "المنتج ← الوصف" },
    description: {
      en: "Full description, HTML preserved.",
      ar: "الوصف الكامل، يحفظ HTML.",
    },
    compatible: ["textarea", "richtext"],
  },
  {
    path: "product.description_snippet",
    group: "product",
    label: { en: "Product → Description (excerpt)", ar: "المنتج ← مقتطف الوصف" },
    description: {
      en: "First 200 plain-text characters.",
      ar: "أول 200 حرف نصي.",
    },
    compatible: TEXT_TYPES,
  },
  {
    path: "product.sku",
    group: "product",
    label: { en: "Product → SKU", ar: "المنتج ← SKU" },
    compatible: ["text"],
  },
  {
    path: "product.price",
    group: "product",
    label: { en: "Product → Price", ar: "المنتج ← السعر" },
    description: {
      en: "The active product's price (number).",
      ar: "سعر المنتج الحالي (رقم).",
    },
    compatible: NUMBER_TYPES,
  },
  {
    path: "product.slug",
    group: "product",
    label: { en: "Product → Handle", ar: "المنتج ← المُعرّف" },
    description: {
      en: "URL handle — bind to a link/URL field.",
      ar: "مُعرّف الرابط — اربطه بحقل رابط.",
    },
    compatible: URL_TYPES,
  },
  {
    path: "product.image",
    group: "product",
    label: { en: "Product → Image", ar: "المنتج ← الصورة" },
    description: {
      en: "The product's first image.",
      ar: "أول صورة للمنتج.",
    },
    compatible: IMAGE_TYPES,
  },

  // ── Collection ─────────────────────────────────────────────────────
  {
    path: "collection.title",
    group: "collection",
    label: { en: "Collection → Title", ar: "المجموعة ← الاسم" },
    compatible: TEXT_TYPES,
  },
  {
    path: "collection.description",
    group: "collection",
    label: { en: "Collection → Description", ar: "المجموعة ← الوصف" },
    compatible: ["textarea", "richtext"],
  },
  {
    path: "collection.description_snippet",
    group: "collection",
    label: { en: "Collection → Description (excerpt)", ar: "المجموعة ← مقتطف الوصف" },
    compatible: TEXT_TYPES,
  },
  {
    path: "collection.image",
    group: "collection",
    label: { en: "Collection → Image", ar: "المجموعة ← الصورة" },
    compatible: IMAGE_TYPES,
  },
  {
    path: "collection.slug",
    group: "collection",
    label: { en: "Collection → Handle", ar: "المجموعة ← المُعرّف" },
    description: {
      en: "URL handle — bind to a link/URL field.",
      ar: "مُعرّف الرابط — اربطه بحقل رابط.",
    },
    compatible: URL_TYPES,
  },
  {
    path: "collection.product_count",
    group: "collection",
    label: { en: "Collection → Product count", ar: "المجموعة ← عدد المنتجات" },
    description: {
      en: "Number of products in the collection.",
      ar: "عدد المنتجات في المجموعة.",
    },
    compatible: NUMBER_TYPES,
  },

  // ── Store ──────────────────────────────────────────────────────────
  {
    path: "store.name",
    group: "store",
    label: { en: "Store → Name", ar: "المتجر ← الاسم" },
    compatible: TEXT_TYPES,
  },
  {
    path: "store.description",
    group: "store",
    label: { en: "Store → Description", ar: "المتجر ← الوصف" },
    compatible: ["textarea", "richtext"],
  },
  {
    path: "store.logo",
    group: "store",
    label: { en: "Store → Logo", ar: "المتجر ← الشعار" },
    compatible: IMAGE_TYPES,
  },
];

const GROUP_LABELS: Record<SourceDef["group"], { en: string; ar: string }> = {
  product: { en: "Product", ar: "المنتج" },
  collection: { en: "Collection", ar: "المجموعة" },
  store: { en: "Store", ar: "المتجر" },
};

// ─── Merchant-defined metafield sources (data-driven) ────────────────────────
//
// Built-in SOURCES above is a fixed catalog. Metafields are per-store, so they
// can't be a literal — the editor fetches the store's PUBLIC definitions once
// and registers them here. Path shape mirrors the host/SDK resolver:
//   product.metafield:{namespace}.{key}  →  { __numu_source: "..." }
// Registering here (module scope) instead of prop-threading keeps the existing
// picker call sites untouched; the setter re-renders consumers via the version
// counter below.

let METAFIELD_SOURCES: SourceDef[] = [];
let metafieldSourcesVersion = 0;
const metafieldSourceListeners = new Set<() => void>();

/** Called by the editor when the store's public metafield definitions load.
 *  Only owner types product/collection map to picker groups (page isn't a
 *  bindable template context in v1). */
export function registerMetafieldSources(
  defs: {
    owner_type: string;
    namespace: string;
    key: string;
    name: string;
    compatible: readonly string[];
  }[],
): void {
  METAFIELD_SOURCES = defs
    .filter((d) => d.owner_type === "product" || d.owner_type === "collection")
    .map((d) => ({
      path: `${d.owner_type}.metafield:${d.namespace}.${d.key}`,
      group: d.owner_type as SourceDef["group"],
      label: {
        en: `${d.owner_type === "product" ? "Product" : "Collection"} → ${d.name}`,
        ar: `${d.owner_type === "product" ? "المنتج" : "المجموعة"} ← ${d.name}`,
      },
      description: {
        en: `Custom field ${d.namespace}.${d.key}`,
        ar: `حقل مخصص ${d.namespace}.${d.key}`,
      },
      compatible: d.compatible,
    }));
  metafieldSourcesVersion += 1;
  metafieldSourceListeners.forEach((fn) => fn());
}

/** All sources (built-in + registered metafields). */
function allSources(): ReadonlyArray<SourceDef> {
  return METAFIELD_SOURCES.length ? [...SOURCES, ...METAFIELD_SOURCES] : SOURCES;
}

/** Subscribe a component to metafield-source registration so the toggle
 *  appears the moment definitions load (React 18 useSyncExternalStore). */
function useMetafieldSourcesVersion(): number {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    metafieldSourceListeners.add(fn);
    return () => {
      metafieldSourceListeners.delete(fn);
    };
  }, []);
  return metafieldSourcesVersion;
}

// ─── Template → available groups ────────────────────────────────────────────

/**
 * Which source groups are bindable on a given template. The Shopify
 * model: page resources flow from the URL into the page context. A
 * collection template implicitly has a collection in scope, but a home
 * page does not — so product/collection sources hide on home.
 *
 * We're conservative: if the template name isn't recognized we assume
 * "store-only" (better to under-offer than to bind to a source that
 * won't resolve at runtime).
 */
function availableGroups(activePage: string | undefined): Set<SourceDef["group"]> {
  const set = new Set<SourceDef["group"]>(["store"]);
  if (!activePage) return set;
  const t = activePage.toLowerCase();
  if (t === "product" || t.startsWith("product")) set.add("product");
  if (t === "collection" || t.startsWith("collection") || t === "category") {
    set.add("collection");
  }
  return set;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function findSourceByPath(path: string): SourceDef | undefined {
  return allSources().find((s) => s.path === path);
}

/**
 * Returns true when *any* source is bindable to this setting type on
 * this template. The caller uses this to decide whether to show the
 * "{}" toggle at all.
 */
export function hasBindableSources(
  settingType: string,
  activePage: string | undefined,
): boolean {
  const groups = availableGroups(activePage);
  return allSources().some(
    (s) => s.compatible.includes(settingType) && groups.has(s.group),
  );
}

// ─── Toggle button ──────────────────────────────────────────────────────────

export interface DynamicSourceToggleProps {
  setting: SettingDefinition;
  /**
   * Current stored value. When this is a `{ __numu_source }` ref, the
   * toggle renders in "bound" state (filled, with the binding label
   * as tooltip) and clicking unbinds.
   */
  value: unknown;
  /** Editor locale for label/aria translations. */
  locale: EditorLocale;
  /**
   * Active template id (from `customizerStore.activePage`). Used to
   * filter sources — product/collection sources hide on templates
   * without that resource in context.
   */
  activePage: string | undefined;
  /**
   * Called when the user picks a source (with the new ref object) or
   * clears a binding (with `null`).
   */
  onChange: (next: { __numu_source: string } | null) => void;
  /** Defaults to render-when-bindable. Set to true to always render
   *  (used by inputs that want to surface the toggle even when no
   *  sources are compatible — they typically grey it out instead). */
  alwaysRender?: boolean;
}

export function DynamicSourceToggle({
  setting,
  value,
  locale,
  activePage,
  onChange,
  alwaysRender,
}: DynamicSourceToggleProps) {
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Re-evaluate bindability when metafield sources register after mount.
  useMetafieldSourcesVersion();

  const isBound = isDynamicSourceValue(value);
  const boundSource = isBound ? findSourceByPath((value as { __numu_source: string }).__numu_source) : undefined;
  const bindable = hasBindableSources(setting.type, activePage);

  // Close on outside click + Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Hide when nothing's bindable AND no current binding exists. If a
  // template change strips the active binding's group, we still keep
  // the toggle visible so the merchant can clear the stale ref.
  if (!alwaysRender && !bindable && !isBound) return null;

  return (
    <div ref={rootRef} className="relative inline-flex">
      <Button
        type="button"
        variant={isBound ? "secondary" : "ghost"}
        size="icon"
        className={cn(
          "h-7 w-7 shrink-0",
          isBound && "text-primary",
        )}
        title={
          isBound
            ? (isAr
                ? `مربوط بـ ${boundSource?.label.ar ?? (value as { __numu_source: string }).__numu_source}`
                : `Bound to ${boundSource?.label.en ?? (value as { __numu_source: string }).__numu_source}`)
            : isAr
              ? "ربط بمصدر ديناميكي"
              : "Connect a dynamic source"
        }
        aria-label={isAr ? "مصادر ديناميكية" : "Dynamic source"}
        onClick={() => setOpen((o) => !o)}
      >
        <Braces className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <DynamicSourceMenu
          setting={setting}
          locale={locale}
          activePage={activePage}
          currentPath={isBound ? (value as { __numu_source: string }).__numu_source : null}
          onPick={(path) => {
            setOpen(false);
            onChange({ __numu_source: path });
          }}
          onClear={() => {
            setOpen(false);
            onChange(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Picker dropdown ────────────────────────────────────────────────────────

function DynamicSourceMenu({
  setting,
  locale,
  activePage,
  currentPath,
  onPick,
  onClear,
}: {
  setting: SettingDefinition;
  locale: EditorLocale;
  activePage: string | undefined;
  currentPath: string | null;
  onPick: (path: string) => void;
  onClear: () => void;
}) {
  const isAr = locale === "ar";
  const groups = availableGroups(activePage);

  // Pre-group sources by their group so we render one section header
  // per group instead of looping the catalog twice.
  const grouped = useMemo(() => {
    const out: Record<SourceDef["group"], SourceDef[]> = {
      product: [],
      collection: [],
      store: [],
    };
    for (const s of allSources()) {
      if (!s.compatible.includes(setting.type)) continue;
      if (!groups.has(s.group)) continue;
      out[s.group].push(s);
    }
    return out;
  }, [setting.type, groups]);

  const hasAny =
    grouped.product.length + grouped.collection.length + grouped.store.length > 0;

  return (
    <div
      className={cn(
        "absolute top-full z-50 mt-1 w-72 rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        // RTL flips on this is intentional — the toggle sits to the
        // end of the field, so the dropdown should open inward.
        isAr ? "start-0" : "end-0",
      )}
      role="menu"
      aria-label={isAr ? "اختر مصدراً" : "Choose a source"}
    >
      {/* Header explaining what's about to happen. Keeps the panel
          self-documenting — the toggle icon is small and not everyone
          will know what "{}" means. */}
      <div className="border-b px-2.5 py-1.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Link2 className="h-3 w-3" />
          {isAr ? "مصادر ديناميكية" : "Dynamic sources"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">
          {isAr
            ? "اربط هذا الحقل بقيمة حية من بيانات المتجر."
            : "Bind this field to a live value from store data."}
        </p>
      </div>

      {/* Current binding row — when active, surface a "clear" button
          at the top so the merchant doesn't have to re-pick "no source"
          (there is no such option). */}
      {currentPath && (
        <div className="border-b px-2.5 py-1.5">
          <button
            type="button"
            onClick={onClear}
            className="flex w-full items-center justify-between gap-2 rounded-sm bg-muted/40 px-2 py-1.5 text-[11px] text-foreground hover:bg-muted"
          >
            <span className="truncate">
              <span className="font-mono text-muted-foreground">
                {currentPath}
              </span>
            </span>
            <span className="flex items-center gap-1 text-destructive">
              <X className="h-3 w-3" />
              {isAr ? "إلغاء الربط" : "Unbind"}
            </span>
          </button>
        </div>
      )}

      {/* The actual catalog, grouped. Empty groups are skipped — no
          stub "no sources in this group" lines so the menu stays
          dense and scannable. */}
      <div className="max-h-72 overflow-y-auto py-1">
        {(["product", "collection", "store"] as const).map((g) =>
          grouped[g].length === 0 ? null : (
            <div key={g} className="mb-1">
              <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {GROUP_LABELS[g][isAr ? "ar" : "en"]}
              </p>
              {grouped[g].map((src) => {
                const active = currentPath === src.path;
                return (
                  <button
                    key={src.path}
                    type="button"
                    onClick={() => onPick(src.path)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-sm px-2.5 py-1.5 text-start text-xs transition-colors",
                      active
                        ? "bg-primary/10 text-foreground"
                        : "text-foreground hover:bg-accent",
                    )}
                  >
                    <span className="font-medium">
                      {src.label[isAr ? "ar" : "en"]}
                    </span>
                    {src.description && (
                      <span className="text-[10.5px] text-muted-foreground">
                        {src.description[isAr ? "ar" : "en"]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ),
        )}

        {/* Empty-state — fires when the setting type is bindable but
            the active template has no resource in context (e.g. an
            image setting on a home page can't bind product image). */}
        {!hasAny && (
          <p className="px-2.5 py-2.5 text-[11px] text-muted-foreground">
            {isAr
              ? "لا توجد مصادر متاحة لهذا الحقل على هذه الصفحة. جرّب صفحة منتج أو مجموعة."
              : "No sources available for this field on this page. Try a product or collection page."}
          </p>
        )}
      </div>

      <ChevronDown className="absolute top-2 end-2 hidden h-3 w-3 text-muted-foreground" />
    </div>
  );
}

// ─── Source ref helpers ─────────────────────────────────────────────────────

/**
 * Customizer-side mirror of the SDK's `isDynamicSource`. Inlined here
 * (instead of importing from `@numueg/theme-sdk`) because the merchant
 * hub doesn't have a direct dependency on the SDK — federation
 * resolves it at runtime on the storefront only.
 */
export function isDynamicSourceValue(value: unknown): value is { __numu_source: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { __numu_source?: unknown }).__numu_source === "string"
  );
}

/** Human-readable label for a dynamic source value (used in the bound-state chip). */
export function dynamicSourceLabel(
  value: unknown,
  locale: EditorLocale,
): string | null {
  if (!isDynamicSourceValue(value)) return null;
  const src = findSourceByPath(value.__numu_source);
  if (!src) return value.__numu_source;
  return src.label[locale === "ar" ? "ar" : "en"];
}
