// Pure logic for api/og-rivals.js (PITCH Rivals share previews).
//
// Social crawlers (WhatsApp, Telegram, Facebook, X) do not run JS, so the
// per-link title/description/image has to be in the served HTML. This file
// holds everything that can be tested without a network: query parsing, pt-PT
// date formatting, tag building, HTML escaping and the head rewrite. The edge
// function only does I/O. Underscore-prefixed files in /api are not routed.
//
// Privacy: only fields the anon preview RPCs already expose are ever used
// (team name/city/format/member_count, inviter first name, challenge terms'
// kickoff/format/venue/cost). Never rosters, phones or emails.

export const SITE = "https://pitch-fc.com";
export const OG_IMAGE = `${SITE}/brand/og-rivals.jpg`;
const BRAND = "PITCH Rivals";

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;
const SLUG_RE = /^[a-z0-9-]{1,60}$/;

/** Which Rivals deep link is this? → {kind, value} | null. desafio > tjoin > team. */
export function parseOgRequest(search = "") {
  let q;
  try { q = new URLSearchParams(search); } catch { return null; }
  const desafio = (q.get("desafio") || "").trim();
  if (TOKEN_RE.test(desafio)) return { kind: "desafio", value: desafio };
  const tjoin = (q.get("tjoin") || "").trim();
  if (TOKEN_RE.test(tjoin)) return { kind: "tjoin", value: tjoin };
  const team = (q.get("team") || "").trim().toLowerCase();
  if (SLUG_RE.test(team)) return { kind: "team", value: team };
  return null;
}

/** HTML text/attribute-safe. */
export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Single line, no control chars, bounded length (applied BEFORE escaping). */
export function clean(s, max = 80) {
  const t = String(s ?? "").replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function zonedParts(date, timeZone) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, hh: o.hour === "24" ? "00" : o.hour, mm: o.minute };
}

/**
 * pt-PT kickoff label in the team's own timezone, built from fixed tables so
 * it does not depend on the runtime's ICU locale data.
 * -> {date: "sáb 18 out", time: "21:00"} | null
 */
export function formatKickoffPt(iso, timezone = "Europe/Lisbon") {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  let p;
  try { p = zonedParts(date, timezone || "Europe/Lisbon"); }
  catch { try { p = zonedParts(date, "Europe/Lisbon"); } catch { return null; } }
  const wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return { date: `${WEEKDAYS[wd]} ${p.d} ${MONTHS[p.m - 1]}`, time: `${p.hh}:${p.mm}` };
}

/** "7v7" -> "7x7" (pt-PT copy). Unknown shapes -> "". */
export function formatLabel(f) {
  const m = /^(\d{1,2})v(\d{1,2})$/.exec(String(f || ""));
  return m ? `${m[1]}x${m[2]}` : "";
}

