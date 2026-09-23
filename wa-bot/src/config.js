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
});
