/**
 * Gift Cards page — Phase 8.3.
 *
 * Lets the merchant issue gift cards + browse existing ones. The
 * plaintext code is returned ONCE in the issue response — we show it
 * in a modal with a Copy button + warning, because there's no way to
 * recover it from the DB after this dialog closes.
 */

import { useCallback, useEffect, useState } from "react";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  issueGiftCard,
  listGiftCards,
  voidGiftCard,
  type GiftCard,
} from "@/services/giftCardsApi";
import { showError } from "@/lib/show-error";
import { toast } from "sonner";

export default function GiftCardsPage() {
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [revealCode, setRevealCode] = useState<string | null>(null);
  const [revealCard, setRevealCard] = useState<GiftCard | null>(null);

  const refresh = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const result = await listGiftCards(storeId, { page: 1, limit: 50 });
      setCards(Array.isArray(result) ? result : []);
    } catch (err) {
      showError(err, "Couldn't load gift cards.");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      toast.error("Enter a positive amount.");
      return;
    }
    setIssuing(true);
    try {
      const result = await issueGiftCard(storeId, {
        initial_balance_cents: cents,
        currency: currentStore?.currency || "EGP",
        expires_at: expiresAt || null,
        note: note || null,
      });
      setRevealCode(result.code);
      setRevealCard(result.card);
      setAmount("");
      setNote("");
      setExpiresAt("");
      await refresh();
    } catch (err) {
      showError(err, "Couldn't issue gift card.");
    } finally {
      setIssuing(false);
    }
  }

  async function handleVoid(card: GiftCard) {
    if (!storeId) return;
    if (!confirm(`Void gift card •••${card.last_four}? This is permanent.`)) return;
    try {
      await voidGiftCard(storeId, card.id);
      toast.success("Gift card voided.");
      await refresh();
    } catch (err) {
      showError(err, "Couldn't void gift card.");
    }
  }

  async function copyCode() {
    if (!revealCode) return;
    try {
      await navigator.clipboard.writeText(revealCode);
      toast.success("Code copied to clipboard.");
    } catch {
      // Fallback for browsers that block clipboard without user gesture
      // edge — the input is selectable so the merchant can copy manually.
    }
  }

  const currency = currentStore?.currency || "EGP";

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Gift cards</h1>
        <p className="text-sm text-gray-600 mt-1">
          Issue gift cards, browse existing balances, and void cards
          you need to revoke. Cards are redeemed at checkout — customers
          can stack up to 5 per order.
        </p>
      </div>

      <section className="border rounded-lg p-6 bg-white">
        <h2 className="font-semibold mb-3">Issue a new card</h2>
        <form onSubmit={handleIssue} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Amount</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Currency</label>
            <input
              type="text"
              value={currency}
              readOnly
              className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Expires (optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs text-gray-600 mb-1">Note (internal)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. compensation for order #1234"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={issuing}
              className="px-4 py-2 bg-black text-white rounded font-medium disabled:opacity-50"
            >
              {issuing ? "Issuing…" : "Issue gift card"}
            </button>
          </div>
        </form>
      </section>

      <section className="border rounded-lg bg-white">
        <h2 className="font-semibold p-4 border-b">Existing cards ({cards.length})</h2>
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        ) : cards.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            No gift cards issued yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium">Last four</th>
                <th className="text-left p-3 font-medium">Balance</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Issued</th>
                <th className="text-left p-3 font-medium">Note</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3 font-mono">•••{c.last_four}</td>
                  <td className="p-3">
                    {(c.current_balance_cents / 100).toFixed(2)} {c.currency}
                    {c.current_balance_cents !== c.initial_balance_cents && (
                      <span className="text-xs text-gray-500 ml-2">
                        of {(c.initial_balance_cents / 100).toFixed(2)} issued
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={[
                        "inline-block px-2 py-0.5 text-xs rounded",
                        c.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : c.status === "depleted"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-red-100 text-red-700",
                      ].join(" ")}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-gray-600">{c.note || "—"}</td>
                  <td className="p-3 text-right">
                    {c.status === "active" && (
                      <button
                        type="button"
                        onClick={() => handleVoid(c)}
                        className="text-xs text-gray-500 hover:text-red-700"
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {revealCode && revealCard && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-2">
              Gift card issued
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Copy this code now — it's the only time we&apos;ll show it.
              You can&apos;t recover it from the database later.
            </p>
            <input
              type="text"
              readOnly
              value={revealCode}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full font-mono text-center border rounded px-3 py-3 text-lg bg-gray-50"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={copyCode}
                className="flex-1 px-4 py-2 bg-black text-white rounded font-medium"
              >
                Copy code
              </button>
              <button
                type="button"
                onClick={() => {
                  setRevealCode(null);
                  setRevealCard(null);
                }}
                className="px-4 py-2 border rounded font-medium"
              >
                Done
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Balance: {(revealCard.initial_balance_cents / 100).toFixed(2)}{" "}
              {revealCard.currency}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
