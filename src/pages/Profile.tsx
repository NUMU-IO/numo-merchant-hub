import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PhoneInput, isValidE164 } from "@/components/forms/PhoneInput";
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  ArrowLeft, Loader2, Camera, Trash2, Upload as UploadIcon, Eye, EyeOff,
} from "lucide-react";
import { changePassword, updateProfile } from "@/services/authApi";
import { useDashboardStore } from "@/contexts/StoreContext";
import { uploadStoreAsset } from "@/services/storeApi";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { useNavigate } from "react-router-dom";

const NUMU_PRIMARY = "hsl(222.2, 47.4%, 11.2%)";

export default function Profile() {
  const { language } = useLanguage();
  const { user, refreshUser } = useAuth();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const navigate = useNavigate();

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);

  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [isSaving, setIsSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const initials = `${(user?.first_name || "N").charAt(0)}${(user?.last_name || "").charAt(0)}`.toUpperCase();

  const handleSave = async () => {
    if (phone && !isValidE164(phone)) {
      toast.error(
        isAr ? "رقم الهاتف غير صالح" : "Please enter a valid phone number",
      );
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({ first_name: firstName, last_name: lastName, phone: phone || null });
      if (refreshUser) await refreshUser();
      toast.success(isAr ? "تم حفظ البيانات" : "Profile saved");
    } catch (e) { showError(e, language); }
    finally { setIsSaving(false); }
  };

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => { setCropImageSrc(reader.result as string); setShowCropDialog(true); };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    try { await updateProfile({ avatar_url: null }); if (refreshUser) await refreshUser(); toast.success(isAr ? "تم إزالة الصورة" : "Avatar removed"); setShowAvatarPreview(false); }
    catch (e) { showError(e, language); }
    finally { setUploadingAvatar(false); }
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!currentStore?.id) return;
    setUploadingAvatar(true);
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const result = await uploadStoreAsset(currentStore.id, file, "profile_picture");
      await updateProfile({ avatar_url: result.url });
      if (refreshUser) await refreshUser();
      toast.success(isAr ? "تم تحديث الصورة" : "Avatar updated");
      setShowCropDialog(false); setCropImageSrc(null);
    } catch (e) { showError(e, language); }
    finally { setUploadingAvatar(false); }
  };

  const handleChangePw = async () => {
    if (newPw !== confirmPw) { toast.error(isAr ? "كلمات المرور غير متطابقة" : "Passwords don't match"); return; }
    if (newPw.length < 8) { toast.error(isAr ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل" : "Min 8 characters"); return; }
    setChangingPw(true);
    try { await changePassword(currentPw, newPw); toast.success(isAr ? "تم تغيير كلمة المرور" : "Password changed"); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }
    catch (e) { showError(e, language); }
    finally { setChangingPw(false); }
  };

  return (
    <div className="p-6 max-w-[800px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "إعدادات الحساب" : "Account Settings"}</h1>
        </div>
        <Button size="sm" className="h-8 text-xs rounded-lg gap-1.5" onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
          {isAr ? "حفظ" : "Save"}
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════════
         SECTION 1: بيانات الحساب — Account Data
         ═══════════════════════════════════════════════════════ */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-bold">{isAr ? "بيانات الحساب" : "Account Details"}</h2>
        </div>
        <div className="p-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4 pb-5 border-b">
            <div className="relative group">
              <button
                type="button"
                onClick={() => user?.avatar_url ? setShowAvatarPreview(true) : document.getElementById("avatar-input")?.click()}
                className="relative cursor-pointer"
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-16 w-16 rounded-2xl object-cover border" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-bold text-primary-foreground" style={{ background: NUMU_PRIMARY }}>
                    {initials}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar ? <Loader2 className="h-4 w-4 text-background animate-spin" /> : <Camera className="h-4 w-4 text-background" />}
                </div>
              </button>
              <input id="avatar-input" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
            </div>
            <div>
              <p className="text-sm font-semibold">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <button className="text-[11px] text-primary hover:underline mt-1 cursor-pointer" onClick={() => document.getElementById("avatar-input")?.click()}>
                {isAr ? "تغيير الصورة" : "Change photo"}
              </button>
            </div>
          </div>

          {/* Form fields — 2 column grid like Zid */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">{isAr ? "الاسم" : "Name"}</Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder={isAr ? "الاسم الأول" : "First name"} className="h-10 text-sm rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">{isAr ? "رقم جوالك" : "Phone Number"}</Label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                defaultCountry="EG"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">{isAr ? "البريد الإلكتروني" : "Email"}</Label>
              <Input value={user?.email || ""} disabled className="h-10 text-sm rounded-lg bg-muted/30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">{isAr ? "اسم العائلة" : "Last Name"}</Label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder={isAr ? "اسم العائلة" : "Last name"} className="h-10 text-sm rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
         SECTION 2: كلمة المرور — Password
         ═══════════════════════════════════════════════════════ */}
      <div className="rounded-xl border bg-card">
        <div className="px-6 py-4 border-b">
          <h2 className="text-base font-bold">{isAr ? "كلمة المرور" : "Password"}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">{isAr ? "أدخل كلمة المرور الحالية" : "Current Password"}</Label>
            <div className="relative">
              <Input type={showPw ? "text" : "password"} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder={isAr ? "أدخل كلمة المرور الخاصة بك" : "Enter your current password"} className="h-10 text-sm rounded-lg pr-9" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">{isAr ? "أدخل كلمة المرور الجديدة" : "New Password"}</Label>
              <Input type={showPw ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder={isAr ? "أدخل كلمة المرور الخاصة بك" : "Enter new password"} className="h-10 text-sm rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">{isAr ? "تأكيد كلمة المرور الجديدة" : "Confirm New Password"}</Label>
              <Input type={showPw ? "text" : "password"} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder={isAr ? "أدخل كلمة المرور الخاصة بك" : "Confirm new password"} className="h-10 text-sm rounded-lg" />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg gap-1.5" onClick={handleChangePw} disabled={changingPw || !currentPw || !newPw}>
              {changingPw && <Loader2 className="h-3 w-3 animate-spin" />}
              {isAr ? "تغيير كلمة المرور" : "Change Password"}
            </Button>
          </div>
        </div>
      </div>

      {/* Avatar Preview Dialog */}
      <Dialog open={showAvatarPreview} onOpenChange={setShowAvatarPreview}>
        <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-xl">
          {user?.avatar_url && <img src={user.avatar_url} alt="" className="w-full aspect-square object-cover" />}
          <div className="flex border-t">
            <button onClick={() => { setShowAvatarPreview(false); document.getElementById("avatar-input")?.click(); }} className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium hover:bg-muted/50 transition-colors cursor-pointer">
              <UploadIcon className="h-3.5 w-3.5" />{isAr ? "تغيير" : "Change"}
            </button>
            <div className="w-px bg-border" />
            <button onClick={handleRemoveAvatar} disabled={uploadingAvatar} className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50 cursor-pointer">
              {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}{isAr ? "إزالة" : "Remove"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Crop Dialog */}
      {cropImageSrc && (
        <ImageCropDialog
          open={showCropDialog}
          onClose={() => { setShowCropDialog(false); setCropImageSrc(null); }}
          imageSrc={cropImageSrc}
          onCropComplete={handleCroppedUpload}
          cropShape="round"
          aspect={1}
          title={isAr ? "تعديل صورة الملف الشخصي" : "Edit Profile Picture"}
          loading={uploadingAvatar}
        />
      )}
    </div>
  );
}
