import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listProducts, type ApiProductResponse } from "@/services/productApi";
import {
  addSeriesBook, createSeries, listSeries, removeSeriesBook, reorderSeries,
  type ProductSeries,
} from "@/services/seriesApi";

export default function SeriesPage() {
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id;
  const [series, setSeries] = useState<ProductSeries[]>([]);
  const [products, setProducts] = useState<ApiProductResponse[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [productId, setProductId] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = series.find((item) => item.id === selectedId) ?? series[0];
  const available = useMemo(() => products.filter(
    (product) => !selected?.products.some((book) => book.product_id === product.id),
  ), [products, selected]);

  const reload = async () => {
    if (!storeId) return;
    const [nextSeries, nextProducts] = await Promise.all([
      listSeries(storeId), listProducts(storeId, { limit: 100 }),
    ]);
    setSeries(nextSeries);
    setProducts(nextProducts.items);
    setSelectedId((current) => current || nextSeries[0]?.id || "");
  };

  useEffect(() => { void reload(); }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    try { await work(); await reload(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not update series"); }
    finally { setBusy(false); }
  };

  const move = (index: number, offset: number) => {
    if (!storeId || !selected) return;
    const books = [...selected.products];
    [books[index], books[index + offset]] = [books[index + offset], books[index]];
    void act(() => reorderSeries(storeId, selected.id, books.map((book) => book.product_id)));
  };

  return <div className="mx-auto max-w-5xl space-y-6 p-6">
    <div><h1 className="text-2xl font-bold">Book series</h1><p className="text-sm text-muted-foreground">Group volumes and control their storefront reading order.</p></div>
    <Card><CardContent className="flex gap-2 pt-6">
      <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="New series name" />
      <Button disabled={busy || !storeId || !newName.trim()} onClick={() => void act(async () => {
        const created = await createSeries(storeId!, newName.trim()); setSelectedId(created.id); setNewName("");
      })}><Plus className="me-2 h-4 w-4" />Create</Button>
    </CardContent></Card>
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <Card><CardHeader><CardTitle className="text-base">Series</CardTitle></CardHeader><CardContent className="space-y-2">
        {series.map((item) => <Button key={item.id} variant={selected?.id === item.id ? "secondary" : "ghost"} className="w-full justify-start" onClick={() => setSelectedId(item.id)}><BookOpen className="me-2 h-4 w-4" />{item.name}</Button>)}
        {!series.length && <p className="text-sm text-muted-foreground">Create your first series.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{selected?.name ?? "Select a series"}</CardTitle></CardHeader><CardContent className="space-y-4">
        {selected && <div className="flex gap-2"><select className="h-10 flex-1 rounded-md border bg-background px-3 text-sm" value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Add a book…</option>{available.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select><Button disabled={busy || !productId} onClick={() => void act(async () => { await addSeriesBook(storeId!, selected.id, productId, selected.products.length + 1); setProductId(""); })}>Add</Button></div>}
        {selected?.products.map((book, index) => <div key={book.product_id} className="flex items-center gap-3 rounded-lg border p-3"><span className="w-8 text-center font-semibold">{index + 1}</span><span className="flex-1 font-medium">{book.name}</span><Button size="icon" variant="ghost" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" disabled={busy || index === selected.products.length - 1} onClick={() => move(index, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button><Button size="icon" variant="ghost" disabled={busy} onClick={() => void act(() => removeSeriesBook(storeId!, selected.id, book.product_id))} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button></div>)}
        {busy && <Loader2 className="h-5 w-5 animate-spin" />}
      </CardContent></Card>
    </div>
  </div>;
}
