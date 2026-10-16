import { C, cardStyle, displayFont } from "../theme";
import { t, tCtx } from "../lib/i18n";

/** Hero phone #2 — Matchday ao vivo: score, the night's events, MVP vote. */
export default function LandingMatchdayScreen() {
  const EVENTS = [
    { color: C.accent, name: "Tiago", label: "Golo" },
    { color: C.blue, name: "Rui", label: "Assistência" },
    { color: C.green, name: "Marco", label: "Defesa" },
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.text1 }}>Matchday</span>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: C.red, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: C.red }} />{t("AO VIVO")}
        </span>
      </div>
      <div style={{ ...cardStyle, padding: 12 }}>
        <div style={{ fontSize: 9.5, fontWeight: 800, color: C.text2, textAlign: "center", marginBottom: 6 }}>{tCtx("landing", "Jogo 2")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", textAlign: "center" }}>
          <div>
            <div style={{ ...displayFont, fontSize: 26, color: C.accent }}>3</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: C.text2 }}>{t("Coletes")}</div>
          </div>
          <span style={{ fontSize: 12, color: C.text3 }}>—</span>
          <div>
            <div style={{ ...displayFont, fontSize: 26, color: C.blue }}>2</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: C.text2 }}>{t("Sem colete")}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
        {EVENTS.map((e) => (
          <div key={e.name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: e.color, flexShrink: 0 }} />
            <b style={{ color: C.text1 }}>{e.name}</b>
            <span style={{ color: C.text2, marginLeft: "auto" }}>{tCtx("landing", e.label)}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, padding: "8px 10px", borderRadius: 10, background: C.accentDim, border: `1px solid ${C.accentBorder}`, fontSize: 10.5, fontWeight: 800, color: C.accent, textAlign: "center" }}>
        {t("MVP · votação aberta")}
      </div>
    </div>
  );
}
