// Per-route <head> metadata for a client-rendered SPA.
//
// The Open Graph tags in index.html are static (social crawlers don't run
// JS). Everything search engines read AFTER rendering — title, description,
// canonical, robots — is set here, per route, so the legal pages don't
// canonicalise to the homepage and internal/token routes stay out of the
// index.

const SITE = "https://pitch-fc.com";

const HOME = {
  title: "PITCH — O teu jogo de futebol semanal, organizado",
  description: "Confirmações, pagamentos, sorteio de equipas e stats do teu jogo de futebol amador — sem o caos do grupo de WhatsApp. Cria o teu grupo grátis.",
};

// Routes that exist in PitchApp.jsx. Anything else (SPA fallback serves
// index.html with a 200 for any URL) is treated as "not a real page".
const ROUTES = {
  "/": HOME,
  "/league": {
    title: "PITCH League — competições de futebol amador | PITCH",
    description: "PITCH League: competições de futebol amador organizadas no PITCH. Inscreve a tua equipa na primeira liga.",
  },
  "/pricing": {
    title: "Planos e preços | PITCH",
    description: "Jogar é grátis. Organizar melhor é outra história. Planos do PITCH para grupos (Free, Club, Club + AI) e para jogadores (Player, Player+).",
  },
  "/privacidade": {
    title: "Política de Privacidade | PITCH",
    description: "Como o PITCH trata os teus dados pessoais, que cookies usa e como podes exercer os teus direitos (RGPD).",
  },
  "/termos": {
    title: "Termos de Uso | PITCH",
    description: "Condições de utilização do PITCH: conta, conteúdo, pagamentos entre jogadores e o bot Pitch AI.",
  },
  // Shared by link / owner-only — reachable, never indexed.
  "/pro": { ...HOME, title: "PITCH Pro (demo) | PITCH", noindex: true },
  "/pitch-deck": { ...HOME, title: "PITCH — Pitch Deck", noindex: true },
  "/roadmap": { ...HOME, title: "PITCH — Roadmap", noindex: true },
  "/admin": { ...HOME, title: "PITCH — Admin", noindex: true },
};

// One-time links carrying a secret token, plus the owner deep link.
const TOKEN_PARAMS = ["join", "confirm", "rate", "admin"];

/** Pure: what the head should say for this URL. */
export function routeMeta(pathname, search = "") {
  const path = pathname.replace(/\/+$/, "") || "/";
  const known = ROUTES[path];
  const m = known ?? HOME;
  const hasToken = TOKEN_PARAMS.some((p) => new URLSearchParams(search).has(p));
  return {
    title: m.title,
    description: m.description,
    canonical: known ? SITE + (path === "/" ? "/" : path) : SITE + "/",
    noindex: Boolean(m.noindex) || hasToken || !known,
  };
}

function upsert(selector, create, attr, value) {
  let el = document.head.querySelector(selector);
  if (!el) { el = create(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
}

/** Apply routeMeta() to the live document. Call once per page load — routes are full navigations. */
export function applyRouteMeta(loc = window.location) {
  const m = routeMeta(loc.pathname, loc.search);
  document.title = m.title;
  upsert('meta[name="description"]', () => Object.assign(document.createElement("meta"), { name: "description" }), "content", m.description);
  upsert('link[rel="canonical"]', () => Object.assign(document.createElement("link"), { rel: "canonical" }), "href", m.canonical);
  upsert('meta[name="robots"]', () => Object.assign(document.createElement("meta"), { name: "robots" }), "content",
    m.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
}
