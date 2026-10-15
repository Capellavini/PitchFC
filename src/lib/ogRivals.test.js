import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseOgRequest, escapeHtml, clean, formatKickoffPt, formatLabel, buildOgMeta, applyOgToHtml, rpcFor, OG_IMAGE,
} from "../../api/_og.js";

const INDEX = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const TOKEN = "abcDEF123456_-xy";

const challenge = (over = {}) => ({
  status: "pending",
  challenger: { name: "Os Tubarões", slug: "tubaroes" },
  challenged: null,
  terms: { kickoff_at: "2026-10-18T19:00:00Z", timezone: "Europe/Lisbon", format: "7v7", venue_name: "Campo do Dragão", cost_cents: 7000 },
  ...over,
});

test("parseOgRequest: kinds, priority, validation", () => {
  assert.deepEqual(parseOgRequest(`?desafio=${TOKEN}`), { kind: "desafio", value: TOKEN });
  assert.deepEqual(parseOgRequest(`?tjoin=${TOKEN}`), { kind: "tjoin", value: TOKEN });
  assert.deepEqual(parseOgRequest("?team=Os-Tubaroes"), { kind: "team", value: "os-tubaroes" });
  assert.equal(parseOgRequest(`?tjoin=${TOKEN}&desafio=${TOKEN}`).kind, "desafio");
  assert.equal(parseOgRequest("?desafio=short"), null);
  assert.equal(parseOgRequest("?desafio=" + encodeURIComponent('"><script>alert(1)</script>')), null);
  assert.equal(parseOgRequest("?team=has space"), null);
  assert.equal(parseOgRequest(""), null);
  assert.equal(parseOgRequest("?other=1"), null);
});

test("rpcFor maps each kind to its anon RPC", () => {
  assert.deepEqual(rpcFor("desafio", TOKEN), { fn: "get_challenge_invite", body: { p_token: TOKEN } });
  assert.deepEqual(rpcFor("tjoin", TOKEN), { fn: "team_invite_preview", body: { p_token: TOKEN } });
  assert.deepEqual(rpcFor("team", "x"), { fn: "team_profile", body: { p_slug: "x" } });
});

test("escapeHtml / clean", () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  assert.equal(clean("  a\n\tb\u0000c  "), "a b c");
  assert.ok(clean("x".repeat(200), 10).length <= 10);
});

test("formatKickoffPt: pt-PT, in the team's timezone", () => {
  assert.deepEqual(formatKickoffPt("2026-10-18T19:00:00Z", "Europe/Lisbon"), { date: "dom 18 out", time: "20:00" });
  // Saturday 17 Oct 2026, 21:00 Lisbon (WEST, UTC+1)
  assert.deepEqual(formatKickoffPt("2026-10-17T20:00:00Z", "Europe/Lisbon"), { date: "sáb 17 out", time: "21:00" });
  // Same instant, another zone crosses midnight into the next day
  assert.equal(formatKickoffPt("2026-10-17T20:00:00Z", "Asia/Tokyo").date, "dom 18 out");
  // Winter time is UTC+0; midnight renders as 00:00 (not 24:00)
  assert.deepEqual(formatKickoffPt("2026-12-05T00:30:00Z", "Europe/Lisbon"), { date: "sáb 5 dez", time: "00:30" });
  // Bad timezone falls back to Lisbon; bad date -> null
  assert.equal(formatKickoffPt("2026-10-17T20:00:00Z", "Not/AZone").time, "21:00");
  assert.equal(formatKickoffPt("nope"), null);
  assert.equal(formatKickoffPt(null), null);
});

test("formatLabel", () => {
  assert.equal(formatLabel("7v7"), "7x7");
  assert.equal(formatLabel("11v11"), "11x11");
  assert.equal(formatLabel("x"), "");
  assert.equal(formatLabel(undefined), "");
});

