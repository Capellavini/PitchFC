// Edge function: which country is this request coming from?
//
// Vercel adds `x-vercel-ip-country` (ISO 3166-1 alpha-2) at the edge, from
// the request IP. We only echo that two-letter code back so the pricing page
// can show each visitor the prices for THEIR market. The IP address itself is
// never read here, logged or stored, and nothing is sent to a third party.
export const config = { runtime: "edge" };

export default function handler(request) {
  const raw = request.headers.get("x-vercel-ip-country") || "";
  const country = /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null;
  return new Response(JSON.stringify({ country }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Per-visitor answer: never cache it in a shared cache or the browser.
      "cache-control": "private, no-store",
    },
  });
}
