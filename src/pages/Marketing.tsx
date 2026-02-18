import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Tag, Gift, Mail, Plus } from "lucide-react";

const mockCampaigns = [
  { id: "1", name: "Summer Sale", nameAr: "تخفيضات الصيف", type: "discount", status: "active", discount: "20%" },
  { id: "2", name: "New Arrivals", nameAr: "وصل حديثاً", type: "email", status: "scheduled", discount: null },
  { id: "3", name: "Eid Offer", nameAr: "عرض العيد", type: "coupon", status: "ended", discount: "15%" },
];

export default function Marketing() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const typeIcons: Record<string, any> = { discount: Tag, email: Mail, coupon: Gift };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            {t("nav.marketing")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAr ? "أدر حملاتك التسويقية وكوبوناتك" : "Manage your campaigns and coupons"}
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {isAr ? "حملة جديدة" : "New Campaign"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: isAr ? "حملات نشطة" : "Active Campaigns", value: "3" },
          { label: isAr ? "كوبونات مستخدمة" : "Coupons Used", value: "156" },
          { label: isAr ? "إيرادات من التسويق" : "Marketing Revenue", value: isAr ? "٤٥,٠٠٠ ج.م" : "EGP 45,000" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaigns */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockCampaigns.map((c) => {
          const Icon = typeIcons[c.type] || Tag;
          return (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-sm">{isAr ? c.nameAr : c.name}</CardTitle>
                  </div>
                  <Badge
                    variant={c.status === "active" ? "default" : c.status === "scheduled" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {c.status === "active" ? (isAr ? "نشط" : "Active") :
                     c.status === "scheduled" ? (isAr ? "مجدول" : "Scheduled") :
                     (isAr ? "انتهى" : "Ended")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {c.discount && (
                  <p className="text-lg font-bold text-primary">{c.discount} {isAr ? "خصم" : "OFF"}</p>
                )}
                <Button variant="outline" size="sm" className="w-full mt-3">
                  {isAr ? "عرض التفاصيل" : "View Details"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
