import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import StoreLinkShare from "@/components/StoreLinkShare";
import { useDashboardStore } from "@/contexts/StoreContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPublicStoreUrl } from "@/lib/storefront";

/** The store's shareable link on the dashboard home. On day one, getting it
 *  out is the job, not which theme version is installed. */
export function StoreLinkCard() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore } = useDashboardStore();
  const url = getPublicStoreUrl(currentStore);
  if (!currentStore || !url) return null;

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">{isAr ? "رابط متجرك" : "Your store link"}</p>
          <p className="truncate text-[14px] font-bold">{currentStore.name}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0 gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold"
          onClick={() => navigate("/online-store/themes/editor-v3")}
        >
          <Pencil className="h-3.5 w-3.5" />
          {isAr ? "عدّل الشكل" : "Customize"}
        </Button>
      </div>
      <StoreLinkShare url={url} storeName={currentStore.name} />
    </div>
  );
}

export default StoreLinkCard;
