/**
 * useTemplateOptions — derive the "Template" dropdown options for a resource
 * editor (product / collection / page) from the active theme's V3 templates.
 *
 * The active theme's `customization_v3.templates` map is keyed Shopify-style:
 *   product            → base template     → "Default"   (template_suffix = null)
 *   product.wholesale  → alternate variant → "wholesale" (template_suffix = "wholesale")
 *
 * We read the current draft via the V3 editor API. The draft always resolves
 * to a normalized V3 payload, and it includes variants the merchant just
 * created in the customizer but hasn't published yet — so a freshly-duplicated
 * `product.wholesale` is assignable to a resource immediately.
 */
import { useQuery } from "@tanstack/react-query";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchDraftV3 } from "@/features/theme-editor-v3/services/themeEditorV3Api";

export interface TemplateOption {
  /** The `template_suffix` value this option writes. `null` = base ("Default"). */
  value: string | null;
  /** Merchant-facing label. */
  label: string;
}

/**
 * Sentinel used with shadcn/Radix <Select> (which forbids empty-string item
 * values) to represent the base template, i.e. `template_suffix = null`.
 */
export const DEFAULT_TEMPLATE_VALUE = "__default__";

/**
 * Pure: derive template options for `type` from a `templates` map. Exported
 * separately from the hook so it can be unit-tested and reused without the
 * react-query plumbing.
 *
 * Matches keys against `^<type>(\.<suffix>)?$` where suffix is
 * `[a-z0-9-]+`; the base template maps to "Default" (value `null`) and each
 * `<type>.<suffix>` maps to an option whose value is the bare suffix.
 */
export function deriveTemplateOptions(
  templates: Record<string, unknown> | null | undefined,
  type: string,
  locale: "en" | "ar" = "en",
): TemplateOption[] {
  const re = new RegExp(`^${type}(?:\\.(?<suffix>[a-z0-9-]+))?$`);
  const variants: TemplateOption[] = [];
  for (const key of Object.keys(templates ?? {})) {
    const suffix = re.exec(key)?.groups?.suffix;
    if (suffix) variants.push({ value: suffix, label: suffix });
  }
  variants.sort((a, b) => (a.value ?? "").localeCompare(b.value ?? ""));
  // The base ("Default") is always offered even when the literal `type` key is
  // absent — an un-seeded draft still renders against the theme's default
  // template, and selecting Default writes template_suffix = null.
  return [
    { value: null, label: locale === "ar" ? "افتراضي" : "Default" },
    ...variants,
  ];
}

/**
 * Hook: fetch the active theme's draft templates and derive the Template
 * dropdown options for a resource `type` ("product" | "collection" | "page").
 * On any fetch failure it degrades to just the "Default" option.
 */
export function useTemplateOptions(type: string): {
  options: TemplateOption[];
  isLoading: boolean;
} {
  const { currentStore } = useDashboardStore();
  const { language } = useLanguage();
  const storeId = currentStore?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["theme-templates-v3", storeId],
    queryFn: () => fetchDraftV3(storeId as string),
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  const templates =
    data && typeof data === "object" && "templates" in data
      ? (data as { templates?: Record<string, unknown> }).templates
      : undefined;

  return {
    options: deriveTemplateOptions(
      templates,
      type,
      language === "ar" ? "ar" : "en",
    ),
    isLoading,
  };
}
