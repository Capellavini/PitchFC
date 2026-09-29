// Home activity feed — pure data shaping (no React). Turns matchday rows
// (cloud or local demo) + social posts into ONE chronological list of
// feed items, where auto-generated football items (results, standout
// performances, personal records, streak milestones) sit alongside
// manual posts as first-class entries (docs/REDESIGN-SPEC.md §2 Home).
import { MONTHS_PT } from "./helpers";
import { t } from "./i18n";

const DAY = 24 * 60 * 60 * 1000;

/** "7 Jun" (or its translated month) → a timestamp at midday of that
 *  day in the most recent past occurrence, capped at now. Local demo
 *  only stores day/month labels, so this is an approximation used just
 *  for ordering + the "last 7 days" check. 0 when unparseable. */
export function tsFromDayMonth(label, now = Date.now()) {
  if (!label) return 0;
  const [d, m] = String(label).trim().split(/\s+/);
  const idx = MONTHS_PT.findIndex((x) => x === m || t(x) === m);
  const day = Number(d);
  if (idx < 0 || !day) return 0;
  const today = new Date(now);
  const dt = new Date(today.getFullYear(), idx, day, 12);
  if (dt.getTime() > now + DAY) dt.setFullYear(dt.getFullYear() - 1);
  return Math.min(dt.getTime(), now);
}

/** Normalizes the two matchday sources into one shape:
 *  { id, ts, dateLabel, groupName, mode, summary, mvpKey, mvpNick?, resultText? }
 *  - cloudRows: matchdays rows (active + cross-group) already carrying
 *    `groupName`; `fmt` formats played_on → "7 Jun".
 *  - local: { lastMatchday, history, mvpKey, groupName } (demo mode). */
export function normalizeMatchdays({ cloudRows, local, fmt }) {
  if (cloudRows) {
    return cloudRows.map((r) => ({
      id: r.id,
      ts: Date.parse(r.created_at || r.played_on) || 0,
      dateLabel: r.played_on ? fmt(r.played_on) : "",
      groupName: r.groupName,
      mode: r.mode,
      summary: r.summary || {},
      mvpKey: r.mvp_id ?? null,
    }));
  }
  if (!local) return [];
  const out = [];
  // Local demo with full per-day detail (PitchApp's localDays: the user's
  // own last matchday + the dated demo seed). Date-less history rows not
  // covered by a day are still appended as plain results.
  if (Array.isArray(local.days) && local.days.length) {
    const { days, history = [], groupName } = local;
    days.forEach((d) => out.push({
      id: d.id,
      ts: d.playedOn ? new Date(`${d.playedOn}T21:00:00`).getTime() : tsFromDayMonth(d.date),
      dateLabel: d.date, groupName, mode: d.mode, summary: d.summary || {}, mvpKey: d.mvpKey ?? null,
    }));
    const covered = new Set(days.map((d) => d.date));
    history.filter((h) => !covered.has(h.date)).forEach((h) => out.push({
      id: `local-h${h.id}`, ts: tsFromDayMonth(h.date), dateLabel: h.date, groupName,
      summary: {}, mvpKey: null, mvpNick: h.mvpNick ?? null, resultText: h.result ?? null,
    }));
    return out;
  }
  const { lastMatchday, history = [], mvpKey, groupName } = local;
  if (lastMatchday) {
    const { date, mode, ...summary } = lastMatchday;
    out.push({ id: "local-last", ts: tsFromDayMonth(date), dateLabel: date, groupName, mode, summary, mvpKey: mvpKey ?? null });
  }
  history
    .filter((h) => !lastMatchday || h.date !== lastMatchday.date)
    .forEach((h) => out.push({
      id: `local-h${h.id}`, ts: tsFromDayMonth(h.date), dateLabel: h.date, groupName,
      summary: {}, mvpKey: null, mvpNick: h.mvpNick ?? null, resultText: h.result ?? null,
    }));
  return out;
}

/** Nick for a line key within a matchday summary (lines, then candidates). */
export const nickIn = (md, key) =>
  (md.summary?.lines || []).find((l) => l.key === key)?.nick
  ?? (md.summary?.candidates || []).find((c) => c.key === key)?.nick
  ?? null;

const WEEK = 7 * DAY;

