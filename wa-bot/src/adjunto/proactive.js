// Treinador Adjunto — proactive DM schedule (plan §8.5 as amended:
// NO "confirmations opened" DM (decision 8); team proposal at T-24h
// (decision 3)). Pure: given one (link, group, game) snapshot, which DMs
// are due? No I/O, unit-tested like events.js.
//
//  kind               when                                        urgent
//  adj_status   (P1)  T-48h..T-24h, Lisbon 10–21h, < 80% full, game >12h old
//  adj_hint     (P2)  T-26h..T-24h, not full, no P1 action this cycle
//  adj_gameday  (P3)  game day ≥10:00 until kickoff, not full
//  adj_spot     (P4)  a FULL game dropped below spots, ≤36h, no waitlist   ✓
//  adj_teams    (P5)  ≤ teamsLeadHours (24) to kickoff, teams not confirmed, ≥4 playing
//  adj_teams_full     game became full after the organizer said "espera"
//  adj_groupstage (P6) personalizado with play-off: group stage just finished  ✓
//  adj_summary  (P7)  matchday committed ≤30 min ago                          ✓
//  adj_unfinished (P8) live_matchday still open at kickoff+4h, and next day 10:00
//  adj_format_nudge (P9) 24h after linking, format still unset (once)
//
// Rules: dedupe by key (claimed in bot_announcements, so restarts never
// repeat); quiet 23:00–09:00 Lisbon holds everything (retried next poll);
// max 3 non-urgent DMs per link per day; prefs.proactive=false → nothing;
// nothing about something the organizer did themselves <10 min ago.
import { isQuietHour, lisbonDayKey, lisbonMinutesOfDay } from "../time.js";
import { playoffState } from "../core/standings.js";

export const URGENT = new Set(["adj_spot", "adj_groupstage", "adj_summary"]);
const H = 36e5;

export function decideAdjunto({
  link, game, spots, confirmed, waitlist = 0, prevConfirmed = null, teamsWaiting = false,
  formatSet = true, matchdays = [], now, sentToday = 0, lastOwnActionAt = null, p1Acted = false,
  quietStart = 23, quietEnd = 9, dailyCap = 3,
}) {
  const prefs = link.prefs ?? {};
  if (prefs.proactive === false) return [];
  const L = link.id;
  const ev = [];

  if (!formatSet && link.linked_at && now - new Date(link.linked_at) >= 24 * H) {
    ev.push({ kind: "adj_format_nudge", key: `adj:format_nudge:${L}` });
  }

  for (const md of matchdays) {
    const age = (now - new Date(md.created_at)) / H;
    if (age >= 0 && age <= 0.5) ev.push({ kind: "adj_summary", key: `adj:summary:${L}:${md.id}`, matchdayId: md.id });
  }

  if (game) {
    const gid = game.id, cyc = game.cycle_opened_at ?? "once";
    const k = (kind) => `adj:${kind.replace(/^adj_/, "")}:${L}:${gid}:${cyc}`;
    const h = (new Date(game.scheduled_at) - now) / H;
    const open = ["open", "full"].includes(game.status);
    const live = Boolean(game.live_matchday);
    const ageH = (now - new Date(game.created_at)) / H;
    const mins = lisbonMinutesOfDay(now);
    const recentOwn = lastOwnActionAt && now - new Date(lastOwnActionAt) < 10 * 60 * 1000;

    if (open && !live && !recentOwn) {
      if (h > 24 && h <= 48 && mins >= 10 * 60 && mins < 21 * 60 && confirmed < Math.ceil(0.8 * spots) && ageH > 12) ev.push({ kind: "adj_status", key: k("adj_status") });
      if (h > 24 && h <= 26 && confirmed < spots && !p1Acted) ev.push({ kind: "adj_hint", key: k("adj_hint") });
      if (h > 0 && lisbonDayKey(new Date(game.scheduled_at)) === lisbonDayKey(now) && mins >= 10 * 60 && confirmed < spots) ev.push({ kind: "adj_gameday", key: k("adj_gameday") });
      if (prevConfirmed !== null && prevConfirmed >= spots && confirmed < spots && h > 0 && h <= 36 && waitlist === 0) {
        ev.push({ kind: "adj_spot", key: `${k("adj_spot")}:${prevConfirmed}>${confirmed}:${Math.floor(now.getTime() / 6e5)}` });
      }
    }
    const lead = Number.isFinite(prefs.teamsLeadHours) ? prefs.teamsLeadHours : 24;
    if (open && !live && !game.teams_confirmed && h > 0 && h <= lead && Math.min(confirmed, spots) >= 4) {
      ev.push({ kind: "adj_teams", key: k("adj_teams"), full: confirmed >= spots });
      if (teamsWaiting && confirmed >= spots) ev.push({ kind: "adj_teams_full", key: k("adj_teams_full"), full: true });
    }
    if (live) {
      const md = game.live_matchday;
      const po = playoffState(md);
      if (md.mode === "personalizado" && md.config?.faseFinal && po.currentRound === 0 && po.canAdvance) ev.push({ kind: "adj_groupstage", key: k("adj_groupstage") });
      if (h <= -4) ev.push({ kind: "adj_unfinished", key: `${k("adj_unfinished")}:1` });
      if (lisbonDayKey(now) !== lisbonDayKey(new Date(game.scheduled_at)) && mins >= 10 * 60 && h < 0) ev.push({ kind: "adj_unfinished", key: `${k("adj_unfinished")}:2` });
    }
  }

  if (isQuietHour(quietStart, quietEnd, now)) return [];
  let budget = Math.max(0, dailyCap - sentToday);
  return ev.filter((e) => {
    e.urgent = URGENT.has(e.kind);
    if (e.urgent) return true;
    if (budget <= 0) return false;
    budget--;
    return true;
  });
}
