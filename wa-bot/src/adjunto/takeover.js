// Treinador Adjunto — human takeover. The bot runs as a linked device of
// the bot's WhatsApp number; when someone replies by hand from the phone
// (a fromMe message the bot did NOT send), the Adjunto stays quiet in that
// chat for 30 minutes so it never talks over the founder.

export class Takeover {
  constructor({ now = () => Date.now(), ms = 30 * 60 * 1000, keepSentMs = 6 * 60 * 60 * 1000 } = {}) {
    this.now = now; this.ms = ms; this.keepSentMs = keepSentMs;
    this.sent = new Map();   // message id the bot sent -> ts
    this.until = new Map();  // bare chat jid -> ts until which the bot stays quiet
  }

  /** Record a message id the bot itself sent (from sock.sendMessage's result). */
  noteBotSent(id) {
    if (!id) return;
    const t = this.now();
    this.sent.set(id, t);
    if (this.sent.size > 500) for (const [k, v] of this.sent) if (t - v > this.keepSentMs) this.sent.delete(k);
  }

  isBotSent(id) { return Boolean(id) && this.sent.has(id); }

  /** A fromMe message appeared in chat `jid`. Returns true if it started (or extended) a takeover. */
  onOwnMessage(jid, id) {
    if (!jid || this.isBotSent(id)) return false;
    this.until.set(jid, this.now() + this.ms);
    return true;
  }

  /** Is a human handling any of these chat jids right now? */
  isActive(jids) {
    const t = this.now();
    return [].concat(jids).filter(Boolean).some((j) => (this.until.get(j) ?? 0) > t);
  }
}
