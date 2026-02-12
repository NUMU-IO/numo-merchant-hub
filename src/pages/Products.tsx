import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { products as allProducts, type Product, type ProductStatus } from "@/data/mock-products";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

const Products = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProductStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const formatCurrency = (val: number) =>
    language === "ar" ? `${val.toLocaleString("ar-EG")} ج.م` : `EGP ${val.toLocaleString()}`;

  const filtered = allProducts.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.nameAr.includes(search);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusColor: Record<ProductStatus, string> = {
    published: "bg-primary/10 text-primary",
    draft: "bg-yellow-100 text-yellow-700",
    archived: "bg-muted text-muted-foreground",
  };

  const handleAddProduct = () => {
    setDialogOpen(false);
    toast.success(language === "ar" ? "تم إضافة المنتج بنجاح!" : "Product added successfully!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("products.title")}</h1>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t("products.addProduct")}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("products.search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">{t("products.all")}</TabsTrigger>
                <TabsTrigger value="published">{t("products.published")}</TabsTrigger>
                <TabsTrigger value="draft">{t("products.draft")}</TabsTrigger>
                <TabsTrigger value="archived">{t("products.archived")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t("products.noProducts")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("products.image")}</TableHead>
                  <TableHead>{t("products.name")}</TableHead>
                  <TableHead>{t("products.price")}</TableHead>
                  <TableHead>{t("products.stock")}</TableHead>
                  <TableHead>{t("products.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xl">{p.image}</span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{language === "ar" ? p.nameAr : p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(p.price)}</TableCell>
                    <TableCell>{p.stock}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColor[p.status]}>
                        {t(`products.${p.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Product Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("products.addProductTitle")}</DialogTitle>
            <DialogDescription>{language === "ar" ? "أدخل تفاصيل المنتج الجديد" : "Enter new product details"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>{t("products.productName")}</Label>
              <Input placeholder={language === "ar" ? "اسم المنتج" : "Product name"} />
            </div>
            <div className="grid gap-2">
              <Label>{t("products.description")}</Label>
              <Textarea placeholder={language === "ar" ? "وصف المنتج" : "Product description"} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("products.price")}</Label>
                <Input type="number" placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label>{t("products.stock")}</Label>
                <Input type="number" placeholder="0" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("products.status")}</Label>
              <Select defaultValue="draft">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("products.draft")}</SelectItem>
                  <SelectItem value="published">{t("products.published")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("products.cancel")}</Button>
            <Button onClick={handleAddProduct}>{t("products.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
