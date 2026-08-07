/**
 * Downloadable documents for subscription invoices.
 *
 * There is no server-side PDF endpoint — `GET /billing/invoices` returns JSON
 * and nothing else. Rather than add a rendering service for a document a
 * merchant downloads a handful of times a year, this builds the invoice in a
 * print window and lets the browser's own "Save as PDF" produce the file. It
 * is what Stripe, Vercel and most billing pages do, it needs no backend, and
 * the output is a real page the merchant can also just print.
 *
 * The CSV export exists for the other job entirely: handing a year of billing
 * to an accountant, where one file beats twelve PDFs.
 */

export interface SubscriptionInvoice {
  id: string;
  period_start: string;
  period_end: string;
  amount_cents: number;
  currency: string;
  status: string;
  discount_amount_cents: number;
  paid_at: string | null;
  created_at: string;
}

export interface InvoiceParty {
  /** Merchant's store/tenant name — who the invoice is addressed to. */
  name: string;
  subdomain?: string | null;
  plan?: string | null;
}

const money = (cents: number, currency: string, ar: boolean) =>
  `${(cents / 100).toLocaleString(ar ? "ar-EG" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

const day = (iso: string, ar: boolean) =>
  new Date(iso).toLocaleDateString(ar ? "ar-EG" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** Short, stable, human-quotable invoice number derived from the row id. */
export const invoiceNumber = (inv: SubscriptionInvoice) =>
  `NUMU-${inv.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function invoiceHtml(
  inv: SubscriptionInvoice,
  party: InvoiceParty,
  ar: boolean,
): string {
  const gross = inv.amount_cents + inv.discount_amount_cents;
  const t = ar
    ? {
        title: "فاتورة اشتراك",
        no: "رقم الفاتورة",
        issued: "تاريخ الإصدار",
        billedTo: "الفاتورة إلى",
        period: "فترة الاشتراك",
        desc: "الوصف",
        amount: "المبلغ",
        subtotal: "الإجمالي قبل الخصم",
        discount: "الخصم",
        total: "الإجمالي",
        paid: "مدفوعة",
        due: "غير مدفوعة",
        paidOn: "دُفعت في",
        sub: "اشتراك",
        note: "شكراً لاستخدامك نُمُو. للاستفسارات: billing@numueg.app",
      }
    : {
        title: "Subscription invoice",
        no: "Invoice no.",
        issued: "Issued",
        billedTo: "Billed to",
        period: "Billing period",
        desc: "Description",
        amount: "Amount",
        subtotal: "Subtotal",
        discount: "Discount",
        total: "Total",
        paid: "Paid",
        due: "Unpaid",
        paidOn: "Paid on",
        sub: "subscription",
        note: "Thanks for using numu. Questions: billing@numueg.app",
      };

  const planLabel = party.plan ? `${party.plan} ${t.sub}` : t.sub;
  const isPaid = inv.status === "paid";

  return `<!doctype html>
<html lang="${ar ? "ar" : "en"}" dir="${ar ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8"/>
<title>${esc(invoiceNumber(inv))}</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:${ar ? "'Tajawal'," : ""}-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;
    color:#0F1624;background:#fff;padding:48px;line-height:1.6;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .sheet{max-width:760px;margin:0 auto}
  header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;
    padding-bottom:26px;border-bottom:2px solid #0F1624}
  .brand{font-size:26px;font-weight:800;letter-spacing:-.02em}
  .brand span{color:#6B7280;font-weight:500;font-size:13px;display:block;letter-spacing:0}
  h1{font-size:17px;font-weight:650;text-align:${ar ? "left" : "right"}}
  .status{display:inline-block;margin-top:8px;font-size:12px;font-weight:700;
    padding:4px 12px;border-radius:999px;letter-spacing:.02em}
  .status.paid{background:#ECFDF5;color:#047857;border:1px solid #A7F3D0}
  .status.due{background:#FEF3C7;color:#92400E;border:1px solid #FDE68A}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin:28px 0 34px}
  .meta h2{font-size:11px;text-transform:uppercase;letter-spacing:.09em;
    color:#6B7280;font-weight:600;margin-bottom:5px}
  .meta p{font-size:14px}
  table{width:100%;border-collapse:collapse;margin-bottom:26px}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:#6B7280;
    text-align:${ar ? "right" : "left"};padding:10px 0;border-bottom:1px solid #E5E7EB}
  th:last-child,td:last-child{text-align:${ar ? "left" : "right"}}
  td{padding:16px 0;border-bottom:1px solid #F3F4F6;font-size:14px}
  .num{font-variant-numeric:tabular-nums}
  .totals{margin-${ar ? "right" : "left"}:auto;width:min(300px,100%)}
  .totals div{display:flex;justify-content:space-between;padding:7px 0;font-size:14px}
  .totals .grand{border-top:2px solid #0F1624;margin-top:7px;padding-top:12px;
    font-size:17px;font-weight:750}
  .disc{color:#047857}
  footer{margin-top:44px;padding-top:18px;border-top:1px solid #E5E7EB;
    font-size:12px;color:#6B7280}
  @media print{body{padding:0}@page{margin:18mm}}
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <div class="brand">numu<span>numueg.app</span></div>
      <div>
        <h1>${esc(t.title)}</h1>
        <span class="status ${isPaid ? "paid" : "due"}">${esc(isPaid ? t.paid : t.due)}</span>
      </div>
    </header>

    <div class="meta">
      <div>
        <h2>${esc(t.billedTo)}</h2>
        <p><strong>${esc(party.name)}</strong></p>
        ${party.subdomain ? `<p class="num">${esc(party.subdomain)}.numueg.app</p>` : ""}
      </div>
      <div>
        <h2>${esc(t.no)}</h2>
        <p class="num">${esc(invoiceNumber(inv))}</p>
        <h2 style="margin-top:14px">${esc(t.issued)}</h2>
        <p class="num">${esc(day(inv.created_at, ar))}</p>
      </div>
    </div>

    <table>
      <thead><tr><th>${esc(t.desc)}</th><th>${esc(t.amount)}</th></tr></thead>
      <tbody>
        <tr>
          <td>
            <strong>${esc(planLabel)}</strong><br/>
            <span style="color:#6B7280;font-size:13px">
              ${esc(t.period)}: ${esc(day(inv.period_start, ar))} — ${esc(day(inv.period_end, ar))}
            </span>
          </td>
          <td class="num">${esc(money(gross, inv.currency, ar))}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div><span>${esc(t.subtotal)}</span><span class="num">${esc(money(gross, inv.currency, ar))}</span></div>
      ${
        inv.discount_amount_cents > 0
          ? `<div class="disc"><span>${esc(t.discount)}</span><span class="num">−${esc(money(inv.discount_amount_cents, inv.currency, ar))}</span></div>`
          : ""
      }
      <div class="grand"><span>${esc(t.total)}</span><span class="num">${esc(money(inv.amount_cents, inv.currency, ar))}</span></div>
    </div>

    <footer>
      ${inv.paid_at ? `<p>${esc(t.paidOn)} ${esc(day(inv.paid_at, ar))}</p>` : ""}
      <p>${esc(t.note)}</p>
    </footer>
  </div>
</body></html>`;
}

/**
 * Open one invoice in a print window.
 *
 * Writes into a blob URL rather than `document.write` so the popup has its own
 * origin-clean document, and revokes it after printing. Returns false when the
 * popup was blocked, so the caller can tell the merchant why nothing happened
 * instead of leaving a dead button.
 */
export function printInvoice(
  inv: SubscriptionInvoice,
  party: InvoiceParty,
  ar: boolean,
): boolean {
  const blob = new Blob([invoiceHtml(inv, party, ar)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener,width=900,height=1100");
  if (!w) {
    URL.revokeObjectURL(url);
    return false;
  }
  w.addEventListener("load", () => {
    w.focus();
    w.print();
    // Give the print dialog time to take its snapshot before the URL dies.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });
  return true;
}

/** All invoices as CSV — the format an accountant actually wants. */
export function downloadInvoicesCsv(
  invoices: SubscriptionInvoice[],
  fileName = "numu-invoices.csv",
): void {
  const head = [
    "invoice_no",
    "issued",
    "period_start",
    "period_end",
    "status",
    "amount",
    "discount",
    "currency",
    "paid_at",
  ];
  // Quote every field and double internal quotes: a store name with a comma
  // would otherwise shift every following column.
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = invoices.map((i) =>
    [
      invoiceNumber(i),
      i.created_at.slice(0, 10),
      i.period_start.slice(0, 10),
      i.period_end.slice(0, 10),
      i.status,
      (i.amount_cents / 100).toFixed(2),
      (i.discount_amount_cents / 100).toFixed(2),
      i.currency,
      i.paid_at ? i.paid_at.slice(0, 10) : "",
    ].map(cell).join(","),
  );

  // BOM so Excel opens UTF-8 correctly — without it Arabic store names arrive
  // as mojibake, which is the whole reason an accountant rejects the file.
  const blob = new Blob(["﻿" + [head.map(cell).join(","), ...rows].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
