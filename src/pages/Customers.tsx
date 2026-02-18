import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Search, UserPlus } from "lucide-react";

const mockCustomers = [
  { id: "1", name: "Ahmed Hassan", nameAr: "أحمد حسن", email: "ahmed@example.com", orders: 12, spent: 4500, status: "active" },
  { id: "2", name: "Sara Mohamed", nameAr: "سارة محمد", email: "sara@example.com", orders: 8, spent: 2800, status: "active" },
  { id: "3", name: "Omar Ali", nameAr: "عمر علي", email: "omar@example.com", orders: 3, spent: 950, status: "inactive" },
  { id: "4", name: "Fatma Youssef", nameAr: "فاطمة يوسف", email: "fatma@example.com", orders: 15, spent: 6200, status: "active" },
  { id: "5", name: "Khaled Ibrahim", nameAr: "خالد إبراهيم", email: "khaled@example.com", orders: 1, spent: 350, status: "inactive" },
];

export default function Customers() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const formatCurrency = (val: number) =>
    isAr ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.customers")}</h1>
          <p className="text-sm text-muted-foreground">
            {isAr ? "إدارة عملاء متجرك" : "Manage your store customers"}
          </p>
        </div>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          {isAr ? "إضافة عميل" : "Add Customer"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: isAr ? "إجمالي العملاء" : "Total Customers", value: "124", icon: Users },
          { label: isAr ? "عملاء نشطين" : "Active", value: "98" },
          { label: isAr ? "عملاء جدد الشهر ده" : "New This Month", value: "12" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{isAr ? "قائمة العملاء" : "Customer List"}</CardTitle>
            <div className="relative w-64">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={isAr ? "بحث..." : "Search..."} className="ps-9 h-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isAr ? "الاسم" : "Name"}</TableHead>
                <TableHead>{isAr ? "الإيميل" : "Email"}</TableHead>
                <TableHead>{isAr ? "الطلبات" : "Orders"}</TableHead>
                <TableHead>{isAr ? "إجمالي الإنفاق" : "Total Spent"}</TableHead>
                <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockCustomers.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40">
                  <TableCell className="font-medium">{isAr ? c.nameAr : c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email}</TableCell>
                  <TableCell>{c.orders}</TableCell>
                  <TableCell className="tabular-nums">{formatCurrency(c.spent)}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-xs">
                      {c.status === "active" ? (isAr ? "نشط" : "Active") : (isAr ? "غير نشط" : "Inactive")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
