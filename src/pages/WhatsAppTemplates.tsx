import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDashboardStore } from "@/contexts/StoreContext";
import { listTemplates, type WhatsAppTemplate } from "@/services/templatesApi";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { enUS } from "date-fns/locale";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useState } from "react";

const statusColors = {
  PENDING: "bg-yellow-500",
  APPROVED: "bg-green-500",
  REJECTED: "bg-red-500",
};

export const WhatsAppTemplates = () => {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const isRTL = i18n.language === "ar";
  const locale = isRTL ? ar : enUS;

  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["whatsapp-templates", storeId],
    queryFn: () => listTemplates(storeId!),
    enabled: !!storeId,
  });

  if (!storeId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">WhatsApp Templates</h1>
        <p className="text-muted-foreground mt-2">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">WhatsApp Templates</h1>
        <Button onClick={() => navigate("/channels/whatsapp/templates/new")}>
          <Plus className="h-4 w-4 mr-2" />
          {t("omnichannel.new_template")}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data?.templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No templates yet</p>
          <Button
            variant="link"
            onClick={() => navigate("/channels/whatsapp/templates/new")}
            className="mt-2"
          >
            {t("omnichannel.new_template")}
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("omnichannel.template_name")}</TableHead>
              <TableHead>{t("omnichannel.template_language")}</TableHead>
              <TableHead>{t("omnichannel.template_category")}</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{t("dashboard.date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.templates.map((template) => (
              <TableRow
                key={template.id}
                className="cursor-pointer"
                onClick={() => setSelectedTemplate(template)}
              >
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell>{template.language}</TableCell>
                <TableCell>
                  {template.category === "MARKETING"
                    ? t("omnichannel.category_marketing")
                    : template.category === "UTILITY"
                    ? t("omnichannel.category_utility")
                    : t("omnichannel.category_authentication")}
                </TableCell>
                <TableCell>
                  <Badge className={`${statusColors[template.status]} text-white`}>
                    {template.status === "PENDING"
                      ? t("omnichannel.template_pending")
                      : template.status === "APPROVED"
                      ? t("omnichannel.template_approved")
                      : t("omnichannel.template_rejected")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {formatDistanceToNow(new Date(template.created_at), {
                    addSuffix: true,
                    locale,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Sheet open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedTemplate?.name}</SheetTitle>
          </SheetHeader>
          {selectedTemplate && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                <Badge className={`${statusColors[selectedTemplate.status]} text-white`}>
                  {selectedTemplate.status}
                </Badge>
              </div>
              {selectedTemplate.rejection_reason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800">Rejection Reason</p>
                  <p className="text-sm text-red-600 mt-1">
                    {selectedTemplate.rejection_reason}
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {selectedTemplate.components.map((comp, idx) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      {comp.type}
                    </p>
                    <p className="text-sm">{comp.text}</p>
                    {comp.buttons && comp.buttons.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {comp.buttons.map((btn, btnIdx) => (
                          <Badge key={btnIdx} variant="outline">
                            {btn.text}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default WhatsAppTemplates;