const euro = (cents) => {
  const n = Number(cents);
  if (!Number.isFinite(n) || n <= 0) return "";
  const v = n / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(".", ",")}€`;
};
const joinDot = (...parts) => parts.filter(Boolean).join(" · ");
const teamName = (t) => clean(t?.name, 40);

function desafioMeta(d, token) {
  if (!d || typeof d !== "object" || !d.status || d.status === "not_found") return null;
  const a = teamName(d.challenger);
  if (!a) return null;
  const b = teamName(d.challenged);
  const terms = d.terms || {};
  const fmt = formatLabel(terms.format);
  const when = formatKickoffPt(terms.kickoff_at, terms.timezone);
  const url = `${SITE}/?desafio=${token}`;
  const venue = clean(terms.venue_name, 50);
  const cost = euro(terms.cost_cents);

  if (d.status === "pending" || d.status === "agreed") {
    const head = d.status === "agreed" ? `${a} vs ${b || "?"} · jogo marcado` : b ? `${a} vs ${b}` : `Os ${a} desafiam-te`;
    const title = joinDot(head, fmt, when?.date);
    const facts = joinDot(when ? `${when.date} às ${when.time}` : "", venue, cost ? `${cost} no total` : "");
    const tail = d.status === "agreed" ? "Jogo combinado no PITCH Rivals." : "Abre o link para responder no PITCH Rivals.";
    return { title, description: facts ? `${facts}. ${tail}` : tail, url, noindex: true };
  }
  const state = { expired: "expirou", cancelled: "foi cancelado", declined: "foi recusado", claimed: "já foi aceite por outra equipa" }[d.status];
  if (!state) return null;
  return {
    title: `Desafio dos ${a} · ${state}`,
    description: `Este desafio já não está ativo. Cria a tua equipa e desafia quem quiseres no ${BRAND}.`,
    url,
    noindex: true,
  };
}

function tjoinMeta(d, token) {
  if (!d || typeof d !== "object" || !d.status || d.status === "not_found") return null;
  const t = d.team;
  const name = teamName(t);
  if (!name || d.status === "archived") return null;
  const url = `${SITE}/?tjoin=${token}`;
  if (d.status !== "valid") {
    return {
      title: `Convite para a ${name} · já não está ativo`,
      description: `Este convite expirou ou foi revogado. Pede ao capitão da ${name} um novo link.`,
      url,
      noindex: true,
    };
  }
  const by = clean(d.invited_by, 30);
  const n = Number(t.member_count);
  const facts = joinDot(
    by ? `${by} convidou-te para a equipa ${name}` : `Foste convidado para a equipa ${name}`,
    clean(t.city, 40),
    formatLabel(t.preferred_format),
    n > 0 ? `${n} ${n === 1 ? "jogador" : "jogadores"}` : "",
  );
  return { title: `Entra na ${name}`, description: `${facts}. Junta-te no ${BRAND}.`, url, noindex: true };
}

function teamMeta(t, slug) {
  if (!t || typeof t !== "object" || !t.slug || t.archived) return null;
  const name = teamName(t);
  if (!name) return null;
  const r = t.record || {};
  const w = Number(r.wins) || 0, e = Number(r.draws) || 0, l = Number(r.losses) || 0;
  const played = (Number(r.played) || 0) || w + e + l;
  const n = Number(t.member_count);
  const facts = joinDot(
    clean(t.city, 40),
    formatLabel(t.preferred_format),
    n > 0 ? `${n} ${n === 1 ? "jogador" : "jogadores"}` : "",
  );
  return {
    title: played > 0 ? `${name} — ${w}V ${e}E ${l}D` : `${name} — equipa no ${BRAND}`,
    description: `${facts ? `${facts}. ` : ""}Desafia a ${name} no ${BRAND}.`,
    url: `${SITE}/?team=${encodeURIComponent(t.slug || slug)}`,
    noindex: false,
  };
}

/** RPC payload -> {title, description, url, noindex} | null (null = leave HTML untouched). */
export function buildOgMeta(kind, data, value) {
  try {
    if (kind === "desafio") return desafioMeta(data, value);
    if (kind === "tjoin") return tjoinMeta(data, value);
    if (kind === "team") return teamMeta(data, value);
  } catch { /* fall through */ }
  return null;
}

/** Which RPC (and args) answers each link kind. */
export function rpcFor(kind, value) {
  if (kind === "desafio") return { fn: "get_challenge_invite", body: { p_token: value } };
  if (kind === "tjoin") return { fn: "team_invite_preview", body: { p_token: value } };
  return { fn: "team_profile", body: { p_slug: value } };
}

function setMeta(html, attr, key, content) {
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
  const re = new RegExp(`<meta\\s[^>]*?\\b${attr}\\s*=\\s*["']${key.replace(/[:.]/g, "\\$&")}["'][^>]*>`, "i");
  // Replacer functions: dynamic text must never be read as $-patterns.
  if (re.test(html)) return html.replace(re, () => tag);
  return html.replace(/<\/head>/i, () => `    ${tag}\n  </head>`);
}

/** Rewrite title/description/og/twitter (+ robots when noindex) in an index.html string. */
export function applyOgToHtml(html, meta) {
  if (!meta || typeof html !== "string") return html;
  const { title, description, url, noindex } = meta;
  let out = html;
  out = /<title[^>]*>[\s\S]*?<\/title>/i.test(out)
    ? out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(title)}</title>`)
    : out.replace(/<\/head>/i, () => `    <title>${escapeHtml(title)}</title>\n  </head>`);
  out = setMeta(out, "name", "description", description);
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", description);
  out = setMeta(out, "property", "og:url", url);
  out = setMeta(out, "property", "og:image", OG_IMAGE);
  out = setMeta(out, "property", "og:image:width", "1200");
  out = setMeta(out, "property", "og:image:height", "630");
  out = setMeta(out, "property", "og:image:alt", `${BRAND} — ${title}`);
  out = setMeta(out, "name", "twitter:title", title);
  out = setMeta(out, "name", "twitter:description", description);
  out = setMeta(out, "name", "twitter:image", OG_IMAGE);
  if (noindex) out = setMeta(out, "name", "robots", "noindex, nofollow");
  return out;
}
