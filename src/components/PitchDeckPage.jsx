import { DollarSign, Shuffle, Phone, Link2, CircleDot, BarChart3, Gamepad2, CreditCard, MessageCircle, Smartphone, Users, User, Network, CheckCircle2, Zap, TrendingUp, Rocket } from "lucide-react";
import { C, BRAND, displayFont } from "../theme";

const FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif";

// ── Shared page chrome (same self-contained-page convention as
//    RoadmapPage.jsx / LeaguePage.jsx — each standalone route owns its
//    own small style helpers rather than sharing a design-system file). ──
const wrap = { maxWidth: 980, margin: "0 auto", padding: "0 22px" };
const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent };
const card = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };
const secH = (n, title, sub) => (
  <div style={{ marginBottom: 26 }}>
    <div style={eyebrow}>{n}</div>
    <div style={{ ...displayFont, fontSize: 28, marginTop: 8, lineHeight: 1.15 }}>{title}</div>
    {sub && <div style={{ fontSize: 14, color: C.text2, marginTop: 8, maxWidth: 680, lineHeight: 1.6 }}>{sub}</div>}
  </div>
);
const Section = ({ children, style }) => (
  <section style={{ padding: "clamp(48px,7vw,84px) 0", borderBottom: `1px solid ${C.border}`, ...style }}><div style={wrap}>{children}</div></section>
);
const phaseTag = (label, active) => (
  <span style={{ display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", padding: "3px 9px", borderRadius: 9, background: active ? C.accentDim : C.surface, color: active ? C.accent : C.text3, border: `1px solid ${active ? C.accentBorder : C.border}` }}>{label}</span>
);

const PROBLEM = [
  { Icon: Users, title: "Counting who's in", desc: "Headcount by memory, in a WhatsApp thread nobody scrolls back through. Wrong copy and paste, problems with who's first…" },
  { Icon: DollarSign, title: "Chasing who hasn't paid", desc: "Manual reminders, manual tracking, every single week." },
  { Icon: Shuffle, title: "Drawing teams from memory", desc: "No positions, no balance, arrive early and get a good team." },
  { Icon: Phone, title: "Booking the pitch by phone", desc: "A call, a maybe, a hope nobody double-books the slot." },
];

const SOLUTION_STEPS = [
  { Icon: Link2, title: "Confirm", desc: "One-tap magic link — no login. See who's in!" },
  { Icon: Shuffle, title: "Draw", desc: "Balanced by position, organized by tactics." },
  { Icon: CircleDot, title: "Play", desc: "Live scoring, matchday, real life stats." },
  { Icon: BarChart3, title: "Track", desc: "Stats, history, track your progress." },
  { Icon: Gamepad2, title: "Compete", desc: "Fantasy league, MVP, multi-group players." },
];

const WHY_NOW = [
  { Icon: CreditCard, title: "Instant payments", desc: "Players can pay directly through the app without the organizer constantly reminding everyone." },
  { Icon: MessageCircle, title: "WhatsApp is the default channel", desc: "In both markets. We meet the group where it already lives." },
  { Icon: Smartphone, title: "Web apps or app stores", desc: "However suits the players best, same experience for web app and store app." },
];

const MODULES = [
  "Confirmation grid", "Team draw", "Live matchday", "Tactics board", "Stats & achievements",
  "Pitch Manager (fantasy)", "Social feed", "Cross-group identity", "Organiser tools", "Magic link (no login)",
];

const TRACTION = [
  ["154", "Commits shipped"], ["10", "Weeks, first commit to today"],
  ["68", "Real signed-up players"], ["8", "Matchdays actually played"],
];

const PRICING = [
  { tag: "FREE", price: "€0", desc: "1 group, confirmations, draw, matchday and basic stats. No player cap. The group never has a reason to leave.", hi: false },
  { tag: "PRO", price: "€5–10 /mo per group", desc: "Automatic payment collection, push & reminders, recurring games, full fantasy, unlimited history, export.", hi: true },
  { tag: "CORPORATE", price: "Per event or annual", desc: "Internal tournaments, company branding, HR participation reports — the Phase 2 wedge into companies' wellbeing budgets.", hi: false },
];

const REVENUE_LINES = [
  ["Organiser subscription", "PHASE 1", true], ["Payment fee (~1.5–3%)", "PHASE 1", true],
  ["Pitch booking commission", "PHASE 2", false], ["\"Need 1 player\" marketplace", "PHASE 3", false],
  ["Corporate events & tournaments", "PHASE 3", false], ["Brand deals & sponsorships", "PHASE 5", false],
  ["PITCH OS — B2B licensing for pitch operators", "PHASE 5", false],
];

const COMPETITION = [
  { title: "WhatsApp + spreadsheet", tag: ">90% of the market", desc: "All manual work on one person; no history, no collection, no waiting list." },
  { title: "Team management apps", tag: "Spond, TeamSnap, Heja", desc: "Built for a fixed team with a coach — everyone must install and register." },
  { title: "Booking marketplaces", tag: "Playtomic, Matchi", desc: "Solve the venue, not the group. No draw, stats, fantasy — a Phase 5 partner." },
];

const MOAT = [
  { Icon: Zap, title: "Zero friction on the player side", desc: "Easy to sign up, fun twist with the fantasy league." },
  { Icon: TrendingUp, title: "Accumulated per-group data", desc: "History, peer ratings and fantasy leagues create a switching cost that grows every week and cannot be copied." },
  { Icon: Network, title: "Cross-group identity, already built", desc: "The technical base for \"need 1 player\" — the real network effect — exists before the network does." },
  { Icon: CheckCircle2, title: "End-to-end coverage", desc: "Confirmation → collection → draw → game → stats → fantasy in one place; competitors each cover a slice." },
];

const PHASES = [
  { n: 0, when: "DONE", title: "Foundation", tags: "Confirmations · Draw · Matchday · Stats · Fantasy · Cross-group identity", live: true },
  { n: 1, when: "0–6 MO", title: "Monetisation & automation", tags: "Real payments · Auto push · Reminders · Recurring game · Free/Pro" },
  { n: 2, when: "6–12 MO", title: "Permanent record", tags: "Match verification · Season Wrapped · Records · Auto player cards" },
  { n: 3, when: "12–18 MO", title: "Network effects", tags: "Need 1 player · Open games · Local rankings · Corporate leagues" },
  { n: 4, when: "18–24 MO", title: "Automatic capture", tags: "Strava / Garmin OAuth first" },
  { n: 5, when: "24+ MO", title: "Marketplace", tags: "Pitch bookings · Gear · Tournaments · Sponsorships · PITCH OS licensing" },
];

const FIN_ROWS = [
  { year: "Year 1", groups: "≈ 50", revenue: 5600, costs: 2000, result: 3600 },
  { year: "Year 2", groups: "≈ 500", revenue: 55000, costs: 26000, result: 29000 },
  { year: "Year 3", groups: "≈ 3,000", revenue: 304000, costs: 155000, result: 149000 },
];

const HIRING = [
  { when: "Year 1", role: "Support & community (part-time) · Outsourced developer", trigger: "~200 paying groups" },
  { when: "Year 2", role: "Engineering + partnerships/sales (2–3)", trigger: "Growth and scale" },
];

const ASKS = [
  "A structured pressure-test of the roadmap order — starting with whether Phase 1 (monetisation) or Phase 3 (network effects) should come first.",
  "Intros to other Sportstech founders, to benchmark and expand.",
  "Mentoring and coaching throughout the roadmap, to help PITCH reach its potential faster and better.",
  "Modest seed capital (€20,000) for 12 months of infrastructure, payments integration and legal setup — or an equivalent distribution partnership.",
];

const fmtEUR = (n) => `€${n.toLocaleString("en-US")}`;
const fmtK = (n) => (Math.abs(n) >= 1000 ? `€${Math.round(n / 1000)}k` : `€${n}`);

// Public by design — a pitch deck is meant to be shared by link, unlike
// /roadmap (financial detail + editing) which stays admin-gated.
export default function PitchDeckPage() {
  const page = (children) => <div style={{ minHeight: "100vh", background: C.bg, color: C.text1, fontFamily: FONT }}>{children}</div>;

  const finMax = Math.max(...FIN_ROWS.map((r) => Math.max(r.revenue, r.costs))) * 1.1;

  return page(
    <>
      {/* ── Cover ── */}
      <div style={{ minHeight: "72vh", display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ ...wrap, position: "relative", zIndex: 1, padding: "70px 22px 40px" }}>
          <img src={BRAND.logo} alt="PITCH" style={{ height: 32, marginBottom: 30 }} />
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", color: C.accent, marginBottom: 14 }}>PITCH DECK · AUGUST 2026</div>
          <div style={{ ...displayFont, fontSize: "clamp(32px,5.5vw,52px)", lineHeight: 1.06, maxWidth: 820 }}>
            From a chaotic WhatsApp group to the operating system of amateur football
          </div>
          <div style={{ fontSize: "clamp(15px,2vw,18px)", color: C.text2, marginTop: 18, maxWidth: 560, lineHeight: 1.6 }}>
            Organiser today. The social network of football, tomorrow.
          </div>
        </div>
      </div>

      {/* ── 01 · The problem ── */}
      <Section>
        {secH("01 · THE PROBLEM", "The organiser is an exhausted volunteer, and the group slows down when they quit.")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {PROBLEM.map(({ Icon, title, desc }) => (
            <div key={title} style={card}>
              <div style={{ width: 38, height: 38, borderRadius: 19, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Icon size={18} color={C.bg} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 02 · The solution ── */}
      <Section>
        {secH("02 · THE SOLUTION", "One app absorbs the entire organiser workload.",
          "Confirmation grid, collection, balanced draw, live matchday, stats and fantasy. If you don't want to, you don't need to install anything. Players confirm via a magic link in WhatsApp, in one tap.")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
          {SOLUTION_STEPS.map(({ Icon, title, desc }) => (
            <div key={title} style={card}>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Icon size={19} color={C.bg} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.55 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 03 · Why now ── */}
      <Section>
        {secH("03 · WHY NOW", "Three blockers from five years ago are gone.")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {WHY_NOW.map(({ Icon, title, desc }) => (
            <div key={title} style={card}>
              <div style={{ width: 38, height: 38, borderRadius: 19, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Icon size={18} color={C.bg} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 04 · Product ── */}
      <Section>
        {secH("04 · PRODUCT", "Not a mockup. Live, and used for real.")}
        <div style={{ ...displayFont, fontSize: 44, color: C.accent, marginBottom: 4 }}>11</div>
        <div style={{ fontSize: 12, color: C.text2, marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>Modules already live in production</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          {MODULES.map((m) => (
            <div key={m} style={{ ...card, padding: "16px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{m}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: C.text3, fontStyle: "italic" }}>
          + in beta: automatic push notifications, and native instant payments (today a manual organiser toggle — the biggest missing piece).
        </div>
      </Section>

      {/* ── 05 · Traction ── */}
      <Section>
        {secH("05 · TRACTION", "Built fast. Shipped for real.")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 16 }}>
          {TRACTION.map(([n, label]) => (
            <div key={label} style={card}>
              <div style={{ ...displayFont, fontSize: 36, color: C.accent, fontStyle: "italic" }}>{n}</div>
              <div style={{ fontSize: 11.5, color: C.text2, marginTop: 6 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ ...card, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <Users size={20} color={C.gold} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>Real usage, not a demo</div>
            <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>
              Pulled straight from the admin dashboard: 5 active friend groups since June, the largest with 41 players
              (Goodweather F.C.), plus 2 running Pitch Manager fantasy leagues — organic signups, no paid acquisition,
              no seed accounts.
            </div>
          </div>
        </div>
      </Section>

      {/* ── 06 · Business model — pricing ── */}
      <Section>
        {secH("06 · BUSINESS MODEL", "Freemium per group. The free tier is the acquisition engine.")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 16 }}>
          {PRICING.map(({ tag, price, desc, hi }) => (
            <div key={tag} style={{ ...card, background: hi ? C.accent : C.card, border: hi ? "none" : `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: hi ? C.bg : C.accent, opacity: hi ? 0.75 : 1 }}>{tag}</div>
              <div style={{ ...displayFont, fontSize: 22, color: hi ? C.bg : C.text1, marginTop: 10, marginBottom: 12 }}>{price}</div>
              <div style={{ fontSize: 12.5, color: hi ? C.bg : C.text2, opacity: hi ? 0.85 : 1, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
        <div style={{ ...card, borderStyle: "dashed" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: C.accent, marginBottom: 6 }}>ADDITIONAL REVENUE SOURCES</div>
          <div style={{ fontSize: 12.5, color: C.text2 }}>League sponsorships, fantasy league sponsorship, in-app ads. Strava-like business model.</div>
        </div>
      </Section>

      {/* ── 06b · Revenue lines ── */}
      <Section>
        {secH("06 · BUSINESS MODEL", "Seven revenue lines, sequenced with the roadmap.")}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {REVENUE_LINES.map(([label, phase, active]) => (
            <div key={label} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px" }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{label}</span>
              {phaseTag(phase, active)}
            </div>
          ))}
        </div>
      </Section>

      {/* ── 07 · Competition ── */}
      <Section>
        {secH("07 · COMPETITION", "The real competitor isn't an app. It's the free status quo.")}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {COMPETITION.map(({ title, tag, desc }) => (
            <div key={title} style={{ ...card, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ minWidth: 190 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{title}</div>
                <div style={{ fontSize: 11.5, color: C.accent, marginTop: 2 }}>{tag}</div>
              </div>
              <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>

        <div style={{ ...displayFont, fontSize: 20, marginBottom: 16 }}>Why this compounds instead of getting copied.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {MOAT.map(({ Icon, title, desc }) => (
            <div key={title} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 16, background: C.goldDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={16} color={C.gold} />
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{title}</div>
              </div>
              <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 08 · Roadmap ── */}
      <Section>
        {secH("08 · ROADMAP", "Six phases toward the Strava of football.",
          "Not a rebrand — a sequencing call: player identity, permanent match history and OAuth-first activity tracking are pulled forward, ahead of monetisation depth.")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {PHASES.map(({ n, when, title, tags, live }) => (
            <div key={n} style={{ ...card, background: live ? C.accent : C.card, border: live ? "none" : `1px solid ${C.border}` }}>
              <div style={{ ...displayFont, fontSize: 30, fontStyle: "italic", color: live ? C.bg : C.accent }}>{n}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: live ? C.bg : C.text3, opacity: live ? 0.7 : 1, marginTop: 4, marginBottom: 10 }}>{when}</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: live ? C.bg : C.text1, marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 11, color: live ? C.bg : C.text2, opacity: live ? 0.8 : 1, lineHeight: 1.6 }}>{tags}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 09 · Financial plan ── */}
      <Section>
        {secH("09 · FINANCIAL PLAN", "Low cost, highly scalable. Multi-country possibility.")}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "clamp(20px,5vw,48px)", height: 180, marginBottom: 28, paddingLeft: 4 }}>
          {FIN_ROWS.map((r) => (
            <div key={r.year} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.text1, marginBottom: 6 }}>{fmtK(r.revenue)}</div>
              <div style={{ width: "60%", maxWidth: 64, height: `${Math.max(6, (r.revenue / finMax) * 130)}px`, background: C.accent, borderRadius: "4px 4px 0 0" }} />
              <div style={{ fontSize: 12, color: C.text2, marginTop: 8 }}>{r.year}</div>
            </div>
          ))}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 420 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px 10px", color: C.text3, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}></th>
                {FIN_ROWS.map((r) => <th key={r.year} style={{ textAlign: "left", padding: "8px 10px", color: C.accent, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{r.year}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                ["Paying groups", (r) => r.groups],
                ["Revenue", (r) => fmtEUR(r.revenue)],
                ["Costs", (r) => fmtEUR(r.costs)],
                ["Result", (r) => `+${fmtEUR(r.result)}`],
              ].map(([label, get]) => (
                <tr key={label} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "9px 10px", color: C.text2, fontWeight: 700 }}>{label}</td>
                  {FIN_ROWS.map((r) => (
                    <td key={r.year} style={{ padding: "9px 10px", fontWeight: label === "Result" ? 800 : 500, color: label === "Result" ? C.green : C.text1 }}>{get(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 18, padding: "12px 14px", background: C.card, borderLeft: `2px solid ${C.orange}`, borderRadius: "0 10px 10px 0", fontSize: 12, color: C.text2, lineHeight: 1.6 }}>
          Break-even at 205 paying groups (Base scenario: €7/mo/group, 40% of payments in-app, 2% take rate, €1,800 fixed
          monthly costs). Steady-state model — order of magnitude, not a monthly cash-flow projection.
        </div>
      </Section>

      {/* ── 10 · Team & the ask ── */}
      <Section style={{ borderBottom: "none" }}>
        {secH("10 · TEAM & THE ASK", "Founder-led.")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <User size={22} color={C.text2} />
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>Vinicius Capella Trevisan</div>
                <div style={{ fontSize: 11.5, color: C.accent }}>Founder</div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
              Track record on building business: scaled brokerage teams at RE/MAX Complete, ran a sales division as
              Director of Revenue in a Real Estate startup, founded a family-owned Commercial Real Estate boutique, and
              grew one of Brazil's top real-estate podcasts to 75+ episodes. Solo-builds PITCH — product, engineering
              and support alone.
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", color: C.text3, marginBottom: 8 }}>HIRING PLAN, TRIGGERED BY REVENUE</div>
            {HIRING.map((h) => (
              <div key={h.when} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{h.when} — {h.role}</div>
                <div style={{ fontSize: 11, color: C.text3 }}>{h.trigger}</div>
              </div>
            ))}
          </div>

          <div style={{ ...card, background: C.accent }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Rocket size={18} color={C.bg} />
              <div style={{ fontSize: 14.5, fontWeight: 800, color: C.bg }}>What we're asking</div>
            </div>
            <ul style={{ margin: 0, padding: "0 0 0 18px", color: C.bg }}>
              {ASKS.map((a) => (
                <li key={a} style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 10, opacity: 0.9 }}>{a}</li>
              ))}
            </ul>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.bg, fontStyle: "italic", marginTop: 4 }}>
              The plan does not require a funding round to reach revenue.
            </div>
          </div>
        </div>
      </Section>

      {/* ── Closing ── */}
      <div style={{ padding: "70px 22px 90px", textAlign: "center" }}>
        <img src={BRAND.logo} alt="PITCH" style={{ height: 30, marginBottom: 22 }} />
        <div style={{ ...displayFont, fontSize: 24, marginBottom: 22 }}>Make sure the weekly game happens.</div>
        <a href="https://pitch-fc.vercel.app" style={{ color: C.accent, fontSize: 14, textDecoration: "none", fontWeight: 700 }}>pitch-fc.vercel.app</a>
        <div style={{ fontSize: 12.5, color: C.text3, marginTop: 10 }}>Vinicius Capella · capella.vinicius@gmail.com</div>
      </div>
    </>
  );
}
