/**
 * TrackableLinkBuilder — produce a tagged storefront URL + QR for a campaign.
 *
 * Wraps the backend's POST /campaigns/{id}/trackable-link endpoint with
 * a destination-kind selector (homepage / collection / product /
 * custom) plus source/medium/term/content controls. Custom paths are
 * pre-validated through the PathValidator child (SEC-002 hardened on
 * the backend) so the merchant never produces a broken link.
 *
 * Once generated, the URL + QR PNG (server-rendered) are handed off to
 * QrCodeDisplay for the copy/download affordances.
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  generateTrackableLink,
  type TrackableLinkDestinationKind,
  type TrackableLinkResponse,
  type TrackableLinkSource,
} from "@/services/campaignApi";
import { listProducts, type ApiProductResponse } from "@/services/productApi";
import { showError } from "@/lib/show-error";
import { PathValidator } from "./PathValidator";
import { QrCodeDisplay } from "./QrCodeDisplay";

interface TrackableLinkBuilderProps {
  storeId: string;
  campaignId: string;
  /** Used as the suggested download filename when the QR is saved. */
  campaignSlug?: string;
}

const SOURCES: TrackableLinkSource[] = [
  "facebook",
  "instagram",
  "whatsapp",
  "email",
  "tiktok",
  "sms",
  "qr",
  "other",
];

export function TrackableLinkBuilder({
  storeId,
  campaignId,
  campaignSlug,
}: TrackableLinkBuilderProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [kind, setKind] = useState<TrackableLinkDestinationKind>("product");
  const [productId, setProductId] = useState<string>("");
  const [products, setProducts] = useState<ApiProductResponse[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [collectionSlug, setCollectionSlug] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [customPathValid, setCustomPathValid] = useState<string | null>(null);

  const [source, setSource] = useState<TrackableLinkSource>("facebook");
  const [medium, setMedium] = useState("");
  const [term, setTerm] = useState("");
  const [content, setContent] = useState("");

  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<TrackableLinkResponse | null>(null);

  useEffect(() => {
    if (kind !== "product" || products.length > 0 || productsLoading) return;
    setProductsLoading(true);
    listProducts(storeId, { limit: 100, sort_by: "updated_at", sort_order: "desc" })
      .then((res) => setProducts(res.items))
      .catch((err) => showError(err))
      .finally(() => setProductsLoading(false));
  }, [kind, storeId, products.length, productsLoading]);

  const canGenerate = useMemo(() => {
    if (generating) return false;
    if (kind === "product") return !!productId;
    if (kind === "collection") return collectionSlug.trim().length > 0;
    if (kind === "custom") return !!customPathValid;
    return true; // homepage
  }, [generating, kind, productId, collectionSlug, customPathValid]);

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await generateTrackableLink(storeId, campaignId, {
        destination:
          kind === "product"
            ? { kind: "product", product_id: productId }
            : kind === "collection"
              ? { kind: "collection", collection_slug: collectionSlug.trim() }
              : kind === "custom"
                ? { kind: "custom", custom_path: customPathValid || customPath }
                : { kind: "homepage" },
        source,
        medium: medium.trim() || null,
        term: term.trim() || null,
        content: content.trim() || null,
      });
      setResult(res);
      toast.success(isAr ? "تم توليد الرابط" : "Link generated");
    } catch (err) {
      showError(err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {isAr ? "إنشاء رابط قابل للتتبع" : "Generate trackable link"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Destination */}
        <div className="space-y-2">
          <Label>{isAr ? "الوجهة" : "Destination"}</Label>
          <RadioGroup
            value={kind}
            onValueChange={(v) => setKind(v as TrackableLinkDestinationKind)}
            className="flex flex-wrap gap-3"
          >
            {(["homepage", "collection", "product", "custom"] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <RadioGroupItem value={k} id={`dest-${k}`} />
                <Label htmlFor={`dest-${k}`} className="cursor-pointer text-sm">
                  {(() => {
                    if (isAr) {
                      return {
                        homepage: "الرئيسية",
                        collection: "مجموعة",
                        product: "منتج",
                        custom: "مسار مخصص",
                      }[k];
                    }
                    return {
                      homepage: "Homepage",
                      collection: "Collection",
                      product: "Product",
                      custom: "Custom path",
                    }[k];
                  })()}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {kind === "product" && (
          <div className="space-y-1.5">
            <Label htmlFor="product-pick">
              {isAr ? "اختر المنتج" : "Pick a product"}
            </Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="product-pick">
                <SelectValue
                  placeholder={
                    productsLoading
                      ? isAr ? "جارٍ التحميل…" : "Loading…"
                      : isAr ? "اختر منتجاً" : "Select a product"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {kind === "collection" && (
          <div className="space-y-1.5">
            <Label htmlFor="collection-slug">
              {isAr ? "معرّف المجموعة" : "Collection slug"}
            </Label>
            <Input
              id="collection-slug"
              dir="ltr"
              placeholder="summer-2026"
              value={collectionSlug}
              onChange={(e) => setCollectionSlug(e.target.value)}
            />
          </div>
        )}

        {kind === "custom" && (
          <PathValidator
            storeId={storeId}
            value={customPath}
            onChange={setCustomPath}
            onValidPathChange={setCustomPathValid}
          />
        )}

        {/* Source preset */}
        <div className="space-y-1.5">
          <Label htmlFor="source">{isAr ? "المصدر" : "Source"}</Label>
          <Select
            value={source}
            onValueChange={(v) => setSource(v as TrackableLinkSource)}
          >
            <SelectTrigger id="source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Optional UTM fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="medium">
              {isAr ? "وسيط (اختياري)" : "Medium (optional)"}
            </Label>
            <Input
              id="medium"
              dir="ltr"
              placeholder="social"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="term">
              {isAr ? "مصطلح (اختياري)" : "Term (optional)"}
            </Label>
            <Input
              id="term"
              dir="ltr"
              placeholder="linen-collection"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="content">
              {isAr ? "محتوى (اختياري)" : "Content (optional)"}
            </Label>
            <Input
              id="content"
              dir="ltr"
              placeholder="banner-v2"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="gap-2"
        >
          {generating && <Loader2 className="h-4 w-4 animate-spin" />}
          {isAr ? "إنشاء" : "Generate"}
        </Button>

        {result && (
          <div className="pt-2 border-t">
            <QrCodeDisplay
              url={result.url}
              qrPngBase64={result.qr_png_base64}
              downloadName={`${campaignSlug || result.campaign_slug}-qr`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
