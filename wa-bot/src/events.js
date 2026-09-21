// Pure decision logic: given what we see now and what we saw last time,
// which announcements are due? No I/O here, so it is unit-tested.
//
// Rules baked in (from the group-bot playbook):
//  - milestones are proportional to the group size, coalesced to the highest crossed
//  - "vaga aberta" only when the game WAS full (a drop from 8 to 7 is not news)
//  - cancellation is its own kind and is flagged urgent

import { lisbonDayKey, lisbonHour } from "./time.js";

/**
 * Proportional milestones, e.g. for 10 spots: 8 (80%, "2 left"), 10 (full),
 * 12 and 15 (waiting list growing). Works for any group size; duplicates
 * collapse for tiny groups.
 */
export function milestoneThresholds(spots, almostPct = 0.8) {
  const raw = [Math.ceil(spots * almostPct), spots, Math.ceil(spots * 1.2), Math.ceil(spots * 1.5)];
  return [...new Set(raw)].filter((t) => t > 0).sort((a, b) => a - b);
}

/**
 * @param {object} i
 * @param {object} i.game            games row (id, status, scheduled_at, spots, created_at)
 * @param {number} i.spots           effective spots
 * @param {number} i.confirmed       confirmed attendances right now
 * @param {number|null} i.prev       last_confirmed we recorded, null = first sighting
 * @param {Date} i.now
 * @param {number} [i.openMaxAgeH]   only announce "jogo aberto" for games this fresh
 * @param {number} [i.almostPct]     "almost full" threshold, default 80%
 * @param {number} [i.dayOfHour]     Lisbon hour the game-day reminder may start
 * @returns {{kind:string,key:string,urgent?:boolean}[]}
 */
export function decide({ game, spots, confirmed, prev, now, openMaxAgeH = 12, almostPct = 0.8, dayOfHour = 10 }) {
  const out = [];
  const gid = game.id;

  if (game.status === "cancelled") {
    return [{ kind: "cancelled", key: `cancelled:${gid}`, urgent: true }];
  }
  if (!["open", "full"].includes(game.status)) return out;

  const start = new Date(game.scheduled_at);
  const ageH = (now - new Date(game.created_at)) / 36e5;
  if (prev === null && ageH <= openMaxAgeH) {
    out.push({ kind: "game_open", key: `game_open:${gid}` });
    // Right after the announcement: a one-tap poll. Follow-ups don't spend the daily cap.
    out.push({ kind: "game_poll", key: `game_poll:${gid}`, followUp: true });
  }

  if (prev !== null && confirmed !== prev) {
    if (confirmed > prev) {
      const crossed = milestoneThresholds(spots, almostPct).filter((t) => prev < t && t <= confirmed);
      if (crossed.length) {
        const t = Math.max(...crossed);
        out.push({ kind: "milestone", key: `milestone:${gid}:${t}` });
      }
    } else if (prev >= spots && confirmed < spots) {
      // Same numbers can recur (fill, drop, fill, drop): bucket to 10 min.
      const bucket = Math.floor(now.getTime() / 6e5);
      out.push({ kind: "spot_opened", key: `spot_opened:${gid}:${prev}>${confirmed}:${bucket}` });
    }
  }

  const hoursToGame = (start - now) / 36e5;
  if (hoursToGame > 0 && hoursToGame <= 24 && confirmed < spots) {
    out.push({ kind: "reminder", key: `reminder:${gid}` });
  }

  // Game day, morning onwards, until kickoff.
  if (hoursToGame > 0 && lisbonDayKey(start) === lisbonDayKey(now) && lisbonHour(now) >= dayOfHour) {
    out.push({ kind: "matchday", key: `matchday:${gid}` });
  }
  return out;
}

/** A finished matchday (row in `matchdays`) → one post-game message. */
export function decidePostGame({ matchday, now, maxAgeH = 12 }) {
  const ageH = (now - new Date(matchday.created_at)) / 36e5;
  if (ageH > maxAgeH) return [];
  return [{ kind: "postgame", key: `postgame:${matchday.id}` }];
}
