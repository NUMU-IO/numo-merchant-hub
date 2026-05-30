/* NUMU "Souq" — destination screens: Finance, Logistics, Analytics,
   Online Store, Marketing, Settings. Reuse PageHead/StatTile + kit
   primitives. All bilingual, RTL-aware, numerals/currency stay LTR. */
const { useState: useX } = React;

/* segmented control reflecting a sub-route */
function Seg({ items, value, onChange, ar }) {
  return (
    <div className="sg">
      {items.map(it => (
        <button key={it.key} className={value === it.key ? "on" : ""} onClick={() => onChange(it.key)}>{tx(it, ar)}</button>
      ))}
    </div>
  );
}

/* ============================== FINANCE ============================== */
function Finance({ ar, mobile, go, sub }) {
  const cur = sub || "overview";
  const segItems = [
    { key: "overview", en: "Overview", ar: "نظرة عامة" },
    { key: "payouts", en: "Payouts", ar: "التحويلات" },
    { key: "invoices", en: "Invoices", ar: "الفواتير" },
  ];
  const txns = [
    { id: "TXN-9920", who: 1, method: "paymob", amt: 349, kind: "in", ago: ar ? "من ساعة" : "1h ago" },
    { id: "TXN-9919", who: 2, method: "cod", amt: 2140, kind: "in", ago: ar ? "٣ س" : "3h ago" },
    { id: "PAYOUT-441", who: null, method: "instapay", amt: 12400, kind: "out", ago: ar ? "إمبارح" : "Yesterday" },
    { id: "TXN-9917", who: 4, method: "fawry", amt: 890, kind: "in", ago: ar ? "إمبارح" : "Yesterday" },
    { id: "TXN-9916", who: 5, method: "kashier", amt: 470, kind: "in", ago: ar ? "٢ يوم" : "2d ago" },
  ];
  const methodName = { paymob: "Paymob", fawry: "Fawry", kashier: "Kashier", instapay: "InstaPay", cod: ar ? "عند الاستلام" : "COD" };
  return (
    <div className="page fade-up" style={{ display: "flex", flexDirection: "column", gap: 18, padding: mobile ? 16 : 24 }}>
      <PageHead title={tx(T.finTitle, ar)} sub={tx(T.finSub, ar)}>
        <button className="btn btn-outline btn-sm"><Icon name="file-arrow-down" />{tx(T.export, ar)}</button>
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.5fr 1fr 1fr", gap: 14 }}>
        <div className="fin-balance">
          <div className="wm"><img src="../../assets/numu-symbol-white-transparent.webp" alt="" /></div>
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>{tx(T.available, ar)}</div>
            <div className="display tnum" style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-.025em", marginTop: 6 }}>{FMT(34820, ar)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              <button className="btn btn-accent btn-sm"><Icon name="arrow-line-up-right" weight="bold" />{tx(T.payout, ar)}</button>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>{tx(T.nextPayout, ar)}: <span className="tnum">{ar ? "الخميس" : "Thursday"}</span></span>
            </div>
          </div>
        </div>
        <StatTile icon="hourglass-medium" tone="saffron" label={tx(T.pendingClear, ar)} value={FMT(5200, ar)} />
        <StatTile icon="truck" tone="info" label={tx(T.codInTransit, ar)} value={FMT(8640, ar)} />
      </div>

      <div className="card" style={{ display: "flex", alignItems: "center", gap: 13, padding: 16 }}>
        <div className="ichip terra"><Icon name="money" weight="duotone" /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}><span className="tnum">{ar ? "٤" : "4"}</span> {tx(T.codInTransit, ar)} · {FMT(3240, ar)}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>{ar ? "محتاجة تسوية مع شركة الشحن" : "Need reconciling with your courier"}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => go("cod")}><Icon name="check-square-offset" weight="bold" />{tx(T.reconcileCod, ar)}</button>
      </div>

      <Seg items={segItems} value={cur} onChange={(k) => go(k === "overview" ? "finance" : "finance:" + k)} ar={ar} />

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="sect-head"><h2>{tx(T.transactions, ar)}</h2><button className="link">{tx(T.viewAll, ar)}</button></div>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ minWidth: mobile ? 520 : undefined }}>
            <thead><tr>
              <th>{tx(T.ref, ar)}</th><th>{tx(T.method, ar)}</th><th>{tx(T.date, ar)}</th><th style={{ textAlign: "end" }}>{tx(T.amount, ar)}</th>
            </tr></thead>
            <tbody>
              {txns.map(t => (
                <tr key={t.id}>
                  <td><span className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>{t.id}</span></td>
                  <td><span className="pill" style={{ background: "var(--surface-2)", color: "var(--ink-soft)", fontSize: 11.5 }}><Icon name={t.method === "cod" ? "money" : "credit-card"} size={13} weight="duotone" />{methodName[t.method]}</span></td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{t.ago}</td>
                  <td style={{ textAlign: "end" }}><span className="tnum display" style={{ fontWeight: 800, color: t.kind === "out" ? "var(--terracotta)" : "var(--success)" }}>{t.kind === "out" ? "−" : "+"}{FMT(t.amt, ar)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================== COD RECONCILE ============================== */
function COD({ ar, mobile, go }) {
  const rows = ORDERS.filter(o => o.pay === "cod").map((o, i) => ({ ...o, collected: i < 2 }));
  return (
    <div className="page fade-up" style={{ display: "flex", flexDirection: "column", gap: 18, padding: mobile ? 16 : 24 }}>
      <PageHead title={ar ? "تسوية الدفع عند الاستلام" : "COD reconciliation"} sub={ar ? "طابِق الفلوس المحصّلة مع شركة الشحن" : "Match collected cash with your courier"}>
        <button className="btn btn-accent btn-sm"><Icon name="check-square-offset" weight="bold" />{ar ? "سوّي الكل" : "Reconcile all"}</button>
      </PageHead>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 14 }}>
        <StatTile icon="money" tone="navy" label={tx(T.thisMonth, ar)} value={FMT(48200, ar)} />
        <StatTile icon="hourglass-medium" tone="saffron" label={ar ? "محتاج تسوية" : "To reconcile"} value={FMT(3240, ar)} />
        <StatTile icon="check-circle" tone="sage" label={ar ? "اتسوّى" : "Reconciled"} value={FMT(44960, ar)} />
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ minWidth: mobile ? 520 : undefined }}>
            <thead><tr><th>{tx(T.orders, ar)}</th><th>{tx(T.customer, ar)}</th><th>{tx(T.status, ar)}</th><th style={{ textAlign: "end" }}>{tx(T.amount, ar)}</th></tr></thead>
            <tbody>
              {rows.map(o => {
                const n = NAMES[o.who];
                return (
                  <tr key={o.id}>
                    <td><span className="mono" style={{ fontWeight: 700 }}>{o.id}</span></td>
                    <td><span style={{ fontWeight: 600, fontSize: 13 }}>{tx(n, ar)}</span></td>
                    <td>{o.collected
                      ? <span className="pill" style={{ background: "var(--success-bg)", color: "var(--success)", fontSize: 11.5 }}><span className="dot" style={{ background: "var(--success)" }} />{ar ? "اتحصّل" : "Collected"}</span>
                      : <span className="pill" style={{ background: "var(--warning-bg)", color: "var(--warning)", fontSize: 11.5 }}><span className="dot" style={{ background: "var(--warning)" }} />{ar ? "مستني" : "Pending"}</span>}</td>
                    <td style={{ textAlign: "end" }}><span className="tnum display" style={{ fontWeight: 800 }}>{FMT(o.total, ar)}</span></td>
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

/* ============================== LOGISTICS ============================== */
function Logistics({ ar, mobile, go, sub }) {
  const cur = sub || "shipments";
  const segItems = [
    { key: "shipments", en: "Shipments", ar: "الشحنات" },
    { key: "zones", en: "Zones", ar: "المناطق" },
    { key: "couriers", en: "Couriers", ar: "شركات الشحن" },
  ];
  const couriers = [
    { name: "Bosta", ar: "بوسطة", icon: "truck", live: 18, eta: "1–2", tone: "navy" },
    { name: "Aramex", ar: "أرامكس", icon: "package", live: 7, eta: "2–3", tone: "saffron" },
    { name: "Mylerz", ar: "ميلرز", icon: "truck", live: 4, eta: "1–3", tone: "sage" },
    { name: "R2S", ar: "آر تو إس", icon: "package", live: 2, eta: "2–4", tone: "terra" },
  ];
  const zones = [
    { en: "Cairo & Giza", ar: "القاهرة والجيزة", days: "1–2", fee: 50 },
    { en: "Alexandria", ar: "الإسكندرية", days: "2–3", fee: 65 },
    { en: "Delta & Canal", ar: "الدلتا والقناة", days: "2–4", fee: 70 },
    { en: "Upper Egypt", ar: "الصعيد", days: "3–5", fee: 90 },
  ];
  const ship = ORDERS.filter(o => ["processing", "shipped", "confirmed", "delivered"].includes(o.status)).slice(0, 5);
  return (
    <div className="page fade-up" style={{ display: "flex", flexDirection: "column", gap: 18, padding: mobile ? 16 : 24 }}>
      <PageHead title={tx(T.logTitle, ar)} sub={tx(T.logSub, ar)}>
        <button className="btn btn-outline btn-sm"><Icon name="printer" weight="duotone" />{ar ? "اطبع البوالص" : "Print labels"}</button>
        <button className="btn btn-primary btn-sm"><Icon name="plus" />{ar ? "شحنة جديدة" : "New shipment"}</button>
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 14 }}>
        <StatTile icon="package" tone="saffron" label={tx(T.toShip, ar)} value={ar ? "٣" : "3"} />
        <StatTile icon="truck" tone="navy" label={tx(T.inTransit, ar)} value={ar ? "٥" : "5"} />
        <StatTile icon="map-pin" tone="sage" label={tx(T.outForDelivery, ar)} value={ar ? "٢" : "2"} />
        <StatTile icon="arrow-u-up-left" tone="terra" label={tx(T.returns, ar)} value={ar ? "١" : "1"} />
      </div>

      <Seg items={segItems} value={cur} onChange={(k) => go(k === "shipments" ? "logistics" : "logistics:" + k)} ar={ar} />

      {cur === "couriers" ? (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          {couriers.map(c => (
            <div key={c.name} className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 13 }}>
              <div className={"ichip " + c.tone}><Icon name={c.icon} weight="duotone" /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5 }}>{ar ? c.ar : c.name}</div>
                <div className="muted" style={{ fontSize: 12 }}><span className="tnum">{ar ? c.live.toLocaleString("ar-EG") : c.live}</span> {ar ? "شحنة شغّالة" : "active"} · <span className="ltr-nums">{c.eta}</span> {ar ? "أيام" : "days"}</div>
              </div>
              <span className="pill" style={{ background: "var(--success-bg)", color: "var(--success)", fontSize: 11.5 }}><span className="dot" style={{ background: "var(--success)" }} />{ar ? "متصل" : "Connected"}</span>
            </div>
          ))}
        </div>
      ) : cur === "zones" ? (
        <div className="card" style={{ overflow: "hidden" }}>
          {zones.map((z, i) => (
            <div key={i} className="lrow">
              <div className="ichip sage" style={{ width: 38, height: 38 }}><Icon name="map-pin-area" weight="duotone" size={20} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{tx(z, ar)}</div>
                <div className="muted" style={{ fontSize: 12 }}><span className="ltr-nums">{z.days}</span> {ar ? "أيام عمل" : "business days"}</div>
              </div>
              <span className="tnum display" style={{ fontWeight: 800 }}>{FMT(z.fee, ar)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: mobile ? 560 : undefined }}>
              <thead><tr><th>{tx(T.orders, ar)}</th><th>{tx(T.courier, ar)}</th><th>{tx(T.destination, ar)}</th><th>{tx(T.tracking, ar)}</th><th>{tx(T.status, ar)}</th></tr></thead>
              <tbody>
                {ship.map((o, i) => {
                  const n = NAMES[o.who]; const c = couriers[i % couriers.length];
                  return (
                    <tr key={o.id}>
                      <td><span className="mono" style={{ fontWeight: 700 }}>{o.id}</span></td>
                      <td><span style={{ fontWeight: 600, fontSize: 13 }}>{ar ? c.ar : c.name}</span></td>
                      <td className="muted" style={{ fontSize: 13 }}>{tx({ en: n.city, ar: n.cityAr }, ar)}</td>
                      <td><span className="mono ltr-nums" style={{ fontSize: 12, color: "var(--info)" }}>EG{o.id.replace(/\D/g, "")}</span></td>
                      <td><StatusPill status={o.status} ar={ar} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== ANALYTICS ============================== */
function Analytics({ ar, mobile, go }) {
  const [range, setRange] = useX("30d");
  const ranges = [{ key: "7d", en: "7 days", ar: "٧ أيام" }, { key: "30d", en: "30 days", ar: "٣٠ يوم" }, { key: "90d", en: "90 days", ar: "٩٠ يوم" }];
  const channels = [
    { en: "Online store", ar: "المتجر", val: 62, color: "var(--navy)" },
    { en: "Instagram", ar: "إنستجرام", val: 21, color: "var(--saffron)" },
    { en: "WhatsApp", ar: "واتساب", val: 11, color: "var(--sage)" },
    { en: "Facebook", ar: "فيسبوك", val: 6, color: "var(--terracotta)" },
  ];
  const funnel = [
    { label: T.visits, val: 5840, pct: 100 },
    { label: T.addedCart, val: 1620, pct: 28 },
    { label: T.reachedCheckout, val: 720, pct: 12 },
    { label: T.purchased, val: 312, pct: 5.3 },
  ];
  const monthBars = [32, 41, 38, 52, 47, 61, 58, 70, 64, 78, 73, 86];
  const months = ar ? ["ين","فب","مار","إب","ماي","يون","يول","أغ","سب","أك","نو","دي"] : ["J","F","M","A","M","J","J","A","S","O","N","D"];
  const maxBar = Math.max(...monthBars);
  const top = [...PRODUCTS].sort((a, b) => b.sold * b.price - a.sold * a.price).slice(0, 5);
  return (
    <div className="page fade-up" style={{ display: "flex", flexDirection: "column", gap: 18, padding: mobile ? 16 : 24 }}>
      <PageHead title={tx(T.anTitle, ar)} sub={tx(T.anSub, ar)}>
        <Seg items={ranges} value={range} onChange={setRange} ar={ar} />
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 14 }}>
        <StatTile icon="currency-circle-dollar" tone="navy" label={tx(T.revenue, ar)} value={FMT(186400, ar)} delta="+14.2%" up />
        <StatTile icon="wallet" tone="saffron" label={tx(T.netProfit, ar)} value={FMT(72800, ar)} delta="+9.1%" up />
        <StatTile icon="chart-line-up" tone="sage" label={tx(T.conversion, ar)} value={ar ? "٣٫٤٪" : "3.4%"} delta="+0.4%" up />
        <StatTile icon="repeat" tone="terra" label={tx(T.repeatRate, ar)} value={ar ? "٢٨٪" : "28%"} delta="−1.1%" up={false} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.6fr 1fr", gap: 14 }}>
        <div className="card">
          <div className="sect-head"><h2>{tx(T.revenue, ar)}</h2><span className="muted" style={{ fontSize: 12 }}>{ar ? "آخر سنة" : "Last 12 months"}</span></div>
          <div className="bars" style={{ padding: "8px 16px 6px" }}>
            {monthBars.map((b, i) => (
              <div className="bar-col" key={i}>
                <div className={"bar" + (i === monthBars.length - 1 ? " alt" : "")} style={{ height: (b / maxBar * 100) + "%" }} />
                <span className="bar-lbl">{months[i]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="sect-head"><h2>{tx(T.salesByChannel, ar)}</h2></div>
          <div style={{ padding: "4px 16px 14px" }}>
            <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
              {channels.map((c, i) => <div key={i} style={{ width: c.val + "%", background: c.color }} />)}
            </div>
            {channels.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
                <span className="legend-dot" style={{ background: c.color }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{tx(c, ar)}</span>
                <span className="tnum" style={{ fontWeight: 800, fontSize: 13 }}>{ar ? c.val.toLocaleString("ar-EG") : c.val}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.3fr 1fr", gap: 14 }}>
        <div className="card" style={{ padding: "4px 18px 16px" }}>
          <div className="sect-head" style={{ padding: "15px 0 8px" }}><h2>{tx(T.funnel, ar)}</h2></div>
          {funnel.map((f, i) => (
            <div className="funnel-row" key={i}>
              <span style={{ width: mobile ? 84 : 120, fontSize: 12.5, fontWeight: 600, color: "var(--ink-soft)" }}>{tx(f.label, ar)}</span>
              <div className="funnel-bar"><div className="funnel-fill" style={{ width: Math.max(f.pct, 16) + "%" }}><span className="tnum ltr-nums">{ar ? f.val.toLocaleString("ar-EG") : f.val.toLocaleString()}</span></div></div>
              <span className="tnum" style={{ width: 44, textAlign: "end", fontWeight: 800, fontSize: 12.5 }}>{ar ? f.pct.toLocaleString("ar-EG") : f.pct}%</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="sect-head"><h2>{tx(T.topProductsT, ar)}</h2><button className="link" onClick={() => go("products")}>{tx(T.viewAll, ar)}</button></div>
          <div style={{ paddingBottom: 8 }}>
            {top.map((p, i) => (
              <div className="seller" key={p.id}>
                <span className="rank">{ar ? (i + 1).toLocaleString("ar-EG") : i + 1}</span>
                <span className="s-thumb">{p.img}</span>
                <span className="nm">{tx(p, ar)}</span>
                <span className="amt tnum">{FMT(p.price * p.sold, ar)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== ONLINE STORE ============================== */
function OnlineStore({ ar, mobile, go }) {
  const themes = [
    { name: "Souq", ar: "سوق", hue: "var(--navy)", active: true },
    { name: "Bazaar", ar: "بازار", hue: "var(--terracotta)", active: false },
    { name: "Minimal", ar: "بسيط", hue: "var(--sage)", active: false },
  ];
  const pages = [
    { en: "Home", ar: "الرئيسية", on: true }, { en: "About us", ar: "من نحن", on: true },
    { en: "Shipping & returns", ar: "الشحن والاسترجاع", on: true }, { en: "Contact", ar: "تواصل معنا", on: false },
  ];
  function StoreThumb({ hue }) {
    return (
      <div style={{ width: "100%", height: "100%", background: "var(--surface-2)", display: "flex", flexDirection: "column" }}>
        <div style={{ height: "34%", background: hue, display: "flex", alignItems: "center", padding: "0 12px", gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(255,255,255,.9)" }} />
          <div style={{ flex: 1 }} />
          <div style={{ width: 26, height: 7, borderRadius: 99, background: "rgba(255,255,255,.5)" }} />
          <div style={{ width: 14, height: 7, borderRadius: 99, background: "rgba(255,255,255,.5)" }} />
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, padding: 10 }}>
          {["👕","👜","🧴","☕","🌺","📿"].slice(0, mobile ? 3 : 6).map((e, i) => (
            <div key={i} style={{ background: "var(--surface)", borderRadius: 8, display: "grid", placeItems: "center", fontSize: 18 }}>{e}</div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="page fade-up" style={{ display: "flex", flexDirection: "column", gap: 18, padding: mobile ? 16 : 24 }}>
      <PageHead title={tx(T.storeTitle, ar)} sub={tx(T.storeSub, ar)}>
        <button className="btn btn-outline btn-sm"><Icon name="arrow-square-out" weight="bold" />{tx(T.visitStore, ar)}</button>
        <button className="btn btn-accent btn-sm"><Icon name="paint-brush-broad" weight="bold" />{tx(T.customize, ar)}</button>
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.5fr 1fr", gap: 14 }}>
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="eyebrow" style={{ color: "var(--ink-faint)" }}>{tx(T.liveTheme, ar)}</span>
            <span className="pill" style={{ background: "var(--success-bg)", color: "var(--success)", fontSize: 11.5 }}><span className="dot" style={{ background: "var(--success)" }} />{tx(T.published, ar)}</span>
          </div>
          <div className="theme-card" style={{ aspectRatio: mobile ? "16/10" : "16/7" }}><StoreThumb hue="var(--navy)" /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Souq</div>
              <div className="muted mono" style={{ fontSize: 12 }}>cairothreads.numu.store</div>
            </div>
            <button className="btn btn-soft btn-sm"><Icon name="pencil-simple" weight="bold" />{tx(T.customize, ar)}</button>
          </div>
        </div>
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="sect-head"><h2>{tx(T.pages, ar)}</h2><button className="link"><Icon name="plus" size={14} /></button></div>
          {pages.map((p, i) => (
            <div key={i} className="lrow" style={{ padding: "12px 16px" }}>
              <Icon name="file-text" weight="duotone" size={20} style={{ color: "var(--ink-soft)" }} />
              <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{tx(p, ar)}</span>
              <span className="pill" style={{ fontSize: 11, background: p.on ? "var(--success-bg)" : "var(--surface-2)", color: p.on ? "var(--success)" : "var(--ink-faint)" }}>{p.on ? tx(T.published, ar) : (ar ? "مسودة" : "Draft")}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="sect-head"><h2>{ar ? "الثيمات" : "Themes"}</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: 14, padding: "4px 16px 18px" }}>
          {themes.map(t => (
            <div key={t.name} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div className="theme-card"><StoreThumb hue={t.hue} /></div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1 }}>{ar ? t.ar : t.name}</span>
                {t.active
                  ? <span className="pill" style={{ background: "var(--navy)", color: "#fff", fontSize: 11 }}>{tx(T.liveTheme, ar)}</span>
                  : <button className="btn btn-soft btn-sm" style={{ height: 30 }}>{ar ? "معاينة" : "Preview"}</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================== MARKETING ============================== */
function Marketing({ ar, mobile, go, sub }) {
  const cur = sub || "overview";
  const segItems = [
    { key: "overview", en: "Overview", ar: "نظرة عامة" },
    { key: "discounts", en: "Discounts", ar: "الخصومات" },
    { key: "campaigns", en: "Campaigns", ar: "الحملات" },
    { key: "whatsapp", en: "WhatsApp", ar: "واتساب" },
  ];
  const discounts = [
    { code: "EID20", type: ar ? "٢٠٪ خصم" : "20% off", used: 142, status: "active" },
    { code: "WELCOME10", type: ar ? "١٠٪ خصم" : "10% off", used: 88, status: "active" },
    { code: "FREESHIP", type: ar ? "شحن مجاني" : "Free shipping", used: 61, status: "active" },
    { code: "SUMMER15", type: ar ? "١٥٪ خصم" : "15% off", used: 230, status: "ended" },
  ];
  return (
    <div className="page fade-up" style={{ display: "flex", flexDirection: "column", gap: 18, padding: mobile ? 16 : 24 }}>
      <PageHead title={tx(T.mktTitle, ar)} sub={tx(T.mktSub, ar)}>
        <button className="btn btn-accent btn-sm" onClick={() => go("marketing:discounts")}><Icon name="plus" />{tx(T.newDiscount, ar)}</button>
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 14 }}>
        <StatTile icon="tag" tone="navy" label={tx(T.activeDiscounts, ar)} value={ar ? "٣" : "3"} />
        <StatTile icon="megaphone" tone="saffron" label={tx(T.campaigns, ar)} value={ar ? "٢" : "2"} />
        <StatTile icon="users-three" tone="sage" label={tx(T.reach, ar)} value={ar ? "١٢٬٤٠٠" : "12,400"} delta="+18%" up />
        <StatTile icon="ticket" tone="terra" label={tx(T.redeemed, ar)} value={ar ? "٢٩١" : "291"} delta="+6%" up />
      </div>

      <Seg items={segItems} value={cur} onChange={(k) => go(k === "overview" ? "marketing" : "marketing:" + k)} ar={ar} />

      {cur === "whatsapp" ? (
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: mobile ? "column" : "row", alignItems: mobile ? "stretch" : "center", gap: 16 }}>
          <div className="ichip sage" style={{ width: 52, height: 52 }}><Icon name="whatsapp-logo" weight="fill" size={28} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{tx(T.whatsappBroadcast, ar)}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{ar ? "آخر حملة: عروض رمضان" : "Last broadcast: Ramadan offers"}</div>
            <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
              <span style={{ fontSize: 12.5 }}><b className="tnum">{ar ? "٢٬٤٠٠" : "2,400"}</b> <span className="muted">{tx(T.sent, ar)}</span></span>
              <span style={{ fontSize: 12.5 }}><b className="tnum" style={{ color: "var(--success)" }}>{ar ? "٨٢٪" : "82%"}</b> <span className="muted">{tx(T.opened, ar)}</span></span>
            </div>
          </div>
          <button className="btn btn-primary btn-sm"><Icon name="paper-plane-tilt" weight="bold" />{ar ? "ابعت حملة" : "New broadcast"}</button>
        </div>
      ) : cur === "campaigns" ? (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          {[{ en: "Ramadan offers", ar: "عروض رمضان", reach: 8200, tone: "saffron", icon: "moon-stars" }, { en: "New arrivals", ar: "وصل حديثاً", reach: 4200, tone: "navy", icon: "sparkle" }].map((c, i) => (
            <div key={i} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className={"ichip " + c.tone}><Icon name={c.icon} weight="duotone" /></div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14.5 }}>{tx(c, ar)}</div><div className="muted" style={{ fontSize: 12 }}>{ar ? "شغّالة" : "Active"}</div></div>
                <span className="pill" style={{ background: "var(--success-bg)", color: "var(--success)", fontSize: 11 }}><span className="dot" style={{ background: "var(--success)" }} />{ar ? "شغّالة" : "Live"}</span>
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <div><div className="muted" style={{ fontSize: 11.5 }}>{tx(T.reach, ar)}</div><div className="tnum display" style={{ fontWeight: 800, fontSize: 17 }}>{ar ? c.reach.toLocaleString("ar-EG") : c.reach.toLocaleString()}</div></div>
                <div><div className="muted" style={{ fontSize: 11.5 }}>{tx(T.redeemed, ar)}</div><div className="tnum display" style={{ fontWeight: 800, fontSize: 17 }}>{ar ? "١٤٢" : "142"}</div></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ minWidth: mobile ? 480 : undefined }}>
              <thead><tr><th>{ar ? "الكود" : "Code"}</th><th>{ar ? "النوع" : "Type"}</th><th style={{ textAlign: "center" }}>{tx(T.redeemed, ar)}</th><th>{tx(T.status, ar)}</th></tr></thead>
              <tbody>
                {discounts.map(d => (
                  <tr key={d.code}>
                    <td><span className="mono" style={{ fontWeight: 800, color: "var(--navy)" }}>{d.code}</span></td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{d.type}</td>
                    <td style={{ textAlign: "center" }}><span className="tnum" style={{ fontWeight: 700 }}>{ar ? d.used.toLocaleString("ar-EG") : d.used}</span> <span className="muted" style={{ fontSize: 11.5 }}>{tx(T.used, ar)}</span></td>
                    <td>{d.status === "active"
                      ? <span className="pill" style={{ background: "var(--success-bg)", color: "var(--success)", fontSize: 11.5 }}><span className="dot" style={{ background: "var(--success)" }} />{ar ? "شغّال" : "Active"}</span>
                      : <span className="pill" style={{ background: "var(--surface-2)", color: "var(--ink-faint)", fontSize: 11.5 }}>{ar ? "انتهى" : "Ended"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== SETTINGS ============================== */
function Settings({ ar, mobile, go }) {
  const groups = [
    { en: "Store profile", ar: "بيانات المتجر", desc: { en: "Name, logo, contact", ar: "الاسم، اللوجو، التواصل" }, icon: "storefront", tone: "navy" },
    { en: "Payments", ar: "الدفع", desc: { en: "Paymob, Fawry, Kashier, COD", ar: "بيموب، فوري، كاشير، الاستلام" }, icon: "credit-card", tone: "saffron" },
    { en: "Shipping", ar: "الشحن", desc: { en: "Zones, rates, couriers", ar: "المناطق، الأسعار، الشحن" }, icon: "truck", tone: "sage" },
    { en: "Staff & roles", ar: "الموظفين والصلاحيات", desc: { en: "Invite team, permissions", ar: "ادعُ فريقك، الصلاحيات" }, icon: "users-three", tone: "terra" },
    { en: "Notifications", ar: "الإشعارات", desc: { en: "Email, WhatsApp, SMS", ar: "إيميل، واتساب، رسائل" }, icon: "bell", tone: "navy" },
    { en: "Plan & billing", ar: "الباقة والفواتير", desc: { en: "Premium · renews monthly", ar: "Premium · بتتجدد شهرياً" }, icon: "sparkle", tone: "saffron" },
  ];
  return (
    <div className="page fade-up" style={{ display: "flex", flexDirection: "column", gap: 18, padding: mobile ? 16 : 24 }}>
      <PageHead title={tx(T.settings, ar)} sub={ar ? "اضبط متجرك وحسابك" : "Configure your store and account"} />
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 14 }}>
        {groups.map((g, i) => (
          <div key={i} className="card card-hover" style={{ padding: 16, display: "flex", alignItems: "center", gap: 13 }}>
            <div className={"ichip " + g.tone}><Icon name={g.icon} weight="duotone" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>{tx(g, ar)}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>{tx(g.desc, ar)}</div>
            </div>
            <Icon name={ar ? "caret-left" : "caret-right"} size={18} style={{ color: "var(--ink-faint)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Finance, COD, Logistics, Analytics, OnlineStore, Marketing, Settings });