/** Golo da Semana ranking — the group's video posts from the last 7 days,
 *  most ⚽ Golaço first (the Golaço IS the vote). `postDates` maps
 *  post id → ISO created_at (cloud); posts without one (local demo) use
 *  their own `createdAt`, or always count when neither exists. Shared
 *  by Competir's GoalOfTheWeek and Home's feed. */
export function goalOfTheWeekRanking(social, postDates, now = Date.now()) {
  if (!social) return [];
  return (social.posts || [])
    .filter((p) => p.type === "video" && p.media && p.author?.groupId === social.myGroupId)
    .filter((p) => {
      const iso = postDates?.[p.id] ?? p.createdAt;
      return !iso || now - new Date(iso).getTime() <= WEEK;
    })
    .sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
}

/** Builds the single chronological feed.
 *  Item kinds: "result" | "performance" | "milestone" | "post" | "gotw"
 *  ("gotw" = the current Golo da Semana leader: replaces that video's
 *  plain post item, same place in the timeline). `gotwLeaderId` = id of
 *  the leading post (goalOfTheWeekRanking()[0] with ≥1 Golaço) or null. */
export function buildFeed({ matchdays = [], posts = [], postTs, myKey, meId, friendIds = [], myGroupIds = [], streak = 0, gotwLeaderId = null }) {
  const items = [];
  const sortedMd = [...matchdays].sort((a, b) => b.ts - a.ts);

  sortedMd.forEach((md) => {
    items.push({ kind: "result", id: `r-${md.id}`, ts: md.ts, md });

    // Standout performances: MVP, hat-tricks, and my own contribution.
    const standouts = (md.summary?.lines || [])
      .map((line) => {
        const isMvp = md.mvpKey != null && md.mvpKey === line.key;
        const mine = line.key === myKey;
        const contributed = (line.goals || 0) + (line.assists || 0) > 0 || (line.cleanSheets || 0) > 0;
        if (!(isMvp || (line.goals || 0) >= 3 || (mine && contributed))) return null;
        return { line, isMvp, mine };
      })
      .filter(Boolean)
      .sort((a, b) => Number(b.isMvp) - Number(a.isMvp) || (b.line.goals - a.line.goals))
      .slice(0, 3);
    standouts.forEach((s, i) => items.push({
      kind: "performance", id: `p-${md.id}-${s.line.key}`, ts: md.ts - 1 - i, md, ...s,
    }));
  });

  // Personal record: my most recent performance beats every older one I
  // have in the window (needs a few older nights to mean anything).
  const myPerfs = items.filter((i) => i.kind === "performance" && i.mine);
  if (myPerfs.length >= 3) {
    const score = (i) => (i.line.goals || 0) + (i.line.assists || 0);
    const [latest, ...older] = myPerfs;
    if (score(latest) > 0 && older.every((o) => score(latest) > score(o))) latest.isRecord = true;
  }

  // Streak milestone — pinned just under my latest matchday.
  if (streak >= 3) {
    const latestMine = sortedMd.find((md) => (md.summary?.lines || []).some((l) => l.key === myKey));
    if (latestMine) items.push({ kind: "milestone", id: `streak-${streak}`, ts: latestMine.ts - 10, streak, md: latestMine });
  }

  posts
    .filter((p) => p.mine || p.author?.id === meId || myGroupIds.includes(p.author?.groupId) || friendIds.includes(p.author?.id))
    .forEach((p) => {
      const ts = (postTs && Date.parse(postTs[p.id])) || (p.createdAt && Date.parse(p.createdAt)) || (typeof p.id === "number" && p.id > 1e12 ? p.id : 0);
      if (gotwLeaderId != null && p.id === gotwLeaderId) items.push({ kind: "gotw", id: `gotw-${p.id}`, ts, post: p });
      else items.push({ kind: "post", id: `post-${p.id}`, ts, post: p });
    });

  return items.sort((a, b) => b.ts - a.ts).slice(0, 40);
}

/** name → team colour lookup for a matchday (summary.teamResults). */
export const teamColorOf = (md) => {
  const map = {};
  (md.summary?.teamResults || []).forEach((tr) => { map[tr.name] = tr.color; });
  return (name) => map[name];
};

/** Most recent matchday within the last 7 days, or null. */
export function recentMatchday(matchdays = [], now = Date.now()) {
  const md = [...matchdays].sort((a, b) => b.ts - a.ts)[0];
  return md && md.ts && now - md.ts <= 7 * DAY ? md : null;
}
