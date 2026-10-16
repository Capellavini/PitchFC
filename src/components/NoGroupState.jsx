import { useState } from "react";
import { Users, Shield, ChevronRight, MapPin, Check } from "lucide-react";
import { C, R, S, T, cardStyle, displayFont, inputStyle } from "../theme";
import { t } from "../lib/i18n";
import { RC } from "../lib/rivalsCopy";
import { supabase, supabaseEnabled } from "../lib/supabase";
import BtnPrimary from "./BtnPrimary";
import BtnGhost from "./BtnGhost";

// Remembers (per device) that this player already asked to be told about
// open games nearby, so the form doesn't ask again.
const WAITLIST_KEY = "pitch.v2.playerWaitlist";
const readWaitlist = () => {
  try { return JSON.parse(localStorage.getItem(WAITLIST_KEY))?.city || null; } catch { return null; }
};
const saveWaitlist = (city) => {
  try { localStorage.setItem(WAITLIST_KEY, JSON.stringify({ city, at: new Date().toISOString() })); } catch { /* storage blocked — fine */ }
};

/**
 * Shown on the Jogar / Matchday tabs when a logged-in player hasn't joined
 * a group yet. Non-blocking: keeps them in the app (profile, Home,
 * Competir all work) instead of forcing the invite-code wall. A player
 * who's in a PITCH Rivals team (`onOpenTeams`) also gets a link to where
 * their team's games live.
 *
 * Also hosts the "avisa-me quando houver jogos perto de mim" waitlist the
 * landing page promises solo players: city → submit_lead() with
 * source "player_waitlist" (`contact` = { name, email } of the signed-in
 * user). Demo mode (no Supabase) only shows the success state.
 */
export default function NoGroupState({ onJoinGroup, onOpenTeams, contact }) {
  const [doneCity, setDoneCity] = useState(readWaitlist);
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("idle"); // idle | busy | error | empty

  const submit = async (e) => {
    e.preventDefault();
    const c = city.trim();
    if (!c) { setStatus("empty"); return; }
    setStatus("busy");
    if (supabaseEnabled && supabase) {
      const { error } = await supabase.rpc("submit_lead", {
        payload: { name: contact?.name || "", email: contact?.email || "", city: c, source: "player_waitlist" },
      });
      if (error) { setStatus("error"); return; }
    }
    saveWaitlist(c);
    setDoneCity(c);
    setStatus("idle");
  };

  return (
    <div style={{ padding: `0 ${S.lg}px` }}>
      {onOpenTeams && (
        <button type="button" onClick={onOpenTeams}
          style={{ ...cardStyle, width: "100%", marginTop: S.xl, display: "flex", alignItems: "center", gap: S.md, minHeight: 56, cursor: "pointer", textAlign: "left", color: C.text1, borderLeft: `3px solid ${C.accent}` }}>
          <span style={{ width: 40, height: 40, borderRadius: R.control, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Shield size={20} color={C.accent} />
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: T.body, fontWeight: 700 }}>{t(RC.teamGamesInCompetir)}</span>
          <ChevronRight size={18} color={C.text2} />
        </button>
      )}
      <div style={{ ...cardStyle, textAlign: "center", padding: "32px 22px", marginTop: onOpenTeams ? S.md : S.xl }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Users size={26} color={C.accent} />
        </div>
        <div style={{ ...displayFont, fontSize: 22, marginBottom: 8 }}>{t("Ainda sem grupo")}</div>
        <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginBottom: 20 }}>
          {t("Entra num grupo com o link de convite do teu organizador para veres o jogo, a grelha de vagas, o sorteio e as stats. Entretanto, podes na mesma criar o teu cartão e acompanhar a atividade na Home.")}
        </div>
        <BtnPrimary onClick={onJoinGroup} style={{ width: "100%", fontSize: 14, padding: 13 }}>
          {t("Entrar num grupo")}
        </BtnPrimary>

        <div style={{ borderTop: `1px solid ${C.border}`, marginTop: S.xl, paddingTop: S.lg, textAlign: "left" }}>
          {doneCity ? (
            <div role="status" style={{ display: "flex", gap: S.sm, alignItems: "flex-start", fontSize: 13, color: C.text1, lineHeight: 1.55 }}>
              <Check size={16} color={C.green} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{t("Combinado! Avisamos-te por email quando houver jogos abertos em {city}.").replace("{city}", doneCity)}</span>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <label htmlFor="ng-city" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: C.text1, marginBottom: S.sm }}>
                <MapPin size={14} color={C.accent} /> {t("Avisa-me quando houver jogos perto de mim")}
              </label>
              <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
                <input id="ng-city" type="text" required autoComplete="address-level2" value={city}
                  onChange={(e) => { setCity(e.target.value); if (status !== "busy") setStatus("idle"); }}
                  placeholder={t("A tua cidade")} aria-label={t("Cidade")}
                  style={{ ...inputStyle(), background: C.surface, flex: "1 1 160px", width: "auto" }} />
                <BtnGhost type="submit" tone="accent" disabled={status === "busy"} style={{ flex: "1 1 auto" }}>
                  {status === "busy" ? t("A enviar…") : t("Avisar-me")}
                </BtnGhost>
              </div>
              {status === "empty" && <div role="alert" style={{ fontSize: 12, color: C.orange, marginTop: S.sm }}>{t("Escreve a tua cidade.")}</div>}
              {status === "error" && <div role="alert" style={{ fontSize: 12, color: C.red, marginTop: S.sm }}>{t("Não deu para guardar — tenta outra vez.")}</div>}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
