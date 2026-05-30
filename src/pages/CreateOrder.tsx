import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// Tabs removed — customer step is single-mode now
import { toast } from "sonner";
import { showError } from "@/lib/show-error";
import {
  ArrowLeft, Loader2, Search, Plus, Minus, Trash2, Package,
  User, Truck, FileText, Check, X,
} from "lucide-react";
import { listProducts, type ApiProductResponse } from "@/services/productApi";
import { listCustomers, type Customer } from "@/services/customerApi";
import {
  createDraftOrder,
  createManualOrder,
  type CreateOrderLineItem,
} from "@/services/orderApi";

/* ═══════════════════════════════════════════════════════════════════════ */

type Step = 1 | 2 | 3 | 4;
interface CartItem { product: ApiProductResponse; quantity: number; }

const CreateOrder = () => {
  const { language } = useLanguage();
  const { currentStore } = useDashboardStore();
  const isAr = language === "ar";
  const storeId = currentStore?.id;
  const navigate = useNavigate();
  // `?draft=1` arrives from the Drafts page's "New draft" button. We pre-emit
  // the save-as-draft action when set, and the regular Create flow stays
  // available via the secondary button.
  const [searchParams] = useSearchParams();
  const startAsDraft = searchParams.get("draft") === "1";

  const [step, setStep] = useState<Step>(1);
  const [savingDraft, setSavingDraft] = useState(false);

  /* ── Step 1: Products ── */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<ApiProductResponse[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());

  /* ── Step 2: Customer ── */
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  /* ── Step 3: Shipping & Payment ── */
  const [address, setAddress] = useState({ line1: "", line2: "", city: "", state: "", postal_code: "", country: "EG" });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [notes, setNotes] = useState("");

  /* ── Step 4: Submit ── */
  const [creating, setCreating] = useState(false);

  const fmt = (cents: number) => { const v = cents / 100; return isAr ? `${v.toLocaleString("ar-EG")} ج.م` : `EGP ${v.toLocaleString()}`; };

  /* ── Product search for picker ── */
  useEffect(() => {
    if (!storeId || !showProductPicker) return;
    setLoadingProducts(true);
    listProducts(storeId, { search: productSearch || undefined, limit: 20, status: "active" })
      .then(r => setProducts(r.items)).catch(() => setProducts([])).finally(() => setLoadingProducts(false));
  }, [storeId, productSearch, showProductPicker]);

  /* ── Customer search ── */
  useEffect(() => {
    if (!storeId) return;
    const t = setTimeout(() => {
      setLoadingCustomers(true);
      listCustomers(storeId, { query: customerSearch || undefined, limit: 10 })
        .then(r => setCustomers(r.items)).catch(() => setCustomers([])).finally(() => setLoadingCustomers(false));
    }, 300);
    return () => clearTimeout(t);
  }, [storeId, customerSearch]);

  const togglePickerProduct = (id: string) => {
    setPickerSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const confirmProductPicker = () => {
    const newItems = products.filter(p => pickerSelected.has(p.id) && !cart.find(c => c.product.id === p.id));
    setCart(prev => [...prev, ...newItems.map(p => ({ product: p, quantity: 1 }))]);
    setShowProductPicker(false);
    setPickerSelected(new Set());
    setProductSearch("");
  };

  const updateQty = (id: string, delta: number) => setCart(prev => prev.map(c => c.product.id === id ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.product.id !== id));

  const subtotal = cart.reduce((s, c) => s + Number(c.product.price) * 100 * c.quantity, 0);

  const canNext = () => {
    if (step === 1) return cart.length > 0;
    if (step === 2) return !!selectedCustomer;
    if (step === 3) return address.line1.trim() !== "" && address.city.trim() !== "";
    return true;
  };

  const buildOrderPayload = () => {
    if (!selectedCustomer) return null;
    const line_items: CreateOrderLineItem[] = cart.map((c) => ({
      product_id: c.product.id,
      product_name: c.product.name,
      sku: c.product.sku || undefined,
      quantity: c.quantity,
      unit_price: Math.round(Number(c.product.price) * 100),
    }));
    return {
      customer_id: selectedCustomer.id,
      line_items,
      shipping_address: {
        first_name: selectedCustomer.first_name,
        last_name: selectedCustomer.last_name,
        address_line1: address.line1,
        address_line2: address.line2 || undefined,
        city: address.city,
        state: address.state || undefined,
        postal_code: address.postal_code || undefined,
        country: address.country,
        phone: selectedCustomer.phone || undefined,
      },
      shipping_cost: 0,
      currency: "EGP",
      payment_method: paymentMethod,
      shipping_method: shippingMethod,
      customer_notes: notes || undefined,
    };
  };

  const handleCreate = async () => {
    if (!storeId) return;
    const payload = buildOrderPayload();
    if (!payload) return;
    setCreating(true);
    try {
      await createManualOrder(storeId, payload);
      toast.success(isAr ? "تم إنشاء الطلب بنجاح" : "Order created");
      navigate("/orders");
    } catch (e) { showError(e, language); }
    finally { setCreating(false); }
  };

  const handleSaveDraft = async () => {
    if (!storeId) return;
    const payload = buildOrderPayload();
    if (!payload) return;
    setSavingDraft(true);
    try {
      await createDraftOrder(storeId, payload);
      toast.success(isAr ? "تم حفظ المسودة" : "Draft saved");
      navigate("/orders/drafts");
    } catch (e) { showError(e, language); }
    finally { setSavingDraft(false); }
  };

  const stepsConfig = [
    { num: 1 as Step, label: isAr ? "إضافة منتجات" : "Add Products" },
    { num: 2 as Step, label: isAr ? "معلومات العميل" : "Customer Info" },
    { num: 3 as Step, label: isAr ? "طريقة الشحن والدفع" : "Shipping & Payment" },
    { num: 4 as Step, label: isAr ? "ملخص الطلب" : "Order Summary" },
  ];

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigate("/orders")}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{isAr ? "إنشاء طلب يدوي جديد" : "Create New Manual Order"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{isAr ? "يمكنك إنشاء الطلبات وإنهاؤها دون تدخل العميل" : "Create and fulfill orders without customer involvement"}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          {stepsConfig.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > s.num ? "bg-emerald-500 text-white" : step === s.num ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {step > s.num ? <Check className="h-3.5 w-3.5" /> : s.num}
                </div>
                <span className={`text-[11px] font-medium hidden sm:inline ${step === s.num ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
              </div>
              {i < stepsConfig.length - 1 && <div className={`flex-1 h-px mx-3 ${step > s.num ? "bg-emerald-500" : "bg-border"}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
         STEP 1: إضافة منتجات — Product Selection
         ═══════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div className="rounded-xl border bg-card">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="text-base font-bold">{isAr ? "إضافة منتجات" : "Add Products"}</h2>
            <Button size="sm" className="h-8 text-xs rounded-lg gap-1.5" onClick={() => { setShowProductPicker(true); setPickerSelected(new Set(cart.map(c => c.product.id))); }}>
              <Plus className="h-3 w-3" />{isAr ? "اختر المنتجات" : "Choose Products"}
            </Button>
          </div>
          <div className="p-5 space-y-4">
            {/* Currency */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground">{isAr ? "العملة" : "Currency"}</Label>
                <Input value={isAr ? "جنيه مصري - (ج.م)" : "Egyptian Pound - (EGP)"} disabled className="h-10 text-sm rounded-lg bg-muted/30" />
              </div>
            </div>

            {/* Cart table */}
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader><TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="text-[11px] font-semibold">{isAr ? "المنتج" : "Product"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "الكمية" : "Qty"}</TableHead>
                  <TableHead className="text-[11px] font-semibold">{isAr ? "السعر الصافي" : "Price"}</TableHead>
                  <TableHead className="text-[11px] font-semibold"><div>{isAr ? "الإجمالي" : "Total"}</div><div className="text-[10px] font-normal text-muted-foreground">{isAr ? "العملة" : "Currency"}</div></TableHead>
                  <TableHead className="w-8" />
                </TableRow></TableHeader>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center"><Package className="h-7 w-7 text-muted-foreground/20" /></div>
                        <p className="text-sm font-semibold text-muted-foreground">{isAr ? "لم يتم إضافة منتج بعد." : "No products added yet."}</p>
                        <p className="text-xs text-muted-foreground/60">{isAr ? "اختر المنتجات لتضمينها في هذا الطلب اليدوي" : "Choose products to include in this order"}</p>
                        <Button size="sm" className="h-8 text-xs rounded-lg mt-1" onClick={() => { setShowProductPicker(true); setPickerSelected(new Set()); }}>
                          {isAr ? "اختر المنتجات" : "Choose Products"}
                        </Button>
                      </div>
                    </TableCell></TableRow>
                  ) : cart.map(c => {
                    const price = Number(c.product.price) * 100;
                    return (
                      <TableRow key={c.product.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.product.images?.[0] ? <img src={c.product.images[0]} className="h-8 w-8 rounded-md object-cover border" alt="" /> : <div className="h-8 w-8 rounded-md bg-muted" />}
                            <div><p className="text-xs font-medium truncate max-w-[150px]">{c.product.name}</p><p className="text-[10px] text-muted-foreground">{c.product.sku || "—"}</p></div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <button className="h-6 w-6 rounded border flex items-center justify-center hover:bg-muted/50 cursor-pointer" onClick={() => updateQty(c.product.id, -1)}><Minus className="h-3 w-3" /></button>
                            <span className="text-xs font-medium tabular-nums w-6 text-center">{c.quantity}</span>
                            <button className="h-6 w-6 rounded border flex items-center justify-center hover:bg-muted/50 cursor-pointer" onClick={() => updateQty(c.product.id, 1)}><Plus className="h-3 w-3" /></button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">{fmt(price)}</TableCell>
                        <TableCell><div className="text-xs font-semibold tabular-nums">{fmt(price * c.quantity)}</div><div className="text-[10px] text-muted-foreground">EGP</div></TableCell>
                        <TableCell><button className="text-muted-foreground/40 hover:text-destructive cursor-pointer" onClick={() => removeFromCart(c.product.id)}><Trash2 className="h-3.5 w-3.5" /></button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
         STEP 2: معلومات العميل — Customer (existing or new)
         ═══════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div className="rounded-xl border bg-card">
          <div className="px-5 py-4 border-b"><h2 className="text-base font-bold">{isAr ? "اختر العميل" : "Select Customer"}</h2></div>
          <div className="p-5 space-y-3">
            {selectedCustomer ? (
              <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-500/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{selectedCustomer.first_name.charAt(0)}{selectedCustomer.last_name?.charAt(0) || ""}</div>
                  <div>
                    <p className="text-sm font-semibold">{selectedCustomer.full_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedCustomer.email}{selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedCustomer.total_orders} {isAr ? "طلبات" : "orders"} · {fmt(selectedCustomer.total_spent)}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] text-destructive hover:text-destructive" onClick={() => setSelectedCustomer(null)}><X className="h-3 w-3 mr-1" />{isAr ? "تغيير" : "Change"}</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder={isAr ? "ابحث بالاسم أو البريد أو الهاتف..." : "Search by name, email, or phone..."} className="h-10 text-sm rounded-lg ps-9" />
                </div>
                <div className="rounded-xl border overflow-hidden max-h-[300px] overflow-y-auto">
                  {loadingCustomers ? <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  : customers.length === 0 ? <div className="text-center py-8 text-xs text-muted-foreground">{isAr ? "لا نتائج — ابحث عن عميل" : "No customers found — search for one"}</div>
                  : customers.map(c => (
                    <button key={c.id} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-0 cursor-pointer" onClick={() => setSelectedCustomer(c)}>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{c.first_name.charAt(0)}{c.last_name?.charAt(0) || ""}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{c.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums shrink-0">{c.total_orders} {isAr ? "طلب" : "orders"}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
         STEP 3: طريقة الشحن والدفع
         ═══════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card">
            <div className="px-5 py-4 border-b"><h2 className="text-base font-bold">{isAr ? "عنوان الشحن" : "Shipping Address"}</h2></div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">{isAr ? "العنوان" : "Address"} *</Label><Input value={address.line1} onChange={e => setAddress(p => ({ ...p, line1: e.target.value }))} className="h-10 text-sm rounded-lg" /></div>
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">{isAr ? "العنوان 2" : "Address Line 2"}</Label><Input value={address.line2} onChange={e => setAddress(p => ({ ...p, line2: e.target.value }))} className="h-10 text-sm rounded-lg" /></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">{isAr ? "المدينة" : "City"} *</Label><Input value={address.city} onChange={e => setAddress(p => ({ ...p, city: e.target.value }))} className="h-10 text-sm rounded-lg" /></div>
                <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">{isAr ? "المنطقة" : "State"}</Label><Input value={address.state} onChange={e => setAddress(p => ({ ...p, state: e.target.value }))} className="h-10 text-sm rounded-lg" /></div>
                <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">{isAr ? "الرمز البريدي" : "Postal"}</Label><Input value={address.postal_code} onChange={e => setAddress(p => ({ ...p, postal_code: e.target.value }))} className="h-10 text-sm rounded-lg" /></div>
              </div>
            </div>
          </div>
          <div className="rounded-xl border bg-card">
            <div className="px-5 py-4 border-b"><h2 className="text-base font-bold">{isAr ? "طريقة الدفع والشحن" : "Payment & Shipping"}</h2></div>
            <div className="p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">{isAr ? "طريقة الدفع" : "Payment"}</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger className="h-10 text-sm rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cod">{isAr ? "دفع عند الاستلام" : "COD"}</SelectItem><SelectItem value="card">{isAr ? "بطاقة" : "Card"}</SelectItem><SelectItem value="bank_transfer">{isAr ? "تحويل بنكي" : "Transfer"}</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">{isAr ? "طريقة الشحن" : "Shipping"}</Label><Select value={shippingMethod} onValueChange={setShippingMethod}><SelectTrigger className="h-10 text-sm rounded-lg"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">{isAr ? "عادي" : "Standard"}</SelectItem><SelectItem value="express">{isAr ? "سريع" : "Express"}</SelectItem></SelectContent></Select></div>
              </div>
              <div className="space-y-1.5"><Label className="text-[11px] text-muted-foreground">{isAr ? "ملاحظات" : "Notes"}</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-sm rounded-lg" /></div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
         STEP 4: ملخص الطلب
         ═══════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card">
            <div className="px-5 py-4 border-b"><h2 className="text-base font-bold">{isAr ? "ملخص الطلب" : "Order Summary"}</h2></div>
            <div className="p-5 space-y-3">
              {cart.map(c => (
                <div key={c.product.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    {c.product.images?.[0] ? <img src={c.product.images[0]} className="h-8 w-8 rounded-md object-cover border" alt="" /> : <div className="h-8 w-8 rounded-md bg-muted" />}
                    <div><p className="text-xs font-medium">{c.product.name}</p><p className="text-[10px] text-muted-foreground">×{c.quantity}</p></div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums">{fmt(Number(c.product.price) * 100 * c.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t"><span className="text-sm font-bold">{isAr ? "الإجمالي" : "Total"}</span><span className="text-sm font-bold tabular-nums">{fmt(subtotal)}</span></div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">{isAr ? "العميل" : "Customer"}</p>
              <p className="text-sm font-medium">{selectedCustomer?.full_name}</p>
              {selectedCustomer?.email && <p className="text-xs text-muted-foreground">{selectedCustomer.email}</p>}
              {selectedCustomer?.phone && <p className="text-xs text-muted-foreground" dir="ltr">{selectedCustomer.phone}</p>}
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">{isAr ? "الشحن" : "Shipping"}</p>
              <p className="text-xs">{address.line1}</p>
              <p className="text-xs text-muted-foreground">{address.city}{address.state ? `, ${address.state}` : ""}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary" className="text-[10px]">{paymentMethod === "cod" ? "COD" : paymentMethod}</Badge>
                <Badge variant="secondary" className="text-[10px]">{shippingMethod}</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="rounded-xl border bg-muted/20 px-5 py-3 flex items-center justify-center gap-3">
        <Button variant="outline" size="sm" className="h-9 text-xs rounded-lg px-6" disabled={step === 1} onClick={() => setStep((step - 1) as Step)}>{isAr ? "السابق" : "Previous"}</Button>
        {/* Save-as-draft is available from step 2 onward (needs a customer +
            line items), regardless of which step the wizard is on. */}
        {cart.length > 0 && selectedCustomer && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs rounded-lg px-6 gap-1.5"
            disabled={savingDraft || creating}
            onClick={handleSaveDraft}
          >
            {savingDraft ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
            {isAr ? "حفظ كمسودة" : "Save as draft"}
          </Button>
        )}
        {step < 4 ? (
          <Button size="sm" className="h-9 text-xs rounded-lg px-6" disabled={!canNext()} onClick={() => setStep((step + 1) as Step)}>{isAr ? "التالي" : "Next"}</Button>
        ) : startAsDraft ? (
          <Button size="sm" className="h-9 text-xs rounded-lg px-6 gap-1.5" disabled={savingDraft} onClick={handleSaveDraft}>{savingDraft ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}{isAr ? "حفظ المسودة" : "Save draft"}</Button>
        ) : (
          <Button size="sm" className="h-9 text-xs rounded-lg px-6 gap-1.5" disabled={creating} onClick={handleCreate}>{creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}{isAr ? "إنشاء الطلب" : "Create Order"}</Button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
         PRODUCT PICKER DIALOG — Zid-style
         ═══════════════════════════════════════════════════════ */}
      <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle>{isAr ? "حدد المنتجات" : "Select Products"}</DialogTitle>
          </DialogHeader>

          {/* Search + filters */}
          <div className="px-5 py-3 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder={isAr ? "بحث" : "Search"} className="h-9 text-sm rounded-lg ps-9" autoFocus />
            </div>
          </div>

          {/* Product list */}
          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader><TableRow className="bg-muted/20 hover:bg-muted/20 sticky top-0">
                <TableHead className="w-10" />
                <TableHead className="text-[11px] font-semibold"><div>{isAr ? "الاسم" : "Name"}</div><div className="text-[10px] font-normal text-muted-foreground">{isAr ? "كود SKU" : "SKU"}</div></TableHead>
                <TableHead className="text-[11px] font-semibold">{isAr ? "الكمية" : "Qty"}</TableHead>
                <TableHead className="text-[11px] font-semibold">{isAr ? "السعر" : "Price"}</TableHead>
                <TableHead className="text-[11px] font-semibold">{isAr ? "الحالة" : "Status"}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loadingProducts ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" /></TableCell></TableRow>
                ) : products.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-xs text-muted-foreground">{isAr ? "لا نتائج" : "No products found"}</TableCell></TableRow>
                ) : products.map(p => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => togglePickerProduct(p.id)}>
                    <TableCell><Checkbox checked={pickerSelected.has(p.id)} onCheckedChange={() => togglePickerProduct(p.id)} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.images?.[0] ? <img src={p.images[0]} className="h-8 w-8 rounded-md object-cover border shrink-0" alt="" /> : <div className="h-8 w-8 rounded-md bg-muted shrink-0" />}
                        <div><p className="text-xs font-medium truncate max-w-[180px]">{p.name}</p><p className="text-[10px] text-muted-foreground">{p.sku || "—"}</p></div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{p.quantity === -1 ? (isAr ? "غير محدود" : "Unlimited") : p.quantity}</TableCell>
                    <TableCell className="text-xs tabular-nums">{fmt(Number(p.price) * 100)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] ${p.is_in_stock ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>
                        {p.is_in_stock ? (isAr ? "منشور" : "Active") : (isAr ? "نفذ" : "Out")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t shrink-0 flex items-center justify-between bg-muted/10">
            <Checkbox id="hide-oos" /><label htmlFor="hide-oos" className="text-[11px] text-muted-foreground cursor-pointer ms-1.5">{isAr ? "إخفاء المنتجات غير المتوفرة في المخزون" : "Hide out-of-stock products"}</label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={() => setShowProductPicker(false)}>{isAr ? "إغلاق" : "Close"}</Button>
              <Button size="sm" className="h-8 text-xs rounded-lg" onClick={confirmProductPicker} disabled={pickerSelected.size === 0}>{isAr ? "حفظ" : "Save"} ({pickerSelected.size})</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateOrder;
