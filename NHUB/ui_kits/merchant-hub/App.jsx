/* NUMU "Souq" Merchant Hub — app orchestration */
const { useState: useA, useEffect: useAEffect } = React;

function App() {
  const [booting, setBooting] = useA(true);
  const [authed, setAuthed] = useA(false);
  const [route, setRoute] = useA("dashboard");
  const [ar, setAr] = useA(false);
  const [dark, setDark] = useA(false);
  const [mobile, setMobile] = useA(false);

  // initial splash
  useAEffect(() => { const t = setTimeout(() => setBooting(false), 1600); return () => clearTimeout(t); }, []);

  const handleLogin = () => {
    setBooting(true);
    setTimeout(() => { setAuthed(true); setBooting(false); }, 1200);
  };

  const Screen = { dashboard: Dashboard, orders: Orders, products: Products, customers: Customers }[route] || Dashboard;
  const wrapCls = (dark ? "dark " : "") + "numu";
  const dir = ar ? "rtl" : "ltr";

  const Controls = (
    <div style={{ position: "fixed", bottom: 18, insetInlineStart: "50%", transform: "translateX(-50%)", zIndex: 100,
      display: "flex", gap: 6, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 999,
      padding: 6, boxShadow: "var(--shadow-pop)" }}>
      <button className={"chip" + (!mobile ? " on" : "")} style={{ height: 34 }} onClick={() => setMobile(false)}><Icon name="desktop" size={16} />Desktop</button>
      <button className={"chip" + (mobile ? " on" : "")} style={{ height: 34 }} onClick={() => setMobile(true)}><Icon name="device-mobile" size={16} />Mobile</button>
    </div>
  );

  let body;
  if (!authed) {
    body = <Login ar={ar} setAr={setAr} onLogin={handleLogin} />;
  } else if (mobile) {
    body = (
      <div style={{ height: "100%", background: "var(--surface-2)", display: "grid", placeItems: "center" }}>
        <div className="device" style={{ borderInline: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
            <div className="sb-mark" style={{ width: 34, height: 34, borderRadius: 11 }}><img src="../../assets/numu-n-mark.jpg" alt="" /></div>
            <span className="display" style={{ fontSize: 20, fontWeight: 700, color: "var(--navy)", fontFamily: "var(--font-brand)" }}>{ar ? "نُمُو" : "numu"}</span>
            <div style={{ flex: 1 }} />
            <button className="h-icon" style={{ width: 38, height: 38 }} onClick={() => setDark(d => !d)}><Icon name={dark ? "sun" : "moon"} weight="duotone" /></button>
            <button className="h-icon" style={{ width: 38, height: 38 }} onClick={() => setAr(a => !a)}><span style={{ fontWeight: 800, fontSize: 13 }}>{ar ? "EN" : "ع"}</span></button>
          </div>
          <div className="m-scroll" key={route + dir}>
            <Screen ar={ar} go={setRoute} mobile={true} />
          </div>
          <MobileNav route={route} setRoute={setRoute} ar={ar} />
        </div>
      </div>
    );
  } else {
    body = (
      <div className="app-shell">
        <Sidebar route={route} setRoute={setRoute} ar={ar} />
        <div className="app-main">
          <Header ar={ar} setAr={setAr} dark={dark} setDark={setDark} />
          <div className="app-scroll" key={route + dir}><Screen ar={ar} go={setRoute} mobile={false} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapCls} dir={dir} style={{ height: "100%", position: "relative" }}>
      {body}
      {authed && !booting && Controls}
      {booting && <Loader />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
