/* NUMU "Souq" — Dashboard (strategic). Zones answer the merchant's real
   questions in order: §TODAY (did I make money / who's waiting) →
   §NEEDS YOU (what's broken) → §GROW (what's next). Handles full data,
   first-time (zero-data + pinned onboarding), desktop + mobile. */
const { useState: useDS } = React;

const DD = {
  today:   { en: "Today", ar: "النهارده" },
  needsYou:{ en: "Needs you", ar: "محتاج منك" },
  grow:    { en: "Grow", ar: "نمّي" },
  qToday:  { en: "Did I make money — and is anyone waiting on me?", ar: "كسبت النهارده؟ وفيه حد مستنيني؟" },
  qNeeds:  { en: "Is anything broken?", ar: "فيه حاجة وقفت؟" },
  qGrow:   { en: "What should I do next?", ar: "أعمل إيه بعد كده؟" },
  salesToday: { en: "Sales · today", ar: "المبيعات · النهارده" },
  waiting: { en: "Waiting on you", ar: "مستنيينك" },
  toFulfill: { en: "to fulfill", ar: "للتجهيز" },
  conversion: { en: "Conversion", ar: "معدل التحويل" },
  netProfit: { en: "Net profit", ar: "صافي الربح" },
  health:  { en: "Store health", ar: "صحة المتجر" },
  great:   { en: "Great", ar: "ممتاز" },
  revenue: { en: "Revenue this week", ar: "إيراد الأسبوع" },
  fulfill: { en: "Fulfill", ar: "جهّز" },
  restock: { en: "Restock", ar: "خزّن" },
  reconcile: { en: "Reconcile", ar: "سوّي" },
  remind:  { en: "Remind", ar: "ذكّر" },
  fulfillTitle: { en: "2 orders waiting to be fulfilled", ar: "٢ طلبات مستنية التجهيز" },
  fulfillDesc:  { en: "Oldest placed 6h ago", ar: "أقدم طلب من ٦ ساعات" },
  lowTitle: { en: "2 products low on stock", ar: "٢ منتجات قرب تخلص" },
  lowDesc:  { en: "Coconut Soap · Pharaonic Necklace", ar: "صابون جوز الهند · عقد فرعوني" },
  codTitle: { en: "4 COD shipments to reconcile", ar: "٤ شحنات استلام محتاجة تسوية" },
  codDesc:  { en: "EGP 3,240 collected", ar: "٣٬٢٤٠ ج.م اتحصّلت" },
  abandTitle: { en: "1 abandoned checkout", ar: "١ سلة اتسابت" },
  abandDesc:  { en: "EGP 890 · 1h ago", ar: "٨٩٠ ج.م · من ساعة" },
  setupTitle: { en: "Finish setting up your store", ar: "كمّل تجهيز متجرك" },
  setupSub: { en: "Complete all 4 steps & get 1 month Premium — free", ar: "كمّل الـ٤ خطوات واكسب شهر Premium مجاناً" },
  stAccount: { en: "Account created", ar: "الحساب اتعمل" },
  stProduct: { en: "Add your first product", ar: "ضيف أول منتج" },
  stShipping: { en: "Set up shipping", ar: "اضبط الشحن" },
  stPayments: { en: "Activate payments", ar: "فعّل الدفع" },
  start: { en: "Start", ar: "ابدأ" },
  firstSale: { en: "Your first sale will show here", ar: "أول عملية بيع هتظهر هنا" },
  noOrdersYet: { en: "No orders yet", ar: "مفيش طلبات لسه" },
  ordersHere: { en: "New orders land here", ar: "الطلبات الجديدة هتيجي هنا" },
  dataAfter: { en: "Data appears after your first orders", ar: "البيانات هتظهر بعد أول طلبات" },
  noSalesYet: { en: "No sales yet", ar: "لسه مفيش مبيعات" },
  addFirst: { en: "Add your first product to begin", ar: "ابدأ بإضافة أول منتج" },
  emptyScore: { en: "Shows after your first order", ar: "هيظهر بعد أول طلب" },
  oldest: { en: "Oldest order", ar: "أقدم طلب" },
  theirValue: { en: "Their value", ar: "قيمتها" },
};
const arN = (n) => n.toLocaleString("ar-EG");

