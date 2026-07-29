import { Flag, Trophy, Target, History, ShieldCheck, Crown, CheckCircle2, Zap, Sparkles, Award, Compass, ThumbsUp } from "lucide-react";

// Every check() reads only from data already tracked elsewhere in the app
// (season totals on the player row, or the normalized per-matchday detail
// built in PitchApp) — no new tables, computed fresh on every render.
const inAnyMatchday = (matchdays, pred) => (matchdays || []).some(pred);

export const ACHIEVEMENTS = [
  // ── Career milestones (season totals) ──────────────────────────
  {
    id: "estreante", tier: "bronze", icon: Flag,
    name: "Estreante", desc: "Disputou o primeiro jogo",
    check: (p) => (p.gamesPlayed || 0) >= 1,
  },
  {
    id: "bota-ouro", tier: "gold", icon: Trophy,
    name: "Bota de Ouro", desc: "10 golos na temporada",
    check: (p) => (p.goals || 0) >= 10,
  },
  {
    id: "criador-jogo", tier: "silver", icon: Target,
    name: "Criador de Jogo", desc: "10 assistências na temporada",
    check: (p) => (p.assists || 0) >= 10,
  },
  {
    id: "veterano", tier: "gold", icon: History,
    name: "Veterano", desc: "50 jogos disputados",
    check: (p) => (p.gamesPlayed || 0) >= 50,
  },
  {
    id: "muralha", tier: "silver", icon: ShieldCheck,
    name: "Muralha", desc: "10 jogos sem sofrer golos",
    check: (p) => (p.cleanSheets || 0) >= 10,
  },
  {
    id: "rei-da-noite", tier: "legend", icon: Crown,
    name: "Rei da Noite", desc: "5 vezes eleito MVP",
    check: (p) => (p.mvps || 0) >= 5,
  },
  {
    id: "fiel", tier: "silver", icon: CheckCircle2,
    name: "Fiel", desc: "90%+ de presença na temporada",
    check: (p, ctx) => (ctx.attendancePct ?? 0) >= 90,
  },

  // ── Single-match feats (per-game breakdown of a matchday) ──────
  {
    id: "hat-trick", tier: "gold", icon: Zap,
    name: "Hat-trick", desc: "3 ou mais golos numa só partida",
    check: (p, ctx) => inAnyMatchday(ctx.matchdays, (md) =>
      md.matches.some((m) => (m.lines || []).some((l) => l.key === ctx.playerKey && l.goals >= 3))),
  },
  {
    id: "show-particular", tier: "bronze", icon: Sparkles,
    name: "Show Particular", desc: "Golo e assistência na mesma partida",
    check: (p, ctx) => inAnyMatchday(ctx.matchdays, (md) =>
      md.matches.some((m) => (m.lines || []).some((l) => l.key === ctx.playerKey && l.goals >= 1 && l.assists >= 1))),
  },
  {
    id: "heroi-vitoria", tier: "legend", icon: Award,
    name: "Herói da Vitória", desc: "MVP da noite com 2+ golos",
    check: (p, ctx) => inAnyMatchday(ctx.matchdays, (md) => {
      if (md.mvpKey == null || md.mvpKey !== ctx.playerKey) return false;
      const line = (md.nightLines || []).find((l) => l.key === ctx.playerKey);
      return (line?.goals || 0) >= 2;
    }),
  },

  // ── Group & community ────────────────────────────────────────
  {
    id: "lideranca", tier: "bronze", icon: Compass,
    name: "Liderança", desc: "Foi organizador ou auxiliar do grupo",
    check: (p, ctx) => Boolean(ctx.isLeader),
  },
  {
    id: "bem-visto", tier: "gold", icon: ThumbsUp,
    name: "Bem-visto", desc: "Cartão com overall 80+ (avaliação dos colegas)",
    check: (p, ctx) => (ctx.overall ?? 0) >= 80,
  },
];

/** ctx: { attendancePct, matchdays, playerKey, overall, isLeader } */
export function computeAchievements(player, ctx) {
  return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: a.check(player, ctx) }));
}
