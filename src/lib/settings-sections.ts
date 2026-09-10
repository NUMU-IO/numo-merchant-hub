/**
 * Settings IA — the single list behind BOTH the Settings hub page
 * (`pages/Settings.tsx` card grid) and the sidebar's Settings tab
 * (`layout/AppSidebar.tsx`, Zid-style drill-in list). Gating
 * (navKey / ownerOnly) is applied by the consumers via
 * `visibleSettingsSections`, so a card the admin hid from the page can
 * never reappear in the sidebar.
 */
import type { ComponentType } from "react";
import {
  // general
  Globe, Shield, Monitor, User, Store as StoreIcon, UserCog, Users,
  // billing & finance
  CreditCard, Wallet, Receipt, Banknote, DollarSign, HandCoins, Zap, Landmark,
  // communications
  Bell, Inbox, MessageSquare, Megaphone, Share2, PlugZap, Activity,
  // store & ops
  Palette, FileText, Navigation2, SlidersHorizontal, Package, FolderOpen,
  Truck, Key, Webhook, TrendingUp, UserPlus, Tag, Sparkles,
} from "lucide-react";

export type IconType = ComponentType<{ className?: string }>;

/** `advanced` = technical, easy to misuse; `danger` = money / access. */
export type ItemFlag = "advanced" | "danger";

export interface SettingItem {
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

export interface SettingSection {
  title: { en: string; ar: string };
  /** Tone is a property of the section, not its position — filtering used
      to reshuffle colours as sections dropped out of the search results. */
  tone: "navy" | "saffron" | "sage" | "terra";
  items: SettingItem[];
}

export const SETTINGS_SECTIONS: SettingSection[] = [
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
        title: { en: "Sector & capabilities", ar: "القطاع والإمكانيات" },
        description: {
          en: "Set up your store for its sector and choose what it can do",
          ar: "جهّز متجرك حسب قطاعه واختر الإمكانيات المفعّلة",
        },
        icon: Sparkles,
        to: "/settings/sectors",
        aliases: [
          "sector",
          "preset",
          "industry",
          "capabilities",
          "قطاع",
          "نشاط",
          "إمكانيات",
        ],
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
        title: { en: "Business details", ar: "بيانات النشاط" },
        description: {
          en: "Registration, tax ID and payout account",
          ar: "التسجيل الضريبي والرقم الضريبي وحساب التحويل",
        },
        icon: Landmark,
        to: "/settings/business",
        navKey: "payments.invoices",
        aliases: [
          "business",
          "tax",
          "vat",
          "payout",
          "bank",
          "iban",
          "kyc",
          "نشاط",
          "ضريبة",
          "بنك",
          "تحويل",
        ],
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

/** Apply nav-config + owner gating; drops sections left empty. */
export function visibleSettingsSections(
  isVisible: (key: string) => boolean,
  isOwner: boolean,
): SettingSection[] {
  return SETTINGS_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => (!item.ownerOnly || isOwner) && (!item.navKey || isVisible(item.navKey)),
    ),
  })).filter((section) => section.items.length > 0);
}
