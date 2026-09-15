/**
 * Localized text for a theme-schema field — a setting's label / info /
 * placeholder, a header's content, an option label, or a section / block /
 * preset name.
 *
 * Themes ship Arabic in two forms: `locales.ar.<key>` and the flat `<key>_ar`
 * (the form `@numueg/theme-sdk` declares, and the one almost every theme
 * schema uses). Arabic reads `locales.ar.X || X_ar || X`; English keeps
 * `locales.en.X || X` and never reads `X_ar`.
 */
import type { EditorLocale } from "../../types";

export function localize<T extends object, K extends keyof T & string>(
  field: T,
  key: K,
  locale: EditorLocale,
): T[K] {
  const f = field as Record<string, unknown> & {
    locales?: Partial<Record<EditorLocale, Record<string, unknown>>>;
  };
  return (f.locales?.[locale]?.[key] ||
    (locale === "ar" && f[`${key}_ar`]) ||
    f[key]) as T[K];
}
