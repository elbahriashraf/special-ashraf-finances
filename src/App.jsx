import React, { useState, useEffect, useMemo, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   SPECIAL ASHRAF — FINANCES
   Dark luxury · Gold · Cormorant / Playfair Display
   Data: single state object `fin` → localStorage (Supabase-ready)
   ═══════════════════════════════════════════════════════════════ */

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#F5D98B";
const INK = "#050300";
const CREAM = "#FAF8F3";
const LS_KEY = "sa_finances_v1";
const CURRENCY = "MAD";
const INVEST_PCT = 0.8;

/* ─── Shared Supabase sync (same table as the main Special Ashraf app) ─── */
const SUPABASE_URL = "https://lvqrylyxfwtslxchiots.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cXJ5bHl4Znd0c2x4Y2hpb3RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTI2MzAsImV4cCI6MjA5NTI4ODYzMH0.9_1tRNxna6FmiIru8fPbXpDv1njf12gC1EsITTfGzBg";

async function cloudLoad(key) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ashraf_data?key=eq.${key}&select=value`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data[0]) return JSON.parse(data[0].value);
    return null;
  } catch { return null; }
}
async function cloudSave(key, val) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/ashraf_data?on_conflict=key`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify({ key, value: JSON.stringify(val) }),
    });
  } catch { /* silent — local copy still saved */ }
}

// Mirrors the main app's GOALS_2026 names, so a spend here can be linked to
// a goal there — The Process reads this same "sa_finances_v1" cloud record
// and sums "out" transactions whose linkedGoal matches a goal's name.
const LINKABLE_2026_GOALS = [
  "Special Ashraf Self-Date", '"Special" Necklace', '"77" Necklace', "Ramadan Vibes", "Ramadan Food",
  "Special Ashraf Jerseys 1", "Special Ashraf Caps 1", "300$ Wealth", "Special Ashraf Clothes 1",
  "Casque OR Airpods", "Amine Tsubasa", "Solo Night Vibes", "PS4/PS5 - FC26 - Ecran*",
  "Late Night Dates. (For You, Golf, Michlifen, Trips)", "Sell The Tracker Online", "750$ Wealth.",
  "12 000MAD Lwalida", "Crest 3D", "My Girl", "My Girl Date", "Weekend Solo-Trip",
  "Special Ashraf Clothes 2", "Special Ashraf Caps 2", "Special Ashraf Shoes 1",
  "my F50 & my Brazuca & my Trionda", "200$ Lwalida", "Money Giveaway", "1K$ Wealth", "Funded Account",
  "1,5K$ Wealth.", "Special Ashraf Clothes 3", "Special Ashraf Caps 3", "Special Ashraf Jerseys 2",
  "Special Ashraf Shoes 2", "Permis", "2K$ Wealth.", "20 000MAD Lwalid.", "Special Ashraf Clothes 4",
  "Special Ashraf Caps 4", "Special Ashraf Jerseys 3", "2,5K$ Wealth.",
];

/* ─── Safe storage (works in browser + falls back in sandboxed previews) ─── */
const store = {
  load() {
    try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  },
  save(data) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
  },
};

/* ─── Date helpers ─── */
const todayKey = () => new Date().toISOString().slice(0, 10);
const dKey = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const monthKey = () => new Date().toISOString().slice(0, 7);