function DashArea({ data, color, h = 150 }) {
  const w = 560, pad = 6;
  const max = Math.max(...data), min = Math.min(...data) * 0.85, rng = (max - min) || 1;
  const pts = data.map((v, i) => ({ x: pad + (i / (data.length - 1)) * (w - pad * 2), y: h - 18 - ((v - min) / rng) * (h - 38) }));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx1 = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * .42, cx2 = pts[i].x - (pts[i].x - pts[i - 1].x) * .42;
    d += ` C${cx1},${pts[i - 1].y} ${cx2},${pts[i].y} ${pts[i].x},${pts[i].y}`;
  }
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="ltr-nums" style={{ display: "block" }}>
      <defs><linearGradient id="drev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".18" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {[.33, .66].map((g, i) => <line key={i} x1="0" x2={w} y1={(h - 18) * g + 4} y2={(h - 18) * g + 4} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 6" />)}
      <path d={`${d} L${pts[pts.length - 1].x},${h - 18} L${pts[0].x},${h - 18} Z`} fill="url(#drev)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {pts.map((p, i) => i === pts.length - 1 && <circle key={i} cx={p.x} cy={p.y} r="4" fill={color} stroke="var(--surface)" strokeWidth="2.5" />)}
    </svg>
  );
}

function ZoneHead({ eyebrow, q }) {
  return (
    <div className="zhead">
      <span className="eyebrow">§ {eyebrow}</span>
      {q && <span className="q">{q}</span>}
      <span className="line" />
    </div>
  );
}

function SalesHero({ ar, empty }) {
  if (empty) return (
    <div className="hero empty-hero">
      <div className="hero-top"><span className="hero-label">{tx(DD.salesToday, ar)}</span></div>
      <div className="hero-val tnum">{ar ? "٠ ج.م" : "EGP 0"}</div>
      <div className="empty-note">{tx(DD.firstSale, ar)}</div>
      <div className="empty-flat" />
    </div>
  );
  return (
    <div className="hero">
      <div className="hero-wm"><img src="../../assets/numu-symbol-white-transparent.webp" alt="" /></div>
      <div className="hero-top">
        <span className="hero-label">{tx(DD.salesToday, ar)}</span>
        <span className="pill pill-sage"><span className="ltr-nums">+12.4%</span></span>
      </div>
      <div className="hero-val tnum">{FMT(48250, ar)}</div>
      <div className="hero-spark"><Sparkline data={SPARK} color="var(--saffron)" h={40} id="hero" /></div>
    </div>
  );
}

function WaitingCard({ ar, empty, go }) {
  if (empty) return (
    <div className="card waiting">
      <div className="waiting-h">
        <div className="ichip sage"><Icon name="check-circle" weight="duotone" /></div>
        <div><div style={{ fontWeight: 800, fontSize: 14 }}>{tx(DD.noOrdersYet, ar)}</div>
          <div className="muted" style={{ fontSize: 12 }}>{tx(DD.ordersHere, ar)}</div></div>
      </div>
    </div>
  );
  return (
    <div className="card waiting">
      <div className="waiting-h">
        <div className="ichip saffron"><Icon name="hourglass-medium" weight="duotone" /></div>
        <div>
          <div className="waiting-n tnum">{ar ? "٢" : "2"}</div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{tx(DD.waiting, ar)} · {tx(DD.toFulfill, ar)}</div>
        </div>
        <button className="btn btn-accent btn-sm" style={{ marginInlineStart: "auto" }} onClick={() => go("orders")}><Icon name="truck" weight="bold" />{tx(DD.fulfill, ar)}</button>
      </div>
      <div className="waiting-row"><span className="t">{tx(DD.oldest, ar)}</span><span className="muted mono" style={{ fontSize: 12 }}>#NM-2836 · {ar ? "٦ س" : "6h"}</span></div>
      <div className="waiting-row"><span className="t">{tx(DD.theirValue, ar)}</span><span className="v tnum display">{FMT(2069, ar)}</span></div>
    </div>
  );
}

