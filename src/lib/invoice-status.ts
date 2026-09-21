import type { InvoiceListItem } from "@/services/invoiceApi";

/**
 * The ORDER's payment state for an invoice row — whether the customer has
 * paid. The invoice's own status is its tax-authority state and reads
 * "accepted" on an unpaid cash-on-delivery invoice, which is why this column
 * used to show every such order as paid.
 */
export function invoicePaymentPill(
  status: string | null | undefined,
  isAr: boolean,
): { label: string; className: string } | null {
  switch (status) {
    case "paid":
      return { label: isAr ? "مدفوعة" : "Paid", className: "bg-emerald-500/14 text-emerald-700 dark:text-emerald-400" };
    case "pending":
    case "authorized":
      return { label: isAr ? "غير مدفوعة" : "Unpaid", className: "bg-amber-500/14 text-amber-700 dark:text-amber-400" };
    case "partially_refunded":
      return { label: isAr ? "مسترد جزئياً" : "Partly refunded", className: "bg-blue-500/14 text-blue-700 dark:text-blue-400" };
    case "refunded":
      return { label: isAr ? "مستردة" : "Refunded", className: "bg-muted text-muted-foreground" };
    case "failed":
      return { label: isAr ? "فشل الدفع" : "Failed", className: "bg-destructive/14 text-destructive" };
    default:
      return null;
  }
}

/** A note on the invoice document itself, only when it's not a normal one. */
export function invoiceDocumentState(inv: InvoiceListItem, isAr: boolean): string | null {
  if (inv.invoice_type === "C") return isAr ? "إشعار دائن" : "Credit note";
  if (inv.invoice_type === "D") return isAr ? "إشعار مدين" : "Debit note";
  switch (inv.status) {
    case "cancelled":
      return isAr ? "ملغاة" : "Cancelled";
    case "rejected":
      return isAr ? "مرفوضة من الضرائب" : "Rejected by tax authority";
    case "draft":
      return isAr ? "مسودة" : "Draft";
    default:
      return null;
  }
}
