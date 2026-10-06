// Pure decision logic: given what we see now and what we saw last time,
// which announcements are due? No I/O here, so it is unit-tested.
//
// Rules baked in (from the group-bot playbook):
//  - milestones are proportional to the group size, coalesced to the highest crossed
//  - "vaga aberta" only when the game WAS full (a drop from 8 to 7 is not news)
//  - a decline that still leaves the XI full means a waitlister was auto-
//    promoted into it — its own "promoted" kind, distinct from "spot_opened"
//    (which is for when nobody was waiting to fill the gap)
//  - cancellation is its own kind and is flagged urgent

import { lisbonDayKey, lisbonMinutesOfDay } from "./time.js";

/** Dedupe key of the automatic 24h group reminder. Exported so the
 *  Treinador Adjunto claims the SAME key after the organizer sends a
 *  reminder from the DM — the group never gets two (plan §8.5). Not
 *  cycle-keyed yet (plan §0.5 is a separate fix). */
export const reminderKey = (game) => `reminder:${game.id}:${cycleOf(game)}`;

/** A recurring game reuses its games row every week; cycle_opened_at marks
 *  each weekly reset. Every once-per-game key carries it, or the dedupe row
 *  claimed in week 1 would silently block every later week. */
export const cycleOf = (game) => game.cycle_opened_at ?? "once";

/** Previous confirmed count for decide(), or null when this is a fresh
 *  weekly cycle (so the reset's drop to 0 isn't read as "abriu vaga" and
 *  "Jogo aberto" can fire again). A stored state without a cycle is a
 *  pre-migration row: treated as the current cycle once (no re-announce
 *  on deploy), then overwritten with the cycle by setPrev. */
export function prevForCycle(state, game) {
  if (!state) return null;
  if (state.cycle == null) return state.n;
  const cur = game.cycle_opened_at ? new Date(game.cycle_opened_at).getTime() : null;
  return cur !== null && new Date(state.cycle).getTime() === cur ? state.n : null;
}

/**
 * Proportional milestones, e.g. for 10 spots: 8 (80%, "2 left"), 10 (full),
 * 11 (waiting list just started — always exact, not proportional, so a
 * big group's first waitlister is never lost between 100% and the 1.2x
 * mark), 12 and 15 (waiting list growing further). Works for any group
 * size; duplicates collapse for tiny groups.
 */
export function milestoneThresholds(spots, almostPct = 0.8) {
  const raw = [Math.ceil(spots * almostPct), spots, spots + 1, Math.ceil(spots * 1.2), Math.ceil(spots * 1.5)];
  return [...new Set(raw)].filter((t) => t > 0).sort((a, b) => a - b);
}

/**
 * @param {object} i
 * @param {object} i.game            games row (id, status, scheduled_at, spots, created_at, cycle_opened_at)
 * @param {number} i.spots           effective spots
 * @param {number} i.confirmed       confirmed attendances right now
 * @param {number|null} i.prev       last_confirmed we recorded, null = first sighting
 * @param {Date} i.now
 * @param {number} [i.openMaxAgeH]   only announce "jogo aberto" for games this fresh
 * @param {number} [i.almostPct]     "almost full" threshold, default 80%
 * @param {number} [i.dayOfMinutes]  Lisbon minute-of-day the game-day reminder may start (default 08:30)
 * @returns {{kind:string,key:string,urgent?:boolean}[]}
 */
