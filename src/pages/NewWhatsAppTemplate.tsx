import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useDashboardStore } from "@/contexts/StoreContext";
import { createTemplate, submitTemplate } from "@/services/templatesApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, X, AlertTriangle } from "lucide-react";

interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
}

export const NewWhatsAppTemplate = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("ar");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("MARKETING");
  const [header, setHeader] = useState("");
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [showWarning, setShowWarning] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createTemplate>[1]) => createTemplate(storeId!, data),
    onSuccess: (template) => {
      submitMutation.mutate(template.id);
    },
  });

  const submitMutation = useMutation({
    mutationFn: (templateId: string) => submitTemplate(storeId!, templateId),
    onSuccess: () => {
      navigate("/channels/whatsapp/templates");
    },
  });

  const handleAddButton = () => {
    setButtons([...buttons, { type: "QUICK_REPLY", text: "" }]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleButtonChange = (index: number, field: keyof TemplateButton, value: string) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setButtons(newButtons);
  };

  const handleSubmit = () => {
    const forbiddenPatterns = [
      /free/i,
      /winner/i,
      /congratulations/i,
      /claim now/i,
      /limited time/i,
      /urgent/i,
      /act now/i,
    ];

    const hasForbidden = forbiddenPatterns.some(
      (pattern) => pattern.test(body) || pattern.test(header)
    );

    if (hasForbidden) {
      setShowWarning(true);
      return;
    }

    createMutation.mutate({
      name,
      language,
      category,
      header: header || undefined,
      body,
      footer: footer || undefined,
      buttons: buttons.length > 0 ? buttons : undefined,
    });
  };

  if (!storeId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">{t("omnichannel.new_template")}</h1>
        <p className="text-muted-foreground mt-2">{t("common.loading")}</p>
      </div>
    );
  }

  const isPending = createMutation.isPending || submitMutation.isPending;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("omnichannel.new_template")}</h1>
      </div>

      {showWarning && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Business-Focused AI Policy Warning</p>
            <p className="text-sm text-yellow-700 mt-1">
              Your template contains language that may violate Meta's Business-Focused AI policy.
              Templates with words like "free", "winner", "limited time", or "act now" may be rejected.
              Please revise your content before submitting.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setShowWarning(false)}
            >
              Edit Template
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("omnichannel.template_name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., order_confirmation"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("omnichannel.template_language")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">Arabic (ar)</SelectItem>
                  <SelectItem value="en">English (en)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("omnichannel.template_category")}</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as typeof category)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MARKETING">
                  {t("omnichannel.category_marketing")}
                </SelectItem>
                <SelectItem value="UTILITY">{t("omnichannel.category_utility")}</SelectItem>
                <SelectItem value="AUTHENTICATION">
                  {t("omnichannel.category_authentication")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="header">{t("omnichannel.template_header")} (optional)</Label>
            <Input
              id="header"
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              placeholder="Enter header text"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">
              {t("omnichannel.template_body")} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter message body"
              rows={5}
              required
            />
            <p className="text-xs text-muted-foreground">
              Use {"{{1}}"}, {"{{2}}"} for variables
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer">{t("omnichannel.template_footer")} (optional)</Label>
            <Input
              id="footer"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Enter footer text"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("omnichannel.template_buttons")} (optional)</Label>
            <div className="space-y-2">
              {buttons.map((button, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={button.type}
                    onValueChange={(v) =>
                      handleButtonChange(index, "type", v)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                      <SelectItem value="URL">URL</SelectItem>
                      <SelectItem value="PHONE_NUMBER">Phone</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={button.text}
                    onChange={(e) =>
                      handleButtonChange(index, "text", e.target.value)
                    }
                    placeholder="Button text"
                    className="flex-1"
                  />
                  {button.type === "URL" && (
                    <Input
                      value={button.url || ""}
                      onChange={(e) =>
                        handleButtonChange(index, "url", e.target.value)
                      }
                      placeholder="https://..."
                      className="w-40"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveButton(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleAddButton}>
              <Plus className="h-4 w-4 mr-1" />
              Add Button
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/channels/whatsapp/templates")}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!name || !body || isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          {t("omnichannel.submit_for_approval")}
        </Button>
      </div>
    </div>
  );
};

export default NewWhatsAppTemplate;