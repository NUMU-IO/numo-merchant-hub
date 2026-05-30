/**
 * Variants matrix editor — Phase 8.1.
 *
 * Lets a merchant define option axes (Size, Color, Material — max 3)
 * and a row per variant combination with its own price + SKU + stock.
 * Mounted as a sub-section of ProductEditor for products that opt in.
 *
 * Talks directly to `/stores/.../products/.../variants` via the
 * variantsApi service. The product's `options` field is updated via
 * the product PATCH endpoint (see `updateProductOptions`).
 */

import { useEffect, useMemo, useState } from "react";
import {
  createVariant,
  deleteVariant,
  listVariants,
  updateProductOptions,
  updateVariant,
  type ProductOption,
  type Variant,
} from "@/services/variantsApi";

interface Props {
  storeId: string;
  productId: string;
  /** The product's existing options (axes). Pass [] for a product
   * that has never had variants. */
  initialOptions: ProductOption[];
  /** Display currency for price hints. Not enforced — the backend
   * uses the product's price.currency. */
  currency?: string;
  /** Toast / surface error helper. */
  onError?: (msg: string) => void;
  /** Toast / surface success helper. */
  onSuccess?: (msg: string) => void;
}

interface OptionDraft {
  name: string;
  values: string;
}

interface RowDraft {
  id?: string;
  option_values: Record<string, string>;
  price: string;
  sku: string;
  inventory_quantity: string;
  _dirty?: boolean;
}

/** Expand an axis-of-values table into every combination. */
function cartesian(axes: { name: string; values: string[] }[]): Record<string, string>[] {
  if (axes.length === 0) return [];
  return axes.reduce<Record<string, string>[]>(
    (acc, axis) => {
      const next: Record<string, string>[] = [];
      for (const partial of acc) {
        for (const v of axis.values) {
          next.push({ ...partial, [axis.name]: v });
        }
      }
      return next;
    },
    [{}],
  );
}

function rowKey(opts: Record<string, string>): string {
  const keys = Object.keys(opts).sort();
  return keys.map((k) => `${k}:${opts[k]}`).join("|");
}

