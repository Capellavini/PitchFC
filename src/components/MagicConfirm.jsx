import { useEffect, useState } from "react";
import { Check, X, Clock, MapPin } from "lucide-react";
import { supabase, supabaseEnabled } from "../lib/supabase";
import { C, BRAND, cardStyle, displayFont, fieldBackdrop } from "../theme";

const WD = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fmt = (iso) => {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()]} · ${hh}:${mm}`;
};

/**
 * No-login confirmation page reached via ?confirm=<magic_token>. Reads and
 * writes the player's attendance through SECURITY DEFINER RPCs (the token
 * is the credential), so it works for anonymous visitors despite RLS.
 */
export default function MagicConfirm({ token }) {
  const [state, setState] = useState({ loading: true, error: null, info: null });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!supabaseEnabled) { setState({ loading: false, error: "Indisponível neste modo.", info: null }); return; }
    const { data, error } = await supabase.rpc("magic_game_info", { token });
    if (error) setState({ loading: false, error: error.message, info: null });
    else if (!data) setState({ loading: false, error: "Link inválido ou expirado.", info: null });
    else setState({ loading: false, error: null, info: data });
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const setStatus = async (s) => {
    setBusy(true);
    const { data } = await supabase.rpc("magic_set_status", { token, new_status: s });
    setBusy(false);
    if (data) setState((st) => ({ ...st, info: data }));
  };

  const wrap = (children) => (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 20px", ...fieldBackdrop(0.5, 0.94) }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <img src={BRAND.logo} alt="PITCH Club" style={{ width: "58%", maxWidth: 210 }} />
      </div>
      {children}
    </div>
  );

  if (state.loading) return wrap(<div style={{ textAlign: "center", color: C.text2, fontSize: 13 }}>A carregar…</div>);
  if (state.error) return wrap(<div style={{ ...cardStyle, textAlign: "center", padding: 24, color: C.text2, fontSize: 14 }}>{state.error}</div>);

  const { player, game, group, status, confirmed } = state.info;

  if (!game) {
    return wrap(
      <div style={{ ...cardStyle, textAlign: "center", padding: 24 }}>
        <div style={{ ...displayFont, fontSize: 20, marginBottom: 6 }}>Olá {player.nick}! 👋</div>
        <div style={{ fontSize: 13, color: C.text2 }}>Não há jogo aberto de momento. Recebes o link quando abrir o próximo.</div>
      </div>
    );
  }

  const isConfirmed = status === "confirmed";
  const isDeclined = status === "declined";

  return wrap(
    <div style={{ ...cardStyle, padding: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: C.text2, marginBottom: 4 }}>PRÓXIMO JOGO</div>
      <div style={{ ...displayFont, fontSize: 22, marginBottom: 8 }}>{group?.name ?? "Jogo"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: C.text2, marginBottom: 16 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Clock size={14} /> {fmt(game.scheduled_at)}</span>
        {game.venue && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={14} /> {game.venue}</span>}
        <span style={{ color: C.text3 }}>{confirmed}/{game.spots} confirmados</span>
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: isConfirmed ? C.green : isDeclined ? C.red : C.text1 }}>
        {isConfirmed ? "✅ Estás dentro!" : isDeclined ? "❌ Marcaste que não podes" : `Olá ${player.nick}! Vais jogar?`}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setStatus("confirmed")} disabled={busy}
          style={{ flex: 1, background: isConfirmed ? C.green : C.accent, color: C.bg, border: "none", borderRadius: 12, padding: 14, fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
          <Check size={17} /> {isConfirmed ? "Confirmado" : "Vou jogar"}
        </button>
        <button onClick={() => setStatus("declined")} disabled={busy}
          style={{ flex: 1, background: isDeclined ? C.redDim : C.card, color: isDeclined ? C.red : C.text2, border: `1px solid ${isDeclined ? C.red : C.border}`, borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
          <X size={17} /> Não posso
        </button>
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: C.text3, marginTop: 16 }}>
        Podes mudar a tua resposta a qualquer momento neste link.
      </div>
    </div>
  );
}