function KpiTile({ tone, icon, label, value, delta, dir, empty }) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <div className={"ichip " + tone}><Icon name={icon} weight="duotone" /></div>
        {empty ? <span className="delta flat">—</span> : <span className={"delta " + dir}><span className="ltr-nums">{delta}</span></span>}
      </div>
      <div>
        <div className="kpi-lbl">{label}</div>
        <div className="kpi-val tnum" style={empty ? { color: "var(--ink-faint)" } : null}>{value}</div>
      </div>
    </div>
  );
}

function TriageRow({ tone, icon, lead, desc, cta, value, ar, onClick }) {
  const caret = ar ? "caret-left" : "caret-right";
  return (
    <div className="triage-row" onClick={onClick}>
      <div className={"ichip " + tone}><Icon name={icon} weight="duotone" /></div>
      <div className="t"><div className="lead">{lead}</div><div className="desc">{desc}</div></div>
      {value && <span className="display tnum" style={{ fontWeight: 800, fontSize: 13 }}>{value}</span>}
      <span className="cta">{cta}<Icon name={caret} size={14} /></span>
    </div>
  );
}

function HealthCard({ ar, empty }) {
  const score = 86;
  if (empty) return (
    <div className="card health">
      <div className="eyebrow" style={{ color: "var(--ink-faint)", alignSelf: "flex-start" }}>{tx(DD.health, ar)}</div>
      <div className="health-ring" style={{ background: "conic-gradient(var(--surface-3) 0deg, var(--surface-2) 0)", borderRadius: 999, marginTop: 8 }}>
        <div style={{ position: "absolute", inset: 9, borderRadius: 999, background: "var(--surface)" }} />
        <div className="score"><b style={{ color: "var(--ink-faint)" }}>—</b></div>
      </div>
      <div className="muted" style={{ fontSize: 11.5, maxWidth: 150 }}>{tx(DD.emptyScore, ar)}</div>
    </div>
  );
  const ring = `conic-gradient(var(--sage) ${score * 3.6}deg, var(--surface-2) 0)`;
  return (
    <div className="card health">
      <div className="eyebrow" style={{ color: "var(--ink-faint)", alignSelf: "flex-start" }}>{tx(DD.health, ar)}</div>
      <div className="health-ring" style={{ background: ring, borderRadius: 999, marginTop: 6 }}>
        <div style={{ position: "absolute", inset: 9, borderRadius: 999, background: "var(--surface)" }} />
        <div className="score"><b>{ar ? arN(score) : score}</b><span>/{ar ? "١٠٠" : "100"}</span></div>
      </div>
      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--sage)" }}>{tx(DD.great, ar)}</div>
      <div className="muted" style={{ fontSize: 11.5 }}>{ar ? "الشحن والدفع شغّالين تمام" : "Shipping & payments are healthy"}</div>
    </div>
  );
}

function DashRevenue({ ar, empty }) {
  const days = ar ? ["سبت", "حد", "اتنين", "تلات", "اربع", "خميس", "جمعة"] : ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div className="card">
      <div className="sect-head"><h2>{tx(DD.revenue, ar)}</h2><button className="link">{tx(T.viewAll, ar)}</button></div>
      {empty ? <div className="empty-chart">{tx(DD.dataAfter, ar)}</div> : (
        <React.Fragment>
          <div style={{ padding: "0 8px" }}><DashArea data={SPARK} color="var(--navy)" h={150} /></div>
          <div className="chart-days">{days.map((d, i) => <span key={i}>{d}</span>)}</div>
        </React.Fragment>
      )}
    </div>
  );
}

