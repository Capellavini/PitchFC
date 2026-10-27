// Presentation mode personas. "Entering" a persona = writing the demo
// storage keys (same namespace as lib/storage.js in presentation mode) and
// jumping to the right screen; the app reads them on load.
const NS = "pitch.demo.v1.";
const put = (key, value) => { try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch { /* ignore */ } };

export const PERSONAS = [
  { id: "player", emoji: "⚽", title: "Jogador", who: "Carlão · FC Amigos", blurb: "Confirma presença, vê o cartão FUT, stats da carreira, Fantasy e o feed do grupo." },
  { id: "organizer", emoji: "📋", title: "Organizador", who: "Carlão · FC Amigos", blurb: "O jogo de sábado sem o caos: lista, pagamentos, sorteio de equipas e Matchday ao vivo." },
  { id: "rivals", emoji: "🛡️", title: "Equipa · Rivals", who: "FC Amigos · capitão", blurb: "Desafia outras equipas, combina o jogo, regista resultados e acompanha o histórico." },
  { id: "league", emoji: "🏆", title: "Liga", who: "Liga Amadora de Matosinhos", blurb: "Classificação, calendário, súmulas ao vivo, regulamento e a visão de adepto." },
];

export function enterPersona(id) {
  if (id === "league") { window.location.href = "/league/demo?demo=1"; return; }
  put("session", { role: id === "organizer" ? "organizer" : "player", onboarded: true });
  put("homeContexts", { demo: id === "rivals" ? "rivals" : "player" });
  put("tourSeen_v1", true);
  put("whatsNew_nav5_v1", true);
  put("aiOnboardingDone", true);
  window.location.href = "/?demo=1";
}

export const LANGS = [{ id: "pt", label: "PT" }, { id: "pt-br", label: "BR" }, { id: "en", label: "EN" }];

/** Persist the demo language (the app reads it on load) and reload in place. */
export function setPresentationLang(id) {
  put("lang", id);
  window.location.reload();
}

export function resetPresentationData() {
  Object.keys(localStorage).filter((k) => k.startsWith(NS) || k === "pitch.v2.leagueDemo").forEach((k) => localStorage.removeItem(k));
}
