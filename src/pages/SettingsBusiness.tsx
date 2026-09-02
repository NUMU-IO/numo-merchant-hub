/**
 * Settings → Business details.
 *
 * Registration status, tax id, and where non-COD money should land.
 *
 * Nothing on this page gates anything. The store sells exactly the same
 * with every field empty, and the copy says so — a form that looks like a
 * compliance wall when it is not will cost more merchants than it helps.
 * The reason to fill it in is that gateway KYC, compliant invoices and
 * payouts all need it eventually, and answering now is cheaper than
 * answering under deadline.
 *
 * The account number is write-only. It is sent once and comes back as a
 * masked tail; the field renders empty on load with the stored tail shown
 * beside it, because pre-filling a bank field with a real number invites
 * an accidental overwrite and pre-filling it with a mask sends the mask
 * back to the server the next time somebody saves.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingsBreadcrumb } from "@/components/layout/SettingsBreadcrumb";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { showError } from "@/lib/show-error";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import {
  getBusinessProfile,
  updateBusinessProfile,
  type BusinessProfileUpdate,
} from "@/services/businessProfileApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BadgeCheck, Building2, Landmark, Loader2 } from "lucide-react";

export default function SettingsBusiness() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const storeId = useDashboardStore().currentStore?.id;
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["business-profile", storeId],
    queryFn: () => getBusinessProfile(storeId!),
    enabled: !!storeId,
  });

  const [registered, setRegistered] = useState<boolean | null>(null);
  const [taxId, setTaxId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  // Seed once the profile arrives. The account number is deliberately
  // never seeded — see the file docstring.
  useEffect(() => {
    if (!profile) return;
    setRegistered(profile.isRegisteredBusiness);
    setTaxId(profile.taxId ?? "");
    setBankName(profile.payoutBankName ?? "");
    setAccountName(profile.payoutAccountName ?? "");
  }, [profile]);

  const save = useMutation({
    mutationFn: (update: BusinessProfileUpdate) =>
      updateBusinessProfile(storeId!, update),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["business-profile", storeId] });
      setAccountNumber("");
      // Which sections merchants actually fill in, and whether they ever
      // reach a complete profile. No field values — only whether each
      // part is now present.
      track("business_profile_saved", {
        is_registered_business: saved.isRegisteredBusiness,
        has_tax_id: !!saved.taxId,
        has_payout_account: saved.hasPayoutAccount,
        is_complete: saved.isComplete,
      });
      toast.success(isAr ? "تم الحفظ" : "Saved");
    },
    onError: (e) => showError(e),
  });

  const handleSave = () => {
    // Only send what was actually filled in. An empty string would be a
    // request to clear the field, and a merchant who edited one section
    // must not blank another by saving.
    const update: BusinessProfileUpdate = {};
    if (registered !== null) update.is_registered_business = registered;
    if (taxId.trim()) update.tax_id = taxId.trim();
    if (bankName.trim()) update.payout_bank_name = bankName.trim();
    if (accountName.trim()) update.payout_account_name = accountName.trim();
    if (accountNumber.trim())
      update.payout_account_number = accountNumber.trim();
    save.mutate(update);
  };

  const YesNo = ({ value, label }: { value: boolean; label: string }) => (
    <button
      type="button"
      onClick={() => setRegistered(value)}
      className={[
        "px-4 py-2 rounded-lg border-2 text-sm transition-all duration-200",
        "hover:border-foreground/30 hover:bg-accent/50",
        registered === value
          ? "border-foreground bg-accent font-medium"
          : "border-border/50 bg-card",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <SettingsBreadcrumb
          current={isAr ? "بيانات النشاط" : "Business details"}
        />
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
          {isAr ? "بيانات النشاط" : "Business details"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {isAr
            ? "دي بيانات النشاط التجاري وحساب التحويل. متجرك شغال عادي من غيرها — بنطلبها علشان تفعيل بوابات الدفع والفواتير الرسمية وتحويل الأرباح لما تحتاجها."
            : "Your business registration and where payouts should land. Your store sells exactly the same without them — they matter when you enable card payments, issue formal invoices, or take a payout."}
        </p>
      </div>

      {profile?.isComplete && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <BadgeCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {isAr
              ? "بياناتك كاملة — جاهز لبوابات الدفع والفواتير."
              : "Your details are complete — ready for card payments and formal invoices."}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            {isAr ? "التسجيل الضريبي" : "Registration"}
          </CardTitle>
          <CardDescription>
            {isAr
              ? "النشاط مسجل رسمياً؟ لو لأ، مفيش مشكلة — سيبها وكمّل."
              : "Is the business formally registered? If not, that's fine — leave it and carry on."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <YesNo value={true} label={isAr ? "مسجل" : "Registered"} />
            <YesNo
              value={false}
              label={isAr ? "مش مسجل" : "Not registered"}
            />
          </div>

          {registered && (
            <div className="space-y-2 max-w-sm">
              <Label htmlFor="tax-id">
                {isAr ? "الرقم الضريبي" : "Tax ID"}
              </Label>
              <Input
                id="tax-id"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                maxLength={50}
                placeholder="123-456-789"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "بيظهر على الفواتير الرسمية."
                  : "Appears on formal invoices."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4" />
            {isAr ? "حساب التحويل" : "Payout account"}
          </CardTitle>
          <CardDescription>
            {isAr
              ? "الحساب اللي هيتحول عليه فلوس المدفوعات الإلكترونية. الدفع عند الاستلام بيتحصّل عن طريق شركة الشحن زي ما هو."
              : "Where money from card and wallet payments lands. Cash on delivery is still collected by your courier as before."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="bank">{isAr ? "البنك" : "Bank"}</Label>
              <Input
                id="bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                maxLength={120}
                placeholder={isAr ? "البنك التجاري الدولي" : "CIB"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-name">
                {isAr ? "اسم صاحب الحساب" : "Account holder name"}
              </Label>
              <Input
                id="account-name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                maxLength={160}
              />
            </div>
          </div>

          <div className="space-y-2 max-w-sm">
            <Label htmlFor="account-number">
              {isAr ? "رقم الحساب / IBAN" : "Account number / IBAN"}
            </Label>
            <Input
              id="account-number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              maxLength={64}
              dir="ltr"
              placeholder={
                profile?.payoutMasked
                  ? isAr
                    ? "سيبه فاضي علشان متغيرش الحساب"
                    : "Leave empty to keep the current account"
                  : "EG38 0001 ..."
              }
            />
            {profile?.payoutMasked && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  {profile.payoutMasked}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {isAr ? "الحساب المحفوظ" : "currently saved"}
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {isAr
                ? "بنخزّن الرقم مشفّر، ومبيظهرش تاني بعد الحفظ."
                : "Stored encrypted. It is never shown again after saving."}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!storeId || isLoading || save.isPending}
          className="gap-1.5"
        >
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isAr ? "حفظ" : "Save"}
        </Button>
      </div>
    </div>
  );
}
