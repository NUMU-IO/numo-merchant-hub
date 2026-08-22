import { useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, Lock } from "lucide-react";
import {
  // general
  Globe, Shield, Monitor, User, Store as StoreIcon, UserCog, Users,
  // billing & finance
  CreditCard, Wallet, Receipt, Banknote, DollarSign, HandCoins, Zap,
  // communications
  Bell, Inbox, MessageSquare, Megaphone, Share2, PlugZap, Activity,
  // store & ops
  Palette, FileText, Navigation2, SlidersHorizontal, Package, FolderOpen,
  Truck, Key, Webhook, TrendingUp, UserPlus, Tag,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/PageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavConfig } from "@/hooks/useNavConfig";
import { normalizeArabic } from "@/lib/arabic-normalize";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string }>;

/** `advanced` = technical, easy to misuse; `danger` = money / access. */
type ItemFlag = "advanced" | "danger";

interface SettingItem {
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  icon: IconType;
  to: string;
  /**
   * Platform-admin nav-config key (same registry the sidebar gates on).
   * A tab the admin hid from the sidebar used to stay reachable from here.
   * Unknown keys fail OPEN, like NavItemGate.
   */
  navKey?: string;
  /** Extra search terms — synonyms, Arabic colloquial, old names. */
  aliases?: string[];
  flag?: ItemFlag;
  /** Only the store owner sees this card (staff never should). */
  ownerOnly?: boolean;
}

interface SettingSection {
  title: { en: string; ar: string };
  /** Tone is a property of the section, not its position — filtering used
      to reshuffle colours as sections dropped out of the search results. */
  tone: "navy" | "saffron" | "sage" | "terra";
  items: SettingItem[];
}

