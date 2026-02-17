/**
 * CreateStore — onboarding page for merchants to create their first store.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDashboardStore } from "@/contexts/StoreContext";
import { createStore, checkSubdomain } from "@/services/storeApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, Store } from "lucide-react";

const STOREFRONT_HOST =
  import.meta.env.VITE_STOREFRONT_HOST || "localhost:8080";

export default function CreateStore() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refetchStores } = useDashboardStore();

  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("ar");
  const [currency, setCurrency] = useState("EGP");

  const [subdomainStatus, setSubdomainStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [subdomainMsg, setSubdomainMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-generate subdomain from name
  useEffect(() => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (slug.length >= 3) {
      setSubdomain(slug);
    }
  }, [name]);

  // Debounced subdomain availability check
  useEffect(() => {
    if (subdomain.length < 3) {
      setSubdomainStatus("idle");
      return;
    }

    setSubdomainStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const result = await checkSubdomain(subdomain);
        setSubdomainStatus(result.available ? "available" : "taken");
        setSubdomainMsg(result.message);
      } catch {
        setSubdomainStatus("invalid");
        setSubdomainMsg("Could not check subdomain");
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [subdomain]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subdomainStatus !== "available") return;
    setError(null);
    setLoading(true);

    try {
      await createStore({
        name,
        subdomain,
        description: description || undefined,
        default_language: language,
        default_currency: currency,
      });
      await refetchStores();
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const subdomainIcon =
    subdomainStatus === "checking" ? (
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    ) : subdomainStatus === "available" ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : subdomainStatus === "taken" || subdomainStatus === "invalid" ? (
      <XCircle className="h-4 w-4 text-destructive" />
    ) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center mb-2">
            <Store className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">{t("createStore.title")}</CardTitle>
          <CardDescription>{t("createStore.subtitle")}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">{t("createStore.storeName")}</Label>
              <Input
                id="storeName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("createStore.storeNamePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdomain">{t("createStore.subdomain")}</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="subdomain"
                    value={subdomain}
                    onChange={(e) =>
                      setSubdomain(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "")
                      )
                    }
                    placeholder="mystore"
                    minLength={3}
                    maxLength={63}
                    required
                  />
                  {subdomainIcon && (
                    <div className="absolute inset-y-0 end-2 flex items-center">
                      {subdomainIcon}
                    </div>
                  )}
                </div>
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  .{STOREFRONT_HOST}
                </span>
              </div>
              {subdomainStatus !== "idle" &&
                subdomainStatus !== "checking" && (
                  <p
                    className={`text-xs ${
                      subdomainStatus === "available"
                        ? "text-green-600"
                        : "text-destructive"
                    }`}
                  >
                    {subdomainMsg}
                  </p>
                )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                {t("createStore.description")}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("createStore.descriptionPlaceholder")}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("createStore.language")}</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("createStore.currency")}</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EGP">EGP (ج.م)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="SAR">SAR (ر.س)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || subdomainStatus !== "available"}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("createStore.create")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
