import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { C, R, S, T, BRAND, displayFont } from "../theme";
import { t } from "../lib/i18n";
import { trackEvent } from "../lib/analytics";
import { isGroupPlan, marketFromLang, manageSubscription, MARKET_IDS, PRICING } from "../lib/plans";
import { PAGE, FINAL, UPGRADE } from "../lib/pricingCopy";
import BtnPrimary from "./BtnPrimary";
import PricingGroupPlans from "./PricingGroupPlans";
import PricingPlayerPlans from "./PricingPlayerPlans";
import PricingPayments from "./PricingPayments";
import PricingAiPair from "./PricingAiPair";
import PricingComparison from "./PricingComparison";
import PricingFaq from "./PricingFaq";
import UpgradeModal from "./UpgradeModal";

const MAXW = 1120;
const MARKET_KEY = "pitch.v2.pricingMarket";

const CSS = `
.pr-root *{box-sizing:border-box}
.pr-grid{display:grid;grid-template-columns:1fr;gap:28px}
.pr-pair{display:flex;flex-direction:column;gap:16px}
.pr-flow{display:flex;flex-direction:column;align-items:stretch;gap:8px}
.pr-flow .pr-arrow-h{display:none}
.pr-flow .pr-arrow-v{align-self:center}
@media(min-width:900px){
  .pr-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:stretch}
  .pr-grid.pr-grid-2{grid-template-columns:repeat(2,minmax(0,1fr));max-width:900px;margin:0 auto}
  .pr-pair{flex-direction:row}
  .pr-flow{flex-direction:row;align-items:center}
  .pr-flow .pr-arrow-h{display:block;flex-shrink:0}
  .pr-flow .pr-arrow-v{display:none}
}
`;

// "?source=" tells us which in-app prompt sent someone here. Whitelisted
// shape only — it's an analytics label, never user data.
const sourceFromUrl = () => {
  const s = new URLSearchParams(window.location.search).get("source") || "";
  return /^[a-z0-9_-]{1,30}$/i.test(s) ? s.toLowerCase() : "direct";
};

/** Explicit market choice (?market= or a saved manual switch), else null —
 *  in which case the market follows the UI language. No geo-detection. */
const explicitMarket = () => {
  const q = (new URLSearchParams(window.location.search).get("market") || "").toUpperCase();
  if (MARKET_IDS.includes(q)) return q;
  try {
    const saved = localStorage.getItem(MARKET_KEY);
    return MARKET_IDS.includes(saved) ? saved : null;
  } catch { return null; }
};

const seg = (active) => ({
  flex: 1, minHeight: 44, padding: `0 ${S.lg}px`, border: "none", borderRadius: R.control - 2, cursor: "pointer",
  fontSize: T.body, fontWeight: 800, whiteSpace: "nowrap",
  background: active ? C.accent : "transparent", color: active ? C.bg : C.text2,
});

function Segmented({ value, options, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} style={{ display: "flex", gap: 4, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.control, padding: 4 }}>
      {options.map(([id, text]) => (
        <button key={id} type="button" role="tab" aria-selected={value === id} onClick={() => onChange(id)} style={seg(value === id)}>
          {text}
        </button>
      ))}
    </div>
  );
}

const caption = { fontSize: T.min, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: C.text2, textAlign: "center", marginBottom: S.xs };

/**
 * /pricing — plans for the two Pitch customers, kept apart on purpose:
 * GROUPS (organizers pay for organization + automation) and PLAYERS (pay
 * for their personal football). Public, full width, no app shell.
 *
 * Props:
 *  - user            logged-in account or null
 *  - managedGroups   [{ id, name }] groups this user organizes/assists
 *  - currentPlans    { groups: { [groupId]: planId }, player: planId | null } —
 *                    what the user already pays for (no subscription data
 *                    exists yet, so the app passes nothing today)
 *  - lang, onLang    current UI language + setter (PT-PT / PT-BR / EN)
 * Prices come from lib/plans.js (central config, per market); checkout is
 * behind startCheckout(), and billing is off today.
 */
