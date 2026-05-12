import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { updateOrder, type Order } from "@/services/orderApi";
import { showError } from "@/lib/show-error";

interface Props {
  storeId: string;
  order: Order;
}

/**
 * Editable internal merchant notes (debounced auto-save).
 *
 * `order.customer_notes` is what the customer wrote at checkout and is read-only
 * (it surfaces on the CustomerPanel). `order.notes` is the merchant's private
 * scratchpad — that's what this card edits.
 */
export function NotesCard({ storeId, order }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  const [value, setValue] = useState(order.notes || "");
  const lastSaved = useRef(order.notes || "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useMutation({
    mutationFn: (notes: string) => updateOrder(storeId, order.id, { notes }),
    onSuccess: (_data, notes) => {
      lastSaved.current = notes;
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
    },
    onError: (err) => showError(err, language),
  });

  useEffect(() => {
    if (value === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      save.mutate(value);
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, save]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{t("orders.internalNotes")}</CardTitle>
          {save.isPending && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            language === "ar"
              ? "ملاحظات داخلية فقط للموظفين..."
              : "Internal notes (staff only)..."
          }
          className="min-h-[80px] text-sm"
        />
      </CardContent>
    </Card>
  );
}
