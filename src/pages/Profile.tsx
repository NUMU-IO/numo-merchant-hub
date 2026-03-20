import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  User, Mail, Phone, Shield, Calendar, Key,
  Loader2, Camera, CheckCircle2, AlertCircle,
} from "lucide-react";
import { changePassword, updateProfile } from "@/services/authApi";
import { useDashboardStore } from "@/contexts/StoreContext";
import { uploadStoreAsset } from "@/services/storeApi";

export default function Profile() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [isSaving, setIsSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
      });
      if (refreshUser) await refreshUser();
      toast.success(isAr ? "تم حفظ الملف الشخصي" : "Profile saved successfully");
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!currentStore?.id) return;
    setUploadingAvatar(true);
    try {
      const result = await uploadStoreAsset(currentStore.id, file, "profile_picture");
      await updateProfile({ avatar_url: result.url });
      if (refreshUser) await refreshUser();
      toast.success(isAr ? "تم تحديث الصورة" : "Avatar updated");
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(isAr ? "كلمات المرور غير متطابقة" : "Passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error(isAr ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل" : "Password must be at least 8 characters");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success(isAr ? "تم تغيير كلمة المرور. تم إنهاء جميع الجلسات الأخرى." : "Password changed. All other sessions have been revoked.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      showError(err, language);
    } finally {
      setChangingPassword(false);
    }
  };

  const initials = `${(user?.first_name || "N").charAt(0)}${(user?.last_name || "").charAt(0)}`.toUpperCase();

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {isAr ? "الملف الشخصي" : "Profile"}
        </h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {isAr ? "إدارة معلوماتك الشخصية وأمان حسابك" : "Manage your personal information and account security"}
        </p>
      </div>

      {/* Avatar & Basic Info */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <label className="relative group cursor-pointer">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                  e.target.value = "";
                }}
              />
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="h-20 w-20 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 text-background animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-background" />
                )}
              </div>
            </label>
            <div className="flex-1 space-y-1">
              <h2 className="text-lg font-semibold">
                {user?.first_name} {user?.last_name}
              </h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                {user?.is_verified ? (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {isAr ? "مُفعّل" : "Verified"}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-200 gap-1">
                    {isAr ? "غير مُفعّل" : "Unverified"}
                  </Badge>
                )}
                {user?.trial_ends_at && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    {isAr ? "فترة تجريبية" : "Trial"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm">{isAr ? "المعلومات الشخصية" : "Personal Information"}</CardTitle>
              <CardDescription className="text-xs">{isAr ? "تحديث بياناتك الأساسية" : "Update your basic details"}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="text-xs font-medium">{isAr ? "الاسم الأول" : "First Name"}</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">{isAr ? "الاسم الأخير" : "Last Name"}</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-muted-foreground" />
              {isAr ? "البريد الإلكتروني" : "Email"}
            </Label>
            <Input value={user?.email || ""} disabled className="h-9 text-sm bg-muted/40" />
            <p className="text-[11px] text-muted-foreground">
              {isAr ? "لا يمكن تغيير البريد الإلكتروني" : "Email cannot be changed"}
            </p>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Phone className="h-3 w-3 text-muted-foreground" />
              {isAr ? "رقم الهاتف" : "Phone Number"}
            </Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+201012345678" dir="ltr" className="h-9 text-sm" />
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveProfile} disabled={isSaving} size="sm" className="gap-2 rounded-lg">
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isAr ? "حفظ التغييرات" : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
              <Key className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-sm">{isAr ? "تغيير كلمة المرور" : "Change Password"}</CardTitle>
              <CardDescription className="text-xs">{isAr ? "تحديث كلمة مرور حسابك" : "Update your account password"}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-xs font-medium">{isAr ? "كلمة المرور الحالية" : "Current Password"}</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="text-xs font-medium">{isAr ? "كلمة المرور الجديدة" : "New Password"}</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium">{isAr ? "تأكيد كلمة المرور" : "Confirm Password"}</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleChangePassword} disabled={changingPassword || !currentPassword || !newPassword} variant="outline" size="sm" className="gap-2 rounded-lg">
              {changingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isAr ? "تغيير كلمة المرور" : "Change Password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
              <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-sm">{isAr ? "معلومات الحساب" : "Account Information"}</CardTitle>
              <CardDescription className="text-xs">{isAr ? "تفاصيل حسابك" : "Your account details"}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: isAr ? "معرف الحساب" : "Account ID", value: user?.id?.slice(0, 8) || "—" },
              { label: isAr ? "تاريخ الانضمام" : "Member Since", value: user?.created_at ? new Date(user.created_at).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "long", day: "numeric", year: "numeric" }) : "—" },
              { label: isAr ? "نهاية الفترة التجريبية" : "Trial Ends", value: user?.trial_ends_at ? new Date(user.trial_ends_at).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "long", day: "numeric", year: "numeric" }) : (isAr ? "لا يوجد" : "N/A") },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg p-2.5 -mx-2.5 hover:bg-muted/50 transition-colors">
                <span className="text-[13px] text-muted-foreground">{item.label}</span>
                <span className="text-[13px] font-medium tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/5 rounded-lg text-xs">
            {isAr ? "حذف الحساب" : "Delete Account"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}