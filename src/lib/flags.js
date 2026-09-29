// ─────────────────────────────────────────────────────────
// FEATURE FLAGS — "don't open empty marketplaces" (CLAUDE.md Vision):
// Find a Game, Teams and Challenges are built and left ready, but only
// become visible once there's local density. Until then every flag is
// OFF for regular users and ON for admins (so the owner can preview).
//
// Env override: VITE_FLAGS="openGames,teams" turns those flags on for
// EVERYONE (e.g. a preview deploy, or local demo mode, where no one is
// an admin because there's no account). Unknown names are ignored.
// ─────────────────────────────────────────────────────────

export const FLAGS = {
  openGames: false,  // Jogar → "Encontrar jogo"
  teams: false,      // Competir → Equipas
  challenges: false, // Competir → Desafios
};

const envOn = new Set(
  String(import.meta.env?.VITE_FLAGS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

/** Is `flag` on for this viewer? Admins see every flag. */
export function isEnabled(flag, { isAdmin = false } = {}) {
  if (!(flag in FLAGS)) return false;
  if (FLAGS[flag] || envOn.has(flag)) return true;
  return Boolean(isAdmin);
}