export function decide({ game, spots, confirmed, prev, now, openMaxAgeH = 12, almostPct = 0.8, dayOfMinutes = 8 * 60 + 30 }) {
  const out = [];
  const gid = game.id;

  if (game.status === "cancelled") {
    return [{ kind: "cancelled", key: `cancelled:${gid}:${cycleOf(game)}`, legacyKey: `cancelled:${gid}`, urgent: true }];
  }
  if (!["open", "full"].includes(game.status)) return out;

  const start = new Date(game.scheduled_at);
  // Freshness of THIS week's cycle (a recycled row keeps its old created_at).
  const ageH = (now - new Date(game.cycle_opened_at ?? game.created_at)) / 36e5;
  if (prev === null && ageH <= openMaxAgeH) {
    out.push({ kind: "game_open", key: `game_open:${gid}:${cycleOf(game)}`, legacyKey: `game_open:${gid}` });
  }

  if (prev !== null && confirmed !== prev) {
    if (confirmed > prev) {
      const crossed = milestoneThresholds(spots, almostPct).filter((t) => prev < t && t <= confirmed);
      if (crossed.length) {
        const t = Math.max(...crossed);
        // A recurring game reuses the same row every week (games.cycle_opened_at
        // marks each reset) — without that in the key, "12/15 reached" would
        // claim its dedupe row once and then silently never fire again for any
        // later week that also happens to cross 12, since the unique constraint
        // in bot_announcements sees it as already announced.
        out.push({ kind: "milestone", key: `milestone:${gid}:${t}:${game.cycle_opened_at ?? "once"}` });
      }
    } else if (prev >= spots && confirmed >= spots) {
      // Someone left but the XI is still full — a waitlister was
      // auto-promoted into their place (the waitlist is derived, not
      // stored: it's just "confirmed" rows beyond the first `spots`, by
      // responded_at order). Who specifically got promoted isn't known
      // here (no I/O) — the caller resolves that from the roster.
      const bucket = Math.floor(now.getTime() / 6e5);
      out.push({ kind: "promoted", key: `promoted:${gid}:${prev}>${confirmed}:${bucket}` });
    } else if (prev >= spots && confirmed < spots) {
      // Same numbers can recur (fill, drop, fill, drop): bucket to 10 min.
      const bucket = Math.floor(now.getTime() / 6e5);
      out.push({ kind: "spot_opened", key: `spot_opened:${gid}:${prev}>${confirmed}:${bucket}` });
    }
  }

  const hoursToGame = (start - now) / 36e5;
  if (hoursToGame > 0 && hoursToGame <= 24 && confirmed < spots) {
    out.push({ kind: "reminder", key: reminderKey(game), legacyKey: `reminder:${gid}` });
  }

  // Game day, morning onwards, until kickoff.
  if (hoursToGame > 0 && lisbonDayKey(start) === lisbonDayKey(now) && lisbonMinutesOfDay(now) >= dayOfMinutes) {
    out.push({ kind: "matchday", key: `matchday:${gid}:${cycleOf(game)}`, legacyKey: `matchday:${gid}` });
  }
  return out;
}

/** A finished matchday (row in `matchdays`) → one post-game message. */
export function decidePostGame({ matchday, now, maxAgeH = 12 }) {
  const ageH = (now - new Date(matchday.created_at)) / 36e5;
  if (ageH > maxAgeH) return [];
  return [{ kind: "postgame", key: `postgame:${matchday.id}` }];
}

/** Top scorer + top assist for the match, sent once a matchday has had time
 *  to settle (2h) — separate from the immediate postgame score recap, and
 *  from its own age window so it isn't just "postgame, but later". Games
 *  aren't always at night, so this is named/worded around "the match", not
 *  "tonight". */
export function decideMatchAwards({ matchday, now, minAgeH = 2, maxAgeH = 12 }) {
  const ageH = (now - new Date(matchday.created_at)) / 36e5;
  if (ageH < minAgeH || ageH > maxAgeH) return [];
  return [{ kind: "match_awards", key: `match_awards:${matchday.id}` }];
}

/** groups.wa_bot_kinds allowlist (NULL/empty = every kind allowed). */
export const kindAllowed = (group, kind) =>
  !Array.isArray(group?.wa_bot_kinds) || group.wa_bot_kinds.length === 0 || group.wa_bot_kinds.includes(kind);

/** groups.wa_bot_interactive === false → the bot never answers in the group. */
export const isInteractive = (group) => group?.wa_bot_interactive !== false;
