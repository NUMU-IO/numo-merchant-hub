import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, ShoppingCart, Package, Users, Megaphone } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavItemGate } from "@/components/layout/NavItemGate";
import { cn } from "@/lib/utils";

type Entry = {
  key: string;
  navKey: string;
  icon: typeof Plus;
  title: string;
  hint: string;
  href: string;
  /** Letter for Alt+Shift+<letter>. */
  shortcut: string;
};

/**
 * Zid-style "+ Add" menu in the top bar: Orders / Products / Customers /
 * Marketing, each with an Alt+Shift+<letter> shortcut that works anywhere
 * in the hub (ignored while typing in a field).
 */
export function AddMenu({ className }: { className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const entries: Entry[] = [
    { key: "order", navKey: "orders", icon: ShoppingCart, title: t("header.addOrder"), hint: t("header.addOrderHint"), href: "/orders/create", shortcut: "O" },
    { key: "product", navKey: "products", icon: Package, title: t("header.addProduct"), hint: t("header.addProductHint"), href: "/products/new", shortcut: "N" },
    { key: "customer", navKey: "customers", icon: Users, title: t("header.addCustomer"), hint: t("header.addCustomerHint"), href: "/customers/import", shortcut: "C" },
    { key: "marketing", navKey: "marketing", icon: Megaphone, title: t("header.addMarketing"), hint: t("header.addMarketingHint"), href: "/marketing/promotions/new", shortcut: "M" },
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.altKey && e.shiftKey) || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      const hit = entries.find((x) => x.shortcut === e.key.toUpperCase());
      if (!hit) return;
      e.preventDefault();
      navigate(hit.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-saffron px-3.5 text-[13px] font-bold text-navy-900 shadow-sm transition-colors hover:bg-saffron-600 hover:text-white",
            className,
          )}
          aria-label={t("header.add")}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          <span className="hidden sm:inline">{t("header.add")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-[300px] rounded-2xl p-1.5">
        {entries.map((x) => (
          <NavItemGate key={x.key} navKey={x.navKey}>
            <DropdownMenuItem
              onClick={() => navigate(x.href)}
              className="cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5"
            >
              <span className="ichip ichip-navy mt-0.5 !h-9 !w-9 shrink-0 rounded-lg">
                <x.icon className="!h-[18px] !w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold">{x.title}</span>
                <span className="block text-[12px] text-muted-foreground">{x.hint}</span>
              </span>
              <kbd className="ms-2 mt-1 hidden shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                Alt+Shift+{x.shortcut}
              </kbd>
            </DropdownMenuItem>
          </NavItemGate>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default AddMenu;
