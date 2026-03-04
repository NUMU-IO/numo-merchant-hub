/**
 * ThemeMarketplace — a rich visual marketplace for browsing and selecting themes.
 * Shows full preview cards with color palettes, typography samples, and layout info.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check, Search, Sparkles, Eye, Star, Layout,
  Palette, Type, Zap, Crown, Gem, Newspaper, Paintbrush,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvailableTheme } from "@/services/themeApi";

// ─── Rich theme metadata for marketplace display ─────────────────────────────

interface ThemeShowcase {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  icon: typeof Sparkles;
  category: string;
  categoryAr: string;
  tags: string[];
  tagsAr: string[];
  colors: { primary: string; secondary: string; accent: string; bg: string; text: string };
  fonts: { heading: string; body: string };
  features: string[];
  featuresAr: string[];
  popular?: boolean;
  isNew?: boolean;
}

const THEME_SHOWCASE: ThemeShowcase[] = [
  {
    id: "modern",
    name: "Modern",
    nameAr: "مودرن",
    description: "Clean, minimal design with smooth animations and balanced whitespace. Perfect for contemporary brands.",
    descriptionAr: "تصميم نظيف وبسيط مع حركات سلسة ومساحات بيضاء متوازنة. مثالي للعلامات التجارية العصرية.",
    icon: Sparkles,
    category: "Minimal",
    categoryAr: "بسيط",
    tags: ["Clean", "Responsive", "Fast"],
    tagsAr: ["نظيف", "متجاوب", "سريع"],
    colors: { primary: "#3b82f6", secondary: "#64748b", accent: "#06b6d4", bg: "#f8fafc", text: "#0f172a" },
    fonts: { heading: "Inter", body: "Inter" },
    features: ["Smooth animations", "Grid layouts", "Modern cards"],
    featuresAr: ["حركات سلسة", "تخطيطات شبكية", "كروت حديثة"],
    popular: true,
  },
  {
    id: "boutique",
    name: "Boutique",
    nameAr: "بوتيك",
    description: "Elegant and feminine design tailored for fashion and lifestyle brands with soft tones.",
    descriptionAr: "تصميم أنيق وناعم مصمم لعلامات الأزياء والأسلوب الحياتي بألوان هادئة.",
    icon: Paintbrush,
    category: "Fashion",
    categoryAr: "أزياء",
    tags: ["Elegant", "Feminine", "Soft"],
    tagsAr: ["أنيق", "ناعم", "هادئ"],
    colors: { primary: "#ec4899", secondary: "#f472b6", accent: "#a855f7", bg: "#fdf2f8", text: "#831843" },
    fonts: { heading: "El Messiri", body: "Cairo" },
    features: ["Soft gradients", "Rounded elements", "Image-focused"],
    featuresAr: ["تدرجات ناعمة", "عناصر مستديرة", "تركيز على الصور"],
  },
  {
    id: "elegant",
    name: "Elegant",
    nameAr: "أنيق",
    description: "Luxurious design with warm gold accents and serif typography. Ideal for premium products.",
    descriptionAr: "تصميم فاخر مع لمسات ذهبية دافئة وخطوط كلاسيكية. مثالي للمنتجات الراقية.",
    icon: Crown,
    category: "Luxury",
    categoryAr: "فاخر",
    tags: ["Premium", "Gold", "Classic"],
    tagsAr: ["فاخر", "ذهبي", "كلاسيكي"],
    colors: { primary: "#d97706", secondary: "#92400e", accent: "#b45309", bg: "#fffbeb", text: "#78350f" },
    fonts: { heading: "El Messiri", body: "Tajawal" },
    features: ["Gold accents", "Serif fonts", "Refined spacing"],
    featuresAr: ["لمسات ذهبية", "خطوط كلاسيكية", "مسافات مصقولة"],
    popular: true,
  },
  {
    id: "skeuomorphic",
    name: "Classic",
    nameAr: "كلاسيك",
    description: "Tactile, 3D design with glassmorphism effects and dimensional elements for a physical feel.",
    descriptionAr: "تصميم ثلاثي الأبعاد مع تأثيرات زجاجية وعناصر بعمق حسي.",
    icon: Palette,
    category: "Creative",
    categoryAr: "إبداعي",
    tags: ["3D", "Glass", "Tactile"],
    tagsAr: ["ثلاثي الأبعاد", "زجاجي", "حسي"],
    colors: { primary: "#10b981", secondary: "#059669", accent: "#34d399", bg: "#ecfdf5", text: "#064e3b" },
    fonts: { heading: "Rubik", body: "Cairo" },
    features: ["Glassmorphism", "3D depth", "Rich textures"],
    featuresAr: ["تأثير الزجاج", "عمق ثلاثي الأبعاد", "نسيج غني"],
  },
  {
    id: "tech-wave",
    name: "Tech Wave",
    nameAr: "تك ويف",
    description: "Dark, futuristic design with neon glows and wave animations. Built for tech and gaming brands.",
    descriptionAr: "تصميم داكن مستقبلي مع توهج نيون وحركات موجية. مبني لعلامات التكنولوجيا والألعاب.",
    icon: Zap,
    category: "Tech",
    categoryAr: "تكنولوجيا",
    tags: ["Dark", "Neon", "Futuristic"],
    tagsAr: ["داكن", "نيون", "مستقبلي"],
    colors: { primary: "#00d4ff", secondary: "#6366f1", accent: "#a855f7", bg: "#0a0e1a", text: "#e0e6ed" },
    fonts: { heading: "Space Grotesk", body: "Inter" },
    features: ["Neon glow effects", "Wave animations", "Dark mode native"],
    featuresAr: ["تأثيرات توهج نيون", "حركات موجية", "وضع داكن أصلي"],
    isNew: true,
  },
  {
    id: "neo-brutalism",
    name: "Neo Brutalism",
    nameAr: "نيو بروتاليزم",
    description: "Bold, unapologetic design with thick borders, vivid colors, and playful shadows.",
    descriptionAr: "تصميم جريء بحدود سميكة وألوان حية وظلال مرحة.",
    icon: Layout,
    category: "Creative",
    categoryAr: "إبداعي",
    tags: ["Bold", "Playful", "Colorful"],
    tagsAr: ["جريء", "مرح", "ملون"],
    colors: { primary: "#a3e635", secondary: "#1a1a1a", accent: "#facc15", bg: "#fefce8", text: "#1a1a1a" },
    fonts: { heading: "Space Grotesk", body: "Inter" },
    features: ["Thick borders", "Bold shadows", "Vivid colors"],
    featuresAr: ["حدود سميكة", "ظلال جريئة", "ألوان حية"],
    isNew: true,
  },
  {
    id: "editorial",
    name: "Editorial",
    nameAr: "إيديتوريال",
    description: "Magazine-style layout with editorial typography and content-first design philosophy.",
    descriptionAr: "تخطيط بأسلوب المجلات مع خطوط تحريرية وتصميم يركز على المحتوى.",
    icon: Newspaper,
    category: "Content",
    categoryAr: "محتوى",
    tags: ["Magazine", "Typography", "Content"],
    tagsAr: ["مجلة", "خطوط", "محتوى"],
    colors: { primary: "#2d6a4f", secondary: "#40916c", accent: "#52b788", bg: "#f0f2ec", text: "#1b1b1b" },
    fonts: { heading: "El Messiri", body: "Noto Sans Arabic" },
    features: ["Editorial layouts", "Rich typography", "Content grids"],
    featuresAr: ["تخطيطات تحريرية", "خطوط غنية", "شبكات محتوى"],
  },
  {
    id: "luxury-minimal",
    name: "Luxury Minimal",
    nameAr: "فخامة مينيمال",
    description: "Ultra-refined minimal design with generous whitespace and gold accents for high-end brands.",
    descriptionAr: "تصميم بسيط فائق التصفية مع مساحات بيضاء سخية ولمسات ذهبية للعلامات الراقية.",
    icon: Gem,
    category: "Luxury",
    categoryAr: "فاخر",
    tags: ["Luxury", "Minimal", "Refined"],
    tagsAr: ["فاخر", "بسيط", "مصقول"],
    colors: { primary: "#b8860b", secondary: "#8b6914", accent: "#daa520", bg: "#ffffff", text: "#1a1a1a" },
    fonts: { heading: "El Messiri", body: "Almarai" },
    features: ["Generous whitespace", "Gold accents", "Refined details"],
    featuresAr: ["مساحات بيضاء سخية", "لمسات ذهبية", "تفاصيل مصقولة"],
    popular: true,
  },
];

const CATEGORIES = [
  { value: "all", label: "All", labelAr: "الكل" },
  { value: "Minimal", label: "Minimal", labelAr: "بسيط" },
  { value: "Fashion", label: "Fashion", labelAr: "أزياء" },
  { value: "Luxury", label: "Luxury", labelAr: "فاخر" },
  { value: "Creative", label: "Creative", labelAr: "إبداعي" },
  { value: "Tech", label: "Tech", labelAr: "تكنولوجيا" },
  { value: "Content", label: "Content", labelAr: "محتوى" },
];

interface ThemeMarketplaceProps {
  activeTheme: string;
  onSelectTheme: (themeId: string) => void;
  availableThemes: AvailableTheme[];
}

export function ThemeMarketplace({ activeTheme, onSelectTheme, availableThemes }: ThemeMarketplaceProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);

  const filtered = THEME_SHOWCASE.filter((theme) => {
    if (category !== "all" && theme.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        theme.name.toLowerCase().includes(q) ||
        theme.nameAr.includes(q) ||
        theme.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isAr ? "سوق الثيمات" : "Theme Marketplace"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isAr
              ? "اختر ثيم يعكس هوية علامتك التجارية"
              : "Choose a theme that reflects your brand identity"}
          </p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "ابحث عن ثيم..." : "Search themes..."}
            className="ps-9 rounded-xl"
          />
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.value}
            variant={category === cat.value ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory(cat.value)}
            className="rounded-full shrink-0 text-xs"
          >
            {isAr ? cat.labelAr : cat.label}
          </Button>
        ))}
      </div>

      {/* Theme grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((theme) => {
          const isActive = activeTheme === theme.id;
          const Icon = theme.icon;

          return (
            <Card
              key={theme.id}
              className={cn(
                "group overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer rounded-2xl",
                isActive
                  ? "ring-2 ring-primary shadow-lg"
                  : "hover:ring-1 hover:ring-primary/30",
              )}
              onClick={() => onSelectTheme(theme.id)}
            >
              {/* Theme preview header */}
              <div
                className="relative h-44 p-4 flex flex-col justify-between overflow-hidden"
                style={{ backgroundColor: theme.colors.bg }}
              >
                {/* Mini layout mockup */}
                <div className="flex flex-col gap-2 flex-1">
                  {/* Fake nav bar */}
                  <div className="flex items-center justify-between">
                    <div
                      className="h-3 w-16 rounded-sm opacity-80"
                      style={{ backgroundColor: theme.colors.text }}
                    />
                    <div className="flex gap-1.5">
                      <div className="h-2 w-8 rounded-sm opacity-40" style={{ backgroundColor: theme.colors.text }} />
                      <div className="h-2 w-8 rounded-sm opacity-40" style={{ backgroundColor: theme.colors.text }} />
                      <div className="h-2 w-8 rounded-sm opacity-40" style={{ backgroundColor: theme.colors.text }} />
                    </div>
                  </div>

                  {/* Fake hero section */}
                  <div className="flex-1 flex items-center gap-3 mt-2">
                    <div className="flex-1 space-y-2">
                      <div
                        className="h-3.5 w-3/4 rounded-sm"
                        style={{ backgroundColor: theme.colors.text, opacity: 0.85 }}
                      />
                      <div
                        className="h-2.5 w-1/2 rounded-sm"
                        style={{ backgroundColor: theme.colors.text, opacity: 0.4 }}
                      />
                      <div
                        className="h-6 w-20 rounded-md mt-2"
                        style={{ backgroundColor: theme.colors.primary }}
                      />
                    </div>
                    <div
                      className="h-16 w-16 rounded-lg shrink-0"
                      style={{ backgroundColor: theme.colors.secondary, opacity: 0.2 }}
                    />
                  </div>

                  {/* Fake product grid */}
                  <div className="flex gap-2 mt-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex-1 space-y-1">
                        <div
                          className="h-8 w-full rounded-md"
                          style={{ backgroundColor: theme.colors.secondary, opacity: 0.12 }}
                        />
                        <div
                          className="h-1.5 w-3/4 rounded-sm"
                          style={{ backgroundColor: theme.colors.text, opacity: 0.3 }}
                        />
                        <div
                          className="h-1.5 w-1/2 rounded-sm"
                          style={{ backgroundColor: theme.colors.primary, opacity: 0.5 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Badges */}
                <div className="absolute top-3 end-3 flex flex-col gap-1.5 items-end">
                  {isActive && (
                    <Badge className="bg-primary text-primary-foreground shadow-md gap-1">
                      <Check className="h-3 w-3" />
                      {isAr ? "مفعّل" : "Active"}
                    </Badge>
                  )}
                  {theme.popular && !isActive && (
                    <Badge variant="secondary" className="shadow-sm gap-1 text-[10px]">
                      <Star className="h-2.5 w-2.5" />
                      {isAr ? "شائع" : "Popular"}
                    </Badge>
                  )}
                  {theme.isNew && !isActive && (
                    <Badge className="bg-emerald-500 text-primary-foreground shadow-sm text-[10px]">
                      {isAr ? "جديد" : "New"}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Theme info */}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm tracking-tight">
                        {isAr ? theme.nameAr : theme.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        {isAr ? theme.categoryAr : theme.category}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {isAr ? theme.descriptionAr : theme.description}
                </p>

                {/* Color palette */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {isAr ? "الألوان" : "Colors"}
                  </span>
                  <div className="flex gap-1">
                    {Object.values(theme.colors).slice(0, 4).map((color, i) => (
                      <div
                        key={i}
                        className="h-4 w-4 rounded-full border border-border/50 shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Font preview */}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Type className="h-3 w-3" />
                  <span>{theme.fonts.heading}</span>
                  {theme.fonts.heading !== theme.fonts.body && (
                    <>
                      <span className="opacity-40">•</span>
                      <span>{theme.fonts.body}</span>
                    </>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {(isAr ? theme.tagsAr : theme.tags).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Action */}
                <Button
                  variant={isActive ? "secondary" : "default"}
                  size="sm"
                  className="w-full rounded-xl gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTheme(theme.id);
                  }}
                >
                  {isActive ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      {isAr ? "الثيم الحالي" : "Current Theme"}
                    </>
                  ) : (
                    <>
                      <Palette className="h-3.5 w-3.5" />
                      {isAr ? "اختر الثيم" : "Select Theme"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {isAr ? "مفيش ثيمات مطابقة للبحث" : "No themes match your search"}
          </p>
        </div>
      )}
    </div>
  );
}
