import { useEffect, useState } from "react";
import { Search, MapPin, MessageCircle } from "lucide-react";
import { C, S, T, TOUCH, cardStyle, inputStyle } from "../theme";
import { t } from "../lib/i18n";
import { RC, rivalsError, tf } from "../lib/rivalsCopy";
import { TEAM_FORMATS } from "../lib/rivals";
import { openWhatsApp } from "../lib/whatsapp";
import OptionPills from "./OptionPills";
import TeamDirectoryCard from "./TeamDirectoryCard";
import SectionLabel from "./SectionLabel";
import BtnGhost from "./BtnGhost";

const PAGE = 20;

/**
 * "Descobrir" — the team directory (owner decision 2026-10-08): listed,
 * non-archived teams of my country, same city first, then region.
 * Filters: free text, city, format, "só a minha zona". Signed-in only
 * (list_teams). `home` = { country, city, region } of my current team
 * (or the market default). `onOpenTeam(slug)`; `onChallenge` → PR5.
 */
export default function TeamDirectory({ teams, home, onOpenTeam, onChallenge }) {
  const country = home?.country || "PT";
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(home?.city || "");
  const [format, setFormat] = useState("");
  const [onlyNear, setOnlyNear] = useState(false);
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPage = async (offset) => {
    setLoading(true); setError(null);
    const r = await teams.listTeams({ country, city: city.trim() || null, region: home?.region || null, format: format || null, query: query.trim() || null, onlyNear, limit: PAGE, offset });
    setLoading(false);
    if (r.error) { setError(rivalsError(r.error)); return; }
    setItems((prev) => (offset ? [...prev, ...r.data.items] : r.data.items));
    setHasMore(r.data.hasMore);
  };

  useEffect(() => {
    const id = setTimeout(() => fetchPage(0), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, city, format, query, onlyNear, teams.revision]);

  const inviteRivals = () => openWhatsApp(tf(RC.inviteRivalsMessage, { url: window.location.origin }));
  const where = city.trim() || home?.region || "";

  return (
    <div>
      <SectionLabel>{t(RC.discoverTitle)}</SectionLabel>
      <div style={{ position: "relative", marginBottom: S.sm }}>
        <Search size={16} color={C.text2} aria-hidden style={{ position: "absolute", left: 12, top: 14 }} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(RC.searchPlaceholder)}
          aria-label={t(RC.searchPlaceholder)} style={{ ...inputStyle(), paddingLeft: 36 }} />
      </div>
      <div style={{ display: "flex", gap: S.sm, marginBottom: S.sm, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 150px" }}>
          <MapPin size={16} color={C.text2} aria-hidden style={{ position: "absolute", left: 12, top: 14 }} />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t(RC.cityPlaceholder)} aria-label={t(RC.cityPlaceholder)}
            style={{ ...inputStyle(), paddingLeft: 36 }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: S.sm, minHeight: TOUCH.min, fontSize: T.meta + 1, color: C.text1, cursor: "pointer" }}>
          <input type="checkbox" checked={onlyNear} onChange={(e) => setOnlyNear(e.target.checked)} style={{ width: 20, height: 20, accentColor: C.accent }} />
          {t(RC.onlyNear)}
        </label>
      </div>
      <div style={{ marginBottom: S.lg }}>
        <OptionPills label={t(RC.format)} value={format}
          options={[{ id: "", label: t(RC.allFormats) }, ...TEAM_FORMATS.map((x) => ({ id: x, label: x }))]} onChange={setFormat} />
      </div>

      {error && <div role="alert" style={{ fontSize: T.meta + 0.5, color: C.red, marginBottom: S.md }}>{error}</div>}

      <div aria-live="polite" aria-busy={loading}>
        {items.map((tm) => (
          <TeamDirectoryCard key={tm.id} team={tm} onOpen={() => onOpenTeam(tm.slug)} onChallenge={onChallenge ? () => onChallenge(tm) : undefined} />
        ))}
        {!loading && !error && items.length === 0 && (
          <div style={{ ...cardStyle, textAlign: "center", padding: `${S.xl}px ${S.lg}px` }}>
            <div style={{ fontSize: T.body, color: C.text1, fontWeight: 700, lineHeight: 1.5, marginBottom: S.md }}>
              {where ? tf(RC.emptyDirectoryCity, { city: where }) : t(RC.emptyDirectory)}
            </div>
            <BtnGhost tone="accent" onClick={inviteRivals}><MessageCircle size={16} /> {t(RC.inviteRivals)}</BtnGhost>
          </div>
        )}
        {loading && items.length === 0 && <div style={{ fontSize: T.body, color: C.text2, padding: `${S.md}px 0` }}>{t(RC.loading)}</div>}
        {hasMore && !loading && <BtnGhost block onClick={() => fetchPage(items.length)}>{t(RC.loadMore)}</BtnGhost>}
      </div>
    </div>
  );
}
