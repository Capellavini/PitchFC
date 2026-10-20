// Home activity feed — pure data shaping (no React). Turns matchday rows
// (cloud or local demo) + social posts into ONE chronological list of
// feed items, where auto-generated football items (results, standout
// performances, personal records, streak milestones) sit alongside
// manual posts as first-class entries (docs/REDESIGN-SPEC.md §2 Home).
import { MONTHS_PT, computeOverall, playerColor } from "./helpers";
import { t } from "./i18n";
import { ACHIEVEMENTS } from "./achievements";
import { podiumTop3 } from "./rankings";

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

// ── Identity items: achievements + LENDA ─────────────────────
const playedIn = (md, key) =>
  (md.summary?.candidates || []).some((c) => c.key === key)
  || (md.summary?.lines || []).some((l) => l.key === key)
  || (md.summary?.teamResults || []).some((tr) => (tr.players || []).includes(key));

/** Shape lib/achievements' per-matchday checks expect. */
const achMatchday = (md) => ({ matches: md.summary?.matches ?? [], nightLines: md.summary?.lines ?? [], mvpKey: md.mvpKey ?? null });

/** When did each player unlock each conquista? Replays the group's
 *  matchdays oldest → newest and re-runs the SAME check() functions from
 *  lib/achievements against the player "as of" each day: season totals
 *  minus what the window still has to add (baseline) plus what's been
 *  played so far. The first day a check flips to true is the unlock day;
 *  anything already true at the baseline was unlocked before the data we
 *  have, so it gets no item. Checks that can't be replayed in time
 *  (attendance %, leader role, peer-rated overall) are fed neutral values
 *  and never fire here — no invented dates. One item per player per day. */
export function achievementUnlocks({ players = [], matchdays = [] }) {
  const days = [...matchdays].sort((a, b) => a.ts - b.ts);
  if (!days.length) return [];
  const out = [];
  players.forEach((p) => {
    const key = p.uuid ?? p.id;
    const perDay = days.map((md) => {
      const line = (md.summary?.lines || []).find((l) => l.key === key) || {};
      return {
        goals: line.goals || 0, assists: line.assists || 0, cleanSheets: line.cleanSheets || 0,
        gamesPlayed: playedIn(md, key) ? 1 : 0, mvps: md.mvpKey != null && md.mvpKey === key ? 1 : 0,
      };
    });
    const FIELDS = ["goals", "assists", "cleanSheets", "gamesPlayed", "mvps"];
    const windowSum = Object.fromEntries(FIELDS.map((f) => [f, perDay.reduce((s, d) => s + d[f], 0)]));
    const baseline = Object.fromEntries(FIELDS.map((f) => [f, Math.max(0, (p[f] || 0) - windowSum[f])]));
    const ctxAt = (n) => ({ attendancePct: 0, isLeader: false, overall: 0, playerKey: key, matchdays: days.slice(0, n).map(achMatchday) });
    const asOf = (n) => {
      const cum = { ...baseline };
      for (let i = 0; i < n; i++) FIELDS.forEach((f) => { cum[f] += perDay[i][f]; });
      return { ...p, ...cum };
    };
    const byDay = new Map();
    ACHIEVEMENTS.forEach((a) => {
      if (!a.check(p, ctxAt(days.length))) return; // not unlocked today (real season totals)
      if (a.check(asOf(0), ctxAt(0))) return; // unlocked before our data
      for (let i = 1; i <= days.length; i++) {
        if (a.check(asOf(i), ctxAt(i))) {
          byDay.set(i - 1, [...(byDay.get(i - 1) || []), a]);
          break;
        }
      }
    });
    byDay.forEach((list, idx) => {
      const md = days[idx];
      out.push({
        kind: "achievement", id: `ach-${md.id}-${key}`, ts: md.ts - 5, md,
        line: { key, nick: p.nick, name: p.name, photo: p.photo, color: playerColor(players, p), isMe: Boolean(p.isMe) },
        mine: Boolean(p.isMe),
        achievements: list.map(({ id, name, desc, tier, icon }) => ({ id, name, desc, tier, icon })),
      });
    });
  });
  return out;
}

/** LENDA (FutCard tier, OVR ≥ 86 — same 3+ peer-ratings gate as the
 *  card). There's no history of past OVRs, so it's placed at the best
 *  time source we have: the player's latest peer rating (cloud
 *  `ratingTs`), else the latest matchday they played. Stable id per
 *  player → it shows once, never repeats. */
