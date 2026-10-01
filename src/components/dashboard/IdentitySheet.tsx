import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { errorMessage } from "@/lib/api-error";
import { updateStore, uploadStoreAsset } from "@/services/storeApi";

/** "Make it yours" in one focused sheet: a logo and one sentence about the
 *  store, with the storefront header previewed as they type. The full /store
 *  settings page stays for everything else. */
export function IdentitySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { currentStore, refetchStores } = useDashboardStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLogoFile(null);
    setLogoPreview(currentStore?.logo_url || null);
    setDescription(currentStore?.description || "");
  }, [open, currentStore?.logo_url, currentStore?.description]);

  const pickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!currentStore?.id) return;
    setSaving(true);
    try {
      const logo_url = logoFile ? (await uploadStoreAsset(currentStore.id, logoFile, "logo")).url : undefined;
      await updateStore(currentStore.id, { ...(logo_url ? { logo_url } : {}), description: description.trim() || null });
      await refetchStores(currentStore.id);
      toast.success(isAr ? "شكله حلو عليك 👌" : "Looking good 👌");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, language));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isAr ? "left" : "right"} className="space-y-5">
        <SheetHeader>
          <SheetTitle>{isAr ? "خلّي متجرك شبهك" : "Make it yours"}</SheetTitle>
          <SheetDescription>
            {isAr ? "لوجو وجملة واحدة عن متجرك — بتظهر لعملائك فوق." : "A logo and one sentence about your store — customers see them up top."}
          </SheetDescription>
        </SheetHeader>

        {/* Live mini header: what the storefront's top bar will show. */}
        <div className="rounded-xl border bg-white p-4 flex items-center gap-3 text-[#1a1a1a]">
          {logoPreview ? (
            <img src={logoPreview} alt="" className="h-10 max-w-[120px] object-contain" />
          ) : (
            <span className="text-lg font-bold">{currentStore?.name}</span>
          )}
          <span className="ms-auto text-[11px] text-neutral-500 line-clamp-2 max-w-[55%]">{description}</span>
        </div>

        <div className="space-y-2">
          <Label>{isAr ? "اللوجو" : "Logo"}</Label>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={pickLogo} />
          <Button type="button" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
            {logoPreview ? (isAr ? "غيّر اللوجو" : "Change logo") : (isAr ? "ارفع اللوجو" : "Upload logo")}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="identity-description">{isAr ? "جملة عن متجرك" : "One sentence about your store"}</Label>
          <Textarea
            id="identity-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={160}
            rows={3}
            placeholder={isAr ? "مثال: فخار مرسوم بالإيد من المنصورة" : "e.g. Hand-painted pottery from Mansoura"}
          />
        </div>

        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isAr ? "تمام كده" : "Save"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
