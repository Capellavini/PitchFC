// Env is read lazily: process.loadEnvFile() runs after static imports.
export const cfg = () => ({
  supabaseUrl: process.env.SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  appUrl: (process.env.APP_URL || "https://pitch-fc.com").replace(/\/$/, ""),
  autosend: process.env.BOT_AUTOSEND === "true",
  maxPerDay: Number(process.env.BOT_MAX_PER_DAY || 4),
  quietStart: Number(process.env.BOT_QUIET_START ?? 23),
  quietEnd: Number(process.env.BOT_QUIET_END ?? 8),
  pollMs: Number(process.env.BOT_POLL_SECONDS || 30) * 1000,
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  askModel: process.env.ASK_MODEL || "claude-haiku-4-5",

  // ── Treinador Adjunto (private organizer DMs) — docs/ADJUNTO-PLAN.md ──
  // Master switch: false = DMs are ignored exactly as before (no routing at all).
  adjuntoEnabled: process.env.ADJUNTO_ENABLED === "true",
  // Dry-run unless "true": log what would be sent/written, send nothing,
  // write nothing to shared app tables. Separate from BOT_AUTOSEND.
  adjuntoAutosend: process.env.ADJUNTO_AUTOSEND === "true",
  adjuntoModel: process.env.ADJUNTO_MODEL || "claude-sonnet-5-5",
  adjuntoEffort: process.env.ADJUNTO_EFFORT || "low",
  adjuntoFallback: process.env.ADJUNTO_FALLBACK !== "false", // server-side refusal fallback (Claude API)
  adjuntoMaxRounds: Number(process.env.ADJUNTO_MAX_ROUNDS || 6),
  adjuntoWindowTurns: Number(process.env.ADJUNTO_WINDOW_TURNS || 12),
  adjuntoBurstMs: Number(process.env.ADJUNTO_BURST_MS ?? 4000),
  adjuntoDmDailyCap: Number(process.env.ADJUNTO_DM_DAILY_CAP || 3),
  adjuntoLimits: {
    dailyMsgs: Number(process.env.ADJUNTO_DAILY_MSGS || 40),
    dailyTurns: Number(process.env.ADJUNTO_DAILY_TURNS || 25),
    dailyUsd: Number(process.env.ADJUNTO_DAILY_USD_PER_LINK || 0.5),
    globalDailyUsd: Number(process.env.ADJUNTO_GLOBAL_DAILY_USD || 10),
  },
});
