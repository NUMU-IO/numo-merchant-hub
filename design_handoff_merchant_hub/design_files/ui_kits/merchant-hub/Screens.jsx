/* NUMU "Souq" — screens (redesigned): Dashboard, Orders, Products, Customers, Login */
const { useState: useS } = React;

/* ---------- shared bits ---------- */
function PageHead({ title, sub, children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <h1 className="display">{title}</h1>
        {sub && <p className="muted" style={{ marginTop: 3 }}>{sub}</p>}
      </div>
      {children && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>}
    </div>
  );
}

function StatTile({ icon, tone, label, value, delta, up }) {
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className={"ichip " + tone} style={{ width: 38, height: 38, borderRadius: 12 }}><Icon name={icon} weight="duotone" size={20} /></div>
        {delta && <span className="pill" style={{ fontSize: 11.5, padding: "3px 9px", color: up ? "var(--success)" : "var(--terracotta)", background: up ? "var(--success-bg)" : "var(--danger-bg)" }}><span className="ltr-nums">{delta}</span></span>}
      </div>
      <div>
        <div className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</div>
        <div className="display tnum" style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.01em", marginTop: 1 }}>{value}</div>
      </div>
    </div>
  );
}

function SectionCard({ title, action, onAction, children, pad = true }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px" }}>
        <h2 className="display" style={{ fontSize: 17 }}>{title}</h2>
        {action && <button className="btn btn-ghost btn-sm" onClick={onAction} style={{ color: "var(--navy)" }}>{action}</button>}
      </div>
      <div style={{ padding: pad ? "0 6px 6px" : 0 }}>{children}</div>
    </div>
  );
}

// bigger area chart for the dashboard
function AreaChart({ data, color, h = 150 }) {
  const w = 520, pad = 8;
  const max = Math.max(...data), min = Math.min(...data) * .9, rng = (max - min) || 1;
  const pts = data.map((v, i) => ({ x: pad + (i / (data.length - 1)) * (w - pad * 2), y: h - 22 - ((v - min) / rng) * (h - 44) }));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx1 = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * .42, cx2 = pts[i].x - (pts[i].x - pts[i - 1].x) * .42;
    d += ` C${cx1},${pts[i - 1].y} ${cx2},${pts[i].y} ${pts[i].x},${pts[i].y}`;
  }
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="ltr-nums" style={{ display: "block" }}>
      <defs><linearGradient id="ac" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".20" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {[0.25, 0.5, 0.75].map((g, i) => <line key={i} x1="0" x2={w} y1={(h - 22) * g + 8} y2={(h - 22) * g + 8} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" />)}
      <path d={`${d} L${pts[pts.length - 1].x},${h - 22} L${pts[0].x},${h - 22} Z`} fill="url(#ac)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {pts.map((p, i) => i === pts.length - 1 && <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} stroke="var(--surface)" strokeWidth="2.5" />)}
    </svg>
  );
}

