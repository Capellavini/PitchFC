// Edge Function: one welcome email per account, right after the user
// confirms their email address. Called by the app (fire-and-forget) with
// the user's own JWT — see the send-welcome call in load() in
// src/hooks/useCloud.js. Idempotent: calling it again, or twice at once,
// never sends a second email.
//
// Deploy:  supabase functions deploy send-welcome   (CI: .github/workflows/supabase-functions.yml)
// Secrets: RESEND_API_KEY   required — same Resend key used as the Auth SMTP password
//          PITCH_WHATSAPP   optional — the bot's WhatsApp number, E.164 digits (e.g. 351912345678);
//                           adds a "WhatsApp" wa.me link to the footer, omitted when unset
//          WELCOME_FROM     optional — defaults to "Vini | Pitch FC App <vini@pitch-fc.com>"
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically)
//
// Flow: JWT → auth user → re-read via auth.admin (email must be confirmed)
// → CLAIM public.welcome_emails (insert … on conflict do nothing, keyed by
// auth user id) → personalise (name, optional group, language) → send via
// Resend → on failure, delete the claim so a later call retries.
// Claim-before-send is what makes two concurrent calls safe.
//
// The group is optional: at confirmation time the user usually has no
// players row yet. We use their group if they already have one, else the
// invite they signed up through (user_metadata.join_token, stored by
// signUp in useCloud.js, or body.join_token from the current URL),
// else send a generic welcome.
//
// Body (optional): { lang?: "pt" | "pt-br" | "en", join_token?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ICONS, firstName, pickLang, renderWelcome, whatsappSocial, type Social } from "./email.ts";

// ── Footer social links — the single place to add more (TikTok, X, …) ──
const SOCIALS: Social[] = [
  { label: "Instagram", handle: "@pitchfc.app", url: "https://instagram.com/pitchfc.app", icon: ICONS.instagram },
  ...[whatsappSocial(Deno.env.get("PITCH_WHATSAPP"))].filter((s): s is Social => !!s),
];

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const WELCOME_FROM = Deno.env.get("WELCOME_FROM") || "Vini | Pitch FC App <vini@pitch-fc.com>";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: string, code = 200) =>
  new Response(JSON.stringify({ status }), { status: code, headers: { ...cors, "Content-Type": "application/json" } });

type Group = { name: string | null; wa_bot_enabled: boolean | null; wa_group_jid: string | null; wa_bot_lang: string | null };
const GROUP_COLS = "name, wa_bot_enabled, wa_group_jid, wa_bot_lang";

/** The user's current group, else the group behind the invite they signed up with. */
async function resolveGroup(userId: string, joinToken: string | null): Promise<Group | null> {
  const { data: players } = await admin.from("players")
    .select("group_id").eq("user_id", userId).order("created_at", { ascending: true }).limit(1);
  const gid = players?.[0]?.group_id;
  if (gid) {
    const { data } = await admin.from("groups").select(GROUP_COLS).eq("id", gid).maybeSingle();
    if (data) return data as Group;
  }
  const t = (joinToken || "").trim();
  if (!t) return null;
  // Same lookup as resolveInviteToken in useCloud.js: mensalista link, then avulso link.
  for (const col of ["invite_token", "invite_token_avulso"]) {
    const { data } = await admin.from("groups").select(GROUP_COLS).eq(col, t).limit(1);
    if (data?.[0]) return data[0] as Group;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return reply("unauthorized", 401);
    const { data: auth, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !auth?.user) return reply("unauthorized", 401);

    // Authoritative, fresh read of the account (not the token's claims).
    const { data: fresh, error: uErr } = await admin.auth.admin.getUserById(auth.user.id);
    const user = fresh?.user;
    if (uErr || !user) return reply("unauthorized", 401);
    if (!user.email || !user.email_confirmed_at) return reply("email_not_confirmed");
    if (!RESEND_API_KEY) return reply("not_configured");

    let body: { lang?: string; join_token?: string } = {};
    try { body = await req.json(); } catch { /* no body is fine */ }
    const meta = (user.user_metadata ?? {}) as { name?: string; lang?: string; join_token?: string };

    // Claim: only one caller can insert the row for this user.
    const { data: claimed, error: cErr } = await admin.from("welcome_emails")
      .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true })
      .select("user_id");
    if (cErr) throw cErr;
    if (!claimed?.length) return reply("already_sent");
    const release = () => admin.from("welcome_emails").delete().eq("user_id", user.id);

    try {
      const group = await resolveGroup(user.id, meta.join_token || body.join_token || null);
      const lang = pickLang(meta.lang || body.lang, group?.wa_bot_lang);
      const { subject, html, text } = renderWelcome({
        firstName: firstName(meta.name, user.email, lang),
        groupName: group?.name ?? null,
        lang,
        botEnabled: !!(group?.wa_bot_enabled && group?.wa_group_jid),
        socials: SOCIALS,
      });

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
          // Belt and braces on top of the DB claim: Resend itself drops a
          // repeat of the same key within 24h.
          "Idempotency-Key": `welcome-${user.id}`,
        },
        body: JSON.stringify({ from: WELCOME_FROM, to: [user.email], subject, html, text }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        await release();
        console.error(`resend ${res.status}: ${detail.slice(0, 300)}`);
        return reply("send_failed", 502);
      }
    } catch (e) {
      await release(); // anything failed after the claim: let a later call retry
      throw e;
    }
    return reply("sent");
  } catch (e) {
    console.error("send-welcome error:", (e as Error).message);
    return reply("error", 500);
  }
});
