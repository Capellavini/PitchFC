// Poll support. Baileys 7.0.0-rc14 ships with poll-vote decryption disabled,
// so we keep each poll's creation secret ourselves and decrypt votes here.
//
// A vote can only be read if the bot SAW the poll being created (or created it
// itself): the vote is encrypted with a key that lives in the creation message.
// Polls are kept on disk (data/polls.json, gitignored) so a restart doesn't lose them.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { BufferJSON, decryptPollVote } from "@whiskeysockets/baileys";
import { parseIntent } from "./roster.js";

const FILE = path.resolve("data", "polls.json");
const KEEP_MS = 30 * 24 * 36e5;
let state = null;
let memoryOnly = false; // tests: never touch the real data/polls.json

const load = () => {
  if (state) return state;
  try { state = JSON.parse(fs.readFileSync(FILE, "utf8"), BufferJSON.reviver); } catch { state = null; }
  state ??= { polls: {}, votes: {} };
  for (const [id, p] of Object.entries(state.polls)) if (Date.now() - p.createdAt > KEEP_MS) delete state.polls[id];
  return state;
};
const save = () => {
  if (memoryOnly) return;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, BufferJSON.replacer));
};

/** Test hook: start from a clean in-memory state without touching disk. */
export const _reset = () => { memoryOnly = true; state = { polls: {}, votes: {} }; };

export const addPoll = (poll) => { load().polls[poll.id] = { createdAt: Date.now(), ...poll }; save(); };
export const getPoll = (id) => load().polls[id] ?? null;
export const setApplies = (id, applies) => { const p = getPoll(id); if (p) { p.applies = applies; save(); } };

/** Poll creation payload out of a message (any of the 3 wire versions). */
export function extractPoll(inner) {
  const c = inner?.pollCreationMessage ?? inner?.pollCreationMessageV2 ?? inner?.pollCreationMessageV3;
  if (!c) return null;
  return {
    name: c.name ?? "",
    options: (c.options ?? []).map((o) => o.optionName ?? "").filter(Boolean),
    secret: inner.messageContextInfo?.messageSecret ?? null,
  };
}

/**
 * What does choosing this option mean for attendance? Options are matched with
 * the same strict phrase list as chat ("✅ Eu vou", "Não vou"), and bilingual
 * options like "Eu vou / I'm in" are split first. "Talvez" and the like -> null.
 */
export function optionIntent(name) {
  for (const part of String(name).split(/\s*[/|]\s*/)) {
    const r = parseIntent(part);
    if (r) return r.intent;
  }
  return null;
}

const sha256 = (s) => crypto.createHash("sha256").update(Buffer.from(s)).digest();

/**
 * Decrypt a vote trying every plausible JID form (phone vs privacy id) for the
 * poll creator and the voter. Returns the chosen option names, or null.
 */
export function decryptSelected(poll, encVote, { creators, voters }) {
  for (const pollCreatorJid of creators) {
    for (const voterJid of voters) {
      try {
        const vote = decryptPollVote(encVote, { pollEncKey: poll.secret, pollCreatorJid, pollMsgId: poll.id, voterJid });
        const picked = (vote.selectedOptions ?? []).map((h) => Buffer.from(h));
        return { voterJid, names: poll.options.filter((o) => picked.some((h) => h.equals(sha256(o)))) };
      } catch { /* wrong jid form: try the next */ }
    }
  }
  return null;
}

/** The single attendance intent of a vote, or null (no vote, "maybe", or conflicting picks). */
export function voteIntent(names) {
  const intents = [...new Set(names.map(optionIntent).filter(Boolean))];
  return intents.length === 1 ? intents[0] : null;
}

/** Idempotence: only act when a voter's intent CHANGED. Returns true if it is new. */
export function noteVote(pollId, voterJid, intent) {
  const k = `${pollId}|${voterJid}`;
  const s = load();
  if (s.votes[k] === intent) return false;
  s.votes[k] = intent;
  save();
  return true;
}
