// Shared core (app + wa-bot): pure ESM, no DOM/i18n/theme/env.

// Stable positive integer from a uuid, so cloud players slot into the
// local features that assume numeric ids (teams, matchday, posts…).
// games.teams[].players and live_matchday events store these ints.
export const hashId = (uuid) => {
  let h = 0;
  for (let i = 0; i < uuid.length; i++) h = (h * 31 + uuid.charCodeAt(i)) >>> 0;
  return h;
};
