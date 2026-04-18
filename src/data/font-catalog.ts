export type FontCategory = "latin-sans" | "latin-serif" | "arabic" | "display" | "mono";

export interface FontOption {
  family: string;
  category: FontCategory;
  weights: number[];
  supportsArabic: boolean;
  sample: { en: string; ar?: string };
  fallback: "sans-serif" | "serif" | "monospace" | "cursive" | "display";
}

export const FONT_CATALOG: FontOption[] = [
  // Arabic
  { family: "Cairo",           category: "arabic", weights: [300,400,500,600,700,800,900], supportsArabic: true,  sample: { en: "The quick brown fox", ar: "أهلاً وسهلاً بكم" }, fallback: "sans-serif" },
  { family: "Tajawal",         category: "arabic", weights: [300,400,500,700,800,900],     supportsArabic: true,  sample: { en: "The quick brown fox", ar: "أهلاً وسهلاً بكم" }, fallback: "sans-serif" },
  { family: "Almarai",         category: "arabic", weights: [300,400,700,800],             supportsArabic: true,  sample: { en: "The quick brown fox", ar: "أهلاً وسهلاً بكم" }, fallback: "sans-serif" },
  { family: "Readex Pro",      category: "arabic", weights: [300,400,500,600,700],         supportsArabic: true,  sample: { en: "The quick brown fox", ar: "أهلاً وسهلاً بكم" }, fallback: "sans-serif" },
  { family: "El Messiri",      category: "arabic", weights: [400,500,600,700],             supportsArabic: true,  sample: { en: "The quick brown fox", ar: "أهلاً وسهلاً بكم" }, fallback: "sans-serif" },
  { family: "Changa",          category: "arabic", weights: [300,400,500,600,700,800],     supportsArabic: true,  sample: { en: "The quick brown fox", ar: "أهلاً وسهلاً بكم" }, fallback: "sans-serif" },
  { family: "IBM Plex Sans Arabic", category: "arabic", weights: [300,400,500,600,700],  supportsArabic: true,  sample: { en: "The quick brown fox", ar: "أهلاً وسهلاً بكم" }, fallback: "sans-serif" },
  { family: "Noto Sans Arabic", category: "arabic", weights: [400,500,600,700,800,900],    supportsArabic: true,  sample: { en: "The quick brown fox", ar: "أهلاً وسهلاً بكم" }, fallback: "sans-serif" },
  { family: "Marhey",          category: "arabic", weights: [300,400,500,600,700,800],     supportsArabic: true,  sample: { en: "The quick brown fox", ar: "أهلاً وسهلاً بكم" }, fallback: "sans-serif" },
  { family: "Emiri",          category: "arabic", weights: [400,500,600,700],             supportsArabic: true,  sample: { en: "The quick brown fox", ar: "أهلاً وسهلاً بكم" }, fallback: "sans-serif" },

  // Latin Sans
  { family: "Inter",           category: "latin-sans", weights: [300,400,500,600,700,800], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "sans-serif" },
  { family: "Poppins",         category: "latin-sans", weights: [300,400,500,600,700,800], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "sans-serif" },
  { family: "Space Grotesk",   category: "latin-sans", weights: [300,400,500,600,700],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "sans-serif" },
  { family: "Outfit",          category: "latin-sans", weights: [300,400,500,600,700,800], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "sans-serif" },
  { family: "Manrope",         category: "latin-sans", weights: [300,400,500,600,700,800], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "sans-serif" },
  { family: "Work Sans",       category: "latin-sans", weights: [300,400,500,600,700,800], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "sans-serif" },
  { family: "Nunito",          category: "latin-sans", weights: [300,400,500,600,700,800], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "sans-serif" },
  { family: "Quicksand",       category: "latin-sans", weights: [300,400,500,600,700],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "sans-serif" },
  { family: "Cabinet Grotesk", category: "latin-sans", weights: [300,400,500,600,700,800], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "sans-serif" },
  { family: "Satoshi",         category: "latin-sans", weights: [300,400,500,600,700,800,900], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "sans-serif" },

  // Latin Serif
  { family: "Playfair Display",     category: "latin-serif", weights: [400,500,600,700,800], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "serif" },
  { family: "Cormorant Garamond",   category: "latin-serif", weights: [300,400,500,600,700], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "serif" },
  { family: "DM Serif Display",     category: "latin-serif", weights: [400],                  supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "serif" },
  { family: "Lora",                 category: "latin-serif", weights: [400,500,600,700],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "serif" },
  { family: "Merriweather",       category: "latin-serif", weights: [300,400,700,900],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "serif" },
  { family: "Libre Baskerville",   category: "latin-serif", weights: [400,700],             supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "serif" },
  { family: "Fraunces",            category: "latin-serif", weights: [100,200,300,400,500,600,700,800,900], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "serif" },
  { family: "Newsreader",         category: "latin-serif", weights: [200,300,400,500,600,700,800], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "serif" },

  // Display & Script (contains Playball)
  { family: "Playball",        category: "display", weights: [400],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "cursive" },
  { family: "Pacifico",        category: "display", weights: [400],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "cursive" },
  { family: "Dancing Script",  category: "display", weights: [400,500,600,700], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "cursive" },
  { family: "Lobster",         category: "display", weights: [400],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "display" },
  { family: "Abril Fatface",   category: "display", weights: [400],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "display" },
  { family: "Bebas Neue",       category: "display", weights: [400],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "display" },
  { family: "Oswald",           category: "display", weights: [200,300,400,500,600,700], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "display" },
  { family: "Righteous",       category: "display", weights: [400],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "display" },
  { family: "Alfa Slab One",   category: "display", weights: [400],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "display" },
  { family: "Bungee",          category: "display", weights: [400],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "display" },
  { family: "Comic Neue",       category: "display", weights: [300,400,700], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "cursive" },
  { family: "Caveat",           category: "display", weights: [400,500,600,700], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "cursive" },
  { family: "Satisfy",          category: "display", weights: [400],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "cursive" },
  { family: "Great Vibes",      category: "display", weights: [400],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "cursive" },
  { family: "Parisienne",       category: "display", weights: [400],     supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "cursive" },

  // Monospace
  { family: "JetBrains Mono",  category: "mono", weights: [400,500,700], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "monospace" },
  { family: "Fira Code",        category: "mono", weights: [300,400,500,600,700], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "monospace" },
  { family: "Source Code Pro",  category: "mono", weights: [200,300,400,500,600,700,800,900], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "monospace" },
  { family: "IBM Plex Mono",    category: "mono", weights: [300,400,500,600,700], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "monospace" },
  { family: "Space Mono",      category: "mono", weights: [400,700], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "monospace" },
  { family: "Roboto Mono",      category: "mono", weights: [100,200,300,400,500,600,700], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "monospace" },
  { family: "Inconsolata",      category: "mono", weights: [200,300,400,500,600,700,800,900], supportsArabic: false, sample: { en: "The quick brown fox" }, fallback: "monospace" },
];

export const CATEGORY_LABELS: Record<FontCategory, { en: string; ar: string }> = {
  "arabic":      { en: "Arabic",           ar: "عربي" },
  "latin-sans":  { en: "Sans-serif",       ar: "بدون زخرفة" },
  "latin-serif": { en: "Serif",            ar: "مزخرف" },
  "display":     { en: "Display & Script", ar: "زخرفة وعرض" },
  "mono":        { en: "Monospace",        ar: "أحادي المسافة" },
};

export function buildGoogleFontsUrl(families: FontOption[]): string {
  if (families.length === 0) return "";
  const params = families.map((f) => {
    const name = f.family.replace(/ /g, "+");
    const weights = f.weights.join(";");
    return `family=${name}:wght@${weights}`;
  });
  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}

export function findFont(family: string): FontOption | undefined {
  return FONT_CATALOG.find((f) => f.family === family);
}