/* ===== (legacy dashboard — superseded by DashboardScreen.jsx, kept dormant) ===== */
function DashboardOld({ ar, go, mobile }) {
  const fmt = (n) => FMT(n, ar);
  const days = ar ? ["سبت","حد","اتنين","تلات","اربع","خميس","جمعة"] : ["Sat","Sun","Mon","Tue","Wed","Thu","Fri"];
  return (
    <div className="page stagger" style={{ display: "flex", flexDirection: "column", gap: 18, padding: mobile ? 16 : 24 }}>
      {/* greeting */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <img src="../../assets/onboarding/welcome.webp" alt="" style={{ width: 52, height: 52, objectFit: "contain" }} />
          <div>
            <h1 className="display">{tx(T.greetMorning, ar)}، {tx(T.merchant, ar)} 👋</h1>
            <p className="muted" style={{ marginTop: 2 }}>{tx(T.summary, ar)}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-outline btn-sm"><Icon name="arrow-square-out" />{tx(T.viewStore, ar)}</button>
          <button className="btn btn-accent btn-sm" onClick={() => go("products")}><Icon name="plus" />{tx(T.addProduct, ar)}</button>
        </div>
      </div>

      {/* attention inline bar */}
      <div className="card" style={{ display: "flex", flexDirection: mobile ? "column" : "row", overflow: "hidden" }}>
        <button onClick={() => go("orders")} style={{ flex: 1, display: "flex", alignItems: "center", gap: 13, padding: "14px 18px", textAlign: "start", background: "none", borderInlineEnd: mobile ? "none" : "1px solid var(--border)", borderBottom: mobile ? "1px solid var(--border)" : "none" }}>
          <div className="ichip saffron" style={{ width: 40, height: 40 }}><Icon name="clock" weight="duotone" size={21} /></div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}><span className="tnum">2</span> {tx(T.pendingOrders, ar)}</div><div className="muted" style={{ fontSize: 12 }}>{ar ? "اتصرف فيها بسرعة" : "Take action soon"}</div></div>
          <Icon name="caret-left" size={16} style={{ color: "var(--ink-faint)", transform: ar ? "none" : "scaleX(-1)" }} />
        </button>
        <button onClick={() => go("products")} style={{ flex: 1, display: "flex", alignItems: "center", gap: 13, padding: "14px 18px", textAlign: "start", background: "none" }}>
          <div className="ichip terra" style={{ width: 40, height: 40 }}><Icon name="warning" weight="duotone" size={21} /></div>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}><span className="tnum">2</span> {tx(T.lowStock, ar)}</div><div className="muted" style={{ fontSize: 12 }}>{ar ? "محتاج إعادة تخزين" : "Restock needed"}</div></div>
          <Icon name="caret-left" size={16} style={{ color: "var(--ink-faint)", transform: ar ? "none" : "scaleX(-1)" }} />
        </button>
      </div>

      {/* KPI row — navy Sales hero + 3 tiles */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1.35fr 1fr 1fr 1fr", gap: 14 }}>
        {/* navy hero */}
        <div style={{ gridColumn: mobile ? "1 / -1" : "auto", background: "var(--navy)", borderRadius: "var(--r-lg)", padding: 18, color: "#fff", position: "relative", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
          <div style={{ position: "absolute", inset: 0, opacity: .12, mixBlendMode: "screen", backgroundImage: "url(../../assets/numu-n-mark.jpg)", backgroundSize: 120, backgroundPosition: "right -10px top -10px", backgroundRepeat: "no-repeat" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>{tx(T.sales, ar)} · {tx(T.last7, ar)}</span>
              <span className="pill" style={{ fontSize: 11.5, padding: "3px 9px", background: "rgba(94,138,92,.25)", color: "#9FD89C" }}><span className="ltr-nums">+12.4%</span></span>
            </div>
            <div className="display tnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", marginTop: 8 }}>{fmt(48250)}</div>
            <div style={{ marginTop: 12, marginInline: -4 }}><Sparkline data={SPARK} color="#E89A2C" h={42} id="hero" /></div>
          </div>
        </div>
        <StatTile icon="shopping-cart" tone="navy" label={tx(T.orders, ar)} value={ar ? (312).toLocaleString("ar-EG") : "312"} delta="+8.1%" up />
        <StatTile icon="users" tone="sage" label={tx(T.visitors, ar)} value={ar ? (5840).toLocaleString("ar-EG") : "5,840"} delta="+3.2%" up />
        <StatTile icon="receipt" tone="terra" label={tx(T.aov, ar)} value={fmt(412)} delta="−1.4%" up={false} />
      </div>

      {/* chart + top sellers */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.7fr 1fr", gap: 14 }}>
        <SectionCard title={ar ? "حركة الإيرادات" : "Revenue this week"} pad={false}>
          <div style={{ padding: "0 6px" }}><AreaChart data={SPARK} color="var(--navy)" h={mobile ? 150 : 168} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 18px 16px" }}>
            {days.map((d, i) => <span key={i} className="muted" style={{ fontSize: 11 }}>{d}</span>)}
          </div>
        </SectionCard>
        <TopSellers ar={ar} go={go} />
      </div>

      {/* recent orders */}
      <RecentOrders ar={ar} go={go} />

      {/* setup banner */}
      <SetupBanner ar={ar} />
    </div>
  );
}

function TopSellers({ ar, go }) {
  const top = [...PRODUCTS].sort((a, b) => b.sold - a.sold).slice(0, 5);
  return (
    <SectionCard title={tx(T.topProducts, ar)} action={tx(T.viewAll, ar)} onAction={() => go("products")}>
      {top.map((p, i) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px" }}>
          <div className="display" style={{ width: 18, color: "var(--ink-faint)", fontWeight: 800, fontSize: 14 }}>{ar ? (i + 1).toLocaleString("ar-EG") : i + 1}</div>
          <div className="thumb" style={{ width: 38, height: 38, fontSize: 21 }}>{p.img}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tx(p, ar)}</div>
            <div className="muted" style={{ fontSize: 11.5 }}><span className="tnum">{ar ? p.sold.toLocaleString("ar-EG") : p.sold}</span> {tx(T.sold_u, ar)}</div>
          </div>
          <div className="tnum display" style={{ fontWeight: 800, fontSize: 13 }}>{FMT(p.price * p.sold, ar)}</div>
        </div>
      ))}
    </SectionCard>
  );
}

function RecentOrders({ ar, go }) {
  return (
    <SectionCard title={tx(T.recentOrders, ar)} action={tx(T.viewAll, ar)} onAction={() => go("orders")}>
      {ORDERS.slice(0, 5).map((o) => {
        const n = NAMES[o.who];
        return (
          <div key={o.id} onClick={() => go("orders")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, cursor: "pointer" }} className="hoverrow">
            <Avatar name={tx(n, ar)} tone={o.who} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{tx(n, ar)}</div>
              <div className="muted mono" style={{ fontSize: 11 }}>{o.id} · {ar ? (o.agoAr || o.ago) : o.ago}</div>
            </div>
            <StatusPill status={o.status} ar={ar} />
            <div className="tnum display" style={{ fontWeight: 800, minWidth: 84, textAlign: ar ? "left" : "right" }}>{FMT(o.total, ar)}</div>
          </div>
        );
      })}
    </SectionCard>
  );
}
function mobile_hidden_removed() { return null; }

