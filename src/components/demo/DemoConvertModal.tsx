import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/services/api";

interface DemoConvertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  store_name: string;
  subdomain: string;
  phone: string;
}

const DemoConvertModal: React.FC<DemoConvertModalProps> = ({ open, onOpenChange }) => {
  const { language } = useLanguage();
  const { refreshUser } = useAuth();
  const isAr = language === "ar";

  const [form, setForm] = useState<FormData>({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    store_name: "",
    subdomain: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiClient("/demo/convert", {
        method: "POST",
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          first_name: form.first_name,
          last_name: form.last_name,
          store_name: form.store_name,
          subdomain: form.subdomain.toLowerCase().trim(),
          phone: form.phone || null,
        }),
      });

      // Success — cookies were swapped by the API response.
      // Hard-reload so the entire app re-initializes with the new session.
      window.location.href = "/";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      setError(
        msg || (isAr ? "حصلت مشكلة. حاول تاني." : "Something went wrong. Please try again.")
      );
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isAr ? "احفظ شغلك — ابدأ حسابك" : "Save your work — create your account"}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? "هتبدأ تجربة مجانية ٣٠ يوم. مش هنطلب منك بطاقة دلوقتي."
              : "You'll start a free 30-day trial. No credit card required now."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="first_name">{isAr ? "الاسم الأول" : "First name"}</Label>
              <Input id="first_name" required value={form.first_name} onChange={set("first_name")} disabled={loading} />
            </div>
            <div>
              <Label htmlFor="last_name">{isAr ? "الاسم الأخير" : "Last name"}</Label>
              <Input id="last_name" required value={form.last_name} onChange={set("last_name")} disabled={loading} />
            </div>
          </div>

          <div>
            <Label htmlFor="email">{isAr ? "البريد الإلكتروني" : "Email"}</Label>
            <Input id="email" type="email" required value={form.email} onChange={set("email")} disabled={loading} dir="ltr" />
          </div>

          <div>
            <Label htmlFor="password">{isAr ? "كلمة المرور" : "Password"}</Label>
            <Input id="password" type="password" required minLength={8} value={form.password} onChange={set("password")} disabled={loading} dir="ltr" />
          </div>

          <div>
            <Label htmlFor="store_name">{isAr ? "اسم المتجر" : "Store name"}</Label>
            <Input id="store_name" required value={form.store_name} onChange={set("store_name")} disabled={loading} />
          </div>

          <div>
            <Label htmlFor="subdomain">{isAr ? "رابط المتجر" : "Store URL"}</Label>
            <div className="flex items-center gap-1">
              <Input
                id="subdomain"
                required
                minLength={3}
                maxLength={63}
                value={form.subdomain}
                onChange={set("subdomain")}
                disabled={loading}
                dir="ltr"
                placeholder="mystore"
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground shrink-0">.numu.io</span>
            </div>
          </div>

          <div>
            <Label htmlFor="phone">{isAr ? "رقم الموبايل (اختياري)" : "Phone (optional)"}</Label>
            <Input id="phone" type="tel" value={form.phone} onChange={set("phone")} disabled={loading} dir="ltr" placeholder="+201..." />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? (isAr ? "جاري الحفظ..." : "Saving...")
              : (isAr ? "احفظ وابدأ التجربة المجانية" : "Save & start free trial")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DemoConvertModal;