function DashTopSellers({ ar, empty, go }) {
  const top = [...PRODUCTS].sort((a, b) => b.sold * b.price - a.sold * a.price).slice(0, 4);
  return (
    <div className="card">
      <div className="sect-head"><h2>{tx(T.topProducts, ar)}</h2><button className="link" onClick={() => go("products")}>{tx(T.viewAll, ar)}</button></div>
      {empty ? <div style={{ padding: "26px 18px", textAlign: "center" }} className="muted">{tx(DD.noSalesYet, ar)}</div> : (
        <div style={{ paddingBottom: 8 }}>
          {top.map((p, i) => (
            <div className="seller" key={p.id}>
              <span className="rank">{ar ? arN(i + 1) : i + 1}</span>
              <span className="s-thumb">{p.img}</span>
              <span className="nm">{tx(p, ar)}</span>
              <span className="amt tnum">{FMT(p.price * p.sold, ar)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DashRecentOrders({ ar, go }) {
  return (
    <div className="card">
      <div className="sect-head"><h2>{tx(T.recentOrders, ar)}</h2><button className="link" onClick={() => go("orders")}>{tx(T.viewAll, ar)}</button></div>
      <div className="recent">
        {ORDERS.slice(0, 4).map((o) => {
          const n = NAMES[o.who];
          return (
            <div className="recent-row" key={o.id} onClick={() => go("orders")}>
              <Avatar name={tx(n, ar)} tone={o.who} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="nm">{tx(n, ar)}</div>
                <div className="meta">{o.id} · {ar ? (o.agoAr || o.ago) : o.ago}</div>
              </div>
              <StatusPill status={o.status} ar={ar} />
              <div className="amt tnum" style={{ minWidth: 78, textAlign: ar ? "left" : "right" }}>{FMT(o.total, ar)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OnboardStrip({ ar, go }) {
  const steps = [
    { label: DD.stAccount, icon: "check-circle", state: "done" },
    { label: DD.stProduct, icon: "package", state: "now" },
    { label: DD.stShipping, icon: "truck", state: "todo" },
    { label: DD.stPayments, icon: "credit-card", state: "todo" },
  ];
  return (
    <div className="onboard">
      <div className="onboard-wm"><img src="../../assets/numu-symbol-white-transparent.webp" alt="" /></div>
      <div className="onboard-top">
        <div className="gift"><Icon name="gift" weight="duotone" /></div>
        <div>
          <div className="onboard-title">{tx(DD.setupTitle, ar)}</div>
          <div className="onboard-sub">{tx(DD.setupSub, ar)}</div>
        </div>
        <div className="onboard-count"><b className="tnum">{ar ? "١" : "1"}</b><span className="tnum">/{ar ? "٤" : "4"}</span></div>
        <button className="btn btn-accent btn-sm" style={{ marginInlineStart: 6 }} onClick={() => go("products")}>{tx(DD.start, ar)}<Icon name={ar ? "arrow-left" : "arrow-right"} weight="bold" /></button>
      </div>
      <div className="progress"><i style={{ width: "25%" }} /></div>
      <div className="onboard-steps">
        {steps.map((s, i) => (
          <div key={i} className={"ostep " + s.state}>
            <Icon name={s.state === "done" ? "check-circle" : s.icon} weight={s.state === "done" ? "fill" : "bold"} />
            {tx(s.label, ar)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ DESKTOP ============================ */
function DashboardDesktop({ ar, go, firstTime }) {
  const ft = firstTime;
  return (
    <div className="zones">
      {ft && <OnboardStrip ar={ar} go={go} />}

      <div className="zone">
        {!ft && (
          <div className="greet">
            <div>
              <h1>{tx(T.greetMorning, ar)}، {tx(T.merchant, ar)} 👋</h1>
              <div className="sub">{ar ? "عندك طلبين مستنيين، والمبيعات في تحسّن" : "You have 2 orders waiting — and sales are up"}</div>
            </div>
            <div className="actions">
              <button className="btn btn-outline btn-sm"><Icon name="arrow-square-out" weight="bold" />{tx(T.viewStore, ar)}</button>
              <button className="btn btn-primary btn-sm" onClick={() => go("products")}><Icon name="plus" weight="bold" />{tx(T.addProduct, ar)}</button>
            </div>
          </div>
        )}
        <ZoneHead eyebrow={tx(DD.today, ar)} q={tx(DD.qToday, ar)} />
        <div className={ft ? "ghost" : ""}>
          <div className="todo-grid">
            <SalesHero ar={ar} empty={ft} />
            <WaitingCard ar={ar} empty={ft} go={go} />
          </div>
          <div className="kpis" style={{ marginTop: 14 }}>
            <KpiTile tone="navy" icon="shopping-cart" label={tx(T.orders, ar)} value={ft ? (ar ? "٠" : "0") : (ar ? arN(312) : "312")} delta="+8.1%" dir="up" empty={ft} />
            <KpiTile tone="sage" icon="users" label={tx(T.visitors, ar)} value={ft ? (ar ? "٠" : "0") : (ar ? arN(5840) : "5,840")} delta="+3.2%" dir="up" empty={ft} />
            <KpiTile tone="terra" icon="chart-line-up" label={tx(DD.conversion, ar)} value={ft ? "—" : (ar ? "٣٫٤٪" : "3.4%")} delta="+0.4%" dir="up" empty={ft} />
            <KpiTile tone="saffron" icon="wallet" label={tx(DD.netProfit, ar)} value={ft ? (ar ? "٠ ج.م" : "EGP 0") : FMT(18900, ar)} delta="−1.4%" dir="down" empty={ft} />
          </div>
        </div>
      </div>

      <div className="zone">
        <ZoneHead eyebrow={tx(DD.needsYou, ar)} q={tx(DD.qNeeds, ar)} />
        <div className={ft ? "ghost" : ""}>
          <div className="needs-grid">
            <div className="card triage">
              {ft ? (
                <TriageRow ar={ar} tone="saffron" icon="package" lead={tx(DD.addFirst, ar)} desc={ar ? "أول خطوة لمتجرك" : "The first step for your store"} cta={tx(T.addProduct, ar)} />
              ) : (
                <React.Fragment>
                  <TriageRow ar={ar} tone="saffron" icon="hourglass-medium" lead={tx(DD.fulfillTitle, ar)} desc={tx(DD.fulfillDesc, ar)} cta={tx(DD.fulfill, ar)} onClick={() => go("orders")} />
                  <TriageRow ar={ar} tone="terra" icon="warning" lead={tx(DD.lowTitle, ar)} desc={tx(DD.lowDesc, ar)} cta={tx(DD.restock, ar)} onClick={() => go("products")} />
                  <TriageRow ar={ar} tone="info" icon="money" lead={tx(DD.codTitle, ar)} desc={tx(DD.codDesc, ar)} value={FMT(3240, ar)} cta={tx(DD.reconcile, ar)} onClick={() => go("cod")} />
                  <TriageRow ar={ar} tone="navy" icon="shopping-cart-simple" lead={tx(DD.abandTitle, ar)} desc={tx(DD.abandDesc, ar)} cta={tx(DD.remind, ar)} onClick={() => go("orders:abandoned")} />
                </React.Fragment>
              )}
            </div>
            <HealthCard ar={ar} empty={ft} />
          </div>
        </div>
      </div>

      <div className="zone">
        <ZoneHead eyebrow={tx(DD.grow, ar)} q={tx(DD.qGrow, ar)} />
        <div className={ft ? "ghost" : ""}>
          <div className="grow-grid">
            <DashRevenue ar={ar} empty={ft} />
            <DashTopSellers ar={ar} empty={ft} go={go} />
          </div>
          {!ft && <div style={{ marginTop: 14 }}><DashRecentOrders ar={ar} go={go} /></div>}
        </div>
      </div>
    </div>
  );
}

/* ============================ MOBILE ============================ */
function DashboardMobile({ ar, go, firstTime }) {
  const ft = firstTime;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
      {ft ? <OnboardStrip ar={ar} go={go} /> : (
        <div className="m-greet">
          <img className="av" src="../../assets/onboarding/welcome.webp" alt="" />
          <div>
            <h1>{tx(T.greetMorning, ar)}، {tx(T.merchant, ar)} 👋</h1>
            <div className="sub">{ar ? "عندك طلبين مستنيين" : "2 orders waiting on you"}</div>
          </div>
        </div>
      )}

      <div className="zone" style={{ gap: 10 }}>
        <ZoneHead eyebrow={tx(DD.today, ar)} q={null} />
        <div className={ft ? "ghost" : ""} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <SalesHero ar={ar} empty={ft} />
          {!ft && (
            <div className="card m-waiting">
              <div className="ichip saffron"><Icon name="hourglass-medium" weight="duotone" /></div>
              <div className="t">
                <div className="lead"><span className="tnum">{ar ? "٢" : "2"}</span> {tx(DD.waiting, ar)}</div>
                <div className="desc">{ar ? "محتاجين تجهيز دلوقتي" : "Need fulfilling now"}</div>
              </div>
              <button className="btn btn-accent btn-sm" onClick={() => go("orders")}><Icon name="truck" weight="bold" />{tx(DD.fulfill, ar)}</button>
            </div>
          )}
          <div className="m-kpis">
            <KpiTile tone="navy" icon="shopping-cart" label={tx(T.orders, ar)} value={ft ? (ar ? "٠" : "0") : (ar ? arN(312) : "312")} delta="+8.1%" dir="up" empty={ft} />
            <KpiTile tone="saffron" icon="wallet" label={tx(DD.netProfit, ar)} value={ft ? (ar ? "٠ ج.م" : "EGP 0") : FMT(18900, ar)} delta="−1.4%" dir="down" empty={ft} />
          </div>
        </div>
      </div>

      <div className="zone" style={{ gap: 10 }}>
        <ZoneHead eyebrow={tx(DD.needsYou, ar)} q={null} />
        <div className="card triage">
          {ft ? (
            <TriageRow ar={ar} tone="saffron" icon="package" lead={tx(DD.addFirst, ar)} desc={ar ? "أول خطوة لمتجرك" : "First step"} cta={tx(T.addProduct, ar)} onClick={() => go("products")} />
          ) : (
            <React.Fragment>
              <TriageRow ar={ar} tone="terra" icon="warning" lead={tx(DD.lowTitle, ar)} desc={tx(DD.lowDesc, ar)} cta={tx(DD.restock, ar)} onClick={() => go("products")} />
              <TriageRow ar={ar} tone="info" icon="money" lead={tx(DD.codTitle, ar)} desc={tx(DD.codDesc, ar)} cta={tx(DD.reconcile, ar)} onClick={() => go("cod")} />
            </React.Fragment>
          )}
        </div>
      </div>

      {!ft && (
        <div className="zone" style={{ gap: 10 }}>
          <ZoneHead eyebrow={tx(DD.grow, ar)} q={null} />
          <DashTopSellers ar={ar} go={go} />
        </div>
      )}
    </div>
  );
}

function Dashboard({ ar, go, mobile, firstTime }) {
  return mobile ? <DashboardMobile ar={ar} go={go} firstTime={firstTime} /> : (
    <div className="page" style={{ padding: 24 }}><DashboardDesktop ar={ar} go={go} firstTime={firstTime} /></div>
  );
}

Object.assign(window, { Dashboard });
