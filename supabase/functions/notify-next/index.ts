// Edge Function: notify the player who just got promoted off the waiting
// line. Invoked by a Database Webhook on `attendances` UPDATE.
//
// Deploy:  supabase functions deploy notify-next
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@x.com
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically)
//
// Logic: when a CONFIRMED titular flips to DECLINED, recompute the playing
// XI (confirmed ordered by responded_at, nulls first). If there are still
// >= spots confirmed, a waitlister was promoted into the last slot → push them.

import webpush from "https://esm.sh/web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:admin@pitch.app",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const rec = body.record ?? {};
    const old = body.old_record ?? {};

    if (!(old.status === "confirmed" && rec.status === "declined")) {
      return new Response("ignored", { status: 200 });
    }
    const gameId = rec.game_id;
    if (!gameId) return new Response("no game", { status: 200 });

    const { data: game } = await admin.from("games")
      .select("id, spots, group_id").eq("id", gameId).single();
    if (!game) return new Response("no game", { status: 200 });

    const { data: conf } = await admin.from("attendances")
      .select("player_id, responded_at").eq("game_id", gameId).eq("status", "confirmed")
      .order("responded_at", { ascending: true, nullsFirst: true });
    if (!conf || conf.length < game.spots) return new Response("no promotion", { status: 200 });

    const promoted = conf[game.spots - 1]; // the marginal titular = just promoted
    const { data: grp } = await admin.from("groups").select("name").eq("id", game.group_id).single();
    const { data: subs } = await admin.from("push_subscriptions").select("*").eq("player_id", promoted.player_id);
    if (!subs?.length) return new Response("no subs", { status: 200 });

    const payload = JSON.stringify({
      title: "Entraste no jogo! ⚽",
      body: `Abriu vaga no ${grp?.name ?? "jogo"} — estás dentro.`,
      url: "/",
    });

    await Promise.all(subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      ).catch(async (err) => {
        // Drop dead subscriptions.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      })
    ));

    return new Response("sent", { status: 200 });
  } catch (e) {
    return new Response("error: " + (e as Error).message, { status: 200 });
  }
});