test("desafio: open challenge title/description", () => {
  const m = buildOgMeta("desafio", challenge(), TOKEN);
  assert.equal(m.title, "Os Os Tubarões desafiam-te · 7x7 · dom 18 out");
  assert.match(m.description, /dom 18 out às 20:00 · Campo do Dragão · 70€ no total\./);
  assert.equal(m.url, `https://pitch-fc.com/?desafio=${TOKEN}`);
  assert.equal(m.noindex, true);
});

test("desafio: targeted, agreed and dead states", () => {
  const targeted = buildOgMeta("desafio", challenge({ challenged: { name: "Leões" } }), TOKEN);
  assert.match(targeted.title, /^Os Tubarões vs Leões · 7x7/);
  const agreed = buildOgMeta("desafio", challenge({ status: "agreed", challenged: { name: "Leões" } }), TOKEN);
  assert.match(agreed.title, /jogo marcado/);
  for (const [status, word] of [["expired", "expirou"], ["cancelled", "cancelado"], ["declined", "recusado"], ["claimed", "aceite por outra"]]) {
    const m = buildOgMeta("desafio", challenge({ status }), TOKEN);
    assert.match(m.title, new RegExp(word));
    assert.equal(m.noindex, true);
  }
});

test("desafio: missing fields degrade gracefully", () => {
  const m = buildOgMeta("desafio", { status: "pending", challenger: { name: "Tubarões" }, terms: {} }, TOKEN);
  assert.equal(m.title, "Os Tubarões desafiam-te");
  assert.equal(m.description, "Abre o link para responder no PITCH Rivals.");
  const noTerms = buildOgMeta("desafio", { status: "pending", challenger: { name: "Tubarões" } }, TOKEN);
  assert.equal(noTerms.title, "Os Tubarões desafiam-te");
});

test("tjoin: valid, dead, singular", () => {
  const valid = buildOgMeta("tjoin", {
    status: "valid", invited_by: "Ana",
    team: { name: "Tubarões", city: "Porto", preferred_format: "5v5", member_count: 8 },
  }, TOKEN);
  assert.equal(valid.title, "Entra na Tubarões");
  assert.equal(valid.description, "Ana convidou-te para a equipa Tubarões · Porto · 5x5 · 8 jogadores. Junta-te no PITCH Rivals.");
  const solo = buildOgMeta("tjoin", { status: "valid", team: { name: "T", member_count: 1 } }, TOKEN);
  assert.match(solo.description, /Foste convidado para a equipa T · 1 jogador\./);
  const dead = buildOgMeta("tjoin", { status: "expired", team: { name: "Tubarões" } }, TOKEN);
  assert.match(dead.title, /já não está ativo/);
});

test("team: record title and no-games variant", () => {
  const t = { slug: "tubaroes", name: "Tubarões", city: "Porto", preferred_format: "7v7", member_count: 12, record: { played: 8, wins: 5, draws: 2, losses: 1 } };
  const m = buildOgMeta("team", t, "tubaroes");
  assert.equal(m.title, "Tubarões — 5V 2E 1D");
  assert.equal(m.url, "https://pitch-fc.com/?team=tubaroes");
  assert.equal(m.noindex, false);
  const fresh = buildOgMeta("team", { ...t, record: { played: 0, wins: 0, draws: 0, losses: 0 } }, "tubaroes");
  assert.equal(fresh.title, "Tubarões — equipa no PITCH Rivals");
  assert.match(fresh.description, /^Porto · 7x7 · 12 jogadores\. Desafia a Tubarões/);
});

test("unknown / archived / malformed -> null (HTML stays untouched)", () => {
  assert.equal(buildOgMeta("desafio", { status: "not_found" }, TOKEN), null);
  assert.equal(buildOgMeta("tjoin", { status: "not_found" }, TOKEN), null);
  assert.equal(buildOgMeta("team", null, "x"), null);
  assert.equal(buildOgMeta("team", { slug: "x", name: "X", archived: true }, "x"), null);
  assert.equal(buildOgMeta("tjoin", { status: "archived", team: { name: "X" } }, TOKEN), null);
  assert.equal(buildOgMeta("desafio", "garbage", TOKEN), null);
  assert.equal(buildOgMeta("desafio", { status: "pending" }, TOKEN), null);
  assert.equal(buildOgMeta("nope", {}, TOKEN), null);
  assert.equal(applyOgToHtml(INDEX, null), INDEX);
});