const fmt = (n) => {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return sign + abs.toLocaleString("en-US", { minimumFractionDigits: abs % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

/* ─── Fonts + global ─── */
function GlobalStyle() {
  useEffect(() => {
    let tag = document.querySelector('meta[name="viewport"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "viewport";
      document.head.appendChild(tag);
    }
    tag.content = "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover";
  }, []);

  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Cormorant:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body, #root { min-height: 100%; background: ${INK}; }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 1px; }
      input, textarea, button { font-family: inherit; outline: none; }
      input::placeholder, textarea::placeholder { color: rgba(250,248,243,0.25); font-style: italic; }
      @keyframes saFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes saDiamond { from { transform: rotate(0deg) scale(0.6); opacity: 0; } to { transform: rotate(45deg) scale(1); opacity: 1; } }
      @keyframes saGlowPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }

      /* ── Mobile ── */
      @media (max-width: 600px) {
        .sa-container { padding: 0 14px 60px !important; }
        .sa-header { padding: 28px 0 20px !important; }
        .sa-eyebrow { font-size: 9px !important; letter-spacing: 0.32em !important; }
        .sa-nav { gap: 4px !important; margin-bottom: 24px !important; }
        .sa-nav-btn { padding: 9px 12px !important; font-size: 11px !important; letter-spacing: 0.1em !important; }
        .sa-balance-section { padding: 26px 16px 22px !important; margin-bottom: 16px !important; }
        .sa-split-grid { gap: 10px !important; margin-bottom: 16px !important; }
        .sa-split-card { padding: 18px 18px 16px !important; }
        .sa-period-grid { gap: 10px !important; margin-bottom: 18px !important; }
        .sa-flow-section { padding: 18px 16px 12px !important; }
        .sa-form-section { padding: 18px 16px 16px !important; margin-bottom: 22px !important; }
        .sa-form-row { flex-direction: column !important; }
        .sa-form-row > div { flex: 1 1 auto !important; min-width: 0 !important; width: 100% !important; }
        .sa-ledger-row { flex-wrap: wrap !important; gap: 6px 10px !important; padding: 12px 14px !important; }
        .sa-ledger-amt { font-size: 16px !important; }
        .sa-plan-header { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
        .sa-plan-grid { gap: 10px !important; }
        .sa-plan-card { padding: 18px 18px 16px !important; }
        .sa-plan-achieved { padding: 26px 16px 22px !important; }
      }
    `}</style>
  );
}

/* ─── Ornamental background ─── */
function LuxuryBg() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 20% 0%, rgba(201,168,76,0.06) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(201,168,76,0.05) 0%, transparent 50%), ${INK}` }} />
      {/* Frame lines */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: `linear-gradient(90deg, transparent, ${GOLD} 30%, ${GOLD_LIGHT} 50%, ${GOLD} 70%, transparent)` }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.4) 50%, transparent)" }} />
      {/* Corner marks */}
      {[["12px","12px","0,10 0,0 10,0"],["12px",null,"10,0 20,0 20,10"],[null,"12px","0,10 0,20 10,20"],[null,null,"10,20 20,20 20,10"]].map(([top,left,pts],i)=>(
        <svg key={i} width="20" height="20" style={{ position:"absolute", top: top||"auto", bottom: top?"auto":"12px", left: left||"auto", right: left?"auto":"12px", opacity: 0.5 }}>
          <polyline points={pts} fill="none" stroke={GOLD} strokeWidth="1.5" />
        </svg>
      ))}
    </div>
  );
}