export default function VariantsEditor({
  storeId,
  productId,
  initialOptions,
  currency = "EGP",
  onError,
  onSuccess,
}: Props) {
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    initialOptions.map((o) => ({
      name: o.name,
      values: (o.values || []).join(", "),
    })),
  );
  const [variants, setVariants] = useState<Variant[]>([]);
  const [rows, setRows] = useState<RowDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Initial load. The admin variants CRUD endpoint
  // (`/stores/{id}/products/{id}/variants`) isn't deployed on every
  // environment — the backend currently only resolves variants for the
  // public storefront. Treat a 404 as "no variants yet" so the editor
  // opens in build-from-scratch mode instead of firing an error toast.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listVariants(storeId, productId);
        if (cancelled) return;
        setVariants(list);
        setRows(
          list.map((v) => ({
            id: v.id,
            option_values: v.option_values,
            price: v.price,
            sku: v.sku ?? "",
            inventory_quantity: String(v.inventory_quantity ?? 0),
          })),
        );
      } catch (err) {
        if (cancelled) return;
        const status = (err as { status?: number })?.status;
        // 404 on first load = no variants yet (or backend not deployed).
        // Silently treat as an empty list; surface only real errors.
        if (status === 404) {
          setVariants([]);
          setRows([]);
        } else {
          onError?.(err instanceof Error ? err.message : "Failed to load variants.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, productId, onError]);

  // Parsed axes from the drafts.
  const parsedAxes = useMemo(() => {
    return options
      .map((o) => ({
        name: o.name.trim(),
        values: o.values
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }))
      .filter((o) => o.name && o.values.length > 0);
  }, [options]);

  function addAxis() {
    if (options.length >= 3) {
      onError?.("Max 3 option axes (Size / Color / Material).");
      return;
    }
    setOptions((prev) => [...prev, { name: "", values: "" }]);
  }

  function removeAxis(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function generateMatrix() {
    if (parsedAxes.length === 0) {
      onError?.("Define at least one option axis first.");
      return;
    }
    const combos = cartesian(parsedAxes);
    const byKey = new Map(rows.filter((r) => r.id).map((r) => [rowKey(r.option_values), r]));
    const next: RowDraft[] = combos.map((opts) => {
      const existing = byKey.get(rowKey(opts));
      if (existing) return existing;
      return {
        option_values: opts,
        price: "0",
        sku: "",
        inventory_quantity: "0",
        _dirty: true,
      };
    });
    setRows(next);
  }

  function updateRow(idx: number, patch: Partial<RowDraft>) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch, _dirty: true } : r)),
    );
  }

  async function removeRow(idx: number) {
    const row = rows[idx];
    if (row.id) {
      try {
        await deleteVariant(storeId, productId, row.id);
        onSuccess?.("Variant deleted.");
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Couldn't delete variant.");
        return;
      }
    }
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    try {
      // 1. Persist product.options first so the variants endpoint
      //    validates against the same axis list we're about to use.
      const productOptions: ProductOption[] = parsedAxes.map((a, i) => ({
        name: a.name,
        position: i,
        values: a.values,
      }));
      await updateProductOptions(storeId, productId, productOptions);

      // 2. Create new rows + update dirty existing ones.
      for (const r of rows) {
        if (!r._dirty) continue;
        const payload = {
          option_values: r.option_values,
          price: Number(r.price) || 0,
          sku: r.sku || null,
          inventory_quantity: Number(r.inventory_quantity) || 0,
        };
        if (r.id) {
          await updateVariant(storeId, productId, r.id, payload);
        } else {
          const created = await createVariant(storeId, productId, payload);
          r.id = created.id;
        }
      }
      // Reload to pick up server-side normalizations (position, etc).
      const list = await listVariants(storeId, productId);
      setVariants(list);
      setRows(
        list.map((v) => ({
          id: v.id,
          option_values: v.option_values,
          price: v.price,
          sku: v.sku ?? "",
          inventory_quantity: String(v.inventory_quantity ?? 0),
        })),
      );
      onSuccess?.("Variants saved.");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Couldn't save variants.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading variants…</div>;
  }

  const axisNames = parsedAxes.map((a) => a.name);

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold mb-2">Option axes</h3>
        <p className="text-xs text-gray-500 mb-3">
          Up to 3 axes (e.g. Size, Color, Material). Values are
          comma-separated. After defining axes, click "Generate matrix"
          to create one variant row per combination.
        </p>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                type="text"
                placeholder="Axis name (e.g. Size)"
                value={opt.name}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((o, idx) =>
                      idx === i ? { ...o, name: e.target.value } : o,
                    ),
                  )
                }
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Values (S, M, L)"
                value={opt.values}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((o, idx) =>
                      idx === i ? { ...o, values: e.target.value } : o,
                    ),
                  )
                }
                className="flex-[2] border rounded px-3 py-2 text-sm"
              />
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-red-700 px-2"
                onClick={() => removeAxis(i)}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-sm underline text-gray-700"
            onClick={addAxis}
          >
            + Add axis
          </button>
        </div>
        <button
          type="button"
          className="mt-3 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          onClick={generateMatrix}
        >
          Generate matrix
        </button>
      </section>

      <section>
        <h3 className="font-semibold mb-2">Variants ({rows.length})</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">
            No variants yet. Define axes above and click "Generate matrix".
          </p>
        ) : (
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {axisNames.map((n) => (
                    <th key={n} className="text-left p-2 font-medium">
                      {n}
                    </th>
                  ))}
                  <th className="text-left p-2 font-medium">
                    Price ({currency})
                  </th>
                  <th className="text-left p-2 font-medium">SKU</th>
                  <th className="text-left p-2 font-medium">Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id ?? rowKey(r.option_values)} className="border-t">
                    {axisNames.map((n) => (
                      <td key={n} className="p-2">
                        {r.option_values[n] || "—"}
                      </td>
                    ))}
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.price}
                        onChange={(e) =>
                          updateRow(i, { price: e.target.value })
                        }
                        className="w-24 border rounded px-2 py-1"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={r.sku}
                        onChange={(e) => updateRow(i, { sku: e.target.value })}
                        className="w-32 border rounded px-2 py-1"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        value={r.inventory_quantity}
                        onChange={(e) =>
                          updateRow(i, { inventory_quantity: e.target.value })
                        }
                        className="w-20 border rounded px-2 py-1"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        className="text-sm text-gray-500 hover:text-red-700"
                        onClick={() => removeRow(i)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="px-4 py-2 bg-black text-white rounded font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : `Save variants${variants.length > 0 ? ` (${variants.length})` : ""}`}
        </button>
      </div>
    </div>
  );
}