function SetupBanner({ ar }) {
  const steps = [
    { en: "Add a product", ar: "ضيف منتج", icon: "package", done: true },
    { en: "Store identity", ar: "هوية المتجر", icon: "storefront", done: true },
    { en: "Set up shipping", ar: "اضبط الشحن", icon: "truck", done: false },
    { en: "Activate payments", ar: "فعّل الدفع", icon: "credit-card", done: false },
  ];
  const done = steps.filter(s => s.done).length;
  return (
    <div style={{ background: "var(--navy)", borderRadius: "var(--r-xl)", padding: 22, color: "#fff", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, opacity: .12, mixBlendMode: "screen", backgroundImage: "url(../../assets/numu-n-mark.jpg)", backgroundSize: 118 }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: 16, background: "rgba(232,154,44,.16)", display: "grid", placeItems: "center", color: "var(--saffron)" }}><Icon name="gift" weight="duotone" size={26} /></div>
          <div>
            <div className="display" style={{ fontSize: 18, fontWeight: 800 }}>{tx(T.setup, ar)}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", marginTop: 2 }}>{tx(T.setupSub, ar)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--saffron)", fontWeight: 800, fontFamily: "var(--font-display)" }}>
          <span className="tnum" style={{ fontSize: 22 }}>{ar ? done.toLocaleString("ar-EG") : done}</span>
          <span style={{ color: "rgba(255,255,255,.35)" }}>/</span>
          <span className="tnum" style={{ fontSize: 22, color: "rgba(255,255,255,.5)" }}>{ar ? "٤" : "4"}</span>
        </div>
      </div>
      <div style={{ position: "relative", display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 15px", borderRadius: 999, background: s.done ? "rgba(94,138,92,.22)" : "rgba(255,255,255,.07)", border: "1px solid " + (s.done ? "rgba(94,138,92,.4)" : "rgba(255,255,255,.1)"), fontSize: 13, fontWeight: 700 }}>
            <Icon name={s.done ? "check-circle" : s.icon} weight={s.done ? "fill" : "bold"} size={18} style={{ color: s.done ? "#8FCB8C" : "var(--saffron)" }} />
            {tx(s, ar)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== ORDERS ============================== */
function OrderDrawer({ order, ar, onClose, onFulfill }) {
  const n = NAMES[order.who];
  const items = PRODUCTS.slice(0, Math.max(1, Math.min(order.items, 3))).map((p, i) => ({ ...p, qty: i === 0 && order.items > 1 ? 2 : 1 }));
  const shipping = 50;
  const subtotal = order.total - shipping;
  const steps = [
    { t: ar ? "اتعمل الطلب" : "Order placed", on: true },
    { t: ar ? "اتأكد الطلب" : "Order confirmed", on: ["confirmed","processing","shipped","delivered"].includes(order.status) },
    { t: ar ? "بيتجهز" : "Processing", on: ["processing","shipped","delivered"].includes(order.status) },
    { t: ar ? "اتشحن" : "Shipped", on: ["shipped","delivered"].includes(order.status) },
    { t: ar ? "اتسلّم" : "Delivered", on: order.status === "delivered" },
  ];
  return (
    <React.Fragment>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-head">
          <button className="h-icon" style={{ width: 38, height: 38 }} onClick={onClose}><Icon name="x" weight="bold" /></button>
          <div style={{ flex: 1 }}>
            <div className="display mono" style={{ fontWeight: 800, fontSize: 16 }}>{order.id}</div>
            <div className="muted" style={{ fontSize: 12 }}>{ar ? (order.agoAr || order.ago) : order.ago}</div>
          </div>
          <StatusPill status={order.status} ar={ar} />
        </div>
        <div className="drawer-body">
          <div className="dw-block" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={tx(n, ar)} tone={order.who} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{tx(n, ar)}</div>
              <div className="muted" style={{ fontSize: 12 }}>{tx({ en: n.city, ar: n.cityAr }, ar)} · <span className="ltr-nums mono">+20 10 1234 5678</span></div>
            </div>
            <button className="btn btn-sm" style={{ background: "#E3EEE2", color: "#2E7D4F" }}><Icon name="whatsapp-logo" weight="fill" />{ar ? "واتساب" : "WhatsApp"}</button>
          </div>
          <div className="dw-block">
            <div className="dw-block-head">{ar ? "المنتجات" : "Items"}</div>
            {items.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid var(--border)" : "none" }}>
                <div className="thumb" style={{ width: 42, height: 42, fontSize: 22 }}>{p.img}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{tx(p, ar)}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}><span className="tnum">{ar ? p.qty.toLocaleString("ar-EG") : p.qty}</span> × {FMT(p.price, ar)}</div>
                </div>
                <div className="tnum display" style={{ fontWeight: 700, fontSize: 13 }}>{FMT(p.price * p.qty, ar)}</div>
              </div>
            ))}
          </div>
          <div className="dw-block" style={{ padding: "12px 14px" }}>
            <div className="dw-block-head" style={{ padding: "0 0 8px" }}>{ar ? "ملخص الدفع" : "Payment"}</div>
            {[[ar ? "الإجمالي الفرعي" : "Subtotal", FMT(subtotal, ar)], [ar ? "الشحن" : "Shipping", FMT(shipping, ar)]].map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: "var(--ink-soft)" }}><span>{r[0]}</span><span className="tnum">{r[1]}</span></div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "8px 0 0", marginTop: 4, borderTop: "1px solid var(--border)", fontWeight: 800 }}><span>{tx(T.total, ar)}</span><span className="tnum display">{FMT(order.total, ar)}</span></div>
            <div style={{ marginTop: 10 }}>
              <span className="pill" style={{ fontSize: 11.5, background: order.pay === "paid" ? "var(--success-bg)" : "var(--surface-2)", color: order.pay === "paid" ? "var(--success)" : "var(--ink-soft)" }}><Icon name={order.pay === "cod" ? "money" : "credit-card"} size={14} weight="duotone" />{tx(PAY[order.pay], ar)}</span>
            </div>
          </div>
          <div className="dw-block" style={{ padding: "14px" }}>
            <div className="dw-block-head" style={{ padding: "0 0 10px" }}>{ar ? "مسار الطلب" : "Timeline"}</div>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 999, display: "grid", placeItems: "center", background: s.on ? "var(--sage)" : "var(--surface-2)", color: "#fff" }}>{s.on && <Icon name="check" size={11} weight="bold" />}</div>
                  {i < steps.length - 1 && <div style={{ width: 2, height: 18, background: s.on ? "var(--sage)" : "var(--border)" }} />}
                </div>
                <div style={{ fontSize: 13, fontWeight: s.on ? 600 : 400, color: s.on ? "var(--ink)" : "var(--ink-faint)" }}>{s.t}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="drawer-foot">
          <button className="btn btn-outline" style={{ flex: 1 }}><Icon name="printer" weight="duotone" />{ar ? "طباعة" : "Print"}</button>
          <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={onFulfill}><Icon name="truck" weight="bold" />{ar ? "جهّز الطلب" : "Fulfill order"}</button>
        </div>
      </div>
    </React.Fragment>
  );
}