test("applyOgToHtml: rewrites tags, keeps the rest identical", () => {
  const meta = buildOgMeta("desafio", challenge(), TOKEN);
  const out = applyOgToHtml(INDEX, meta);
  assert.match(out, /<title>Os Os Tubarões desafiam-te · 7x7 · dom 18 out<\/title>/);
  assert.match(out, /<meta property="og:title" content="Os Os Tubarões desafiam-te/);
  assert.match(out, /<meta name="twitter:title" content="Os Os Tubarões desafiam-te/);
  assert.match(out, new RegExp(`<meta property="og:image" content="${OG_IMAGE}" />`));
  assert.match(out, new RegExp(`<meta name="twitter:image" content="${OG_IMAGE}" />`));
  assert.match(out, new RegExp(`<meta property="og:url" content="https://pitch-fc.com/\\?desafio=${TOKEN}" />`));
  assert.match(out, /<meta name="robots" content="noindex, nofollow" \/>/);
  // exactly one of each rewritten tag
  assert.equal((out.match(/property="og:title"/g) || []).length, 1);
  assert.equal((out.match(/name="robots"/g) || []).length, 1);
  assert.equal((out.match(/<title>/g) || []).length, 1);
  // scripts / body untouched
  const tail = (h) => h.slice(h.indexOf("</head>"));
  assert.equal(tail(out), tail(INDEX));
  assert.equal((out.match(/<script/g) || []).length, (INDEX.match(/<script/g) || []).length);
});

test("applyOgToHtml: team pages stay indexable (robots untouched)", () => {
  const meta = buildOgMeta("team", { slug: "tubaroes", name: "Tubarões", record: { played: 1, wins: 1 } }, "tubaroes");
  const out = applyOgToHtml(INDEX, meta);
  assert.match(out, /name="robots" content="index, follow/);
});

test("XSS: hostile names/venues never break out of attributes or title", () => {
  const evil = `"><script>alert(1)</script><b onmouseover='x'>&`;
  const html = applyOgToHtml(INDEX, buildOgMeta("desafio", challenge({
    challenger: { name: evil },
    challenged: { name: evil },
    terms: { format: "7v7", venue_name: evil, kickoff_at: "2026-10-17T20:00:00Z" },
  }), TOKEN));
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(!html.includes("<b onmouseover"));
  assert.ok(!/content="[^"]*"[^>]*"><script/i.test(html));
  assert.ok(html.includes("&lt;script&gt;"));
  for (const t of [
    applyOgToHtml(INDEX, buildOgMeta("tjoin", { status: "valid", invited_by: evil, team: { name: evil, city: evil } }, TOKEN)),
    applyOgToHtml(INDEX, buildOgMeta("team", { slug: "x", name: evil, city: evil, record: {} }, "x")),
  ]) {
    assert.ok(!t.includes("<script>alert(1)"));
    assert.ok(!t.includes("<b onmouseover"));
  }
});

test("$-patterns in names are not interpreted by String.replace", () => {
  const out = applyOgToHtml(INDEX, buildOgMeta("team", { slug: "x", name: "Equipa $& $1 $`", record: {} }, "x"));
  assert.ok(out.includes("<title>Equipa $&amp; $1 $` — equipa no PITCH Rivals</title>"));
});

test("applyOgToHtml inserts missing tags before </head>", () => {
  const out = applyOgToHtml("<html><head><title>x</title></head><body></body></html>",
    { title: "T", description: "D", url: "https://pitch-fc.com/?team=a", noindex: false });
  assert.match(out, /<meta property="og:title" content="T" \/>/);
  assert.match(out, /<meta name="twitter:image" content="[^"]+" \/>\n\s*<\/head>/);
  assert.match(out, /<title>T<\/title>/);
});
