import { useState } from "react";
import { Megaphone } from "lucide-react";
import { C, R, S, T } from "../../../theme";
import { t } from "../../../lib/i18n";
import { fmtDateTime } from "../../../lib/leagueDemo";
import BtnGhost from "../../BtnGhost";

const SHOWN = 3;

/** The league's avisos, pinned first. Three show; the rest open with one tap. */
export default function LandingNotices({ notices, brand, ink, lang }) {
  const [all, setAll] = useState(false);
  const list = all ? notices : notices.slice(0, SHOWN);
  return (
    <div>
      {list.map((n) => (
        <article key={n.id} style={{ display: "flex", gap: S.md, background: C.card, border: `1px solid ${n.pinned ? `${brand}88` : C.border}`, borderRadius: R.card, padding: S.md, marginBottom: S.sm }}>
          <Megaphone size={18} color={ink} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: T.body, fontWeight: 800, overflowWrap: "anywhere", color: C.text1 }}>{n.title}</h3>
            <div style={{ fontSize: T.meta, color: C.text2, margin: "2px 0 6px" }}>{n.pinned ? `${t("Fixado")} · ` : ""}{fmtDateTime(n.at, lang)}</div>
            <div style={{ fontSize: T.body, color: C.text1, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.body}</div>
          </div>
        </article>
      ))}
      {notices.length > SHOWN && <BtnGhost compact onClick={() => setAll(!all)}>{all ? t("Mostrar menos") : `${t("Ver todos os avisos")} (${notices.length})`}</BtnGhost>}
    </div>
  );
}
