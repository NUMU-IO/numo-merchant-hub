/* NUMU "Souq" — shared primitives */
const { useState, useEffect, useRef } = React;

// bilingual text helper
function tx(obj, ar) { return ar ? (obj.ar ?? obj.en) : obj.en; }

// Avatar with initials, warm tinted
function Avatar({ name, size = 38, tone = 0 }) {
  const tones = [
    ["#FBEBCF", "#D2841A"], ["#E2ECF7", "#2D6CB5"], ["#E3EEE2", "#5E8A5C"],
    ["#F6E2D9", "#C14A1C"], ["#EAE4F2", "#6E5AA8"],
  ];
  const [bg, fg] = tones[tone % tones.length];
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("");
  return (
    <div style={{ width: size, height: size, borderRadius: size * .34, background: bg, color: fg,
      display: "grid", placeItems: "center", fontWeight: 800, fontSize: size * .38,
      fontFamily: "var(--font-display)", flexShrink: 0 }}>{initials}</div>
  );
}

// Smooth area sparkline
function Sparkline({ data, color = "var(--navy)", w = 200, h = 48, fill = true, id }) {
  const max = Math.max(...data), min = Math.min(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: h - 6 - ((v - min) / rng) * (h - 12) }));
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const cx1 = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * .42;
    const cx2 = pts[i].x - (pts[i].x - pts[i - 1].x) * .42;
    d += ` C${cx1},${pts[i - 1].y} ${cx2},${pts[i].y} ${pts[i].x},${pts[i].y}`;
  }
  const gid = "sg-" + (id || color.replace(/[^a-z]/gi, ""));
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="ltr-nums">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity=".22" /><stop offset="100%" stopColor={color} stopOpacity="0" />
      </linearGradient></defs>
      {fill && <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#${gid})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// Status pill (orders)
function StatusPill({ status, ar }) {
  const s = STATUS[status]; const v = `var(${s.v})`;
  return (
    <span className="pill" style={{ color: v, background: `color-mix(in srgb, ${v} 14%, transparent)` }}>
      <span className="dot" style={{ background: v }} />{tx(s, ar)}
    </span>
  );
}

function PayPill({ pay, ar }) {
  const map = { paid: "var(--success)", cod: "var(--ink-soft)", refunded: "var(--terracotta)" };
  const c = map[pay];
  return <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, color: c }}>{tx(PAY[pay], ar)}</span>;
}

// Number display (formatted). Animation is skipped to stay correct even when
// the iframe is backgrounded and requestAnimationFrame is throttled.
function CountUp({ value, fmt }) {
  return <span>{fmt ? fmt(value) : value.toLocaleString()}</span>;
}

Object.assign(window, { tx, Avatar, Sparkline, StatusPill, PayPill, CountUp });
