/**
 * The Finance → Invoices tab's payment column reads the ORDER's payment
 * status. It used to show the invoice's tax-authority status under a
 * "payment" header, so every unpaid cash-on-delivery invoice ("accepted")
 * read as paid.
 */

import { describe, expect, it } from "vitest";

import { invoiceDocumentState, invoicePaymentPill } from "@/lib/invoice-status";
import type { InvoiceListItem } from "@/services/invoiceApi";

describe("invoicePaymentPill", () => {
  it("shows an unpaid COD order as unpaid, whatever the invoice says", () => {
    expect(invoicePaymentPill("pending", true)?.label).toBe("غير مدفوعة");
    expect(invoicePaymentPill("pending", false)?.label).toBe("Unpaid");
  });

  it("shows paid and refunded orders as such", () => {
    expect(invoicePaymentPill("paid", false)?.label).toBe("Paid");
    expect(invoicePaymentPill("refunded", false)?.label).toBe("Refunded");
  });

  it("shows nothing for an invoice with no order behind it", () => {
    expect(invoicePaymentPill(null, false)).toBeNull();
    expect(invoicePaymentPill(undefined, true)).toBeNull();
  });
});

describe("invoiceDocumentState", () => {
  const base = { invoice_type: "I", status: "accepted" } as InvoiceListItem;

  it("says nothing about an ordinary accepted invoice", () => {
    expect(invoiceDocumentState(base, true)).toBeNull();
  });

  it("names a cancelled invoice in Arabic instead of the raw 'cancelled'", () => {
    expect(invoiceDocumentState({ ...base, status: "cancelled" }, true)).toBe("ملغاة");
  });

  it("marks credit notes", () => {
    expect(invoiceDocumentState({ ...base, invoice_type: "C" }, false)).toBe("Credit note");
  });
});
