import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, ShoppingCart, Package, Plus, MoreHorizontal, X,
  CreditCard, Truck, Banknote, Receipt, Megaphone, BarChart3,
  Share2, Store, Bell, Settings, Users, FolderOpen, Wallet,
  Tag, FileEdit, ShoppingBag, MessageCircle, Inbox, Mail, Send,
  Sparkles, Gift, MapPin, PlugZap, Boxes, ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listOrders } from "@/services/orderApi";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type IconType = typeof Home;

const MobileBottomNav = () => {
  const { isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentStore } = useDashboardStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Orders count badge (pending+processing) — same signal the Dashboard
  // attention bar uses so the badge stays in sync.
  const ordersQuery = useQuery({
    queryKey: ["mnav", "ordersCount", currentStore?.id],
    queryFn: () => listOrders(currentStore!.id, { page: 1, limit: 1, status: "pending" }),
    enabled: !!currentStore?.id,
    staleTime: 60_000,
  });
  const pendingOrders = ordersQuery.data?.total ?? 0;

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  // ─── Quick add sheet items — matches Souq spec (Product / Order / Discount) ──
  const quickAdd: { Icon: IconType; label: string; tone: string; href: string }[] = [
    { Icon: Package, label: isRTL ? "منتج جديد" : "New product", tone: "ichip-navy", href: "/products/new" },
    { Icon: ShoppingCart, label: isRTL ? "طلب جديد" : "New order", tone: "ichip-saffron", href: "/orders/create" },
    { Icon: Tag, label: isRTL ? "خصم جديد" : "New discount", tone: "ichip-sage", href: "/marketing/promotions/new" },
  ];

  // ─── More sheet — grouped tiles mirroring the desktop sidebar IA ──
  type Tile = { Icon: IconType; label: string; href: string };
  const moreGroups: { label: string; tiles: Tile[] }[] = [
    {
      label: isRTL ? "البيع والنمو" : "Sell & grow",
      tiles: [
        { Icon: Store, label: isRTL ? "المتجر" : "Online Store", href: "/online-store/themes" },
        { Icon: Megaphone, label: isRTL ? "التسويق" : "Marketing", href: "/marketing" },
        { Icon: BarChart3, label: isRTL ? "التحليلات" : "Analytics", href: "/analytics/overview" },
        { Icon: Sparkles, label: isRTL ? "الإحالات" : "Referrals", href: "/referrals" },
      ],
    },
    {
      label: isRTL ? "الفلوس" : "Money",
      tiles: [
        { Icon: Wallet, label: isRTL ? "المالية" : "Finance", href: "/payments" },
        { Icon: Banknote, label: isRTL ? "الاستلام" : "COD", href: "/cod" },
        { Icon: Receipt, label: isRTL ? "الفواتير" : "Invoices", href: "/invoices" },
        { Icon: CreditCard, label: isRTL ? "إعداد الدفع" : "Payment setup", href: "/payment-setup" },
        { Icon: Gift, label: isRTL ? "بطاقات هدايا" : "Gift cards", href: "/gift-cards" },
      ],
    },
    {
      label: isRTL ? "العمليات" : "Operations",
      tiles: [
        { Icon: Truck, label: isRTL ? "الشحن" : "Logistics", href: "/logistics" },
        { Icon: MapPin, label: isRTL ? "المناطق" : "Zones", href: "/shipping/zones" },
        { Icon: Inbox, label: isRTL ? "الرسائل" : "Inbox", href: "/inbox" },
        { Icon: MessageCircle, label: isRTL ? "واتساب" : "WhatsApp", href: "/whatsapp" },
        { Icon: Mail, label: isRTL ? "قوالب البريد" : "Email", href: "/email-templates" },
        { Icon: PlugZap, label: isRTL ? "القنوات" : "Channels", href: "/channels" },
        { Icon: Users, label: isRTL ? "الفريق" : "Staff", href: "/staff" },
        { Icon: Boxes, label: isRTL ? "التطبيقات" : "Apps", href: "/apps" },
      ],
    },
    {
      label: isRTL ? "الإضافات" : "More",
      tiles: [
        { Icon: FolderOpen, label: isRTL ? "الفئات" : "Categories", href: "/categories" },
        { Icon: ShoppingBag, label: isRTL ? "السلال المهجورة" : "Abandoned", href: "/orders/abandoned" },
        { Icon: FileEdit, label: isRTL ? "المسودات" : "Drafts", href: "/orders/drafts" },
        { Icon: Send, label: isRTL ? "الحملات" : "Campaigns", href: "/campaigns" },
        { Icon: Share2, label: isRTL ? "السوشيال" : "Social", href: "/social" },
        { Icon: Bell, label: isRTL ? "الإشعارات" : "Notifications", href: "/notifications" },
        { Icon: Settings, label: isRTL ? "الإعدادات" : "Settings", href: "/settings" },
      ],
    },
  ];

  const goAdd = (href: string) => { setAddOpen(false); navigate(href); };
  const goMore = (href: string) => { setMenuOpen(false); navigate(href); };

  // ─── Bottom nav tabs (Souq spec: Home · Orders · +FAB · Products · More) ─
  type Tab = { key: string; label: string; Icon: IconType; path?: string; fab?: boolean; onClick?: () => void; count?: number };
  const tabs: Tab[] = [
    { key: "home", label: isRTL ? "الرئيسية" : "Home", Icon: Home, path: "/" },
    { key: "orders", label: isRTL ? "الطلبات" : "Orders", Icon: ShoppingCart, path: "/orders", count: pendingOrders },
    { key: "add", label: isRTL ? "إضافة" : "Add", Icon: Plus, fab: true, onClick: () => setAddOpen(true) },
    { key: "products", label: isRTL ? "المنتجات" : "Products", Icon: Package, path: "/products" },
    { key: "more", label: isRTL ? "المزيد" : "More", Icon: MoreHorizontal, onClick: () => setMenuOpen(true) },
  ];

  return (
    <>
      {/* Souq mobile chrome — 76px frosted bar, raised navy FAB at the
          center (Quick add), saffron count badge on Orders. */}
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-border bg-background/90 backdrop-blur-lg safe-bottom">
        <div className="flex items-stretch justify-around h-[76px] px-2 pt-2 pb-3">
          {tabs.map((tab) => {
            const active = tab.path ? isActive(tab.path) : false;
            const onTap = tab.onClick ?? (() => tab.path && navigate(tab.path));
            return (
              <button
                key={tab.key}
                type="button"
                onClick={onTap}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 flex-1 rounded-2xl transition-colors cursor-pointer ${
                  tab.fab
                    ? "text-saffron"
                    : active
                      ? "text-navy dark:text-saffron"
                      : "text-ink-faint hover:text-foreground"
                }`}
              >
                {tab.fab ? (
                  <div className="mnav-fab">
                    <tab.Icon className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                ) : (
                  <span className="relative">
                    <tab.Icon className={`h-[25px] w-[25px] ${active ? "stroke-[2.5]" : ""}`} />
                    {tab.count && tab.count > 0 ? (
                      <span className="absolute -top-1.5 -end-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-saffron px-1 text-[10px] font-extrabold text-navy-900 ring-2 ring-background tabular-nums">
                        {tab.count > 9 ? "9+" : tab.count}
                      </span>
                    ) : null}
                  </span>
                )}
                <span className={`text-[10.5px] leading-none ${active || tab.fab ? "font-bold" : "font-semibold"}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Quick add bottom sheet — 3 brand-tinted rows */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-base font-extrabold">{isRTL ? "إضافة سريعة" : "Quick add"}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2.5 pt-4 pb-2">
            {quickAdd.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => goAdd(item.href)}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 hover-lift text-start"
              >
                <div className={`ichip ${item.tone} shrink-0`}>
                  <item.Icon className="h-5 w-5" />
                </div>
                <span className="text-[15px] font-bold flex-1">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* More sheet — grouped IA tiles (matches Souq spec: section labels
          + tile grid per group, scrollable). */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[88vh] flex flex-col">
          <SheetHeader className="flex-row items-center justify-between">
            <SheetTitle className="text-base font-extrabold">{isRTL ? "كل الأقسام" : "All sections"}</SheetTitle>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="h-9 w-9 rounded-xl bg-card border border-border grid place-items-center"
              aria-label={isRTL ? "إغلاق" : "Close"}
            >
              <X className="h-4 w-4" />
            </button>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-3 space-y-5">
            {moreGroups.map((group) => (
              <div key={group.label}>
                <h3 className="souq-eyebrow mb-2 px-1">§ {group.label}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {group.tiles.map((tile) => (
                    <button
                      key={tile.href}
                      type="button"
                      onClick={() => goMore(tile.href)}
                      className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 transition-colors hover:bg-muted/50 ${
                        isActive(tile.href) ? "border-navy" : "border-border"
                      }`}
                    >
                      <div className="ichip ichip-navy !w-[38px] !h-[38px]">
                        <tile.Icon className="h-[18px] w-[18px]" />
                      </div>
                      <span className="text-[11px] font-semibold text-center leading-tight line-clamp-2">
                        {tile.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default MobileBottomNav;