/* ─── Diamond checkbox-style toggle (in / out) ─── */
function FlowToggle({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: "10px" }}>
      {[
        { id: "in", label: "Money In" },
        { id: "out", label: "Money Out" },
      ].map((opt) => {
        const active = value === opt.id;
        const color = opt.id === "in" ? GOLD : "rgba(250,248,243,0.7)";
        return (
          <button key={opt.id} onClick={() => onChange(opt.id)} style={{
            flex: 1, padding: "13px 10px", cursor: "pointer",
            background: active ? (opt.id === "in" ? "rgba(201,168,76,0.12)" : "rgba(250,248,243,0.06)") : "transparent",
            border: `1px solid ${active ? (opt.id === "in" ? "rgba(201,168,76,0.6)" : "rgba(250,248,243,0.3)") : "rgba(201,168,76,0.15)"}`,
            borderRadius: "1px", display: "flex", alignItems: "center", justifyContent: "center", gap: "9px",
            transition: "all 0.25s ease",
          }}>
            <span style={{
              width: "8px", height: "8px", display: "inline-block",
              border: `1.5px solid ${active ? color : "rgba(201,168,76,0.3)"}`,
              background: active ? color : "transparent",
              transform: "rotate(45deg)",
              animation: active ? "saDiamond 0.3s ease" : "none",
              transition: "all 0.25s ease",
            }} />
            <span style={{
              fontFamily: "'Cormorant', serif", fontSize: "15px", fontWeight: 600,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: active ? (opt.id === "in" ? GOLD_LIGHT : CREAM) : "rgba(250,248,243,0.4)",
            }}>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Period indicator chip ─── */
function PeriodChip({ label, net, inAmt, outAmt }) {
  const pos = net > 0, neg = net < 0;
  return (
    <div style={{
      border: "1px solid rgba(201,168,76,0.18)", borderRadius: "1px",
      padding: "16px 18px 14px", position: "relative", overflow: "hidden",
      background: "linear-gradient(160deg, rgba(201,168,76,0.045) 0%, transparent 60%)",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "22px", height: "1.5px", background: GOLD, opacity: 0.7 }} />
      <div style={{ fontFamily: "'Cormorant', serif", fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(201,168,76,0.75)", marginBottom: "8px" }}>{label}</div>
      <div style={{
        fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 600,
        color: pos ? GOLD_LIGHT : neg ? "rgba(250,248,243,0.85)" : "rgba(250,248,243,0.45)",
      }}>
        {pos ? "+" : ""}{fmt(net)} <span style={{ fontSize: "11px", fontFamily: "'Cormorant', serif", letterSpacing: "0.1em", color: "rgba(201,168,76,0.6)" }}>{CURRENCY}</span>
      </div>
      <div style={{ display: "flex", gap: "12px", marginTop: "7px" }}>
        <span style={{ fontFamily: "'Cormorant', serif", fontSize: "12.5px", color: "rgba(201,168,76,0.8)" }}>▲ {fmt(inAmt)}</span>
        <span style={{ fontFamily: "'Cormorant', serif", fontSize: "12.5px", color: "rgba(250,248,243,0.45)" }}>▼ {fmt(outAmt)}</span>
      </div>
    </div>
  );
}

/* ─── 14-day flow sparkline ─── */
function FlowChart({ txs }) {
  const days = useMemo(() => {
    const out = [];
    for (let i = 13; i >= 0; i--) {
      const key = dKey(daysAgo(i));
      let net = 0;
      txs.forEach((t) => { if (t.date === key) net += t.type === "in" ? t.amount : -t.amount; });
      out.push({ key, net });
    }
    return out;
  }, [txs]);

  const [hover, setHover] = useState(null);
  const max = Math.max(...days.map((d) => Math.abs(d.net)), 1);
  const W = 640, H = 120, mid = H / 2;
  const bw = W / 14;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }} onMouseLeave={() => setHover(null)}>
        <line x1="0" y1={mid} x2={W} y2={mid} stroke="rgba(201,168,76,0.25)" strokeWidth="1" strokeDasharray="3 4" />
        {days.map((d, i) => {
          const h = Math.abs(d.net) / max * (mid - 10);
          const isHov = hover === i;
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              {d.net !== 0 && (
                <rect
                  x={i * bw + bw * 0.28} width={bw * 0.44}
                  y={d.net > 0 ? mid - h : mid}
                  height={Math.max(h, 2)}
                  fill={GOLD}
                  opacity={d.net > 0 ? (isHov ? 1 : 0.85) : (isHov ? 0.55 : 0.32)}
                  style={{ transition: "opacity 0.2s" }}
                />
              )}
              {d.net === 0 && <circle cx={i * bw + bw / 2} cy={mid} r="1.5" fill="rgba(201,168,76,0.3)" />}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div style={{
          position: "absolute", top: "-8px", left: `${(hover + 0.5) / 14 * 100}%`, transform: "translateX(-50%)",
          background: "rgba(5,3,0,0.95)", border: "1px solid rgba(201,168,76,0.4)", borderRadius: "1px",
          padding: "5px 10px", whiteSpace: "nowrap", pointerEvents: "none",
        }}>
          <span style={{ fontFamily: "'Cormorant', serif", fontSize: "12px", color: "rgba(250,248,243,0.6)", marginRight: "8px" }}>
            {new Date(days[hover].key + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "13px", color: days[hover].net >= 0 ? GOLD_LIGHT : "rgba(250,248,243,0.8)" }}>
            {days[hover].net > 0 ? "+" : ""}{fmt(days[hover].net)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ APP ═══════════════════════ */
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [fin, setFin] = useState(() => store.load() || { txs: [] });
  const loaded = useRef(false);
  const [cloudReady, setCloudReady] = useState(false);

  // ── The Plan — mirrors this month's target/Earned figures from the main
  // app's Special Ashraf Finances Money page (The Process). We don't have
  // access to that codebase's goal/ledger logic here, so the main app
  // publishes a small summary to a shared key and we just read it. ──
  const PLAN_SUMMARY_KEY = "sa_finance_plan_current_month";
  const [planSummary, setPlanSummary] = useState(() => {
    try { const r = localStorage.getItem(PLAN_SUMMARY_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  });
  const [refreshingPlan, setRefreshingPlan] = useState(false);
  // Pulls both this app's own transaction log AND the main app's published
  // plan summary from the cloud in one go — one button, both refreshed.
  const refreshFromMainApp = () => {
    setRefreshingPlan(true);
    Promise.all([
      cloudLoad(PLAN_SUMMARY_KEY).then((remote) => {
        if (remote) {
          setPlanSummary(remote);
          try { localStorage.setItem(PLAN_SUMMARY_KEY, JSON.stringify(remote)); } catch { }
        }
      }),
      cloudLoad(LS_KEY).then((remote) => {
        if (remote && Array.isArray(remote.txs)) {
          setFin(remote);
          store.save(remote);
        }
      }),
    ]).finally(() => setRefreshingPlan(false));
  };
  useEffect(() => { refreshFromMainApp(); }, []);

  useEffect(() => {
    cloudLoad(LS_KEY).then((remote) => {
      if (remote && Array.isArray(remote.txs)) {
        setFin(remote);
        store.save(remote);
      }
      setCloudReady(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded.current) { loaded.current = true; return; }
    store.save(fin);
    if (cloudReady) cloudSave(LS_KEY, fin);
  }, [fin, cloudReady]);

  /* ─── Derived ─── */
  const txs = fin.txs;
  const balance = useMemo(() => txs.reduce((a, t) => a + (t.type === "in" ? t.amount : -t.amount), 0), [txs]);
  const invested = balance > 0 ? balance * INVEST_PCT : 0;
  const toSpend = balance > 0 ? balance * (1 - INVEST_PCT) : Math.max(balance, 0);

  const period = (filterFn) => {
    let inAmt = 0, outAmt = 0;
    txs.forEach((t) => { if (filterFn(t)) { if (t.type === "in") inAmt += t.amount; else outAmt += t.amount; } });
    return { inAmt, outAmt, net: inAmt - outAmt };
  };
  const tk = todayKey(), wk7 = dKey(daysAgo(6)), mk = monthKey();
  const pToday = period((t) => t.date === tk);
  const p7 = period((t) => t.date >= wk7);
  const pMonth = period((t) => t.date.startsWith(mk));
  const pAll = period(() => true);

  /* ─── Tracking form state ─── */
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [flow, setFlow] = useState("in");
  const [linkedGoal, setLinkedGoal] = useState("");

  const addTx = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    const tx = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: flow, amount: val,
      comment: comment.trim(),
      linkedGoal: flow === "out" ? (linkedGoal || null) : null,
      date: todayKey(),
      ts: Date.now(),
    };
    setFin((p) => ({ ...p, txs: [tx, ...p.txs] }));
    setAmount(""); setComment(""); setLinkedGoal("");
  };

  const deleteTx = (id) => setFin((p) => ({ ...p, txs: p.txs.filter((t) => t.id !== id) }));

  /* ─── Grouped ledger ─── */
  const grouped = useMemo(() => {
    const g = {};
    txs.forEach((t) => { (g[t.date] = g[t.date] || []).push(t); });
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [txs]);

  const dateLabel = (key) => {
    if (key === tk) return "Today";
    if (key === dKey(daysAgo(1))) return "Yesterday";
    return new Date(key + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  return (
    <div style={{ minHeight: "100vh", background: INK, color: CREAM, position: "relative" }}>
      <GlobalStyle />
      <LuxuryBg />

      <div className="sa-container" style={{ position: "relative", zIndex: 1, maxWidth: "880px", margin: "0 auto", padding: "0 22px 80px" }}>

        {/* ─── Header ─── */}
        <header className="sa-header" style={{ textAlign: "center", padding: "46px 0 30px" }}>
          <div className="sa-eyebrow" style={{ fontFamily: "'Cormorant', serif", fontSize: "12px", letterSpacing: "0.5em", textTransform: "uppercase", color: "rgba(201,168,76,0.7)", marginBottom: "10px" }}>Special Ashraf</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(30px, 5vw, 42px)", fontWeight: 600, letterSpacing: "0.06em", color: CREAM }}>
            F I N A N C E S
          </h1>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginTop: "14px" }}>
            <div style={{ width: "60px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.6))" }} />
            <span style={{ width: "6px", height: "6px", border: `1px solid ${GOLD}`, transform: "rotate(45deg)", display: "inline-block" }} />
            <div style={{ width: "60px", height: "1px", background: "linear-gradient(90deg, rgba(201,168,76,0.6), transparent)" }} />
          </div>
        </header>

        {/* ─── Nav ─── */}
        <nav className="sa-nav" style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "38px", flexWrap: "wrap" }}>
          {[["dashboard", "Dashboard"], ["tracking", "Tracking"], ["plan", "The Plan"]].map(([id, label]) => {
            const active = tab === id;
            return (
              <button key={id} className="sa-nav-btn" onClick={() => setTab(id)} style={{
                padding: "11px 34px", cursor: "pointer", background: active ? "rgba(201,168,76,0.1)" : "transparent",
                border: "none", borderBottom: `1px solid ${active ? GOLD : "rgba(201,168,76,0.15)"}`,
                fontFamily: "'Cormorant', serif", fontSize: "15px", fontWeight: 600,
                letterSpacing: "0.24em", textTransform: "uppercase",
                color: active ? GOLD_LIGHT : "rgba(250,248,243,0.4)",
                transition: "all 0.3s ease", flex: "0 1 auto",
              }}>{label}</button>
            );
          })}
        </nav>

        {/* ═══════════ DASHBOARD ═══════════ */}
        {tab === "dashboard" && (
          <div style={{ animation: "saFadeUp 0.45s ease" }}>

            {/* Actual balance */}
            <section className="sa-balance-section" style={{
              textAlign: "center", padding: "38px 20px 34px", marginBottom: "22px",
              border: "1px solid rgba(201,168,76,0.25)", borderRadius: "1px", position: "relative",
              background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 65%)",
            }}>
              <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "120px", height: "2px", background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, animation: "saGlowPulse 4s ease infinite" }} />
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: "12px", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(201,168,76,0.75)", marginBottom: "14px" }}>Actual Balance</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(42px, 8vw, 64px)", fontWeight: 600, color: GOLD_LIGHT, lineHeight: 1, textShadow: "0 0 40px rgba(201,168,76,0.25)" }}>
                {fmt(balance)}
              </div>
              <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "15px", letterSpacing: "0.2em", color: "rgba(201,168,76,0.7)", marginTop: "10px" }}>{CURRENCY}</div>
            </section>

            {/* 80 / 20 split */}
            <div className="sa-split-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "22px" }}>
              {[
                { label: "Invested", pct: "80%", val: invested, note: "Working capital — untouchable" },
                { label: "To Spend", pct: "20%", val: toSpend, note: "Living allocation" },
              ].map((c) => (
                <div key={c.label} className="sa-split-card" style={{
                  border: "1px solid rgba(201,168,76,0.2)", borderRadius: "1px", padding: "24px 24px 20px",
                  position: "relative", background: "linear-gradient(150deg, rgba(201,168,76,0.05) 0%, transparent 55%)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
                    <span style={{ fontFamily: "'Cormorant', serif", fontSize: "12px", letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(201,168,76,0.8)" }}>{c.label}</span>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: "14px", color: "rgba(201,168,76,0.55)" }}>{c.pct}</span>
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "30px", fontWeight: 600, color: CREAM }}>
                    {fmt(c.val)} <span style={{ fontSize: "12px", fontFamily: "'Cormorant', serif", letterSpacing: "0.12em", color: "rgba(201,168,76,0.6)" }}>{CURRENCY}</span>
                  </div>
                  <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "13.5px", color: "rgba(250,248,243,0.35)", marginTop: "8px" }}>{c.note}</div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, height: "2px", width: c.pct, maxWidth: "100%", background: `linear-gradient(90deg, ${GOLD}, transparent)`, opacity: 0.5 }} />
                </div>
              ))}
            </div>

            {/* Period indicators */}
            <div className="sa-period-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "26px" }}>
              <PeriodChip label="Daily" {...pToday} />
              <PeriodChip label="Last 7 Days" {...p7} />
              <PeriodChip label="This Month" {...pMonth} />
              <PeriodChip label="All Time" {...pAll} />
            </div>

            {/* Flow chart */}
            <section className="sa-flow-section" style={{ border: "1px solid rgba(201,168,76,0.18)", borderRadius: "1px", padding: "22px 22px 14px" }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: "11.5px", letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(201,168,76,0.75)", marginBottom: "18px" }}>
                Net Flow — Last 14 Days
              </div>
              <FlowChart txs={txs} />
            </section>
          </div>
        )}

        {/* ═══════════ THE PLAN ═══════════ */}
        {tab === "plan" && (
          <div style={{ animation: "saFadeUp 0.45s ease" }}>
            <div className="sa-plan-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "13px", color: "rgba(201,168,76,0.6)" }}>
                {planSummary ? planSummary.monthLabel : "—"} · from The Process
              </div>
              <button onClick={refreshFromMainApp} disabled={refreshingPlan} style={{
                background: "none", border: "1px solid rgba(201,168,76,0.3)", borderRadius: "1px",
                cursor: refreshingPlan ? "default" : "pointer", color: GOLD, fontSize: "11px", fontFamily: "'Cormorant', serif",
                letterSpacing: "0.14em", padding: "6px 14px", opacity: refreshingPlan ? 0.5 : 1,
              }}>{refreshingPlan ? "Refreshing…" : "↻ Refresh from Main App"}</button>
            </div>

            {!planSummary ? (
              <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "16px", color: "rgba(250,248,243,0.3)" }}>
                No plan published yet — open Special Ashraf Finances in The Process (main app) once to sync this month's target.
              </div>
            ) : (() => {
              const achieved = period((t) => t.date.startsWith(monthKey())).net;
              const pct = planSummary.target > 0 ? Math.round((achieved / planSummary.target) * 100) : 0;
              const pctColor = pct >= 100 ? GOLD_LIGHT : pct >= 60 ? "rgba(201,168,76,0.85)" : "rgba(250,248,243,0.6)";
              return (
                <>
                  <div className="sa-plan-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "22px" }}>
                    <div className="sa-plan-card" style={{
                      border: "1px solid rgba(201,168,76,0.2)", borderRadius: "1px", padding: "22px 22px 18px",
                      background: "linear-gradient(150deg, rgba(201,168,76,0.05) 0%, transparent 55%)",
                    }}>
                      <div style={{ fontFamily: "'Cormorant', serif", fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(201,168,76,0.75)", marginBottom: "10px" }}>This Month Target</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", fontWeight: 600, color: CREAM }}>
                        {fmt(planSummary.target)} <span style={{ fontSize: "12px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.6)" }}>{CURRENCY}</span>
                      </div>
                    </div>
                    <div className="sa-plan-card" style={{
                      border: "1px solid rgba(201,168,76,0.2)", borderRadius: "1px", padding: "22px 22px 18px",
                      background: "linear-gradient(150deg, rgba(201,168,76,0.05) 0%, transparent 55%)",
                    }}>
                      <div style={{ fontFamily: "'Cormorant', serif", fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(201,168,76,0.75)", marginBottom: "10px" }}>This Month Monthly Needed <span style={{ opacity: 0.6 }}>· "Earned"</span></div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", fontWeight: 600, color: CREAM }}>
                        {fmt(planSummary.monthlyNeeded)} <span style={{ fontSize: "12px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.6)" }}>{CURRENCY}</span>
                      </div>
                    </div>
                  </div>

                  <section className="sa-plan-achieved" style={{
                    textAlign: "center", padding: "34px 20px 30px", marginBottom: "22px",
                    border: "1px solid rgba(201,168,76,0.25)", borderRadius: "1px", position: "relative",
                    background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 65%)",
                  }}>
                    <div style={{ fontFamily: "'Cormorant', serif", fontSize: "12px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(201,168,76,0.75)", marginBottom: "12px" }}>Earned Achieved So Far</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px, 6vw, 52px)", fontWeight: 600, color: GOLD_LIGHT, lineHeight: 1 }}>
                      {fmt(achieved)} <span style={{ fontSize: "14px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.6)" }}>{CURRENCY}</span>
                    </div>
                    <div style={{ margin: "18px auto 0", width: "min(320px, 90%)" }}>
                      <div style={{ height: "6px", background: "rgba(250,248,243,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`, transition: "width 0.7s ease" }} />
                      </div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 600, color: pctColor, marginTop: "10px" }}>
                        {pct}% <span style={{ fontSize: "12px", fontFamily: "'Cormorant', serif", fontStyle: "italic", color: "rgba(201,168,76,0.55)" }}>of target</span>
                      </div>
                    </div>
                  </section>

                  <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "12.5px", color: "rgba(250,248,243,0.3)", textAlign: "center" }}>
                    Target and Monthly Needed come from The Process · Special Ashraf Finances. Achieved is this month's real "Money In" recorded here in Tracking.
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ═══════════ TRACKING ═══════════ */}
        {tab === "tracking" && (
          <div style={{ animation: "saFadeUp 0.45s ease" }}>

            {/* Entry form */}
            <section className="sa-form-section" style={{
              border: "1px solid rgba(201,168,76,0.25)", borderRadius: "1px", padding: "26px 26px 24px", marginBottom: "34px",
              background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 70%)",
            }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: "12px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(201,168,76,0.8)", marginBottom: "20px" }}>Record Movement</div>

              <FlowToggle value={flow} onChange={setFlow} />

              <div className="sa-form-row" style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
                <div style={{ flex: "0 0 180px", minWidth: "150px" }}>
                  <input
                    type="number" inputMode="decimal" value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTx()}
                    placeholder="Amount"
                    style={{
                      width: "100%", padding: "14px 16px", background: "rgba(250,248,243,0.03)",
                      border: "1px solid rgba(201,168,76,0.25)", borderRadius: "1px",
                      fontFamily: "'Playfair Display', serif", fontSize: "18px", color: GOLD_LIGHT,
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTx()}
                    placeholder="Comment — where from, where to…"
                    style={{
                      width: "100%", padding: "14px 16px", background: "rgba(250,248,243,0.03)",
                      border: "1px solid rgba(201,168,76,0.18)", borderRadius: "1px",
                      fontFamily: "'Cormorant', serif", fontSize: "16px", color: CREAM,
                    }}
                  />
                </div>
              </div>

              {flow === "out" && (
                <div style={{ marginTop: "12px" }}>
                  <select
                    value={linkedGoal}
                    onChange={(e) => setLinkedGoal(e.target.value)}
                    style={{
                      width: "100%", padding: "12px 14px", background: "rgba(250,248,243,0.03)",
                      border: "1px solid rgba(201,168,76,0.18)", borderRadius: "1px",
                      fontFamily: "'Cormorant', serif", fontStyle: linkedGoal ? "normal" : "italic",
                      fontSize: "14px", color: linkedGoal ? CREAM : "rgba(250,248,243,0.4)",
                      appearance: "none", cursor: "pointer",
                    }}
                  >
                    <option value="" style={{ background: INK, fontStyle: "italic" }}>Link to a 2026 Goal (optional)</option>
                    {LINKABLE_2026_GOALS.map((g) => (
                      <option key={g} value={g} style={{ background: INK, fontStyle: "normal" }}>{g}</option>
                    ))}
                  </select>
                </div>
              )}

              <button onClick={addTx} style={{
                marginTop: "16px", width: "100%", padding: "15px", cursor: "pointer",
                background: "linear-gradient(90deg, rgba(201,168,76,0.14), rgba(201,168,76,0.22), rgba(201,168,76,0.14))",
                border: `1px solid rgba(201,168,76,0.5)`, borderRadius: "1px",
                fontFamily: "'Cormorant', serif", fontSize: "15px", fontWeight: 600,
                letterSpacing: "0.3em", textTransform: "uppercase", color: GOLD_LIGHT,
                transition: "all 0.25s ease",
              }}>
                Record
              </button>
            </section>

            {/* Ledger */}
            {grouped.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 20px", fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "17px", color: "rgba(250,248,243,0.3)" }}>
                No movements yet. Record the first one above.
              </div>
            ) : grouped.map(([date, list]) => {
              const dayNet = list.reduce((a, t) => a + (t.type === "in" ? t.amount : -t.amount), 0);
              return (
                <div key={date} style={{ marginBottom: "28px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid rgba(201,168,76,0.15)" }}>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 500, letterSpacing: "0.06em", color: "rgba(201,168,76,0.9)" }}>{dateLabel(date)}</span>
                    <span style={{ fontFamily: "'Cormorant', serif", fontSize: "14px", color: dayNet >= 0 ? "rgba(201,168,76,0.8)" : "rgba(250,248,243,0.5)" }}>
                      {dayNet > 0 ? "+" : ""}{fmt(dayNet)} {CURRENCY}
                    </span>
                  </div>
                  {list.map((t) => (
                    <div key={t.id} className="sa-ledger-row" style={{
                      display: "flex", alignItems: "center", gap: "14px",
                      padding: "13px 16px", marginBottom: "8px",
                      border: `1px solid ${t.type === "in" ? "rgba(201,168,76,0.22)" : "rgba(250,248,243,0.1)"}`,
                      borderRadius: "1px",
                      background: t.type === "in" ? "linear-gradient(90deg, rgba(201,168,76,0.06), transparent 60%)" : "transparent",
                    }}>
                      <span style={{
                        width: "7px", height: "7px", flexShrink: 0, transform: "rotate(45deg)",
                        background: t.type === "in" ? GOLD : "transparent",
                        border: `1.5px solid ${t.type === "in" ? GOLD : "rgba(250,248,243,0.4)"}`,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Cormorant', serif", fontSize: "16px", color: CREAM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.comment || <span style={{ fontStyle: "italic", color: "rgba(250,248,243,0.3)" }}>No comment</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontFamily: "'Cormorant', serif", fontSize: "12px", letterSpacing: "0.12em", color: "rgba(250,248,243,0.3)" }}>
                            {new Date(t.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                          {t.linkedGoal && (
                            <span style={{
                              fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11px",
                              color: GOLD, border: `1px solid rgba(201,168,76,0.35)`, borderRadius: "1px",
                              padding: "1px 8px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              maxWidth: "220px",
                            }}>◆ {t.linkedGoal}</span>
                          )}
                        </div>
                      </div>
                      <div className="sa-ledger-amt" style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 600, color: t.type === "in" ? GOLD_LIGHT : "rgba(250,248,243,0.75)", whiteSpace: "nowrap" }}>
                        {t.type === "in" ? "+" : "−"}{fmt(t.amount)}
                      </div>
                      <button onClick={() => deleteTx(t.id)} title="Delete" style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        color: "rgba(250,248,243,0.25)", fontSize: "16px", padding: "4px 6px",
                        fontFamily: "'Cormorant', serif", transition: "color 0.2s",
                      }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "rgba(201,168,76,0.9)"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "rgba(250,248,243,0.25)"}
                      >×</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
