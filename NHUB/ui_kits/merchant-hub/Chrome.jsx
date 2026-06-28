/* NUMU "Souq" — chrome: Sidebar, Header, MobileBottomNav, Loader */
const { useState: useStateC } = React;

function Loader() {
  return (
    <div className="numu-loader">
      <div className="nl-stage">
        <svg className="nl-ring" viewBox="0 0 104 104">
          <circle className="track" cx="52" cy="52" r="50" />
          <circle className="arc" cx="52" cy="52" r="50" />
        </svg>
        <div className="nl-tile"><img src="../../assets/numu-n-mark.jpg" alt="NUMU" /></div>
      </div>
    </div>
  );
}

function Sidebar({ route, setRoute, ar }) {
  const groups = [
    { id: "main", label: { en: "Manage", ar: "الإدارة" } },
    { id: "sell", label: { en: "Sell & grow", ar: "البيع والنمو" } },
    { id: "ops",  label: { en: "Operations", ar: "العمليات" } },
  ];
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-mark"><img src="../../assets/numu-n-mark.jpg" alt="" /></div>
        <span className="sb-word">{ar ? "نُمُو" : "numu"}</span>
      </div>
      <nav className="sb-nav">
        {groups.map(g => (
          <div key={g.id}>
            <div className="sb-group">{tx(g.label, ar)}</div>
            {NAV.filter(n => n.group === g.id).map(n => (
              <button key={n.key} className={"nav-item" + (route === n.key ? " active" : "")} onClick={() => setRoute(n.key)}>
                <Icon name={n.icon} weight={route === n.key ? "fill" : "duotone"} />
                <span>{tx(n, ar)}</span>
                {n.count && <span className="nav-count tnum">{n.count}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div style={{ padding: 12, borderTop: "1px solid var(--border)" }}>
        <button className="nav-item"><Icon name="gear" /><span>{ar ? "الإعدادات" : "Settings"}</span></button>
      </div>
    </aside>
  );
}

function Header({ ar, setAr, dark, setDark }) {
  return (
    <header className="header">
      <button className="h-search">
        <Icon name="magnifying-glass" size={19} />
        <span>{tx(T.search, ar)}</span>
        <kbd>⌘K</kbd>
      </button>
      <div style={{ flex: 1 }} />
      <div className="chip" style={{ height: 42, gap: 8 }}>
        <span style={{ position: "relative", display: "flex", width: 9, height: 9 }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: 999, background: "var(--sage)", opacity: .5, animation: "ping 1.4s infinite" }} />
          <span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--sage)" }} />
        </span>
        <span className="tnum" style={{ fontWeight: 700 }}>{ar ? "٢٤ " : "24 "}</span>
        <span style={{ color: "var(--ink-soft)", fontWeight: 600 }}>{tx(T.liveNow, ar)}</span>
      </div>
      <button className="h-icon" onClick={() => setDark(d => !d)} title="Theme">
        <Icon name={dark ? "sun" : "moon"} weight="duotone" />
      </button>
      <button className="h-icon" onClick={() => setAr(a => !a)} style={{ width: "auto", padding: "0 14px", gap: 7 }}>
        <Icon name="translate" /><span style={{ fontWeight: 800, fontSize: 13 }}>{ar ? "EN" : "ع"}</span>
      </button>
      <button className="h-icon"><Icon name="bell" weight="duotone" /><span className="h-dot" /></button>
      <button className="chip" style={{ height: 42, paddingInlineStart: 6, gap: 9 }}>
        <Avatar name="Cairo Threads" size={30} tone={0} />
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{ar ? "خيوط القاهرة" : "Cairo Threads"}</span>
        <Icon name="caret-down" size={15} style={{ color: "var(--ink-soft)" }} />
      </button>
    </header>
  );
}

function MobileNav({ route, setRoute, ar }) {
  const tabs = [
    { key: "dashboard", en: "Home", ar: "الرئيسية", icon: "house" },
    { key: "orders", en: "Orders", ar: "الطلبات", icon: "shopping-cart" },
    { key: "add", en: "Add", ar: "إضافة", icon: "plus", fab: true },
    { key: "products", en: "Products", ar: "المنتجات", icon: "package" },
    { key: "customers", en: "Menu", ar: "القائمة", icon: "list" },
  ];
  return (
    <div className="m-bottom">
      {tabs.map(t => {
        if (t.fab) return (
          <button key={t.key} className="mtab" onClick={() => setRoute("products")}>
            <div className="m-fab"><Icon name="plus" /></div>
          </button>
        );
        const active = route === t.key;
        return (
          <button key={t.key} className={"mtab" + (active ? " active" : "")} onClick={() => setRoute(t.key)}>
            <Icon name={t.icon} weight={active ? "fill" : "duotone"} />
            <span>{tx(t, ar)}</span>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, { Sidebar, Header, MobileNav, Loader });
