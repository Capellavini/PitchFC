// Adjunto da Liga — the browser side of the chat: files in, one request out.
// readAttachment and askAdjunto touch the file reader and the network; the pure
// helpers live in leagueAdjuntoFiles.js so they can be tested without a browser.
import { supabase, supabaseEnabled } from "./supabase";
import { redactPrivate } from "./leagueAdjuntoPrivacy.js";
import { LIMITS } from "./leagueAdjuntoRequest.js";
import { classifyFile } from "./leagueAdjuntoFiles.js";

const toBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(",")[1] || "");
  r.onerror = () => reject(new Error("read_failed"));
  r.readAsDataURL(file);
});
const toText = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new Error("read_failed"));
  r.readAsText(file);
});

/**
 * Reads a file the Gestor picked. Text is masked here (contacts, licences) and
 * the count is returned so the screen can say so; images and PDFs go as they are.
 * @returns {Promise<{attachment: object, masked: number}>}
 * @throws Error("unsupported" | "too_big" | "read_failed")
 */
export async function readAttachment(file) {
  const c = classifyFile(file);
  if (!c) throw new Error("unsupported");
  const name = file.name.slice(0, 80);
  if (c.kind === "text") {
    const raw = await toText(file);
    if (raw.length > LIMITS.textChars) throw new Error("too_big");
    const { text, removed } = redactPrivate(raw);
    return { attachment: { kind: "text", name, text }, masked: removed };
  }
  if (file.size > LIMITS.mediaBytes) throw new Error("too_big");
  return { attachment: { kind: "media", name, media_type: c.media_type, data: await toBase64(file) }, masked: 0 };
}

/**
 * One chat turn. Never throws: `{ ok: false, code, message }` for anything that
 * stops the model from answering (the screen falls back to the guided answers).
 * codes: offline (no cloud), auth, disabled, limit, invalid, refusal, empty, model, network
 */
export async function askAdjunto({ messages, attachments = [], context }) {
  if (!supabaseEnabled || !supabase) return { ok: false, code: "offline", message: "A IA só funciona com a conta ligada." };
  let token = null;
  try { token = (await supabase.auth.getSession())?.data?.session?.access_token || null; } catch { /* no session */ }
  if (!token) return { ok: false, code: "auth", message: "Inicia sessão para usar a IA do Adjunto." };
  try {
    const res = await fetch("/api/league-adjunto", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages, attachments, context }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && !data.error) return { ok: true, reply: data };
    return { ok: false, code: data?.code || (res.status === 404 ? "disabled" : "model"), message: data?.message || "O Adjunto não respondeu." };
  } catch {
    return { ok: false, code: "network", message: "Sem ligação ao Adjunto. Tenta outra vez." };
  }
}
