import React, { useState, useEffect, useMemo, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   SPECIAL ASHRAF — FINANCES
   Dark luxury · Gold · Cormorant / Playfair Display
   Data: single state object `fin` → localStorage (Supabase-ready)
   ═══════════════════════════════════════════════════════════════ */
// ═══════════════════════════════════════════════════════════════
// TRADING TAB — paste this whole block at top level, above your
// main App component. Requires GOLD, GOLD_LIGHT, INK, CREAM,
// CURRENCY, cloudLoad, cloudSave, fmt(n) to already exist in scope
// (same names your file already uses elsewhere).
// ═══════════════════════════════════════════════════════════════

const TRADING_LOSS_PCT_KEY = "sa_trading_loss_pcts"; // { daily, weekly, monthly }
const TRADING_READINESS_KEY_READ = "sa_trading_readiness_today"; // published by the main app
const MINDSET_RATINGS_KEY_READ = "sa_mindset_ratings"; // published by main/companion app
const FINANCE_START_DATE = new Date("2026-07-22"); // must match the main app's START_DATE

function TradingTab({ fin, setFin, capital, planSummary, dailyTarget, yearInAmt }) {
  const [tSubTab, setTSubTab] = useState("dashboard"); // "dashboard" | "tracking"
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [flow, setFlow] = useState("in");

  const [lossPcts, setLossPcts] = useState(() => {
    try { const r = localStorage.getItem(TRADING_LOSS_PCT_KEY); return r ? JSON.parse(r) : { daily: 2, weekly: 5, monthly: 10 }; }
    catch { return { daily: 2, weekly: 5, monthly: 10 }; }
  });
  const [editingLossPcts, setEditingLossPcts] = useState(false);

  const [readiness, setReadiness] = useState(null); // { completionRateUntilNow } — published by the main app
  const [moodPct, setMoodPct] = useState(null); // null = data unavailable, excluded from checklist rather than guessed

  // Salat / Duaa are manual checkboxes now, not derived — reset each day.
  const TRADING_MANUAL_KEY = "sa_trading_manual_checks";
  const [manualChecks, setManualChecks] = useState(() => {
    try {
      const r = JSON.parse(localStorage.getItem(TRADING_MANUAL_KEY) || "{}");
      const todayKey = new Date().toISOString().slice(0, 10);
      return r.date === todayKey ? r : { date: todayKey, salat: false, duaa: false };
    } catch { return { date: new Date().toISOString().slice(0, 10), salat: false, duaa: false }; }
  });
  const toggleManualCheck = (key) => {
    setManualChecks((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(TRADING_MANUAL_KEY, JSON.stringify(next)); } catch { }
      cloudSave(TRADING_MANUAL_KEY, next);
      return next;
    });
  };

  useEffect(() => {
    cloudLoad(TRADING_LOSS_PCT_KEY).then((remote) => {
      if (remote && typeof remote === "object") {
        setLossPcts(remote);
        try { localStorage.setItem(TRADING_LOSS_PCT_KEY, JSON.stringify(remote)); } catch { }
      }
    });
    const pull = () => {
      cloudLoad(TRADING_READINESS_KEY_READ).then((r) => { if (r) setReadiness(r); });
      // Mood schema is a best-effort read — if the shape doesn't match what's
      // expected, moodPct stays null and the checklist item is simply
      // excluded from scoring rather than silently guessed as pass/fail.
      cloudLoad("sa_live_mood").then((r) => {
        // Only trust it if it was published recently (Mood tab needs to be
        // open for it to update) — otherwise it's a stale reading, and
        // showing "data unavailable" is more honest than a wrong old number.
        if (r && typeof r.mood === "number" && r.updatedAt && Date.now() - r.updatedAt < 10 * 60 * 1000) {
          setMoodPct(Math.round(r.mood));
        }
      });
    };
    pull();
    const iv = setInterval(pull, 60000);
    return () => clearInterval(iv);
  }, []);

  const saveLossPcts = (next) => {
    setLossPcts(next);
    try { localStorage.setItem(TRADING_LOSS_PCT_KEY, JSON.stringify(next)); } catch { }
    cloudSave(TRADING_LOSS_PCT_KEY, next);
  };

  const addTradingTx = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    const tx = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: flow, amount: val,
      comment: comment.trim(),
      incomeType: "Trading",
      date: new Date().toISOString().slice(0, 10),
      ts: Date.now(),
    };
    setFin((p) => ({ ...p, txs: [tx, ...p.txs] }));
    setAmount(""); setComment("");
  };

  // ── Trading-only figures ──
  const txs = fin.txs || [];
  const tradingTxs = txs.filter((t) => t.incomeType === "Trading");
  const totalBalance = (capital || 0) + tradingTxs.reduce((s, t) => s + (t.type === "in" ? t.amount : -t.amount), 0);
  const moneyInAll = tradingTxs.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const moneyOutAll = tradingTxs.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0);

  const todayKey = new Date().toISOString().slice(0, 10);
  const weekAgoKey = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })();
  const monthKey = todayKey.slice(0, 7);

  const netFor = (pred) => {
    const list = tradingTxs.filter(pred);
    const inAmt = list.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0);
    const outAmt = list.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0);
    return { in: inAmt, out: outAmt, net: inAmt - outAmt };
  };
  const dayStats = netFor((t) => t.date === todayKey);
  const weekStats = netFor((t) => t.date >= weekAgoKey);
  const monthStats = netFor((t) => t.date && t.date.startsWith(monthKey));
  const yearStats = planSummary?.yearRangeStartISO
    ? netFor((t) => t.date >= planSummary.yearRangeStartISO && t.date < planSummary.yearRangeEndISO)
    : { in: 0, out: 0, net: 0 };
  const tradesToday = tradingTxs.filter((t) => t.date === todayKey).length;

  const dailyLossLimit = Math.round(totalBalance * (lossPcts.daily / 100));
  const weeklyLossLimit = Math.round(totalBalance * (lossPcts.weekly / 100));
  const monthlyLossLimit = Math.round(totalBalance * (lossPcts.monthly / 100));

  // ── Checklist — each item is a pass/fail, contributing an equal share of 100% ──
  const checklist = [
    { label: "Salat is done", checked: !!manualChecks.salat, available: true, manualKey: "salat" },
    { label: "Duaa is done", checked: !!manualChecks.duaa, available: true, manualKey: "duaa" },
    { label: moodPct != null ? `Mood is ${moodPct}%` : "Mood", checked: (moodPct ?? 0) >= 80, available: moodPct != null },
    { label: readiness?.completionRateUntilNow != null ? `Completion rate today is ${readiness.completionRateUntilNow}%` : "Completion rate today", checked: (readiness?.completionRateUntilNow ?? 0) >= 80, available: readiness != null },
    { label: "Number of trades today", checked: tradesToday < 3, available: true, value: tradesToday, target: 3, pct: Math.round((tradesToday / 3) * 100) },
    { label: "Daily loss limit", checked: dayStats.out <= dailyLossLimit, available: true, value: dayStats.out, target: dailyLossLimit, pct: dailyLossLimit > 0 ? Math.round((dayStats.out / dailyLossLimit) * 100) : 0 },
    { label: "Weekly loss limit", checked: weekStats.out <= weeklyLossLimit, available: true, value: weekStats.out, target: weeklyLossLimit, pct: weeklyLossLimit > 0 ? Math.round((weekStats.out / weeklyLossLimit) * 100) : 0 },
    { label: "Monthly loss limit", checked: monthStats.out <= monthlyLossLimit, available: true, value: monthStats.out, target: monthlyLossLimit, pct: monthlyLossLimit > 0 ? Math.round((monthStats.out / monthlyLossLimit) * 100) : 0 },
  ];
  const scoredItems = checklist.filter((c) => c.available);
  const checkedCount = scoredItems.filter((c) => c.checked).length;
  const readinessPct = scoredItems.length ? Math.round((checkedCount / scoredItems.length) * 100) : 0;
  const ableToTrade = readinessPct >= 80;

  return (
    <div style={{ animation: "saFadeUp 0.45s ease" }}>
      <>
        {/* Status */}
        <div style={{
          textAlign: "center", padding: "2rem 1rem", marginBottom: "1.75rem",
          border: `1px solid ${ableToTrade ? "rgba(74,124,89,0.4)" : "rgba(192,57,43,0.4)"}`, borderRadius: "1px",
          background: ableToTrade ? "radial-gradient(ellipse at 50% 0%, rgba(74,124,89,0.1) 0%, transparent 65%)" : "radial-gradient(ellipse at 50% 0%, rgba(192,57,43,0.1) 0%, transparent 65%)",
        }}>
          <div style={{ fontFamily: "'Cormorant', serif", fontSize: "11px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(201,168,76,0.7)", marginBottom: "10px" }}>Status</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 900, color: ableToTrade ? "#4A7C59" : "#C0392B", lineHeight: 1 }}>
            {ableToTrade ? "ABLE TO TRADE" : "NOT ABLE TO TRADE"}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 700, color: ableToTrade ? "#4A7C59" : "#C0392B", marginTop: "8px" }}>
            {readinessPct}% collected
          </div>
        </div>

        {/* Balance + In/Out */}
        <div className="sa-balance-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "28px", maxWidth: "560px", margin: "0 auto 1.25rem" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11px", color: "rgba(201,168,76,0.6)" }}>Actual Balance · Trading</div>
            <div className="sa-balance-value" style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 700, color: CREAM, whiteSpace: "nowrap" }}>{Math.round(totalBalance).toLocaleString()} <span style={{ fontSize: "11px", fontWeight: 600 }}>MAD</span></div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11px", color: "rgba(201,168,76,0.6)" }}>Money In · Trading</div>
            <div className="sa-balance-value" style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 700, color: "#4A7C59", whiteSpace: "nowrap" }}>+{Math.round(moneyInAll).toLocaleString()} <span style={{ fontSize: "10px", fontWeight: 600 }}>MAD</span></div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11px", color: "rgba(201,168,76,0.6)" }}>Money Out · Trading</div>
            <div className="sa-balance-value" style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 700, color: "#C0392B", whiteSpace: "nowrap" }}>−{Math.round(moneyOutAll).toLocaleString()} <span style={{ fontSize: "10px", fontWeight: 600 }}>MAD</span></div>
          </div>
        </div>

        {/* Profit targets */}
        <div className="sa-profit-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "28px", maxWidth: "560px", margin: "0 auto 1.75rem" }}>
          {[
            { label: "Daily Profit", stats: dayStats, target: dailyTarget },
            { label: "Monthly Profit", stats: monthStats, target: planSummary?.target },
            { label: "Yearly Profit", stats: yearStats, target: planSummary?.yearSurplusTarget },
          ].map(({ label, stats, target }) => {
            const hasTarget = target != null && target > 0;
            const pct = hasTarget ? Math.round((stats.net / target) * 100) : null;
            const color = stats.net >= 0 ? "#4A7C59" : "#C0392B";
            return (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11px", color: "rgba(201,168,76,0.6)" }}>{label}</div>
                <div className="sa-profit-value" style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 700, color, whiteSpace: "nowrap" }}>
                  {Math.round(stats.net).toLocaleString()}{hasTarget ? ` / ${Math.round(target).toLocaleString()}` : ""} <span style={{ fontSize: "10px" }}>MAD</span>
                </div>
                {hasTarget && (
                  <div style={{ marginTop: "3px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ height: "3px", width: "90px", background: "rgba(201,168,76,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: color, transition: "width 0.7s ease" }} />
                    </div>
                    <span style={{ fontFamily: "'Cormorant', serif", fontSize: "10px", color, marginTop: "1px" }}>{pct}%</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Loss limit % settings */}
        <div style={{ border: "1px solid rgba(201,168,76,0.2)", borderRadius: "1px", padding: "1.25rem 1.5rem", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontFamily: "'Cormorant', serif", fontSize: "10.5px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)" }}>Loss Limits · % of Total Balance</span>
            <button onClick={() => setEditingLossPcts((v) => !v)} style={{ background: "none", border: "1px solid rgba(201,168,76,0.3)", borderRadius: "1px", color: GOLD, fontSize: "10px", fontFamily: "'Cormorant', serif", padding: "4px 10px", cursor: "pointer" }}>
              {editingLossPcts ? "Done" : "✎ Change"}
            </button>
          </div>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            {[["daily", "Daily", dailyLossLimit], ["weekly", "Weekly", weeklyLossLimit], ["monthly", "Monthly", monthlyLossLimit]].map(([key, label, limitMAD]) => (
              <div key={key} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11px", color: "rgba(201,168,76,0.55)" }}>{label}</div>
                {editingLossPcts ? (
                  <input
                    type="number" step="0.5" defaultValue={lossPcts[key]}
                    onBlur={(e) => saveLossPcts({ ...lossPcts, [key]: Math.max(0, parseFloat(e.target.value) || 0) })}
                    style={{ width: "70px", textAlign: "center", background: "rgba(250,248,243,0.03)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: "1px", color: CREAM, fontFamily: "'Playfair Display', serif", fontSize: "14px", padding: "4px" }}
                  />
                ) : (
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "15px", fontWeight: 700, color: CREAM }}>{lossPcts[key]}%</div>
                )}
                <div style={{ fontFamily: "'Cormorant', serif", fontSize: "10px", color: "rgba(201,168,76,0.45)", marginTop: "2px" }}>≈ {limitMAD.toLocaleString()} MAD</div>
              </div>
            ))}
          </div>
        </div>

        {/* Checklist */}
        <div style={{ border: "1px solid rgba(201,168,76,0.2)", borderRadius: "1px", padding: "1.25rem 1.5rem" }}>
          <div style={{ fontFamily: "'Cormorant', serif", fontSize: "10.5px", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", marginBottom: "14px" }}>Checklist</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {checklist.map((c, i) => (
              <div key={i} onClick={c.manualKey ? () => toggleManualCheck(c.manualKey) : undefined} style={{
                padding: "4px 10px", textAlign: "center",
                border: `1px solid ${!c.available ? "rgba(201,168,76,0.12)" : c.checked ? "rgba(74,124,89,0.3)" : "rgba(192,57,43,0.25)"}`,
                background: !c.available ? "rgba(201,168,76,0.02)" : c.checked ? "rgba(74,124,89,0.05)" : "rgba(192,57,43,0.04)",
                borderRadius: "1px", opacity: c.available ? 1 : 0.5,
                cursor: c.manualKey ? "pointer" : "default",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  <span style={{ fontSize: "12px", flexShrink: 0, color: !c.available ? "rgba(201,168,76,0.4)" : c.checked ? "#4A7C59" : "#C0392B" }}>
                    {!c.available ? "—" : c.checked ? "✓" : "✕"}
                  </span>
                  <span style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontWeight: 600, fontSize: "12.5px", background: "linear-gradient(160deg, #F5D98B 0%, #C9A84C 45%, #7A5C0A 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{c.label}</span>
                  {!c.available && <span style={{ fontFamily: "'Cormorant', serif", fontSize: "10px", color: "rgba(201,168,76,0.4)" }}>data unavailable</span>}
                </div>
                {c.available && c.target !== undefined && (
                  <div style={{ marginTop: "1px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ height: "3px", width: "180px", background: "rgba(201,168,76,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, c.pct))}%`, background: c.checked ? "#4A7C59" : "#C0392B", transition: "width 0.7s ease" }} />
                    </div>
                    <span style={{ fontFamily: "'Cormorant', serif", fontSize: "10.5px", color: c.checked ? "#4A7C59" : "#C0392B", whiteSpace: "nowrap", marginTop: "1px" }}>
                      {c.target !== null
                        ? <>{Math.round(c.value).toLocaleString()}/{Math.round(c.target).toLocaleString()} MAD · {c.pct}%</>
                        : <>{c.value >= 0 ? "+" : ""}{Math.round(c.value).toLocaleString()} MAD</>
                      }
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </>
    </div>
  );
}

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
const TX_TYPES_KEY_IN = "sa_tx_types_in";
const TX_TYPES_KEY_OUT = "sa_tx_types_out";
const DEFAULT_TX_TYPES_IN = ["Trading", "Business", "Family", "Other"];
const DEFAULT_TX_TYPES_OUT = ["Trading", "Shopping", "Bills", "Transport", "Loan", "Other"];

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
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { }
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
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Cormorant:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Cinzel:wght@400;500;600;700;900&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body, #root { min-height: 100%; background: ${INK}; }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.3); border-radius: 1px; }
      input, textarea, button { font-family: inherit; outline: none; }
      input::placeholder, textarea::placeholder { color: rgba(250,248,243,0.25); font-style: italic; }
      body, .sa-container { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      input, textarea { -webkit-user-select: text; user-select: text; }
      input[type="number"] { -moz-appearance: textfield; }
      input[type="number"]::-webkit-inner-spin-button,
      input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      @keyframes saFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes saDiamond { from { transform: rotate(0deg) scale(0.6); opacity: 0; } to { transform: rotate(45deg) scale(1); opacity: 1; } }
      @keyframes saGlowPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
      @keyframes saShimmer { 0% { background-position: 0% center; } 100% { background-position: -300% center; } }
      .sa-gold-shimmer {
        background: linear-gradient(100deg, #3D2B06 0%, #6B4E0A 12%, #8B6914 22%, #6B4E0A 32%, #3D2B06 42%, #6B4E0A 54%, #A8842E 64%, #6B4E0A 74%, #3D2B06 84%, #6B4E0A 92%, #3D2B06 100%);
        background-size: 300% auto;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: saShimmer 30s linear infinite;
      }
      @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }

      /* ── Mobile ── */
      @media (max-width: 600px) {
        .sa-container { padding: 0 calc(14px + env(safe-area-inset-right)) calc(116px + env(safe-area-inset-bottom)) calc(14px + env(safe-area-inset-left)) !important; }
        .sa-header { padding: calc(28px + env(safe-area-inset-top)) 0 20px !important; }
        .sa-eyebrow { font-size: 9px !important; letter-spacing: 0.32em !important; }
        .sa-nav {
          gap: 4px !important; flex-wrap: nowrap !important; width: 100% !important;
          position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important;
          margin-bottom: 0 !important; z-index: 50 !important;
          background: rgba(5,3,0,0.96) !important;
          backdrop-filter: blur(12px) !important; -webkit-backdrop-filter: blur(12px) !important;
          border-top: 1px solid rgba(201,168,76,0.25) !important;
          padding: 6px calc(4px + env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) calc(4px + env(safe-area-inset-left)) !important;
        }
        .sa-nav-btn { flex: 1 1 0 !important; padding: 9px 4px !important; font-size: 9.5px !important; letter-spacing: 0.02em !important; white-space: nowrap !important; }
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
        .sa-yearly-split { flex-direction: column !important; gap: 20px !important; }
        .sa-yearly-split > div { flex: 0 1 auto !important; }
        .sa-yearly-divider { width: 100% !important; height: 1px !important; margin: 0 auto !important; }
        .sa-filter-row { gap: 6px !important; }
        .sa-icon-btn { width: 32px !important; height: 34px !important; font-size: 13px !important; }
        .sa-flow-filter-group { flex: 1 1 0 !important; min-width: 0 !important; }
        .sa-flow-filter-btn { flex: 1 1 0 !important; padding: 8px 4px !important; font-size: 9.5px !important; letter-spacing: 0.02em !important; white-space: nowrap !important; }
        .sa-profit-grid { gap: 6px !important; }
        .sa-profit-value { font-size: 11px !important; }
        .sa-profit-value span { font-size: 8px !important; }
        .sa-balance-grid { gap: 6px !important; }
        .sa-balance-value { font-size: 15px !important; }
        .sa-balance-value span { font-size: 8.5px !important; }
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
      {[["12px", "12px", "0,10 0,0 10,0"], ["12px", null, "10,0 20,0 20,10"], [null, "12px", "0,10 0,20 10,20"], [null, null, "10,20 20,20 20,10"]].map(([top, left, pts], i) => (
        <svg key={i} width="20" height="20" style={{ position: "absolute", top: top || "auto", bottom: top ? "auto" : "12px", left: left || "auto", right: left ? "auto" : "12px", opacity: 0.5 }}>
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
        ...(pos
          ? {
              background: "linear-gradient(160deg, #F5D98B 0%, #C9A84C 45%, #7A5C0A 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }
          : { color: neg ? "rgba(250,248,243,0.85)" : "rgba(250,248,243,0.45)" }),
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

  /* ─── Capital — set in the main app (The Process → Special Ashraf
     Finances), read-only here. Added on top of the running transaction
     total but NEVER counted as money in or out: every in/out/net figure
     below still comes purely from txs. If every transaction is deleted,
     the balance floor is this capital, not 0. ─── */
  const CAPITAL_KEY = "sa_capital";
  const [capital, setCapital] = useState(() => {
    try { const r = localStorage.getItem(CAPITAL_KEY); return r ? parseFloat(r) || 0 : 0; } catch { return 0; }
  });
  useEffect(() => {
    const pull = () => cloudLoad(CAPITAL_KEY).then((remote) => {
      if (typeof remote === "number") {
        setCapital(remote);
        try { localStorage.setItem(CAPITAL_KEY, String(remote)); } catch { }
      }
    });
    pull();
    const iv = setInterval(pull, 60000);
    return () => clearInterval(iv);
  }, []);

  /* ─── Derived ─── */
  const txs = fin.txs;
  const txsBalance = useMemo(() => txs.reduce((a, t) => a + (t.type === "in" ? t.amount : -t.amount), 0), [txs]);
  const balance = capital + txsBalance;
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

  // ── Working days (Mon–Fri) left in the current month, today counted as
  // still remaining if it's itself a weekday. Computed first since Daily
  // Target now divides by this real count instead of a flat 20. ──
  const workingDaysLeft = (() => {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let d = now.getDate(); d <= lastDay; d++) {
      const dow = new Date(year, month, d).getDay(); // 0 Sun … 6 Sat
      if (dow >= 1 && dow <= 5) count++;
    }
    return count;
  })();

  // ── Daily Target InshaALLAH SWT ──
  // (This Month Target − money already made this month, NOT counting today)
  // ÷ real workdays left this month (Mon–Fri only, weekends excluded) — not
  // a flat 20, so the target genuinely tightens as the month's real
  // remaining business days shrink. Frozen for the whole calendar day —
  // today's own earnings don't move the target mid-day, they only move the
  // "done today" side of the ratio below. Naturally flips at midnight since
  // it's keyed off tk/mk (and workingDaysLeft recomputes from the real date).
  const achievedBeforeToday = period((t) => t.date.startsWith(mk) && t.date !== tk).net;
  const dailyTarget = planSummary && planSummary.target != null && workingDaysLeft > 0
    ? Math.max(0, (planSummary.target - achievedBeforeToday) / workingDaysLeft)
    : null;

  const doneTodayMAD = pToday.net;
  const dailyPct = dailyTarget && dailyTarget > 0
    ? Math.round((doneTodayMAD / dailyTarget) * 100)
    : (doneTodayMAD > 0 ? 100 : 0);
  const dailyPctColor = dailyPct >= 100 ? GOLD_LIGHT : dailyPct >= 60 ? "rgba(201,168,76,0.85)" : "rgba(250,248,243,0.6)";

  // ── Tomorrow's target — same formula, but with today's earnings folded
  // into "already made this month" once today is done, and one fewer
  // workday remaining (tomorrow itself is excluded if it's a weekday, since
  // by definition it's the day being targeted, not a day "left before it").
  const workingDaysLeftAfterToday = Math.max(0, workingDaysLeft - (([0, 6].includes(new Date().getDay())) ? 0 : 1));
  const tomorrowTarget = planSummary && planSummary.target != null && workingDaysLeftAfterToday > 0
    ? Math.max(0, (planSummary.target - (achievedBeforeToday + doneTodayMAD)) / workingDaysLeftAfterToday)
    : null;

  // ── Monthly Target — money earned this month vs This Month Target ──
  const monthlyPct = planSummary && planSummary.target > 0
    ? Math.round((pMonth.net / planSummary.target) * 100)
    : 0;
  const monthlyPctColor = monthlyPct >= 100 ? GOLD_LIGHT : monthlyPct >= 60 ? "rgba(201,168,76,0.85)" : "rgba(250,248,243,0.6)";

  // ── Yearly Target — money in during the rolling "this age" window vs
  // Total Surplus target, and actual balance vs Balance-at-End-of-Age target.
  const yearInAmt = (planSummary && planSummary.yearRangeStartISO)
    ? txs.filter((t) => t.type === "in" && t.date >= planSummary.yearRangeStartISO && t.date < planSummary.yearRangeEndISO)
      .reduce((s, t) => s + t.amount, 0)
    : 0;
  const yearSurplusPct = planSummary && planSummary.yearSurplusTarget > 0
    ? Math.round((yearInAmt / planSummary.yearSurplusTarget) * 100) : 0;
  const yearBalancePct = planSummary && planSummary.yearEndBalanceTarget > 0
    ? Math.round((balance / planSummary.yearEndBalanceTarget) * 100) : 0;
  const yearSurplusColor = yearSurplusPct >= 100 ? GOLD_LIGHT : yearSurplusPct >= 60 ? "rgba(201,168,76,0.85)" : "rgba(250,248,243,0.6)";
  const yearBalanceColor = yearBalancePct >= 100 ? GOLD_LIGHT : yearBalancePct >= 60 ? "rgba(201,168,76,0.85)" : "rgba(250,248,243,0.6)";

  // ── Spending vs the 20% "To Spend" allowance ──
  // Shows money out against the allowance that period's earnings justify
  // (money in × 20%), plus the raw difference underneath.
  const spendFor = (pred) => {
    const p = period(pred);
    const allowance = p.inAmt * 0.20;
    return { out: p.outAmt, allowance, diff: p.outAmt - allowance };
  };

  // ── Daily allowance ──
  // This month's 20% allowance, capped at This Month Target, minus whatever
  // has already gone out this month before today — i.e. what's genuinely
  // left to spend today rather than a flat share.
  // The spending "day" runs 6am → 6am, not midnight → midnight: anything
  // logged between midnight and 5:59am still belongs to the previous day.
  const spendingDayKey = (() => {
    const now = new Date();
    if (now.getHours() < 6) now.setDate(now.getDate() - 1);
    return now.toISOString().slice(0, 10);
  })();
  const isTodaySpending = (t) => {
    if (!t.ts) return t.date === spendingDayKey;
    const d = new Date(t.ts);
    if (d.getHours() < 6) d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10) === spendingDayKey;
  };

  const monthIn = period((t) => t.date && t.date.startsWith(monthKey())).inAmt;
  const monthAllowanceCapped = planSummary?.monthlyNeeded != null
    ? Math.min(monthIn * 0.20, planSummary.monthlyNeeded)
    : monthIn * 0.20; 3
  const outThisMonthExceptToday = period((t) => t.date && t.date.startsWith(monthKey()) && !isTodaySpending(t)).outAmt;
  const outToday = period(isTodaySpending).outAmt;
  const dailyRemainingAllowance = monthAllowanceCapped - outThisMonthExceptToday;
  const dailyPctOfMonthAllowance = monthAllowanceCapped > 0
    ? Math.round((outToday / monthAllowanceCapped) * 100)
    : 0;
  const spendRows = [
    { label: "All Time", sub: "Special Ashraf Journey", data: spendFor(() => true) },
    {
      label: "Yearly",
      sub: String(new Date().getFullYear()),
      // Resets every calendar year. Allowance is capped at This Month
      // Needed × every month that's happened so far this year (Jan through
      // the current month, inclusive) — not the raw 20%-of-earnings figure.
      data: (() => {
        const curYear = new Date().getFullYear();
        const curMonth = new Date().getMonth() + 1; // 1-12
        // The first year of tracking counts from whichever month real data
        // actually starts (e.g. Aug 2026 = month 1, Sep 2026 = month 2, …).
        // Every year after that is a full calendar year, so it counts from
        // January like normal (Jan 2027 = month 1, Feb 2027 = month 2, …).
        const firstTxDate = txs.length ? txs.reduce((min, t) => (t.date < min ? t.date : min), txs[0].date) : null;
        const firstTxYear = firstTxDate ? parseInt(firstTxDate.slice(0, 4), 10) : curYear;
        const firstTxMonth = firstTxDate ? parseInt(firstTxDate.slice(5, 7), 10) : curMonth;
        const monthsElapsed = curYear === firstTxYear ? (curMonth - firstTxMonth + 1) : curMonth;

        const pYear = period((t) => t.date && t.date.startsWith(String(curYear)));
        const rawAllowance = pYear.inAmt * 0.20;
        const cap = planSummary?.monthlyNeeded != null ? planSummary.monthlyNeeded * monthsElapsed : null;
        const allowance = cap != null ? Math.min(rawAllowance, cap) : rawAllowance;
        return { out: pYear.outAmt, allowance, diff: pYear.outAmt - allowance };
      })(),
    },
    {
      label: "Monthly",
      sub: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      data: (() => {
        const p = period((t) => t.date && t.date.startsWith(monthKey()));
        const rawAllowance = p.inAmt * 0.20;
        const allowance = planSummary?.monthlyNeeded != null ? Math.min(rawAllowance, planSummary.monthlyNeeded) : rawAllowance;
        return { out: p.outAmt, allowance, diff: p.outAmt - allowance };
      })(),
    },
    {
      label: "Daily",
      sub: new Date(spendingDayKey + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      data: { out: outToday, allowance: dailyRemainingAllowance, diff: outToday - dailyRemainingAllowance },
      showPct: dailyPctOfMonthAllowance,
    },
  ];

  /* ─── Tracking form state ─── */
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [flow, setFlow] = useState("in");
  const [incomeType, setIncomeType] = useState("");
  const [txTypeAttempted, setTxTypeAttempted] = useState(false); // shows the required-cue only after a failed submit, not on first load
  const [txTypesIn, setTxTypesIn] = useState(() => {
    try { const r = localStorage.getItem(TX_TYPES_KEY_IN); return r ? JSON.parse(r) : DEFAULT_TX_TYPES_IN; } catch { return DEFAULT_TX_TYPES_IN; }
  });
  const [txTypesOut, setTxTypesOut] = useState(() => {
    try { const r = localStorage.getItem(TX_TYPES_KEY_OUT); return r ? JSON.parse(r) : DEFAULT_TX_TYPES_OUT; } catch { return DEFAULT_TX_TYPES_OUT; }
  });
  const [addingNewType, setAddingNewType] = useState(false);
  const [newTypeDraft, setNewTypeDraft] = useState("");

  useEffect(() => {
    cloudLoad(TX_TYPES_KEY_IN).then((remote) => {
      if (Array.isArray(remote) && remote.length) {
        setTxTypesIn(remote);
        try { localStorage.setItem(TX_TYPES_KEY_IN, JSON.stringify(remote)); } catch { }
      }
    });
    cloudLoad(TX_TYPES_KEY_OUT).then((remote) => {
      if (Array.isArray(remote) && remote.length) {
        setTxTypesOut(remote);
        try { localStorage.setItem(TX_TYPES_KEY_OUT, JSON.stringify(remote)); } catch { }
      }
    });
  }, []);

  const txTypes = flow === "in" ? txTypesIn : txTypesOut;
  const commitNewType = () => {
    const name = newTypeDraft.trim();
    if (!name) { setAddingNewType(false); return; }
    const key = flow === "in" ? TX_TYPES_KEY_IN : TX_TYPES_KEY_OUT;
    const setter = flow === "in" ? setTxTypesIn : setTxTypesOut;
    setter((prev) => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { }
      cloudSave(key, next);
      return next;
    });
    setIncomeType(name);
    setNewTypeDraft("");
    setAddingNewType(false);
  };

  const addTx = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    if (!incomeType) { setTxTypeAttempted(true); return; } // type is mandatory now, for both flows
    const tx = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: flow, amount: val,
      comment: comment.trim(),
      incomeType,
      date: todayKey(),
      ts: Date.now(),
    };
    setFin((p) => ({ ...p, txs: [tx, ...p.txs] }));
    setAmount(""); setComment(""); setIncomeType(""); setTxTypeAttempted(false);
  };

  const deleteTx = (id) => setFin((p) => ({ ...p, txs: p.txs.filter((t) => t.id !== id) }));

  /* ─── Search + sort ───
     Independent Year / Month / Day pickers in a calendar-style panel — any
     subset can be set: month only, month+day (any year), year only, or all
     three, or none (shows everything). Each field is matched only if set. */
  const [sortBy, setSortBy] = useState("newest");
  const [filterYear, setFilterYear] = useState("");   // "YYYY" or ""
  const [filterMonth, setFilterMonth] = useState("");  // "01".."12" or ""
  const [filterDay, setFilterDay] = useState("");     // "01".."31" or ""
  const [datePanelOpen, setDatePanelOpen] = useState(false);
  const [sortPanelOpen, setSortPanelOpen] = useState(false);

  const [flowFilter, setFlowFilter] = useState("all"); // "all" | "in" | "out"

  const matchesSearch = (t) => {
    if (flowFilter !== "all" && t.type !== flowFilter) return false;
    if (filterYear && t.date.slice(0, 4) !== filterYear) return false;
    if (filterMonth && t.date.slice(5, 7) !== filterMonth) return false;
    if (filterDay && t.date.slice(8, 10) !== filterDay) return false;
    return true;
  };

  const filteredTxs = useMemo(() => txs.filter(matchesSearch), [txs, filterYear, filterMonth, filterDay, flowFilter]);

  const availableYears = useMemo(() => {
    const s = new Set(txs.map((t) => t.date.slice(0, 4)));
    const arr = Array.from(s).sort((a, b) => b.localeCompare(a));
    const thisYear = String(new Date().getFullYear());
    if (!arr.includes(thisYear)) arr.unshift(thisYear);
    return arr;
  }, [txs]);

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const daysInSelectedMonth = filterMonth ? new Date(2024, parseInt(filterMonth, 10), 0).getDate() : 31;

  const dateFilterSummary = (() => {
    const parts = [];
    if (filterMonth) parts.push(MONTH_NAMES[parseInt(filterMonth, 10) - 1]);
    if (filterDay) parts.push(filterDay);
    if (filterYear) parts.push(filterYear);
    return parts.length ? parts.join(" ") : null;
  })();

  const sortedTxs = useMemo(() => {
    const arr = [...filteredTxs];
    if (sortBy === "oldest") arr.sort((a, b) => a.ts - b.ts);
    else if (sortBy === "amount_high") arr.sort((a, b) => b.amount - a.amount);
    else if (sortBy === "amount_low") arr.sort((a, b) => a.amount - b.amount);
    else arr.sort((a, b) => b.ts - a.ts); // newest
    return arr;
  }, [filteredTxs, sortBy]);

  const isAmountSort = sortBy === "amount_high" || sortBy === "amount_low";

  /* ─── Grouped ledger — only used for date-based sorts; amount sorts show
     a flat list instead, since amount ordering cuts across day groups. ─── */
  const grouped = useMemo(() => {
    if (isAmountSort) return null;
    const g = {};
    sortedTxs.forEach((t) => { (g[t.date] = g[t.date] || []).push(t); });
    return Object.entries(g).sort((a, b) => sortBy === "oldest" ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0]));
  }, [sortedTxs, sortBy, isAmountSort]);

  const dateLabel = (key) => {
    if (key === tk) return "Today";
    if (key === dKey(daysAgo(1))) return "Yesterday";
    return new Date(key + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  return (
    <div style={{ minHeight: "100vh", background: INK, color: CREAM, position: "relative" }}>
      <GlobalStyle />
      <LuxuryBg />

      <div className="sa-container" style={{ position: "relative", zIndex: 1, maxWidth: "880px", margin: "0 auto", padding: "0 calc(22px + env(safe-area-inset-right)) calc(80px + env(safe-area-inset-bottom)) calc(22px + env(safe-area-inset-left))" }}>

        {/* ─── Header ─── */}
        <header className="sa-header" style={{ textAlign: "center", padding: "calc(50px + env(safe-area-inset-top)) 0 34px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", marginBottom: "20px" }}>
            <div style={{ width: "44px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5))" }} />
            <span style={{ width: "5px", height: "5px", border: `1px solid ${GOLD}`, transform: "rotate(45deg)", display: "inline-block" }} />
            <div style={{ width: "20px", height: "1px", background: "rgba(201,168,76,0.3)" }} />
            <span style={{ width: "5px", height: "5px", border: `1px solid ${GOLD}`, transform: "rotate(45deg)", display: "inline-block" }} />
            <div style={{ width: "44px", height: "1px", background: "linear-gradient(90deg, rgba(201,168,76,0.5), transparent)" }} />
          </div>

          <h1 style={{
            fontFamily: "'Cinzel', serif", fontSize: "clamp(24px, 4.4vw, 38px)", fontWeight: 700,
            letterSpacing: "0.1em", lineHeight: 1.4, textTransform: "uppercase",
            background: "linear-gradient(160deg, #F5D98B 0%, #C9A84C 45%, #7A5C0A 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            filter: "drop-shadow(0 1px 12px rgba(201,168,76,0.15))",
          }}>
            Special Ashraf Finances
            <span style={{
              display: "block", fontFamily: "'Cinzel', serif", fontWeight: 500,
              fontSize: "12px", letterSpacing: "0.55em", marginTop: "2px",
            }}>
              The Money Game
            </span>
          </h1>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", marginTop: "22px" }}>
            <div style={{ width: "44px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5))" }} />
            <span style={{ width: "5px", height: "5px", border: `1px solid ${GOLD}`, transform: "rotate(45deg)", display: "inline-block" }} />
            <div style={{ width: "20px", height: "1px", background: "rgba(201,168,76,0.3)" }} />
            <span style={{ width: "5px", height: "5px", border: `1px solid ${GOLD}`, transform: "rotate(45deg)", display: "inline-block" }} />
            <div style={{ width: "44px", height: "1px", background: "linear-gradient(90deg, rgba(201,168,76,0.5), transparent)" }} />
          </div>
        </header>

        {/* ─── Nav ─── */}
        <nav className="sa-nav" style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "38px", flexWrap: "wrap" }}>
          {[["dashboard", "Dashboard"], ["tracking", "Tracking"], ["plan", "The Plan"], ["trading", "Trading"]].map(([id, label]) => {
            const active = tab === id;
            return (
              <button key={id} className="sa-nav-btn" onClick={() => setTab(id)} style={{
                padding: "11px 34px", cursor: "pointer", background: active ? "rgba(201,168,76,0.1)" : "transparent",
                border: "none", borderBottom: `1px solid ${active ? GOLD : "rgba(201,168,76,0.15)"}`,
                fontFamily: "'Cormorant', serif", fontSize: "15px", fontWeight: 600,
                letterSpacing: "0.24em", textTransform: "uppercase",
                color: active ? GOLD_LIGHT : "rgba(201,168,76,0.55)",
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
              <div className="sa-gold-shimmer" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(42px, 8vw, 64px)", fontWeight: 600, lineHeight: 1, textShadow: "0 0 40px rgba(201,168,76,0.25)" }}>
                {fmt(balance)}
              </div>
              <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "15px", letterSpacing: "0.2em", color: "rgba(201,168,76,0.7)", marginTop: "10px" }}>{CURRENCY}</div>
              {capital !== 0 && (
                <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "10.5px", color: "rgba(201,168,76,0.45)", marginTop: "2px" }}>
                  includes {fmt(capital)} capital
                </div>
              )}

              {/* Invested / To Spend */}
              <div style={{ display: "flex", justifyContent: "center", gap: "28px", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(201,168,76,0.15)" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Cormorant', serif", fontSize: "10.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", marginBottom: "6px" }}>Invested · 80%</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", fontWeight: 600, color: CREAM }}>
                    {fmt(invested)} <span style={{ fontSize: "11px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>{CURRENCY}</span>
                  </div>
                </div>
                <div style={{ width: "1px", background: "rgba(201,168,76,0.2)" }} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Cormorant', serif", fontSize: "10.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", marginBottom: "6px" }}>To Spend · 20%</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", fontWeight: 600, color: CREAM }}>
                    {fmt(toSpend)} <span style={{ fontSize: "11px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>{CURRENCY}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Daily Target InshaALLAH SWT + Daily Spending — side by side */}
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "22px" }}>
              {dailyTarget != null && (
                <section className="sa-balance-section" style={{
                  flex: "1 1 260px", textAlign: "center", padding: "26px 20px",
                  border: "1px solid rgba(201,168,76,0.2)", borderRadius: "1px",
                  background: "linear-gradient(150deg, rgba(201,168,76,0.05) 0%, transparent 55%)",
                  minHeight: "190px", boxSizing: "border-box",
                  display: "flex", flexDirection: "column", justifyContent: "center",
                }}>
                  <div style={{ fontFamily: "'Cormorant', serif", fontSize: "10.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", marginBottom: "8px", lineHeight: 1.3 }}>
                    Daily Target InshaALLAH SWT
                    <span style={{ display: "block", fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11.5px", letterSpacing: "normal", textTransform: "none", color: "rgba(201,168,76,0.5)" }}>
                      {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      {tomorrowTarget != null && (
                        <span style={{ color: "rgba(201,168,76,0.4)" }}> · tomorrow {fmt(tomorrowTarget)} {CURRENCY}</span>
                      )}
                    </span>
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 600, color: CREAM }}>
                    {fmt(doneTodayMAD)} <span style={{ fontSize: "13px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>/</span> {fmt(dailyTarget)} <span style={{ fontSize: "12px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>{CURRENCY}</span>
                  </div>
                  <div style={{ margin: "12px auto 0", width: "min(260px, 90%)" }}>
                    <div style={{ height: "5px", background: "rgba(250,248,243,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, dailyPct)}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`, transition: "width 0.7s ease" }} />
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "15px", fontWeight: 600, color: dailyPctColor, marginTop: "8px" }}>
                      {dailyPct}%
                    </div>
                  </div>
                </section>
              )}

              {(() => {
                const dailyRow = spendRows.find((r) => r.label === "Daily");
                if (!dailyRow || !dailyRow.data) return null;
                const { out, allowance, diff } = dailyRow.data;
                const over = diff > 0;
                const c = over ? "#C0392B" : "#4A7C59";
                return (
                  <section className="sa-balance-section" style={{
                    flex: "1 1 260px", textAlign: "center", padding: "26px 20px",
                    border: "1px solid rgba(201,168,76,0.2)", borderRadius: "1px",
                    background: "linear-gradient(150deg, rgba(201,168,76,0.05) 0%, transparent 55%)",
                    minHeight: "190px", boxSizing: "border-box",
                    display: "flex", flexDirection: "column", justifyContent: "center",
                  }}>
                    <div style={{ fontFamily: "'Cormorant', serif", fontSize: "10.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", marginBottom: "8px", lineHeight: 1.3 }}>
                      Daily Spending
                      {dailyRow.sub && (
                        <span style={{ display: "block", fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11.5px", letterSpacing: "normal", textTransform: "none", color: "rgba(201,168,76,0.5)" }}>
                          {dailyRow.sub}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 600, color: c }}>
                      {fmt(Math.round(out))} <span style={{ fontSize: "13px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>/</span> {fmt(Math.round(allowance))} <span style={{ fontSize: "12px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>{CURRENCY}</span>
                    </div>
                    <div style={{ margin: "12px auto 0", width: "min(260px, 90%)" }}>
                      <div style={{ height: "5px", background: "rgba(250,248,243,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${allowance > 0 ? Math.min(100, Math.round((out / allowance) * 100)) : 0}%`, background: over ? "linear-gradient(90deg, #8B2E22, #C0392B)" : `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`, transition: "width 0.7s ease" }} />
                      </div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "15px", fontWeight: 600, color: c, marginTop: "8px" }}>
                        {dailyRow.showPct != null
                          ? `${dailyRow.showPct}%`
                          : <>{over ? "−" : ""}{fmt(Math.abs(Math.round(diff)))} <span style={{ fontSize: "11px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>{CURRENCY}</span></>
                        }
                      </div>
                    </div>
                  </section>
                );
              })()}
            </div>

            {/* Spending — over/under the 20% allowance */}
            <section className="sa-balance-section" style={{
              textAlign: "center", padding: "26px 20px", marginBottom: "22px",
              border: "1px solid rgba(201,168,76,0.2)", borderRadius: "1px",
              background: "linear-gradient(150deg, rgba(201,168,76,0.05) 0%, transparent 55%)",
              minHeight: "190px", boxSizing: "border-box",
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <div style={{ fontFamily: "'Cormorant', serif", fontSize: "10.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", marginBottom: "18px" }}>
                Spending
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "18px" }}>
                {spendRows.map((r) => {
                  if (!r.data) return null;
                  const { out, allowance, diff } = r.data;
                  const over = diff > 0;
                  const c = over ? "#C0392B" : "#4A7C59";
                  return (
                    <div key={r.label} style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11px", color: "rgba(201,168,76,0.55)", marginBottom: "6px", lineHeight: 1.3 }}>
                        {r.label}
                        {r.sub && (
                          <span style={{ display: "block", fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "9px", color: "rgba(201,168,76,0.4)" }}>
                            {r.sub}
                          </span>
                        )}
                      </div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 600, color: c }}>
                        {fmt(Math.round(out))} <span style={{ fontSize: "11px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>/</span> {fmt(Math.round(allowance))} <span style={{ fontSize: "10px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>{CURRENCY}</span>
                      </div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "12px", fontWeight: 600, color: c, marginTop: "4px" }}>
                        {r.showPct != null
                          ? `${r.showPct}%`
                          : <>{over ? "−" : ""}{fmt(Math.abs(Math.round(diff)))} <span style={{ fontSize: "9px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>{CURRENCY}</span></>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

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
                      <div style={{ fontFamily: "'Cormorant', serif", fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(201,168,76,0.75)", marginBottom: "10px" }}>This Month Needed</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", fontWeight: 600, color: CREAM }}>
                        {fmt(planSummary.monthlyNeeded)} <span style={{ fontSize: "12px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.6)" }}>{CURRENCY}</span>
                      </div>
                    </div>
                  </div>

                  {/* Daily Target InshaALLAH SWT */}
                  {dailyTarget != null && (
                    <section className="sa-balance-section" style={{
                      textAlign: "center", padding: "26px 20px", marginBottom: "16px",
                      border: "1px solid rgba(201,168,76,0.2)", borderRadius: "1px",
                      background: "linear-gradient(150deg, rgba(201,168,76,0.05) 0%, transparent 55%)",
                      minHeight: "190px", boxSizing: "border-box",
                      display: "flex", flexDirection: "column", justifyContent: "center",
                    }}>
                      <div style={{ fontFamily: "'Cormorant', serif", fontSize: "10.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", marginBottom: "8px", lineHeight: 1.3 }}>
                        Daily Target InshaALLAH SWT
                        <span style={{ display: "block", fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11.5px", letterSpacing: "normal", textTransform: "none", color: "rgba(201,168,76,0.5)" }}>
                          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                          {tomorrowTarget != null && (
                            <span style={{ color: "rgba(201,168,76,0.4)" }}> · tomorrow {fmt(tomorrowTarget)} {CURRENCY}</span>
                          )}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 600, color: CREAM }}>
                        {fmt(doneTodayMAD)} <span style={{ fontSize: "13px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>/</span> {fmt(dailyTarget)} <span style={{ fontSize: "12px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>{CURRENCY}</span>
                      </div>
                      <div style={{ margin: "12px auto 0", width: "min(260px, 90%)" }}>
                        <div style={{ height: "5px", background: "rgba(250,248,243,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(100, dailyPct)}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`, transition: "width 0.7s ease" }} />
                        </div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "15px", fontWeight: 600, color: dailyPctColor, marginTop: "8px" }}>
                          {dailyPct}%
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Monthly Target */}
                  {planSummary && planSummary.target != null && (
                    <section className="sa-balance-section" style={{
                      textAlign: "center", padding: "26px 20px", marginBottom: "22px",
                      border: "1px solid rgba(201,168,76,0.2)", borderRadius: "1px",
                      background: "linear-gradient(150deg, rgba(201,168,76,0.05) 0%, transparent 55%)",
                      minHeight: "190px", boxSizing: "border-box",
                      display: "flex", flexDirection: "column", justifyContent: "center",
                    }}>
                      <div style={{ fontFamily: "'Cormorant', serif", fontSize: "10.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", marginBottom: "8px", lineHeight: 1.3 }}>
                        Monthly Target
                        <span style={{ display: "block", fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11.5px", letterSpacing: "normal", textTransform: "none", color: "rgba(201,168,76,0.5)" }}>
                          {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} <span style={{ color: "rgba(201,168,76,0.4)" }}>(-{workingDaysLeft})</span>
                        </span>
                      </div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 600, color: CREAM }}>
                        {fmt(pMonth.net)} <span style={{ fontSize: "13px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>/</span> {fmt(planSummary.target)} <span style={{ fontSize: "12px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>{CURRENCY}</span>
                      </div>
                      <div style={{ margin: "12px auto 0", width: "min(260px, 90%)" }}>
                        <div style={{ height: "5px", background: "rgba(250,248,243,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(100, monthlyPct)}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`, transition: "width 0.7s ease" }} />
                        </div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "15px", fontWeight: 600, color: monthlyPctColor, marginTop: "8px" }}>
                          {monthlyPct}%
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Yearly Target */}
                  {planSummary && planSummary.yearSurplusTarget != null && (
                    <section className="sa-balance-section" style={{
                      textAlign: "center", padding: "26px 20px", marginBottom: "22px",
                      border: "1px solid rgba(201,168,76,0.2)", borderRadius: "1px",
                      background: "linear-gradient(150deg, rgba(201,168,76,0.05) 0%, transparent 55%)",
                      minHeight: "190px", boxSizing: "border-box",
                      display: "flex", flexDirection: "column", justifyContent: "center",
                    }}>
                      <div style={{ fontFamily: "'Cormorant', serif", fontSize: "10.5px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,168,76,0.65)", marginBottom: "18px", lineHeight: 1.3 }}>
                        Yearly Target
                        <span style={{ display: "block", fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11.5px", letterSpacing: "normal", textTransform: "none", color: "rgba(201,168,76,0.5)" }}>
                          {planSummary.yearRangeLabel}
                        </span>
                      </div>
                      <div className="sa-yearly-split" style={{ display: "flex", justifyContent: "center", gap: "28px", flexWrap: "wrap" }}>
                        <div style={{ textAlign: "center", flex: "1 1 160px" }}>
                          <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11px", color: "rgba(201,168,76,0.55)", marginBottom: "6px" }}>
                            Target to Earn
                          </div>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 600, color: CREAM }}>
                            {fmt(yearInAmt)} <span style={{ fontSize: "11px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>/</span> {fmt(planSummary.yearSurplusTarget)} <span style={{ fontSize: "11px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>{CURRENCY}</span>
                          </div>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "13px", fontWeight: 600, color: yearSurplusColor, marginTop: "6px" }}>{yearSurplusPct}%</div>
                        </div>
                        <div className="sa-yearly-divider" style={{ width: "1px", background: "rgba(201,168,76,0.2)" }} />
                        <div style={{ textAlign: "center", flex: "1 1 160px" }}>
                          <div style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11px", color: "rgba(201,168,76,0.55)", marginBottom: "6px" }}>
                            Target Balance
                          </div>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 600, color: CREAM }}>
                            {fmt(balance)} <span style={{ fontSize: "11px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>/</span> {fmt(planSummary.yearEndBalanceTarget)} <span style={{ fontSize: "11px", fontFamily: "'Cormorant', serif", color: "rgba(201,168,76,0.55)" }}>{CURRENCY}</span>
                          </div>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "13px", fontWeight: 600, color: yearBalanceColor, marginTop: "6px" }}>{yearBalancePct}%</div>
                        </div>
                      </div>
                    </section>
                  )}
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

              <FlowToggle value={flow} onChange={(v) => { setFlow(v); setIncomeType(""); setTxTypeAttempted(false); }} />

              <div className="sa-form-row" style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
                <div style={{ flex: "0 0 180px", minWidth: "150px" }}>
                  <input
                    type="number" inputMode="decimal" value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTx()}
                    placeholder="$"
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
                    placeholder="Comment"
                    style={{
                      width: "100%", padding: "14px 16px", background: "rgba(250,248,243,0.03)",
                      border: "1px solid rgba(201,168,76,0.18)", borderRadius: "1px",
                      fontFamily: "'Cormorant', serif", fontSize: "16px", color: CREAM,
                    }}
                  />
                </div>
                <div style={{ flex: "0 0 170px", minWidth: "150px" }}>
                  {addingNewType ? (
                    <input
                      autoFocus
                      value={newTypeDraft}
                      onChange={(e) => setNewTypeDraft(e.target.value)}
                      onBlur={commitNewType}
                      onKeyDown={(e) => { if (e.key === "Enter") commitNewType(); if (e.key === "Escape") { setAddingNewType(false); setNewTypeDraft(""); } }}
                      placeholder="New type name…"
                      style={{
                        width: "100%", padding: "14px 14px", background: "rgba(250,248,243,0.03)",
                        border: "1px solid rgba(201,168,76,0.4)", borderRadius: "1px",
                        fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "14px", color: CREAM,
                      }}
                    />
                  ) : (
                    <select
                      value={incomeType}
                      onChange={(e) => {
                        if (e.target.value === "__add_new__") { setAddingNewType(true); return; }
                        setIncomeType(e.target.value);
                        setTxTypeAttempted(false);
                      }}
                      style={{
                        width: "100%", padding: "14px 14px", background: "rgba(250,248,243,0.03)",
                        border: `1px solid ${txTypeAttempted && !incomeType ? "#C0392B" : "rgba(201,168,76,0.18)"}`,
                        borderRadius: "1px",
                        fontFamily: "'Cormorant', serif", fontStyle: incomeType ? "normal" : "italic",
                        fontSize: "14px", color: incomeType ? CREAM : (txTypeAttempted ? "#E88" : "rgba(250,248,243,0.4)"),
                        appearance: "none", cursor: "pointer",
                      }}
                    >
                      <option value="" style={{ background: INK, fontStyle: "italic" }}>Type *</option>
                      {txTypes.map((t) => (
                        <option key={t} value={t} style={{ background: INK, fontStyle: "normal" }}>{t}</option>
                      ))}
                      <option value="__add_new__" style={{ background: INK, fontStyle: "italic", color: GOLD }}>+ Add new type…</option>
                    </select>
                  )}
                </div>
              </div>

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

            {/* Search + Sort */}
            <div className="sa-filter-row" style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center", position: "relative" }}>
              <button className="sa-icon-btn" onClick={() => setDatePanelOpen((v) => !v)} title={dateFilterSummary || "All Dates"} style={{
                flexShrink: 0, width: "38px", height: "38px",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                background: dateFilterSummary ? "rgba(201,168,76,0.12)" : "rgba(250,248,243,0.03)",
                border: `1px solid ${dateFilterSummary ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.18)"}`,
                borderRadius: "1px", fontSize: "15px",
              }}>
                📅
              </button>
              {dateFilterSummary && (
                <button className="sa-icon-btn" onClick={() => { setFilterYear(""); setFilterMonth(""); setFilterDay(""); }} title="Clear date filter" style={{
                  flexShrink: 0, width: "26px", height: "38px",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  background: "transparent", border: "none",
                  color: "rgba(250,248,243,0.4)", fontSize: "13px",
                }}>✕</button>
              )}
              <button className="sa-icon-btn" onClick={() => setSortPanelOpen((v) => !v)} title="Sort" style={{
                flexShrink: 0, width: "38px", height: "38px",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                background: sortPanelOpen ? "rgba(201,168,76,0.12)" : "rgba(250,248,243,0.03)",
                border: `1px solid ${sortPanelOpen ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.18)"}`,
                borderRadius: "1px", fontSize: "15px", color: GOLD,
              }}>
                ⇅
              </button>
              <div className="sa-flow-filter-group" style={{ display: "flex", gap: "4px", minWidth: 0 }}>
                {[["all", "All"], ["in", "Money In"], ["out", "Money Out"]].map(([id, label]) => {
                  const active = flowFilter === id;
                  return (
                    <button key={id} className="sa-flow-filter-btn" onClick={() => setFlowFilter(id)} style={{
                      padding: "10px 14px", cursor: "pointer",
                      background: active ? "rgba(201,168,76,0.12)" : "transparent",
                      border: `1px solid ${active ? "rgba(201,168,76,0.5)" : "rgba(201,168,76,0.18)"}`,
                      borderRadius: "1px",
                      fontFamily: "'Cormorant', serif", fontSize: "12.5px", letterSpacing: "0.06em", textTransform: "uppercase",
                      color: active ? GOLD_LIGHT : "rgba(250,248,243,0.4)",
                      transition: "all 0.2s ease", whiteSpace: "nowrap",
                    }}>{label}</button>
                  );
                })}
              </div>

              {sortPanelOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", left: "84px", zIndex: 20,
                  minWidth: "210px", padding: "8px",
                  background: INK, border: "1px solid rgba(201,168,76,0.35)", borderRadius: "1px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                  display: "flex", flexDirection: "column", gap: "4px",
                }}>
                  {[
                    ["newest", "Newest First"],
                    ["oldest", "Oldest First"],
                    ["amount_high", "Amount: High → Low"],
                    ["amount_low", "Amount: Low → High"],
                  ].map(([id, label]) => (
                    <button key={id} onClick={() => { setSortBy(id); setSortPanelOpen(false); }} style={{
                      padding: "9px 12px", textAlign: "left", cursor: "pointer",
                      background: sortBy === id ? "rgba(201,168,76,0.14)" : "transparent",
                      border: `1px solid ${sortBy === id ? GOLD : "transparent"}`,
                      borderRadius: "1px",
                      fontFamily: "'Cormorant', serif", fontSize: "13px", letterSpacing: "0.06em", textTransform: "uppercase",
                      color: sortBy === id ? GOLD_LIGHT : "rgba(250,248,243,0.55)",
                    }}>{label}</button>
                  ))}
                </div>
              )}

              {datePanelOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 20,
                  width: "min(340px, 90vw)", padding: "18px",
                  background: INK, border: "1px solid rgba(201,168,76,0.35)", borderRadius: "1px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
                }}>
                  <div style={{ fontFamily: "'Cormorant', serif", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,168,76,0.6)", marginBottom: "10px" }}>Year</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "18px" }}>
                    {availableYears.map((y) => (
                      <button key={y} onClick={() => setFilterYear(filterYear === y ? "" : y)} style={{
                        padding: "6px 12px", cursor: "pointer",
                        background: filterYear === y ? "rgba(201,168,76,0.18)" : "transparent",
                        border: `1px solid ${filterYear === y ? GOLD : "rgba(201,168,76,0.2)"}`,
                        borderRadius: "1px", fontFamily: "'Playfair Display', serif", fontSize: "13px",
                        color: filterYear === y ? GOLD_LIGHT : "rgba(250,248,243,0.55)",
                      }}>{y}</button>
                    ))}
                  </div>

                  <div style={{ fontFamily: "'Cormorant', serif", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,168,76,0.6)", marginBottom: "10px" }}>Month</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", marginBottom: "18px" }}>
                    {MONTH_NAMES.map((name, i) => {
                      const mm = String(i + 1).padStart(2, "0");
                      const active = filterMonth === mm;
                      return (
                        <button key={mm} onClick={() => { setFilterMonth(active ? "" : mm); if (active) setFilterDay(""); }} style={{
                          padding: "8px 4px", cursor: "pointer",
                          background: active ? "rgba(201,168,76,0.18)" : "transparent",
                          border: `1px solid ${active ? GOLD : "rgba(201,168,76,0.2)"}`,
                          borderRadius: "1px", fontFamily: "'Cormorant', serif", fontSize: "13px",
                          color: active ? GOLD_LIGHT : "rgba(250,248,243,0.55)",
                        }}>{name}</button>
                      );
                    })}
                  </div>

                  <div style={{ fontFamily: "'Cormorant', serif", fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(201,168,76,0.6)", marginBottom: "10px" }}>Day</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", marginBottom: "18px" }}>
                    {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((d) => {
                      const dd = String(d).padStart(2, "0");
                      const active = filterDay === dd;
                      return (
                        <button key={dd} onClick={() => setFilterDay(active ? "" : dd)} style={{
                          padding: "6px 0", cursor: "pointer",
                          background: active ? "rgba(201,168,76,0.18)" : "transparent",
                          border: `1px solid ${active ? GOLD : "rgba(201,168,76,0.15)"}`,
                          borderRadius: "1px", fontFamily: "'Cormorant', serif", fontSize: "12px",
                          color: active ? GOLD_LIGHT : "rgba(250,248,243,0.5)",
                        }}>{d}</button>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                    <button onClick={() => { setFilterYear(""); setFilterMonth(""); setFilterDay(""); }} style={{
                      padding: "8px 16px", background: "none", border: "1px solid rgba(201,168,76,0.25)", borderRadius: "1px",
                      cursor: "pointer", fontFamily: "'Cormorant', serif", fontSize: "12px", letterSpacing: "0.1em",
                      textTransform: "uppercase", color: "rgba(250,248,243,0.45)",
                    }}>Clear All</button>
                    <button onClick={() => setDatePanelOpen(false)} style={{
                      padding: "8px 20px", background: "rgba(201,168,76,0.14)", border: `1px solid ${GOLD}`, borderRadius: "1px",
                      cursor: "pointer", fontFamily: "'Cormorant', serif", fontSize: "12px", letterSpacing: "0.1em",
                      textTransform: "uppercase", color: GOLD_LIGHT,
                    }}>Done</button>
                  </div>
                </div>
              )}
            </div>

            {/* Ledger */}
            {sortedTxs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 20px", fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "17px", color: "rgba(250,248,243,0.3)" }}>
                {txs.length === 0 ? "No movements yet. Record the first one above." : "No movements match that search."}
              </div>
            ) : isAmountSort ? (
              <div style={{ marginBottom: "28px" }}>
                {sortedTxs.map((t) => (
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
                          {dateLabel(t.date)} · {new Date(t.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
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
            ) : grouped.map(([date, list]) => {
              return (
                <div key={date} style={{ marginBottom: "28px" }}>
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
                          {t.incomeType && (
                            <span style={{
                              fontFamily: "'Cormorant', serif", fontStyle: "italic", fontSize: "11px",
                              color: GOLD, border: `1px solid rgba(201,168,76,0.35)`, borderRadius: "1px",
                              padding: "1px 8px", whiteSpace: "nowrap",
                            }}>◆ {t.incomeType}</span>
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

        {tab === "trading" && <TradingTab fin={fin} setFin={setFin} capital={capital} planSummary={planSummary} dailyTarget={dailyTarget} yearInAmt={yearInAmt} />}
      </div>
    </div>
  );
}