const SECTIONS: SettingSection[] = [
  {
    title: { en: "General", ar: "عام" },
    tone: "navy",
    items: [
      {
        title: { en: "Store profile", ar: "إعدادات المتجر" },
        description: {
          en: "Store name, contact info, address and business details",
          ar: "اسم المتجر وبيانات التواصل والعنوان وتفاصيل النشاط",
        },
        icon: StoreIcon,
        to: "/store",
        aliases: ["name", "logo", "address", "phone", "بيانات المتجر", "اسم المتجر", "اللوجو"],
      },
      {
        title: { en: "Language & region", ar: "اللغة والمنطقة" },
        description: {
          en: "Default language, timezone and currency",
          ar: "اللغة والمنطقة الزمنية والعملة",
        },
        icon: Globe,
        to: "/settings/preferences?section=general",
        aliases: ["arabic", "english", "timezone", "currency", "عربي", "انجليزي", "التوقيت", "العملة"],
      },
      {
        title: { en: "Custom fields", ar: "الحقول المخصصة" },
        description: {
          en: "Define extra typed data for products, collections and pages",
          ar: "عرّف حقول بيانات إضافية للمنتجات والمجموعات والصفحات",
        },
        icon: Tag,
        to: "/settings/metafields",
        aliases: ["metafields", "attributes", "خصائص"],
        flag: "advanced",
      },
      {
        title: { en: "Security", ar: "الأمان" },
        description: {
          en: "Password, 2-step verification and active sessions",
          ar: "كلمة المرور والمصادقة الثنائية والجلسات النشطة",
        },
        icon: Shield,
        to: "/settings/preferences?section=security",
        aliases: ["password", "2fa", "otp", "sessions", "login", "كلمة السر", "الباسورد", "تسجيل الدخول"],
        flag: "danger",
      },
      {
        title: { en: "Display", ar: "العرض" },
        description: {
          en: "Dark mode, font size and motion preferences",
          ar: "الوضع الداكن وحجم الخط وتفضيلات الحركة",
        },
        icon: Monitor,
        to: "/settings/preferences?section=display",
        aliases: ["theme", "dark mode", "font", "ثيم", "الوضع الليلي", "الخط"],
      },
      {
        title: { en: "Profile", ar: "الحساب الشخصي" },
        description: {
          en: "Your personal details and avatar",
          ar: "بياناتك الشخصية والصورة",
        },
        icon: User,
        to: "/profile",
        aliases: ["account", "avatar", "email", "حسابي", "الصورة", "الايميل"],
      },
      {
        title: { en: "Staff", ar: "فريق العمل" },
        description: {
          en: "Invite team members and manage access",
          ar: "ادعُ أعضاء الفريق وأدر صلاحيات الوصول",
        },
        icon: UserCog,
        to: "/staff",
        navKey: "staff.members",
        aliases: ["team", "members", "invite", "employees", "الموظفين", "الفريق", "دعوة"],
      },
      {
        title: { en: "Roles & permissions", ar: "الأدوار والصلاحيات" },
        description: {
          en: "Define what each role can see and do",
          ar: "حدّد ما يستطيع كل دور رؤيته والقيام به",
        },
        icon: Users,
        to: "/roles",
        navKey: "staff.roles",
        aliases: ["access", "permissions", "admin", "صلاحيات", "ادمن"],
        flag: "danger",
        ownerOnly: true,
      },
      {
        title: { en: "Notifications", ar: "الإشعارات" },
        description: {
          en: "Choose which events notify you by email or in-app",
          ar: "حدّد الأحداث التي تصلك عبر البريد أو داخل التطبيق",
        },
        icon: Bell,
        to: "/notifications",
        navKey: "notifications",
        aliases: ["alerts", "email", "push", "تنبيهات"],
      },
    ],
  },
  {
    title: { en: "Finance & billing", ar: "الفوترة والمدفوعات" },
    tone: "saffron",
    items: [
      {
        title: { en: "Plan & subscription", ar: "الخطة والاشتراك" },
        description: {
          en: "Review your plan and billing history",
          ar: "راجع خطتك وسجل الفواتير",
        },
        icon: CreditCard,
        to: "/billing",
        navKey: "payments.billing",
        aliases: ["billing", "upgrade", "plan", "subscription", "الباقة", "الاشتراك", "ترقية"],
        flag: "danger",
        ownerOnly: true,
      },
      {
        title: { en: "Payment methods", ar: "طرق الدفع" },
        description: {
          en: "Connect providers like Stripe, Tap and Paymob",
          ar: "وصّل مزودي الدفع مثل Stripe وTap وPaymob",
        },
        icon: Wallet,
        to: "/payment-setup",
        navKey: "payments.payment-setup",
        aliases: ["paymob", "instapay", "vodafone cash", "fawry", "gateway", "انستاباي", "فودافون كاش", "فوري", "بوابة الدفع"],
        flag: "danger",
      },
      {
        title: { en: "Payouts", ar: "التحويلات" },
        description: {
          en: "Store balance and wallet transfers",
          ar: "رصيد المتجر وتحويلات المحفظة",
        },
        icon: DollarSign,
        to: "/payments",
        navKey: "payments.overview",
        aliases: ["balance", "wallet", "finance", "money", "الرصيد", "المحفظة", "الفلوس", "المالية"],
      },
      {
        title: { en: "Invoices", ar: "الفواتير" },
        description: {
          en: "Invoice templates and issued documents",
          ar: "قوالب الفواتير والمستندات الصادرة",
        },
        icon: Receipt,
        to: "/invoices",
        navKey: "payments.invoices",
        aliases: ["receipt", "vat", "tax", "فاتورة", "ضريبة"],
      },
      {
        title: { en: "Cash on delivery", ar: "الدفع عند الاستلام" },
        description: {
          en: "Reconcile COD collections and couriers",
          ar: "تسوية تحصيلات الدفع عند الاستلام مع شركات الشحن",
        },
        icon: Banknote,
        to: "/cod",
        navKey: "cod",
        aliases: ["cod", "reconcile", "reconciliation", "cash", "كاش", "تسوية", "تحصيل"],
      },
      {
        title: { en: "COD Autopilot", ar: "أوتوبايلوت الدفع عند الاستلام" },
        description: {
          en: "WhatsApp-automated shipping and delivery confirmation",
          ar: "أتمتة الشحن وتأكيد الاستلام عبر واتساب",
        },
        icon: Zap,
        to: "/cod-autopilot",
        navKey: "logistics.cod-autopilot",
        aliases: ["automation", "confirm", "whatsapp", "تأكيد", "اوتوبايلوت", "واتس"],
      },
      {
        title: { en: "Referrals", ar: "الإحالات" },
        description: {
          en: "Refer merchants and track rewards",
          ar: "ادعُ متاجر جديدة وتتبّع المكافآت",
        },
        icon: HandCoins,
        to: "/referrals",
        navKey: "marketing.referrals",
        aliases: ["invite", "rewards", "affiliate", "مكافآت", "دعوة"],
      },
    ],
  },
  {
    title: { en: "Communications", ar: "التواصل" },
    tone: "sage",
    items: [
      {
        title: { en: "Inbox", ar: "صندوق الوارد" },
        description: {
          en: "All customer conversations in one place",
          ar: "كل محادثات العملاء في مكان واحد",
        },
        icon: Inbox,
        to: "/inbox",
        navKey: "channels.inbox",
        aliases: ["messages", "chat", "conversations", "رسائل", "شات", "محادثات"],
      },
      {
        title: { en: "Channels", ar: "القنوات" },
        description: {
          en: "Connect WhatsApp, Messenger and Instagram",
          ar: "وصّل واتساب وMessenger وإنستجرام",
        },
        icon: PlugZap,
        to: "/channels",
        navKey: "channels",
        aliases: ["facebook", "instagram", "messenger", "فيسبوك", "انستجرام", "ماسنجر"],
      },
      {
        title: { en: "Tracking & Pixels", ar: "التتبع والـ Pixels" },
        description: {
          en: "Meta Pixel, Conversions API and audience sync",
          ar: "Meta Pixel وConversions API ومزامنة الجماهير",
        },
        icon: Activity,
        to: "/settings/tracking",
        navKey: "settings.tracking",
        aliases: ["pixel", "capi", "tiktok", "google analytics", "gtm", "بيكسل", "تيك توك"],
        flag: "advanced",
      },
      {
        title: { en: "WhatsApp", ar: "واتساب" },
        description: {
          en: "Templates, campaigns and inbox",
          ar: "القوالب والحملات وصندوق الوارد",
        },
        icon: MessageSquare,
        to: "/whatsapp",
        navKey: "whatsapp",
        aliases: ["templates", "campaigns", "otp", "واتس", "قوالب", "حملات"],
      },
      {
        title: { en: "Social import", ar: "السوشيال ميديا" },
        description: {
          en: "Import products from social catalogs",
          ar: "استورد المنتجات من كتالوجات وسائل التواصل",
        },
        icon: Share2,
        to: "/social",
        navKey: "channels.social",
        aliases: ["instagram", "facebook shop", "catalog", "import", "استيراد", "كتالوج"],
      },
      {
        title: { en: "Marketing", ar: "التسويق" },
        description: {
          en: "Campaigns, discounts and promotions",
          ar: "الحملات والخصومات والعروض",
        },
        icon: Megaphone,
        to: "/marketing",
        navKey: "marketing",
        aliases: ["coupon", "discount", "promo", "offers", "كوبون", "خصم", "عروض"],
      },
    ],
  },
  {
    title: { en: "Online store", ar: "المتجر" },
    tone: "terra",
    items: [
      {
        title: { en: "Themes", ar: "الثيمات" },
        description: {
          en: "Customise the look of your storefront",
          ar: "خصّص مظهر واجهة متجرك",
        },
        icon: Palette,
        to: "/online-store/themes",
        navKey: "online-store.themes",
        aliases: ["design", "customize", "storefront", "look", "تصميم", "شكل المتجر", "ثيم"],
      },
      {
        title: { en: "Pages", ar: "الصفحات" },
        description: {
          en: "About, contact and custom content pages",
          ar: "صفحات \"من نحن\" و\"تواصل معنا\" والصفحات المخصصة",
        },
        icon: FileText,
        to: "/online-store/pages",
        navKey: "online-store.pages",
        aliases: ["about", "contact", "policy", "terms", "سياسة", "من نحن", "تواصل"],
      },
      {
        title: { en: "Navigation", ar: "التنقل" },
        description: {
          en: "Menus and footer links",
          ar: "القوائم وروابط التذييل",
        },
        icon: Navigation2,
        to: "/online-store/navigation",
        navKey: "online-store.navigation",
        aliases: ["menu", "header", "footer", "links", "قائمة", "روابط", "الفوتر"],
      },
      {
        title: { en: "Preferences", ar: "تفضيلات المتجر" },
        description: {
          en: "SEO, favicon, social share and checkout preferences",
          ar: "تحسين محركات البحث والأيقونة وتفضيلات الدفع",
        },
        icon: SlidersHorizontal,
        to: "/online-store/preferences",
        navKey: "online-store.preferences",
        aliases: ["seo", "favicon", "checkout", "google", "سيو", "الدفع", "الايقونة"],
      },
      {
        title: { en: "Products", ar: "المنتجات" },
        description: {
          en: "Catalog, variants and inventory",
          ar: "الكتالوج والمتغيرات والمخزون",
        },
        icon: Package,
        to: "/products",
        navKey: "products",
        aliases: ["inventory", "stock", "variants", "sku", "مخزون", "منتج", "متغيرات"],
      },
      {
        title: { en: "Collections", ar: "المجموعات" },
        description: {
          en: "Group related products for your storefront",
          ar: "جمّع المنتجات المتشابهة لعرضها في المتجر",
        },
        icon: FolderOpen,
        to: "/categories",
        navKey: "products.categories",
        aliases: ["categories", "category", "فئات", "تصنيف", "اقسام"],
      },
    ],
  },
  {
    title: { en: "Operations", ar: "العمليات" },
    tone: "navy",
    items: [
      {
        title: { en: "Shipping & logistics", ar: "الشحن والتوصيل" },
        description: {
          en: "Rates, zones and courier integrations",
          ar: "الأسعار والمناطق وتكاملات شركات الشحن",
        },
        icon: Truck,
        to: "/logistics",
        navKey: "logistics",
        aliases: ["bosta", "aramex", "courier", "zones", "rates", "delivery", "بوسطة", "شركة شحن", "مناطق", "توصيل"],
      },
      {
        title: { en: "Health score", ar: "مؤشر الأداء" },
        description: {
          en: "Store health and recommendations",
          ar: "صحة المتجر والتوصيات",
        },
        icon: TrendingUp,
        to: "/health-score",
        navKey: "analytics.health",
        aliases: ["performance", "grade", "score", "صحة المتجر", "تقييم", "الأداء"],
      },
      {
        title: { en: "Customers", ar: "العملاء" },
        description: {
          en: "Customer list, segments and notes",
          ar: "قائمة العملاء والشرائح والملاحظات",
        },
        icon: UserPlus,
        to: "/customers",
        navKey: "customers",
        aliases: ["clients", "segments", "crm", "عميل", "شرائح"],
      },
    ],
  },
  {
    title: { en: "Developer", ar: "المطورون" },
    tone: "saffron",
    items: [
      {
        title: { en: "Webhooks", ar: "Webhooks" },
        description: {
          en: "Receive realtime events at your endpoint",
          ar: "استقبل الأحداث فور حدوثها على الرابط الخاص بك",
        },
        icon: Webhook,
        to: "/settings/preferences?section=api",
        navKey: "settings.webhooks",
        aliases: ["api", "api key", "integration", "events", "تكامل", "مفتاح"],
        flag: "advanced",
      },
      {
        // Last, owner-only and flagged: a merchant browsing Settings
        // shouldn't be invited to hand an AI agent their store keys by
        // accident. Power users know to look for it.
        title: { en: "Connect your AI (MCP)", ar: "اربط الذكاء الاصطناعي (MCP)" },
        description: {
          en: "Let Claude, ChatGPT or Cursor manage your store — API keys & setup",
          ar: "خلّي Claude أو ChatGPT أو Cursor يدير متجرك — مفاتيح API والإعداد",
        },
        icon: Key,
        to: "/settings/mcp",
        navKey: "settings.mcp",
        aliases: ["mcp", "claude", "chatgpt", "cursor", "ai", "agent", "token", "ذكاء اصطناعي"],
        flag: "advanced",
        ownerOnly: true,
      },
    ],
  },
];

