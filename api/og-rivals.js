// Edge function: PITCH Rivals share previews.
//
// vercel.json rewrites `/?desafio=...`, `/?tjoin=...` and `/?team=...` here.
// We serve the site's normal /index.html with the og:/twitter:/title tags
// rewritten for that link (crawlers don't run JS). Humans get the identical
// HTML + scripts, so the SPA behaves exactly as before.
//
// Loop safety: we fetch `/index.html`, which the `/` rewrites do not match
// (and they also carry `missing: x-og-rivals`, a header we set on our own
// subrequest). On ANY error or timeout we return the untouched index.html.
import { parseOgRequest, rpcFor, buildOgMeta, applyOgToHtml } from "./_og.js";

export const config = { runtime: "edge" };

const OK_CACHE = "public, s-maxage=300, stale-while-revalidate=600";
const FALLBACK_CACHE = "public, s-maxage=30, stale-while-revalidate=60";

const page = (body, cache) =>
  new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache },
  });

async function timedFetch(url, init, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

async function loadIndex(origin, request) {
  const headers = { "x-og-rivals": "1", accept: "text/html" };
  // Let preview deployments behind Vercel protection serve us their own shell.
  for (const h of ["cookie", "x-vercel-protection-bypass", "x-vercel-set-bypass-cookie"]) {
    const v = request.headers.get(h);
    if (v) headers[h] = v;
  }
  const r = await timedFetch(`${origin}/index.html`, { headers }, 3000);
  if (!r.ok) throw new Error(`index ${r.status}`);
  return r.text();
}

async function callRpc(kind, value) {
  const env = (typeof process !== "undefined" && process.env) || {};
  const base = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";
  if (!base || !key) throw new Error("missing supabase env");
  const { fn, body } = rpcFor(kind, value);
  const r = await timedFetch(`${base}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  }, 1500);
  if (!r.ok) throw new Error(`rpc ${r.status}`);
  return r.json();
}

export default async function handler(request) {
  const url = new URL(request.url);
  let html;
  try {
    html = await loadIndex(url.origin, request);
  } catch {
    // Without the shell there is nothing sensible to serve here.
    return new Response("Service temporarily unavailable", { status: 502, headers: { "cache-control": "no-store" } });
  }
  try {
    const req = parseOgRequest(url.search);
    if (!req) return page(html, FALLBACK_CACHE);
    const meta = buildOgMeta(req.kind, await callRpc(req.kind, req.value), req.value);
    if (!meta) return page(html, FALLBACK_CACHE);
    return page(applyOgToHtml(html, meta), OK_CACHE);
  } catch {
    return page(html, "no-store");
  }
}