export function legendItems({ players = [], matchdays = [], ratingTs = {} }) {
  const out = [];
  const newestFirst = [...matchdays].sort((a, b) => b.ts - a.ts);
  players.forEach((p) => {
    if (p.ratingsCount != null && p.ratingsCount < 3) return;
    const overall = computeOverall(p.position, p.attrs);
    if (overall < 86) return;
    const key = p.uuid ?? p.id;
    const md = newestFirst.find((d) => playedIn(d, key)) || null;
    const ts = ratingTs[key] || (md ? md.ts - 6 : 0);
    if (!ts) return;
    const d = new Date(ts);
    out.push({
      // md = latest matchday played (Golaço target, same kudos row as that
      // night's performance in cloud); dateLabel follows the placement ts.
      kind: "legend", id: `legend-${key}`, ts, md, overall, position: p.position,
      dateLabel: ratingTs[key] ? `${d.getDate()} ${t(MONTHS_PT[d.getMonth()])}` : md?.dateLabel,
      line: { key, nick: p.nick, name: p.name, photo: p.photo, color: playerColor(players, p), isMe: Boolean(p.isMe) }, mine: Boolean(p.isMe),
    });
  });
  return out;
}

/** One summary per Matchday. Sporting details stay inside that summary;
 * manual posts remain optional and the weekly leader replaces its own post.
 * No time-based association of media: private VAR clips are not social posts. */
export function buildFeed({ matchdays = [], posts = [], postTs, myKey, meId, friendIds = [], myGroupIds = [], streak = 0, gotwLeaderId = null, players = [], activeGroupName = null, ratingTs = {}, now = Date.now() }) {
  const seen = new Set();
  const sortedMd = [...matchdays].sort((a, b) => b.ts - a.ts).filter((md) => {
    if (seen.has(md.id)) return false;
    seen.add(md.id);
    return true;
  });
  const groupMd = activeGroupName ? sortedMd.filter((md) => md.groupName === activeGroupName) : sortedMd;
  const achievements = achievementUnlocks({ players, matchdays: groupMd });
  const legends = legendItems({ players, matchdays: groupMd, ratingTs });
  const myDays = sortedMd.filter((md) => playedIn(md, myKey));
  const score = (md) => {
    const l = (md.summary?.lines || []).find((line) => line.key === myKey);
    return (l?.goals || 0) + (l?.assists || 0);
  };
  const isRecord = myDays.length >= 3 && score(myDays[0]) > 0 && myDays.slice(1).every((md) => score(myDays[0]) > score(md));
  const items = sortedMd.map((md) => {
    const highlights = (md.summary?.lines || []).map((line) => ({
      kind: "performance", id: `p-${md.id}-${line.key}`, md, line,
      mine: line.key === myKey,
      isMvp: md.mvpKey != null && line.key === md.mvpKey,
      isRecord: isRecord && md.id === myDays[0]?.id && line.key === myKey,
    })).filter((it) => it.isMvp || (it.line.goals || 0) >= 3 || (it.mine && ((it.line.goals || 0) + (it.line.assists || 0) + (it.line.cleanSheets || 0) > 0)))
      .sort((a,b) => Number(b.isMvp) - Number(a.isMvp) || Number(b.mine) - Number(a.mine) || (b.line.goals || 0) - (a.line.goals || 0)).slice(0,3);
    return {
      kind: "summary", id: `r-${md.id}`, ts: md.ts, md, myKey,
      top: podiumTop3(md.summary?.lines), highlights,
      achievements: achievements.filter((it) => it.md.id === md.id),
      legends: legends.filter((it) => it.md?.id === md.id),
      streak: streak >= 3 && md.id === myDays[0]?.id ? streak : 0,
    };
  });
  const visiblePostIds = new Set();
  posts.filter((p) => p.mine || p.author?.id === meId || myGroupIds.includes(p.author?.groupId) || friendIds.includes(p.author?.id)).forEach((p) => {
    if (visiblePostIds.has(p.id)) return;
    visiblePostIds.add(p.id);
    const ts = (postTs && Date.parse(postTs[p.id])) || (p.createdAt && Date.parse(p.createdAt)) || (typeof p.id === "number" && p.id > 1e12 ? p.id : 0);
    const weekly = gotwLeaderId != null && p.id === gotwLeaderId && p.type === "video" && p.media && (p.likes?.length || 0) > 0 && (!ts || (ts <= now && now - ts <= WEEK));
    items.push({ kind: weekly ? "gotw" : "post", id: `post-${p.id}`, ts, post: p });
  });
  return items.sort((a,b) => b.ts - a.ts).slice(0,40);
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
