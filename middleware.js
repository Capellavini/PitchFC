// Vercel Routing Middleware (edge): sends Rivals share links to the OG preview
// function BEFORE the static filesystem is consulted.
//
// A plain `rewrites` entry with source "/" never fires: "/" resolves to the
// static index.html first. Middleware runs ahead of that, so
// `/?desafio=…`, `/?tjoin=…` and `/?team=…` reach api/og-rivals.js, which
// returns the normal index.html with link-specific og:/twitter: tags. Every
// other URL (including "/" with any other query) passes through untouched.
import { rewrite, next } from "@vercel/edge";

export const config = { matcher: "/" };

export default function middleware(request) {
  const url = new URL(request.url);
  const q = url.searchParams;
  if (q.has("desafio") || q.has("tjoin") || q.has("team")) {
    const dest = new URL("/api/og-rivals", url);
    dest.search = url.search;
    return rewrite(dest);
  }
  return next();
}
