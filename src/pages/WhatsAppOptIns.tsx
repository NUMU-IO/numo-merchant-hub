/**
 * WhatsApp opt-in list page.
 *
 * The page is history-preserving (FR-012): re-opting after an opt-out
 * creates a NEW row, never mutates the prior row. So a phone can have
 * multiple rows over time. The toggle filters to "active only" by
 * default; un-toggle to see the full history including revoked entries.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Search, RotateCcw } from "lucide-react";
import {
  listOptIns,
  revokeOptIn,
  type OptInRow,
  type OptOutReason,
} from "@/services/whatsappApi";

const REVOKE_REASON: Exclude<OptOutReason, "inbound_stop_keyword"> =
  "merchant_revoke";

export default function WhatsAppOptIns() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [rows, setRows] = useState<OptInRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await listOptIns(storeId, {
        phone: phone.trim() || undefined,
        active_only: activeOnly,
        limit: 100,
      });
      setRows(res.data);
    } catch {
      toast.error(
        isAr ? "فشل تحميل قائمة الاشتراكات" : "Failed to load opt-ins"
      );
    } finally {
      setLoading(false);
    }
  }, [storeId, phone, activeOnly, isAr]);

  useEffect(() => {
    refresh();
    // re-runs when the toggle flips
  }, [refresh, activeOnly]);

  const onRevoke = async (row: OptInRow) => {
    if (!storeId) return;
    if (
      !window.confirm(
        isAr
          ? `هل تريد إلغاء اشتراك ${row.phone}؟`
          : `Revoke opt-in for ${row.phone}?`
      )
    )
      return;
    setRevoking(row.id);
    try {
      await revokeOptIn(storeId, {
        phone: row.phone,
        reason: REVOKE_REASON,
      });
      toast.success(isAr ? "تم الإلغاء" : "Revoked");
      refresh();
    } catch {
      toast.error(
        isAr ? "فشل الإلغاء" : "Revoke failed"
      );
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="space-y-4 p-6" dir={isAr ? "rtl" : "ltr"}>
      <header>
        <h1 className="text-2xl font-bold">
          {isAr ? "اشتراكات واتساب" : "WhatsApp opt-ins"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "سجل بمن وافق على استلام رسائل واتساب من متجرك. سجل تاريخي — كل إعادة اشتراك ينشئ صفًا جديدًا."
            : "Customers who consented to WhatsApp messaging from your store. History-preserving — re-opting after an opt-out creates a new row."}
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium block mb-1" htmlFor="phone">
            {isAr ? "بحث برقم الهاتف (E.164)" : "Search by phone (E.164)"}
          </label>
          <div className="flex gap-2">
            <Input
              id="phone"
              placeholder="+201001234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refresh()}
            />
            <Button onClick={refresh} variant="outline">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 pb-1">
          <Switch
            id="active_only"
            checked={activeOnly}
            onCheckedChange={setActiveOnly}
          />
          <label htmlFor="active_only" className="text-sm cursor-pointer">
            {isAr ? "النشطة فقط" : "Active only"}
          </label>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{isAr ? "الهاتف" : "Phone"}</TableHead>
            <TableHead>{isAr ? "المصدر" : "Source"}</TableHead>
            <TableHead>{isAr ? "بدأ" : "Opted in"}</TableHead>
            <TableHead>{isAr ? "انتهى" : "Opted out"}</TableHead>
            <TableHead>{isAr ? "السبب" : "Reason"}</TableHead>
            <TableHead className="text-end">
              {isAr ? "إجراء" : "Action"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={`skel-${i}`}>
                <TableCell colSpan={6}>
                  <Skeleton className="h-6 w-full" />
                </TableCell>
              </TableRow>
            ))}
          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                {isAr ? "لا توجد سجلات" : "No opt-ins found"}
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            rows.map((row) => {
              const isActive = row.opted_out_at == null;
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">
                    {row.phone}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {row.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.opted_in_at).toLocaleString(
                      isAr ? "ar-EG" : "en-US"
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.opted_out_at
                      ? new Date(row.opted_out_at).toLocaleString(
                          isAr ? "ar-EG" : "en-US"
                        )
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {row.opt_out_reason ? (
                      <code className="text-xs">{row.opt_out_reason}</code>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {isActive ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRevoke(row)}
                        disabled={revoking === row.id}
                      >
                        {revoking === row.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3 me-1" />
                        )}
                        {isAr ? "إلغاء" : "Revoke"}
                      </Button>
                    ) : (
                      <Badge variant="secondary">
                        {isAr ? "ملغى" : "Revoked"}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}
