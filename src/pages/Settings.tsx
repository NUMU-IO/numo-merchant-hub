import { useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import {
  // general
  Globe, Shield, Monitor, User, Store as StoreIcon, UserCog, Users,
  // billing & finance
  CreditCard, Wallet, Receipt, Banknote, DollarSign, HandCoins,
  // communications
  Bell, Inbox, MessageSquare, Megaphone, Share2, PlugZap, Activity,
  // store & ops
  Palette, FileText, Navigation2, SlidersHorizontal, Package, FolderOpen,
  Truck, Key, Webhook, TrendingUp, UserPlus,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";

type IconType = ComponentType<{ className?: string }>;

interface SettingItem {
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  icon: IconType;
  to: string;
}

interface SettingSection {
  title: { en: string; ar: string };
  items: SettingItem[];
}

const SECTIONS: SettingSection[] = [
  {
    title: { en: "General", ar: "عام" },
    items: [
      {
        title: { en: "Store profile", ar: "إعدادات المتجر" },
        description: {
          en: "Store name, contact info, address and business details",
          ar: "اسم المتجر وبيانات التواصل والعنوان وتفاصيل النشاط",
        },
        icon: StoreIcon,
        to: "/store",
      },
      {
        title: { en: "Language & region", ar: "اللغة والمنطقة" },
        description: {
          en: "Default language, timezone and currency",
          ar: "اللغة والمنطقة الزمنية والعملة",
        },
        icon: Globe,
        to: "/settings/preferences?section=general",
      },
      {
        title: { en: "Security", ar: "الأمان" },
        description: {
          en: "Password, 2-step verification and active sessions",
          ar: "كلمة المرور والمصادقة الثنائية والجلسات النشطة",
        },
        icon: Shield,
        to: "/settings/preferences?section=security",
      },
      {
        title: { en: "Display", ar: "العرض" },
        description: {
          en: "Dark mode, font size and motion preferences",
          ar: "الوضع الداكن وحجم الخط وتفضيلات الحركة",
        },
        icon: Monitor,
        to: "/settings/preferences?section=display",
      },
      {
        title: { en: "Profile", ar: "الحساب الشخصي" },
        description: {
          en: "Your personal details and avatar",
          ar: "بياناتك الشخصية والصورة",
        },
        icon: User,
        to: "/profile",
      },
      {
        title: { en: "Staff", ar: "فريق العمل" },
        description: {
          en: "Invite team members and manage access",
          ar: "ادعُ أعضاء الفريق وأدر صلاحيات الوصول",
        },
        icon: UserCog,
        to: "/staff",
      },
      {
        title: { en: "Roles & permissions", ar: "الأدوار والصلاحيات" },
        description: {
          en: "Define what each role can see and do",
          ar: "حدّد ما يستطيع كل دور رؤيته والقيام به",
        },
        icon: Users,
        to: "/roles",
      },
      {
        title: { en: "Notifications", ar: "الإشعارات" },
        description: {
          en: "Choose which events notify you by email or in-app",
          ar: "حدّد الأحداث التي تصلك عبر البريد أو داخل التطبيق",
        },
        icon: Bell,
        to: "/notifications",
      },
    ],
  },
  {
    title: { en: "Finance & billing", ar: "الفوترة والمدفوعات" },
    items: [
      {
        title: { en: "Plan & subscription", ar: "الخطة والاشتراك" },
        description: {
          en: "Review your plan and billing history",
          ar: "راجع خطتك وسجل الفواتير",
        },
        icon: CreditCard,
        to: "/billing",
      },
      {
        title: { en: "Payment methods", ar: "طرق الدفع" },
        description: {
          en: "Connect providers like Stripe, Tap and Paymob",
          ar: "وصّل مزودي الدفع مثل Stripe وTap وPaymob",
        },
        icon: Wallet,
        to: "/payment-setup",
      },
      {
        title: { en: "Payouts", ar: "التحويلات" },
        description: {
          en: "Store balance and wallet transfers",
          ar: "رصيد المتجر وتحويلات المحفظة",
        },
        icon: DollarSign,
        to: "/payments",
      },
      {
        title: { en: "Invoices", ar: "الفواتير" },
        description: {
          en: "Invoice templates and issued documents",
          ar: "قوالب الفواتير والمستندات الصادرة",
        },
        icon: Receipt,
        to: "/invoices",
      },
      {
        title: { en: "Cash on delivery", ar: "الدفع عند الاستلام" },
        description: {
          en: "Reconcile COD collections and couriers",
          ar: "تسوية تحصيلات الدفع عند الاستلام مع شركات الشحن",
        },
        icon: Banknote,
        to: "/cod",
      },
      {
        title: { en: "Referrals", ar: "الإحالات" },
        description: {
          en: "Refer merchants and track rewards",
          ar: "ادعُ متاجر جديدة وتتبّع المكافآت",
        },
        icon: HandCoins,
        to: "/referrals",
      },
    ],
  },
  {
    title: { en: "Communications", ar: "التواصل" },
    items: [
      {
        title: { en: "Inbox", ar: "صندوق الوارد" },
        description: {
          en: "All customer conversations in one place",
          ar: "كل محادثات العملاء في مكان واحد",
        },
        icon: Inbox,
        to: "/inbox",
      },
      {
        title: { en: "Channels", ar: "القنوات" },
        description: {
          en: "Connect WhatsApp, Messenger and Instagram",
          ar: "وصّل واتساب وMessenger وإنستجرام",
        },
        icon: PlugZap,
        to: "/channels",
      },
      {
        title: { en: "Tracking & Pixels", ar: "التتبع والـ Pixels" },
        description: {
          en: "Meta Pixel, Conversions API and audience sync",
          ar: "Meta Pixel وConversions API ومزامنة الجماهير",
        },
        icon: Activity,
        to: "/settings/tracking",
      },
      {
        title: { en: "WhatsApp", ar: "واتساب" },
        description: {
          en: "Templates, campaigns and inbox",
          ar: "القوالب والحملات وصندوق الوارد",
        },
        icon: MessageSquare,
        to: "/whatsapp",
      },
      {
        title: { en: "Social import", ar: "السوشيال ميديا" },
        description: {
          en: "Import products from social catalogs",
          ar: "استورد المنتجات من كتالوجات وسائل التواصل",
        },
        icon: Share2,
        to: "/social",
      },
      {
        title: { en: "Marketing", ar: "التسويق" },
        description: {
          en: "Campaigns, discounts and promotions",
          ar: "الحملات والخصومات والعروض",
        },
        icon: Megaphone,
        to: "/marketing",
      },
    ],
  },
  {
    title: { en: "Online store", ar: "المتجر" },
    items: [
      {
        title: { en: "Themes", ar: "الثيمات" },
        description: {
          en: "Customise the look of your storefront",
          ar: "خصّص مظهر واجهة متجرك",
        },
        icon: Palette,
        to: "/online-store/themes",
      },
      {
        title: { en: "Pages", ar: "الصفحات" },
        description: {
          en: "About, contact and custom content pages",
          ar: "صفحات \"من نحن\" و\"تواصل معنا\" والصفحات المخصصة",
        },
        icon: FileText,
        to: "/online-store/pages",
      },
      {
        title: { en: "Navigation", ar: "التنقل" },
        description: {
          en: "Menus and footer links",
          ar: "القوائم وروابط التذييل",
        },
        icon: Navigation2,
        to: "/online-store/navigation",
      },
      {
        title: { en: "Preferences", ar: "تفضيلات المتجر" },
        description: {
          en: "SEO, favicon, social share and checkout preferences",
          ar: "تحسين محركات البحث والأيقونة وتفضيلات الدفع",
        },
        icon: SlidersHorizontal,
        to: "/online-store/preferences",
      },
      {
        title: { en: "Products", ar: "المنتجات" },
        description: {
          en: "Catalog, variants and inventory",
          ar: "الكتالوج والمتغيرات والمخزون",
        },
        icon: Package,
        to: "/products",
      },
      {
        title: { en: "Collections", ar: "المجموعات" },
        description: {
          en: "Group related products for your storefront",
          ar: "جمّع المنتجات المتشابهة لعرضها في المتجر",
        },
        icon: FolderOpen,
        to: "/categories",
      },
    ],
  },
  {
    title: { en: "Operations", ar: "العمليات" },
    items: [
      {
        title: { en: "Shipping & logistics", ar: "الشحن والتوصيل" },
        description: {
          en: "Rates, zones and courier integrations",
          ar: "الأسعار والمناطق وتكاملات شركات الشحن",
        },
        icon: Truck,
        to: "/logistics",
      },
      {
        title: { en: "Health score", ar: "مؤشر الأداء" },
        description: {
          en: "Store health and recommendations",
          ar: "صحة المتجر والتوصيات",
        },
        icon: TrendingUp,
        to: "/health-score",
      },
      {
        title: { en: "Customers", ar: "العملاء" },
        description: {
          en: "Customer list, segments and notes",
          ar: "قائمة العملاء والشرائح والملاحظات",
        },
        icon: UserPlus,
        to: "/customers",
      },
    ],
  },
  {
    title: { en: "Developer", ar: "المطورون" },
    items: [
      {
        title: { en: "API keys", ar: "مفاتيح API" },
        description: {
          en: "Generate live and test API keys",
          ar: "أنشئ مفاتيح API للعمل الفعلي والاختبار",
        },
        icon: Key,
        to: "/settings/preferences?section=api",
      },
      {
        title: { en: "Webhooks", ar: "Webhooks" },
        description: {
          en: "Receive realtime events at your endpoint",
          ar: "استقبل الأحداث فور حدوثها على الرابط الخاص بك",
        },
        icon: Webhook,
        to: "/settings/preferences?section=api",
      },
    ],
  },
];

export default function Settings() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const haystack = [
          item.title.en,
          item.title.ar,
          item.description.en,
          item.description.ar,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      }),
    })).filter((section) => section.items.length > 0);
  }, [query]);

  /* Souq Settings hub — display title, prominent search, brand-tinted
     ichip icons cycled per section (navy / saffron / sage / terra) so
     each section reads as a coherent group rather than a wall of grey.
     Section headers got a count badge so merchants see "12 items" at
     a glance. Empty search state uses the brand EmptyState pattern. */
  const SECTION_TONES = ["ichip-navy", "ichip-saffron", "ichip-sage", "ichip-terra"] as const;

  return (
    <div className="space-y-7">
      {/* Page head */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
            {isAr ? "الإعدادات" : "Settings"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAr
              ? "إدارة متجرك وحسابك من مكان واحد"
              : "Manage your store and account from one place"}
          </p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isAr ? "دوّر في الإعدادات…" : "Search settings…"}
            className="ps-11"
          />
        </div>
      </div>

      {filteredSections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong py-16 text-center">
          <div className="ichip ichip-saffron ichip-lg mx-auto mb-4">
            <Search />
          </div>
          <h3 className="text-base font-extrabold tracking-tight mb-1.5">
            {isAr ? "مفيش نتائج" : "No matches"}
          </h3>
          <p className="text-[13px] text-ink-soft max-w-sm mx-auto">
            {isAr
              ? `لا يوجد إعداد بـ "${query}". جرّب كلمة تانية.`
              : `Nothing matches "${query}". Try another keyword.`}
          </p>
        </div>
      ) : (
        filteredSections.map((section, sIdx) => {
          const tone = SECTION_TONES[sIdx % SECTION_TONES.length];
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
                  return (
                    <Link
                      key={item.title.en + item.to}
                      to={item.to}
                      className="group flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover-lift"
                    >
                      <div className={`ichip ${tone} shrink-0`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[14px] font-bold leading-snug">
                          {isAr ? item.title.ar : item.title.en}
                        </h3>
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
