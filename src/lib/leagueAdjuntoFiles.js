// Adjunto da Liga — pure helpers for the chat (no browser, no network).
import { MEDIA_TYPES } from "./leagueAdjuntoRequest.js";

const TEXT_EXT = /\.(csv|tsv|txt)$/i;
const MEDIA_EXT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

/** @returns {{kind: "text"|"media", media_type?: string}|null} */
export function classifyFile({ name = "", type = "" }) {
  if (MEDIA_TYPES.includes(type)) return { kind: "media", media_type: type };
  const ext = String(name).split(".").pop().toLowerCase();
  if (MEDIA_EXT[ext]) return { kind: "media", media_type: MEDIA_EXT[ext] };
  if (TEXT_EXT.test(name) || type.startsWith("text/")) return { kind: "text" };
  return null;
}

/** The last turns of the chat as the server wants them: starts with the user, alternating text only. */
export function chatHistory(log, { max = 8 } = {}) {
  const turns = log.filter((m) => m.text && m.text.trim()).map((m) => ({ role: m.role, text: m.text.trim().slice(0, 1500) }));
  const recent = turns.slice(-max);
  while (recent.length && recent[0].role !== "user") recent.shift();
  return recent;
}
