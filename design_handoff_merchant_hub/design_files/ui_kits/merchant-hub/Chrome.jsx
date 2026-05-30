/* NUMU "Souq" — chrome: Sidebar (2-level IA), Header, MobileNav + More sheet, Loader */
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

/* top-level key from a possibly-namespaced route ("orders:drafts" -> "orders") */
function baseKey(route) { return (route || "").split(":")[0]; }

function NavItem({ n, route, setRoute, ar }) {
  const active = baseKey(route) === n.key;
  const hasKids = n.kids && n.kids.length;
  const [open, setOpen] = useStateC(active && hasKids);
  // keep parent open when its route is active
  React.useEffect(() => { if (active && hasKids) setOpen(true); }, [active]);

  return (
    <div className="nav-block">
      <button
        className={"nav-item" + (active ? " active" : "")}
        onClick={() => { setRoute(n.key); if (hasKids) setOpen(o => !o); }}
      >
        <Icon name={n.icon} weight={active ? "fill" : "duotone"} />
        <span>{tx(n, ar)}</span>
        {n.count && <span className="nav-count tnum">{ar ? n.count.toLocaleString("ar-EG") : n.count}</span>}
        {hasKids && (
          <Icon name="caret-down" size={14}
            className="nav-caret"
            style={{ marginInlineStart: n.count ? 6 : "auto", transform: open ? "rotate(180deg)" : "none" }} />
        )}
      </button>
      {hasKids && open && (
        <div className="nav-kids">
          {n.kids.map(k => {
            const kActive = route === k.key;
            return (
              <button key={k.key} className={"nav-kid" + (kActive ? " active" : "")} onClick={() => setRoute(k.key)}>
                <span className="nav-kid-dot" />
                <span>{tx(k, ar)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sidebar({ route, setRoute, ar }) {
  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-mark"><img src="../../assets/numu-n-mark.jpg" alt="" /></div>
        <span className="sb-word">{ar ? "نُمُو" : "numu"}</span>
      </div>
      <nav className="sb-nav">
        {NAV_GROUPS.map(g => (
          <div key={g.id} className="sb-section">
            {g.label && <div className="sb-group">{tx(g.label, ar)}</div>}
            {NAV.filter(n => n.group === g.id).map(n => (
              <NavItem key={n.key} n={n} route={route} setRoute={setRoute} ar={ar} />
            ))}
          </div>
        ))}
      </nav>
      <div className="sb-foot">
        <button className={"nav-item" + (route === "settings" ? " active" : "")} onClick={() => setRoute("settings")}>
          <Icon name="gear" weight={route === "settings" ? "fill" : "duotone"} /><span>{tx(T.settings, ar)}</span>
        </button>
        <div className="sb-store">
          <Avatar name="Cairo Threads" size={34} tone={0} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sb-store-n">{ar ? "خيوط القاهرة" : "Cairo Threads"}</div>
            <div className="sb-store-m">{ar ? "باقة Premium" : "Premium plan"}</div>
          </div>
          <Icon name="caret-up-down" size={15} style={{ color: "var(--ink-faint)" }} />
        </div>
      </div>
    </aside>
  );
}

function Header({ ar, setAr, dark, setDark, title }) {
  return (
    <header className="header">
      <button className="h-search">
        <Icon name="magnifying-glass" size={19} />
        <span>{tx(T.search, ar)}</span>
        <kbd>⌘K</kbd>
      </button>
      <div style={{ flex: 1 }} />
      <div className="chip h-live" style={{ height: 42, gap: 8 }}>
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
    </header>
  );
}

/* ── Mobile ─────────────────────────────────────────────────────────── */
function MobileNav({ route, setRoute, ar, onMore, onAdd }) {
  const tabs = [
    { key: "dashboard", en: "Home", ar: "الرئيسية", icon: "house" },
    { key: "orders", en: "Orders", ar: "الطلبات", icon: "shopping-cart", count: 6 },
    { key: "add", fab: true, icon: "plus" },
    { key: "products", en: "Products", ar: "المنتجات", icon: "package" },
    { key: "more", en: "More", ar: "المزيد", icon: "dots-three-outline", onClick: onMore },
  ];
  return (
    <div className="m-bottom">
      {tabs.map(t => {
        if (t.fab) return (
          <button key={t.key} className="mtab" onClick={onAdd}>
            <div className="m-fab"><Icon name="plus" weight="bold" /></div>
          </button>
        );
        const active = baseKey(route) === t.key;
        return (
          <button key={t.key} className={"mtab" + (active ? " active" : "")} onClick={t.onClick || (() => setRoute(t.key))}>
            <span style={{ position: "relative" }}>
              <Icon name={t.icon} weight={active ? "fill" : "duotone"} />
              {t.count && <span className="mtab-count tnum">{ar ? t.count.toLocaleString("ar-EG") : t.count}</span>}
            </span>
            <span>{tx(t, ar)}</span>
          </button>
        );
      })}
    </div>
  );
}

function MoreSheet({ route, setRoute, ar, onClose }) {
  const go = (k) => { setRoute(k); onClose(); };
  return (
    <React.Fragment>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-grab" />
        <div className="sheet-head">
          <span className="display" style={{ fontSize: 18, fontWeight: 800 }}>{ar ? "كل الأقسام" : "All sections"}</span>
          <button className="h-icon" style={{ width: 36, height: 36 }} onClick={onClose}><Icon name="x" weight="bold" /></button>
        </div>
        <div className="sheet-body">
          {NAV_GROUPS.map(g => (
            <div key={g.id} className="sheet-group">
              {g.label && <div className="sb-group" style={{ padding: "10px 4px 6px" }}>{tx(g.label, ar)}</div>}
              <div className="sheet-grid">
                {NAV.filter(n => n.group === g.id).map(n => {
                  const active = baseKey(route) === n.key;
                  return (
                    <button key={n.key} className={"sheet-tile" + (active ? " active" : "")} onClick={() => go(n.key)}>
                      <div className="sheet-ico"><Icon name={n.icon} weight="duotone" /></div>
                      <span>{tx(n, ar)}</span>
                      {n.count && <span className="nav-count tnum" style={{ position: "absolute", top: 8, insetInlineEnd: 8 }}>{ar ? n.count.toLocaleString("ar-EG") : n.count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button className={"sheet-tile wide" + (route === "settings" ? " active" : "")} onClick={() => go("settings")} style={{ marginTop: 6 }}>
            <div className="sheet-ico"><Icon name="gear" weight="duotone" /></div>
            <span>{tx(T.settings, ar)}</span>
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

function AddSheet({ ar, go, onClose }) {
  const items = [
    { key: "products", icon: "package", label: T.newProduct, tone: "navy" },
    { key: "orders", icon: "shopping-cart", label: T.newOrder, tone: "saffron" },
    { key: "marketing:discounts", icon: "tag", label: T.newDiscount, tone: "sage" },
  ];
  return (
    <React.Fragment>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet add-sheet">
        <div className="sheet-grab" />
        <div className="sheet-head"><span className="display" style={{ fontSize: 17, fontWeight: 800 }}>{tx(T.quickAdd, ar)}</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "4px 16px 20px" }}>
          {items.map(it => (
            <button key={it.key} className="add-row" onClick={() => { go(it.key); onClose(); }}>
              <div className={"ichip " + it.tone}><Icon name={it.icon} weight="duotone" /></div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{tx(it.label, ar)}</span>
              <Icon name={ar ? "caret-left" : "caret-right"} size={16} style={{ marginInlineStart: "auto", color: "var(--ink-faint)" }} />
            </button>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { Sidebar, Header, MobileNav, MoreSheet, AddSheet, Loader, baseKey });
