import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { C, R, S, T, TOUCH, inputStyle } from "../theme";
import { t } from "../lib/i18n";
import { CC } from "../lib/rivalsCopy";
import TeamBadge from "./TeamBadge";

/** Pick the team to challenge from the directory (same country; nearby
 *  first). `exclude` = my team ids. onPick(team). */
export default function OpponentPicker({ teams, country = "PT", city, exclude = [], onPick }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const id = setTimeout(async () => {
      const r = await teams.listTeams({ country, city: city || null, query: query.trim() || null, limit: 20 });
      if (!live) return;
      setLoading(false);
      setItems(r.error ? [] : r.data.items.filter((x) => !exclude.includes(x.id) && !x.myRole));
    }, 250);
    return () => { live = false; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, country, city]);

  return (
    <div>
      <div style={{ position: "relative" }}>
        <Search size={16} color={C.text2} aria-hidden style={{ position: "absolute", left: 12, top: 14 }} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(CC.searchOpponent)}
          aria-label={t(CC.searchOpponent)} style={{ ...inputStyle(), paddingLeft: 36 }} />
      </div>
      <div aria-live="polite" aria-busy={loading} style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: S.sm, maxHeight: 260, overflowY: "auto" }}>
        {items.slice(0, 8).map((tm) => (
          <button key={tm.id} type="button" onClick={() => onPick(tm)} style={{
            display: "flex", alignItems: "center", gap: S.md, minHeight: TOUCH.min + 8, padding: `6px ${S.md}px`, textAlign: "left",
            background: C.card, border: `1px solid ${C.border}`, borderRadius: R.control, cursor: "pointer", color: C.text1,
          }}>
            <TeamBadge team={tm} size={32} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: T.body, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tm.name}</span>
              <span style={{ display: "block", fontSize: T.meta, color: C.text2 }}>{[tm.city || tm.region, tm.format].filter(Boolean).join(" · ")}</span>
            </span>
          </button>
        ))}
        {!loading && items.length === 0 && <div style={{ fontSize: T.meta, color: C.text2, lineHeight: 1.5 }}>{t(CC.noTeamsFound)}</div>}
      </div>
    </div>
  );
}
