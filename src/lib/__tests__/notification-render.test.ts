import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { formatTimeAgo, renderNotification } from "@/lib/notifications/render";
import type { NotificationItem } from "@/services/notificationsApi";
import en from "@/i18n/en";

// Minimal i18next-compatible t(): dotted lookup + {{var}} interpolation
// + count-based plural keys (key_one / key_other) like i18next's default.
function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
    return undefined;
  }, obj);
}
const t = ((key: string, opts?: Record<string, unknown>) => {
  let raw = get(en, key);
  if (opts && typeof opts.count === "number") {
    const plural = get(en, `${key}_${opts.count === 1 ? "one" : "other"}`);
    if (typeof plural === "string") raw = plural;
  }
  if (typeof raw !== "string") return (opts?.defaultValue as string) ?? key;
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts?.[k] ?? ""));
}) as unknown as TFunction;

function item(kind: string, data: Record<string, unknown>, extra: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: "n1",
    category: "orders",
    kind,
    data,
    link: null,
    entity_type: null,
    entity_id: null,
    is_important: false,
    is_read: false,
    created_at: new Date().toISOString(),
    ...extra,
  };
}

describe("renderNotification", () => {
  it("splits the customer name into an emphasised segment", () => {
    const r = renderNotification(
      item("order.new", {
        order_number: "ORD-123",
        customer_name: "Yahia Sherif",
        total_cents: 72900,
        currency: "EGP",
        payment_method: "cod",
      }),
      t,
      "en",
    );
    expect(r.title).toEqual([
      { text: "New order #ORD-123 from " },
      { text: "Yahia Sherif", em: true },
    ]);
    expect(r.body).toContain("Cash on delivery");
    expect(r.body).toContain("729");
    expect(r.icon).toBe("order");
    expect(r.tone).toBe("navy");
  });

  it("falls back to 'A shopper' and drops empty body parts", () => {
    const r = renderNotification(
      item("cart.abandoned", { items_count: 2 }),
      t,
      "en",
    );
    expect(r.title[0]).toEqual({ text: "A shopper", em: true });
    expect(r.body).not.toContain(" ·  ·");
    expect(r.body.endsWith("·")).toBe(false);
  });

  it("important rows render terra regardless of kind", () => {
    const r = renderNotification(
      item("order.cancelled", { order_number: "X" }, { is_important: true }),
      t,
      "en",
    );
    expect(r.tone).toBe("terra");
  });

  it("unknown kinds never throw", () => {
    const r = renderNotification(item("future.kind", {}), t, "en");
    expect(r.title[0].text).toBe("future.kind");
    expect(r.icon).toBe("alert");
  });
});

describe("formatTimeAgo", () => {
  const now = Date.parse("2026-08-22T12:00:00Z");
  it("buckets minutes / hours / days / weeks", () => {
    expect(formatTimeAgo("2026-08-22T11:59:40Z", t, now)).toBe("Just now");
    expect(formatTimeAgo("2026-08-22T11:30:00Z", t, now)).toBe("30m ago");
    expect(formatTimeAgo("2026-08-22T09:00:00Z", t, now)).toBe("3h ago");
    expect(formatTimeAgo("2026-08-20T12:00:00Z", t, now)).toBe("2d ago");
    expect(formatTimeAgo("2026-08-01T12:00:00Z", t, now)).toBe("3w ago");
  });
});
