import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
import { createCustomer } from "@/services/customerApi";

interface AddCustomerDialogProps {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  notes: "",
  accepts_marketing: false,
};

export function AddCustomerDialog({ storeId, open, onOpenChange }: AddCustomerDialogProps) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const mutation = useMutation({
    mutationFn: () =>
      createCustomer(storeId, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        accepts_marketing: form.accepts_marketing,
      }),
    onSuccess: (customer) => {
      toast.success(
        isAr ? `تم إضافة ${customer.full_name}` : `${customer.full_name} added`,
      );
      queryClient.invalidateQueries({ queryKey: ["customers", storeId] });
      setForm(EMPTY_FORM);
      onOpenChange(false);
    },
    onError: (err) => showError(err, language),
  });

  const canSubmit =
    form.first_name.trim().length > 0 &&
    form.last_name.trim().length > 0 &&
    /^\S+@\S+\.\S+$/.test(form.email.trim()) &&
    !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isAr ? "إضافة عميل" : "Add customer"}</DialogTitle>
          <DialogDescription>
            {isAr
              ? "أضف عميل يدوياً — بدون كلمة مرور، يقدر يسجّل بنفس الإيميل لاحقاً."
              : "Manually add a customer — no password; they can register with the same email later."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) mutation.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cust-first">{isAr ? "الاسم الأول *" : "First name *"}</Label>
              <Input
                id="cust-first"
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-last">{isAr ? "اسم العائلة *" : "Last name *"}</Label>
              <Input
                id="cust-last"
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cust-email">{isAr ? "الإيميل *" : "Email *"}</Label>
            <Input
              id="cust-email"
              type="email"
              dir="ltr"
              placeholder="customer@example.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cust-phone">{isAr ? "الموبايل" : "Phone"}</Label>
            <Input
              id="cust-phone"
              type="tel"
              dir="ltr"
              placeholder="01001234567"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cust-notes">{isAr ? "ملاحظات" : "Notes"}</Label>
            <Textarea
              id="cust-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.accepts_marketing}
              onCheckedChange={(v) => set("accepts_marketing", v === true)}
            />
            {isAr ? "يقبل رسائل التسويق" : "Accepts marketing emails"}
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {isAr ? "إضافة العميل" : "Add customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
