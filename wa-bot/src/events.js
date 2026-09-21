// Pure decision logic: given what we see now and what we saw last time,
// which announcements are due? No I/O here, so it is unit-tested.
//
// Rules baked in (from the group-bot playbook):
//  - one message per milestone crossing, coalesced to the highest crossed
//  - "vaga aberta" only when the game WAS full (a drop from 8 to 7 is not news)
//  - cancellation is its own kind and is flagged urgent

export function milestoneThresholds(spots) {
  return [spots, spots + 2, spots + 5]; // 10 / 12 / 15 for a 10-spot game
}

/**
 * @param {object} i
 * @param {object} i.game            games row (id, status, scheduled_at, spots, created_at)
 * @param {number} i.spots           effective spots
 * @param {number} i.confirmed       confirmed attendances right now
 * @param {number|null} i.prev       last_confirmed we recorded, null = first sighting
 * @param {Date} i.now
 * @param {number} [i.openMaxAgeH]   only announce "jogo aberto" for games this fresh
 * @returns {{kind:string,key:string,urgent?:boolean}[]}
 */
export function decide({ game, spots, confirmed, prev, now, openMaxAgeH = 12 }) {
  const out = [];
  const gid = game.id;

  if (game.status === "cancelled") {
    return [{ kind: "cancelled", key: `cancelled:${gid}`, urgent: true }];
  }
  if (!["open", "full"].includes(game.status)) return out;

  const ageH = (now - new Date(game.created_at)) / 36e5;
  if (prev === null && ageH <= openMaxAgeH) {
    out.push({ kind: "game_open", key: `game_open:${gid}` });
  }

  if (prev !== null && confirmed !== prev) {
    if (confirmed > prev) {
      const crossed = milestoneThresholds(spots).filter((t) => prev < t && t <= confirmed);
      if (crossed.length) {
        const t = Math.max(...crossed);
        out.push({ kind: "milestone", key: `milestone:${gid}:${t}`, ctx: { confirmed: t } });
      }
    } else if (prev >= spots && confirmed < spots) {
      // Same numbers can recur (fill, drop, fill, drop): bucket to 10 min.
      const bucket = Math.floor(now.getTime() / 6e5);
      out.push({ kind: "spot_opened", key: `spot_opened:${gid}:${prev}>${confirmed}:${bucket}` });
    }
  }

  const hoursToGame = (new Date(game.scheduled_at) - now) / 36e5;
  if (hoursToGame > 0 && hoursToGame <= 24 && confirmed < spots) {
    out.push({ kind: "reminder", key: `reminder:${gid}` });
  }
  return out;
}