const TONE_CHIP = {
  navy: "ichip-navy",
  saffron: "ichip-saffron",
  sage: "ichip-sage",
  terra: "ichip-terra",
} as const;

const FLAG_STYLE: Record<ItemFlag, { card: string; badge: string }> = {
  advanced: {
    card: "border-amber-300/50 dark:border-amber-500/30",
    badge: "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-300/50",
  },
  danger: {
    card: "border-destructive/30",
    badge: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

export default function Settings() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { isVisible } = useNavConfig();
  const isAr = language === "ar";
  const [query, setQuery] = useState("");

  const isOwner = user?.role === "store_owner";

  // Gating first, search second — a hidden card must never "come back"
  // because a search term matched it.
  const visibleSections = useMemo(
    () =>
      SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => (!item.ownerOnly || isOwner) && (!item.navKey || isVisible(item.navKey)),
        ),
      })).filter((section) => section.items.length > 0),
    [isOwner, isVisible],
  );

  const filteredSections = useMemo(() => {
    const q = normalizeArabic(query);
    if (!q) return visibleSections;
    return visibleSections
      .map((section) => {
        const sectionHit = normalizeArabic(`${section.title.en} ${section.title.ar}`).includes(q);
        return {
          ...section,
          items: sectionHit
            ? section.items
            : section.items.filter((item) =>
                normalizeArabic(
                  [
                    item.title.en,
                    item.title.ar,
                    item.description.en,
                    item.description.ar,
                    ...(item.aliases ?? []),
                  ].join(" "),
                ).includes(q),
              ),
        };
      })
      .filter((section) => section.items.length > 0);
  }, [query, visibleSections]);

  /* Souq Settings hub — display title, prominent search, brand-tinted
     ichip icons per section (a fixed tone per section, so colours no
     longer reshuffle as search filters sections out). Section headers
     carry a count badge. High-risk cards (money, access, API keys) get a
     tinted border + label so they read differently from "Display". */
  return (
    <div className="space-y-7">
      <PageHeader
        title={isAr ? "الإعدادات" : "Settings"}
        subtitle={isAr ? "إدارة متجرك وحسابك من مكان واحد" : "Manage your store and account from one place"}
        className="md:items-end"
        actions={
          <div className="relative w-full md:w-96">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAr ? "دوّر في الإعدادات…" : "Search settings…"}
              className="ps-11"
              aria-label={isAr ? "ابحث في الإعدادات" : "Search settings"}
            />
          </div>
        }
      />

      {filteredSections.length === 0 ? (
        <EmptyState
          icon={Search}
          title={isAr ? "مفيش نتائج" : "No matches"}
          description={
            isAr
              ? `لا يوجد إعداد بـ "${query}". جرّب كلمة تانية.`
              : `Nothing matches "${query}". Try another keyword.`
          }
          className="rounded-2xl border border-dashed border-border-strong"
        />
      ) : (
        filteredSections.map((section) => {
          const tone = TONE_CHIP[section.tone];
          return (
            <section key={section.title.en} className="space-y-3">
              {/* Section header — eyebrow + count */}
              <div className="flex items-center justify-between gap-3 pb-1">
                <h2 className="souq-eyebrow">
                  § {isAr ? section.title.ar : section.title.en}
                </h2>
                <span className="text-[11px] font-bold tabular-nums text-ink-faint">
                  {isAr ? section.items.length.toLocaleString("ar-EG") : section.items.length}
                  {" "}{isAr ? "عنصر" : section.items.length === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const flag = item.flag ? FLAG_STYLE[item.flag] : null;
                  return (
                    <Link
                      key={item.title.en + item.to}
                      to={item.to}
                      className={cn(
                        "group flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover-lift",
                        flag?.card,
                      )}
                    >
                      <div className={`ichip ${tone} shrink-0`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-[14px] font-bold leading-snug">
                            {isAr ? item.title.ar : item.title.en}
                          </h3>
                          {(item.flag || item.ownerOnly) && (
                            <span className="flex shrink-0 items-center gap-1">
                              {item.ownerOnly && (
                                <Lock
                                  className="h-3 w-3 text-ink-faint"
                                  aria-label={t("settings.ownerOnly")}
                                />
                              )}
                              {item.flag && (
                                <Badge
                                  variant="outline"
                                  className={cn("text-[9.5px] px-1.5 py-0 rounded-md", flag?.badge)}
                                >
                                  {t(`settings.flag.${item.flag}`)}
                                </Badge>
                              )}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
                          {isAr ? item.description.ar : item.description.en}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