export default function PricingPage({ user = null, managedGroups = [], currentPlans = null, lang = "pt", onLang }) {
  const [audience, setAudience] = useState("groups"); // groups | players
  const [billing, setBilling] = useState("monthly");   // monthly | annual
  const [size, setSize] = useState("standard");        // standard | large
  const [chosenMarket, setChosenMarket] = useState(explicitMarket);
  const [modal, setModal] = useState(null);            // { planId } | null
  const [notice, setNotice] = useState(false);
  const source = useMemo(sourceFromUrl, []);
  const market = chosenMarket ?? marketFromLang(lang);
  const currency = PRICING[market].currency;
  const loggedIn = Boolean(user);
  const isOrganizer = managedGroups.length > 0;
  const role = !loggedIn ? "anonymous" : isOrganizer ? "organizer" : "player";
  const sent = useRef(false);

  // Fire once: a page view is a page view, even if the account loads after.
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackEvent("pricing_page_viewed", { source, logged_in: loggedIn, user_role: role, market, currency });
  }, [source, loggedIn, role, market, currency]);

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(false), 7000);
    return () => clearTimeout(id);
  }, [notice]);

  // What the user already owns → "Current plan" instead of a purchase CTA.
  const current = useMemo(() => {
    const g = currentPlans?.groups ?? {};
    const all = (planId) => managedGroups.length > 0 && managedGroups.every((m) => g[m.id] === planId);
    return { club: all("club"), club_ai: all("club_ai"), player_plus: currentPlans?.player === "player_plus" };
  }, [currentPlans, managedGroups]);

  const go = (href) => { window.location.href = href; };
  const groupSizeParam = (planId) => (isGroupPlan(planId) && planId !== "free" ? size : "n/a");

  const changeAudience = (id) => { setAudience(id); trackEvent("pricing_tab_changed", { tab: id, market, currency }); };
  const changeBilling = (id) => { setBilling(id); trackEvent("pricing_billing_changed", { billing_period: id, market, currency }); };
  const changeMarket = (id) => {
    setChosenMarket(id);
    try { localStorage.setItem(MARKET_KEY, id); } catch { /* choice just won't persist */ }
    trackEvent("pricing_market_changed", { market: id, currency: PRICING[id].currency });
  };

  const onPlan = (planId) => {
    trackEvent("pricing_plan_clicked", { plan: planId === "player_free" ? "free" : planId, billing_period: billing, market, currency, group_size: groupSizeParam(planId), source });
    // Free paths, and anyone without an account yet: the app's own landing
    // → sign-up flow (signing up first is how a group gets created).
    if (planId === "free" || planId === "player_free" || !loggedIn) return go("/");
    if (isGroupPlan(planId) && !isOrganizer) return go("/"); // nothing to upgrade yet → create a group
    setModal({ planId });
  };

  const onManage = async () => { await manageSubscription(); setNotice(true); };

  const upgradeLabel = loggedIn && isOrganizer;
  const annual = billing === "annual";

  return (
    <div className="pr-root" style={{ background: C.bg, minHeight: "100vh", color: C.text1, fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', system-ui, sans-serif" }}>
      <style>{CSS}</style>

      <header style={{ position: "sticky", top: 0, zIndex: 10, background: `${C.bg}E6`, backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: MAXW, margin: "0 auto", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.md }}>
          <a href="/" aria-label="PITCH"><img src={BRAND.logo} alt="PITCH App" style={{ height: 24, display: "block" }} /></a>
          <div style={{ display: "flex", alignItems: "center", gap: S.md }}>
            {onLang && (
              <select value={lang} onChange={(e) => onLang(e.target.value)} aria-label="Language"
                style={{ background: C.surface, color: C.text1, border: `1px solid ${C.border}`, borderRadius: 10, minHeight: 36, padding: "0 8px", fontSize: 12, fontWeight: 700, outline: "none", cursor: "pointer" }}>
                <option value="pt">🇵🇹 PT</option>
                <option value="pt-br">🇧🇷 PT-BR</option>
                <option value="en">🇬🇧 EN</option>
              </select>
            )}
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 44, color: C.text2, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              <ArrowLeft size={15} aria-hidden /> {t(PAGE.back)}
            </a>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: MAXW, margin: "0 auto", padding: "28px 20px 80px" }}>
        {/* ── hero: kept short so the cards sit near the fold ── */}
        <section style={{ textAlign: "center", marginBottom: S.xl }}>
          <h1 style={{ ...displayFont, fontSize: "clamp(28px, 5.4vw, 48px)", lineHeight: 1.05, margin: `0 auto ${S.sm}px`, maxWidth: 780 }}>{t(PAGE.heroTitle)}</h1>
          <p style={{ fontSize: "clamp(15px, 2vw, 17px)", color: C.text2, lineHeight: 1.5, margin: "0 auto", maxWidth: 600 }}>{t(PAGE.heroSub)}</p>
        </section>

        {/* ── toggles: market · audience · billing · group size ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: S.md, marginBottom: S.xxl }}>
          <div style={{ width: "100%", maxWidth: 300 }}>
            <div style={caption}>{t(PAGE.marketLabel)}</div>
            <Segmented label={t(PAGE.marketLabel)} value={market} onChange={changeMarket}
              options={[["EU", t(PAGE.marketEu)], ["BR", t(PAGE.marketBr)]]} />
          </div>
          <div style={{ width: "100%", maxWidth: 420 }}>
            <Segmented label="Audience" value={audience} onChange={changeAudience}
              options={[["groups", t(PAGE.tabGroups)], ["players", t(PAGE.tabPlayers)]]} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "flex-end", gap: S.md, width: "100%" }}>
            <div style={{ width: "100%", maxWidth: 300 }}>
              <Segmented label="Billing" value={billing} onChange={changeBilling}
                options={[["monthly", t(PAGE.monthly)], ["annual", t(PAGE.annual)]]} />
            </div>
            {audience === "groups" && (
              <div style={{ width: "100%", maxWidth: 300 }}>
                <div style={caption}>{t(PAGE.groupSize)}</div>
                <Segmented label={t(PAGE.groupSize)} value={size} onChange={setSize}
                  options={[["standard", "≤ 30"], ["large", "31–60"]]} />
              </div>
            )}
          </div>
          <div style={{ fontSize: T.meta, color: C.text2, minHeight: 18, textAlign: "center" }}>
            {annual
              ? <strong style={{ color: C.accent }}>{t(PAGE.saveTwoMonths)}</strong>
              : audience === "groups" ? t(PAGE.activeNote) : t(PAGE.groupLimitNote)}
          </div>
        </div>

        {/* logged-in players who don't organize anything: point at Player+ */}
        {audience === "groups" && loggedIn && !isOrganizer && (
          <div style={{ textAlign: "center", marginBottom: S.xl }}>
            <button type="button" onClick={() => changeAudience("players")}
              style={{ minHeight: 44, background: C.accentDim, color: C.accent, border: `1px solid ${C.accentBorder}`, borderRadius: R.pill, padding: `0 ${S.lg}px`, fontSize: T.body, fontWeight: 800, cursor: "pointer" }}>
              {t(PAGE.playerHint)}
            </button>
          </div>
        )}

        {/* ── plans ── */}
        {audience === "groups"
          ? <PricingGroupPlans billing={billing} size={size} market={market} upgradeLabel={upgradeLabel} current={current} onPlan={onPlan} onManage={onManage} />
          : <PricingPlayerPlans billing={billing} market={market} current={current.player_plus} onPlan={onPlan} onManage={onManage} />}

        {audience === "groups" && (
          <p style={{ textAlign: "center", fontSize: T.meta, color: C.text2, margin: `${S.lg}px auto 0`, maxWidth: 560, lineHeight: 1.5 }}>{t(PAGE.groupLimitNote)}</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 64, marginTop: 72 }}>
          {audience === "groups" && <PricingPayments market={market} />}
          <PricingAiPair />
          <PricingComparison audience={audience} />
          <PricingFaq onOpen={(id) => trackEvent("pricing_faq_opened", { question: id, market })} />

          {/* ── final CTA ── */}
          <section style={{ textAlign: "center", padding: `${S.xxl}px ${S.lg}px`, background: C.accentDim, border: `1px solid ${C.accentBorder}`, borderRadius: R.card }}>
            <h2 style={{ ...displayFont, fontSize: "clamp(24px, 4.5vw, 36px)", margin: `0 0 ${S.sm}px` }}>{t(FINAL.title)}</h2>
            <p style={{ fontSize: T.body, color: C.text2, margin: `0 auto ${S.xl}px`, maxWidth: 480, lineHeight: 1.5 }}>{t(FINAL.sub)}</p>
            <BtnPrimary onClick={() => onPlan(audience === "players" ? "player_free" : "free")} style={{ minWidth: 220 }}>{t(FINAL.cta)}</BtnPrimary>
            <div style={{ fontSize: T.min, color: C.text3, marginTop: S.lg }}>{t(market === "BR" ? PAGE.pricesBr : PAGE.pricesEu)}</div>
          </section>
        </div>
      </main>

      {notice && (
        <div role="status" style={{ position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 90, maxWidth: 480, margin: "0 auto", background: C.card, border: `1px solid ${C.accentBorder}`, borderRadius: R.card, padding: S.lg, boxShadow: "0 8px 30px rgba(0,0,0,.4)" }}>
          <div style={{ fontSize: T.body, fontWeight: 800, marginBottom: S.xs }}>{t(UPGRADE.soonTitle)}</div>
          <div style={{ fontSize: T.body, color: C.text2, lineHeight: 1.45 }}>{t(UPGRADE.soonBody)}</div>
        </div>
      )}

      {modal && (
        <UpgradeModal planId={modal.planId} billing={billing} size={size} market={market} groups={managedGroups} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
