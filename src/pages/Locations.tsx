/**
 * Locations page — Phase 8.2.
 *
 * Minimal CRUD for fulfillment + pickup locations. Stock-level
 * editing (per variant × location) and inter-location transfers
 * are separate flows; for v1 the merchant can already see those
 * via the API. This page covers the most common need: define
 * where the store ships from + where customers can pick up.
 */

import { useCallback, useEffect, useState } from "react";
import { useDashboardStore } from "@/contexts/StoreContext";
import {
  createLocation,
  deleteLocation,
  listLocations,
  updateLocation,
  type Location,
} from "@/services/locationsApi";
import { showError } from "@/lib/show-error";
import { toast } from "sonner";

interface DraftForm {
  name: string;
  name_ar: string;
  fulfills_orders: boolean;
  fulfills_pickup: boolean;
  address_line1: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  pickup_instructions: string;
}

const EMPTY_DRAFT: DraftForm = {
  name: "",
  name_ar: "",
  fulfills_orders: true,
  fulfills_pickup: false,
  address_line1: "",
  city: "",
  state: "",
  country: "EG",
  postal_code: "",
  pickup_instructions: "",
};

export default function LocationsPage() {
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Location | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DraftForm>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const list = await listLocations(storeId);
      setLocations(list);
    } catch (err) {
      showError(err, "Couldn't load locations.");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openCreate() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setCreating(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setDraft({
      name: loc.name,
      name_ar: loc.name_ar ?? "",
      fulfills_orders: loc.fulfills_orders,
      fulfills_pickup: loc.fulfills_pickup,
      address_line1: loc.address?.line1 ?? "",
      city: loc.address?.city ?? "",
      state: loc.address?.state ?? "",
      country: loc.address?.country ?? "EG",
      postal_code: loc.address?.postal_code ?? "",
      pickup_instructions: loc.pickup_instructions ?? "",
    });
    setCreating(true);
  }

  function closeDialog() {
    setCreating(false);
    setEditing(null);
    setDraft(EMPTY_DRAFT);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!storeId) return;
    if (!draft.name.trim()) {
      toast.error("Location name is required.");
      return;
    }
    const payload = {
      name: draft.name.trim(),
      name_ar: draft.name_ar.trim() || null,
      fulfills_orders: draft.fulfills_orders,
      fulfills_pickup: draft.fulfills_pickup,
      address: {
        line1: draft.address_line1.trim() || null,
        city: draft.city.trim() || null,
        state: draft.state.trim() || null,
        country: draft.country.trim() || null,
        postal_code: draft.postal_code.trim() || null,
      },
      pickup_instructions: draft.pickup_instructions.trim() || null,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateLocation(storeId, editing.id, payload);
        toast.success("Location updated.");
      } else {
        await createLocation(storeId, payload);
        toast.success("Location created.");
      }
      closeDialog();
      await refresh();
    } catch (err) {
      showError(err, "Couldn't save location.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(loc: Location) {
    if (!storeId) return;
    if (
      !confirm(
        `Delete location "${loc.name}"? Existing inventory levels at this location will be unlinked.`,
      )
    )
      return;
    try {
      await deleteLocation(storeId, loc.id);
      toast.success("Location deleted.");
      await refresh();
    } catch (err) {
      showError(err, "Couldn't delete location.");
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">Locations</h1>
          <p className="text-sm text-gray-600 mt-1">
            Fulfillment + pickup points. Inventory is tracked per
            variant per location once you have more than one.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="px-4 py-2 bg-black text-white rounded font-medium"
        >
          + Add location
        </button>
      </div>

      <section className="border rounded-lg bg-white">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        ) : locations.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            No locations yet. Add one to start tracking inventory and
            enable in-store pickup at checkout.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">City</th>
                <th className="text-left p-3 font-medium">Fulfills orders</th>
                <th className="text-left p-3 font-medium">Pickup</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{loc.name}</div>
                    {loc.name_ar && (
                      <div className="text-xs text-gray-500">{loc.name_ar}</div>
                    )}
                  </td>
                  <td className="p-3 text-gray-700">
                    {loc.address?.city || "—"}
                  </td>
                  <td className="p-3">
                    {loc.fulfills_orders ? "Yes" : "—"}
                  </td>
                  <td className="p-3">
                    {loc.fulfills_pickup ? "Yes" : "—"}
                  </td>
                  <td className="p-3">
                    <span
                      className={[
                        "inline-block px-2 py-0.5 text-xs rounded",
                        loc.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-700",
                      ].join(" ")}
                    >
                      {loc.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(loc)}
                      className="text-xs text-gray-600 hover:text-black"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(loc)}
                      className="text-xs text-gray-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {creating && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={save}
            className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4"
          >
            <h2 className="text-lg font-semibold">
              {editing ? "Edit location" : "New location"}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Name (Arabic)
                </label>
                <input
                  type="text"
                  value={draft.name_ar}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name_ar: e.target.value }))
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                  dir="rtl"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-600 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={draft.address_line1}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      address_line1: e.target.value,
                    }))
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">City</label>
                <input
                  type="text"
                  value={draft.city}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, city: e.target.value }))
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={draft.country}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, country: e.target.value }))
                  }
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.fulfills_orders}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        fulfills_orders: e.target.checked,
                      }))
                    }
                  />
                  Fulfills shipping orders
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.fulfills_pickup}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        fulfills_pickup: e.target.checked,
                      }))
                    }
                  />
                  Offers in-store pickup
                </label>
              </div>
              {draft.fulfills_pickup && (
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">
                    Pickup instructions (shown to customers)
                  </label>
                  <textarea
                    value={draft.pickup_instructions}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        pickup_instructions: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="e.g. Open 10am-9pm. Bring your order confirmation."
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeDialog}
                className="px-4 py-2 border rounded font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-black text-white rounded font-medium disabled:opacity-50"
              >
                {saving ? "Saving…" : editing ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
