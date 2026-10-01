/** Store category → three catalog themes that suit it, best first. The
 *  "make it yours" step shows the ones that exist and are free. */
export const RECOMMENDED_THEMES: Record<string, string[]> = {
  fashion: ["luxury-minimal-v3", "boutique-v3", "editorial-v3"],
  accessories: ["luxury-minimal-v3", "elegant-v3", "boutique-v3"],
  beauty: ["luxury-minimal-v3", "elegant-v3", "gilded-glamour-boutique-v3"],
  electronics: ["tech-wave-v3", "modern-v3", "luxury-minimal-v3"],
  home: ["skeuomorphic-v3", "luxury-minimal-v3", "modern-v3"],
  handmade: ["skeuomorphic-v3", "editorial-v3", "luxury-minimal-v3"],
  books: ["powells-v3", "editorial-v3", "luxury-minimal-v3"],
  food: ["neo-brutalism-v3", "modern-v3", "luxury-minimal-v3"],
  other: ["luxury-minimal-v3", "modern-v3", "editorial-v3"],
};

export function recommendedThemes(category: string | null | undefined): string[] {
  return RECOMMENDED_THEMES[category || "other"] ?? RECOMMENDED_THEMES.other;
}