function Orders({ ar, mobile }) {
  const [filter, setFilter] = useS("all");
  const [sel, setSel] = useS({});
  const [detail, setDetail] = useS(null);
  const [toast, setToast] = useS(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const filters = [["all", T.all], ["pending", STATUS.pending], ["processing", STATUS.processing], ["shipped", STATUS.shipped], ["delivered", STATUS.delivered]];
  const rows = ORDERS.filter(o => filter === "all" || o.status === filter);
  const selCount = Object.values(sel).filter(Boolean).length;
  const todayRev = ORDERS.reduce((s, o) => s + (o.status !== "cancelled" ? o.total : 0), 0);
  return (
    <div className="page fade-up" style={{ display: "flex", flexDirection: "column", gap: 18, padding: mobile ? 16 : 24 }}>
      <PageHead title={tx(T.orders, ar)} sub={ar ? "تابع طلباتك وجهّزها" : "Track and fulfill your orders"}>
        <button className="btn btn-outline btn-sm"><Icon name="file-arrow-down" />{tx(T.export, ar)}</button>
        <button className="btn btn-primary btn-sm"><Icon name="plus" />{ar ? "طلب جديد" : "New order"}</button>
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 14 }}>
        <StatTile icon="shopping-cart" tone="navy" label={ar ? "كل الطلبات" : "All orders"} value={ar ? "٨" : "8"} />
        <StatTile icon="clock" tone="saffron" label={tx(STATUS.pending, ar)} value={ar ? "٢" : "2"} />
        <StatTile icon="truck" tone="sage" label={tx(STATUS.shipped, ar)} value={ar ? "١" : "1"} />
        <StatTile icon="money" tone="terra" label={ar ? "إيراد الفترة" : "Revenue"} value={FMT(todayRev, ar)} />
      </div>

      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
        {filters.map(([k, lbl]) => <button key={k} className={"chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{tx(lbl, ar)}</button>)}
        <div style={{ flex: 1 }} />
        <div className="chip" style={{ gap: 8, color: "var(--ink-soft)", cursor: "default", minWidth: mobile ? "100%" : 200, justifyContent: "flex-start" }}><Icon name="magnifying-glass" size={16} />{ar ? "دوّر على طلب…" : "Search orders…"}</div>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        {selCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", background: "var(--navy)", color: "#fff" }}>
            <span style={{ fontWeight: 700, fontSize: 13.5 }}><span className="tnum">{ar ? selCount.toLocaleString("ar-EG") : selCount}</span> {ar ? "متحدد" : "selected"}</span>
            <button className="btn btn-accent btn-sm" style={{ marginInlineStart: "auto" }} onClick={() => { showToast(ar ? "اتجهّزت الطلبات المحددة ✓" : "Selected orders fulfilled ✓"); setSel({}); }}><Icon name="truck" />{ar ? "تجهيز" : "Fulfill"}</button>
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ minWidth: mobile ? 520 : undefined }}>
            <thead><tr>
              <th style={{ width: 40 }}></th><th>{tx(T.orders, ar)}</th><th>{tx(T.customer, ar)}</th>
              <th>{tx(T.payment, ar)}</th><th>{tx(T.status, ar)}</th><th style={{ textAlign: "end" }}>{tx(T.total, ar)}</th>
            </tr></thead>
            <tbody>
              {rows.map(o => {
                const n = NAMES[o.who]; const on = !!sel[o.id];
                return (
                  <tr key={o.id} onClick={() => setDetail(o)}>
                    <td onClick={e => e.stopPropagation()}>
                      <button onClick={() => setSel(s => ({ ...s, [o.id]: !s[o.id] }))} style={{ width: 22, height: 22, borderRadius: 7, border: "1.5px solid " + (on ? "var(--navy)" : "var(--border-strong)"), background: on ? "var(--navy)" : "transparent", display: "grid", placeItems: "center" }}>
                        {on && <Icon name="check" size={14} style={{ color: "#fff" }} />}
                      </button>
                    </td>
                    <td><div className="mono" style={{ fontWeight: 700 }}>{o.id}</div><div className="muted" style={{ fontSize: 11.5 }}>{ar ? (o.agoAr || o.ago) : o.ago} · <span className="tnum">{ar ? o.items.toLocaleString("ar-EG") : o.items}</span> {tx(T.units, ar)}</div></td>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar name={tx(n, ar)} tone={o.who} size={32} /><div><div style={{ fontWeight: 600, fontSize: 13 }}>{tx(n, ar)}</div><div className="muted" style={{ fontSize: 11.5 }}>{tx({ en: n.city, ar: n.cityAr }, ar)}</div></div></div></td>
                    <td><PayPill pay={o.pay} ar={ar} /></td>
                    <td><StatusPill status={o.status} ar={ar} /></td>
                    <td style={{ textAlign: "end" }}><span className="tnum display" style={{ fontWeight: 800 }}>{FMT(o.total, ar)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {detail && <OrderDrawer order={detail} ar={ar} onClose={() => setDetail(null)} onFulfill={() => { setDetail(null); showToast(ar ? "اتجهّز الطلب ✓" : "Order fulfilled ✓"); }} />}
      {toast && <div className="toast"><Icon name="check-circle" weight="fill" />{toast}</div>}
    </div>
  );
}

/* ============================== PRODUCTS ============================== */
function Products({ ar, mobile }) {
  const [tab, setTab] = useS("all");
  const tabs = [["all", T.all], ["published", { en: "Published", ar: "منشور" }], ["draft", { en: "Drafts", ar: "مسودات" }]];
  const rows = PRODUCTS.filter(p => tab === "all" || p.status === tab);
  const lowCount = PRODUCTS.filter(p => p.stock <= 10).length;
  return (
    <div className="page fade-up" style={{ display: "flex", flexDirection: "column", gap: 18, padding: mobile ? 16 : 24 }}>
      <PageHead title={ar ? "المنتجات" : "Products"} sub={ar ? "أضف وعدّل منتجاتك" : "Add and manage your catalog"}>
        <button className="btn btn-outline btn-sm"><Icon name="file-arrow-down" />{ar ? "استيراد" : "Import"}</button>
        <button className="btn btn-accent btn-sm"><Icon name="plus" />{tx(T.addProduct, ar)}</button>
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 14 }}>
        <StatTile icon="package" tone="navy" label={ar ? "كل المنتجات" : "Total"} value={ar ? "٩" : "9"} />
        <StatTile icon="check-circle" tone="sage" label={ar ? "منشور" : "Published"} value={ar ? "٧" : "7"} />
        <StatTile icon="warning" tone="terra" label={ar ? "مخزون منخفض" : "Low stock"} value={ar ? lowCount.toLocaleString("ar-EG") : lowCount} />
        <StatTile icon="tag" tone="saffron" label={ar ? "الفئات" : "Categories"} value={ar ? "٦" : "6"} />
      </div>

      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
        {tabs.map(([k, l]) => <button key={k} className={"chip" + (tab === k ? " on" : "")} onClick={() => setTab(k)}>{tx(l, ar)}</button>)}
        <div style={{ flex: 1 }} />
        <div className="chip" style={{ gap: 8, color: "var(--ink-soft)", cursor: "default", minWidth: mobile ? "100%" : 200, justifyContent: "flex-start" }}><Icon name="magnifying-glass" size={16} />{ar ? "دوّر على منتج…" : "Search products…"}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: 14 }} className="stagger">
        {rows.map(p => {
          const low = p.stock <= 10;
          const pct = Math.min(100, Math.round((p.stock / 120) * 100));
          return (
            <div key={p.id} className="card card-hover" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                <div className="thumb" style={{ width: 60, height: 60, fontSize: 32 }}>{p.img}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>{tx(p, ar)}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{tx({ en: p.cat, ar: p.catAr }, ar)} · <span className="mono">{p.id}</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                    <span className="tnum display" style={{ fontWeight: 800, fontSize: 15 }}>{FMT(p.price, ar)}</span>
                    {p.was && <span className="tnum muted" style={{ fontSize: 12, textDecoration: "line-through" }}>{FMT(p.was, ar)}</span>}
                    {p.status === "draft" && <span className="pill" style={{ marginInlineStart: "auto", fontSize: 10.5, padding: "2px 9px", color: "var(--ink-soft)", background: "var(--surface-2)" }}>{ar ? "مسودة" : "Draft"}</span>}
                  </div>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 5 }}>
                  <span className="muted">{tx(T.stock, ar)}</span>
                  <span className="tnum" style={{ fontWeight: 700, color: low ? "var(--terracotta)" : "var(--ink)" }}>{ar ? p.stock.toLocaleString("ar-EG") : p.stock} {tx(T.units, ar)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: pct + "%", borderRadius: 999, background: low ? "var(--terracotta)" : "var(--sage)" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== CUSTOMERS ============================== */
function Customers({ ar, mobile }) {
  const segs = [
    { key: "VIP", en: "VIP", ar: "VIP", icon: "crown", tone: "saffron", count: 1 },
    { key: "Loyal", en: "Loyal", ar: "وفي", icon: "heart", tone: "sage", count: 2 },
    { key: "New", en: "New", ar: "جديد", icon: "user-plus", tone: "navy", count: 3 },
  ];
  return (
    <div className="page fade-up" style={{ display: "flex", flexDirection: "column", gap: 18, padding: mobile ? 16 : 24 }}>
      <PageHead title={ar ? "العملاء" : "Customers"} sub={ar ? "اعرف عملاءك وقسّمهم" : "Know and segment your shoppers"}>
        <button className="btn btn-outline btn-sm"><Icon name="file-arrow-down" />{tx(T.export, ar)}</button>
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: 14 }}>
        {segs.map(s => (
          <div key={s.key} className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 13 }}>
            <div className={"ichip " + s.tone}><Icon name={s.icon} weight="duotone" /></div>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>{tx(s, ar)}</div>
              <div className="display tnum" style={{ fontSize: 22, fontWeight: 800 }}>{ar ? s.count.toLocaleString("ar-EG") : s.count}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ minWidth: mobile ? 520 : undefined }}>
            <thead><tr>
              <th>{tx(T.customer, ar)}</th><th>{ar ? "المنطقة" : "Region"}</th><th>{ar ? "الشريحة" : "Segment"}</th>
              <th style={{ textAlign: "center" }}>{tx(T.ordersCount, ar)}</th><th style={{ textAlign: "end" }}>{ar ? "إجمالي الشراء" : "Total spent"}</th>
            </tr></thead>
            <tbody>
              {CUSTOMERS.map((c, i) => {
                const n = NAMES[c.who];
                const tone = { VIP: ["var(--saffron-100)", "var(--saffron-600)"], Loyal: ["#E3EEE2", "var(--sage)"], New: ["var(--info-bg)", "var(--info)"] }[c.tag];
                return (
                  <tr key={i}>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar name={tx(n, ar)} tone={c.who} size={36} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>{tx(n, ar)}</span></div></td>
                    <td className="muted" style={{ fontSize: 13 }}>{tx({ en: n.city, ar: n.cityAr }, ar)}</td>
                    <td><span className="pill" style={{ background: tone[0], color: tone[1], fontSize: 11 }}>{c.tag === "VIP" ? "VIP" : tx({ en: c.tag, ar: c.tagAr }, ar)}</span></td>
                    <td style={{ textAlign: "center" }}><span className="tnum" style={{ fontWeight: 700 }}>{ar ? c.orders.toLocaleString("ar-EG") : c.orders}</span></td>
                    <td style={{ textAlign: "end" }}><span className="tnum display" style={{ fontWeight: 800 }}>{FMT(c.spent, ar)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================== LOGIN ============================== */
function Login({ ar, setAr, onLogin }) {
  return (
    <div style={{ minHeight: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--bg)" }}>
      <div style={{ background: "var(--navy)", color: "#fff", padding: 48, display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: .12, mixBlendMode: "screen", backgroundImage: "url(../../assets/numu-n-mark.jpg)", backgroundSize: 132 }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <div className="sb-mark" style={{ width: 44, height: 44 }}><img src="../../assets/numu-n-mark.jpg" alt="" /></div>
          <span className="display" style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-brand)" }}>{ar ? "نُمُو" : "numu"}</span>
        </div>
        <div style={{ position: "relative" }}>
          <div className="eyebrow" style={{ color: "var(--saffron)" }}>{ar ? "منصة التجارة المصرية" : "Egypt's commerce platform"}</div>
          <div className="display" style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.15, marginTop: 14, letterSpacing: "-.02em" }}>{ar ? "متجرك. طلباتك. نموّك." : "Your store. Your orders. Your growth."}</div>
          <p style={{ color: "rgba(255,255,255,.65)", fontSize: 15.5, marginTop: 14, maxWidth: 380 }}>{ar ? "أدِر متجرك من موبايلك — منتجات، طلبات، شحن، ودفع عند الاستلام، كله في مكان واحد." : "Run your whole shop from your phone — products, orders, shipping, and cash-on-delivery, all in one place."}</p>
        </div>
        <div style={{ position: "relative", display: "flex", gap: 14, alignItems: "center" }}>
          {["paymob", "fawry", "kashier"].map(p => (
            <div key={p} style={{ background: "#fff", borderRadius: 11, padding: "8px 12px", height: 38, display: "grid", placeItems: "center" }}>
              <img src={`../../assets/payments/${p}-logo.webp`} alt={p} style={{ maxHeight: 20, maxWidth: 76, objectFit: "contain" }} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 48, position: "relative" }}>
        <button className="chip" onClick={() => setAr(a => !a)} style={{ position: "absolute", top: 28, insetInlineEnd: 28 }}><Icon name="translate" />{ar ? "English" : "العربية"}</button>
        <div style={{ width: "100%", maxWidth: 360, margin: "0 auto" }}>
          <h1 className="display" style={{ fontSize: 28 }}>{ar ? "أهلاً بعودتك 👋" : "Welcome back 👋"}</h1>
          <p className="muted" style={{ marginTop: 6 }}>{ar ? "سجّل دخولك وكمّل شغلك على متجرك" : "Sign in to pick up where you left off"}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 26 }}>
            <div><label style={{ fontSize: 13, fontWeight: 700 }}>{ar ? "البريد الإلكتروني" : "Email"}</label><input className="input" style={{ marginTop: 7 }} defaultValue="ahmed@cairothreads.com" /></div>
            <div><label style={{ fontSize: 13, fontWeight: 700 }}>{ar ? "كلمة المرور" : "Password"}</label><input className="input" style={{ marginTop: 7 }} type="password" defaultValue="numu1234" /></div>
            <button className="btn btn-primary btn-lg" style={{ marginTop: 6 }} onClick={onLogin}>{ar ? "تسجيل الدخول" : "Sign in"}<Icon name={ar ? "arrow-left" : "arrow-right"} /></button>
            <div style={{ textAlign: "center", fontSize: 13.5 }} className="muted">{ar ? "لسه مالكش متجر؟ " : "No store yet? "}<a href="#" style={{ color: "var(--navy)", fontWeight: 700, textDecoration: "none" }}>{ar ? "ابدأ مجاناً" : "Start free"}</a></div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Orders, Products, Customers, Login, PageHead, StatTile });
