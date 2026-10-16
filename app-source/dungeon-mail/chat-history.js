import { CHAT_RETENTION_MS, freshMessages } from '../../courtyard/chat.js';

export class ChatHistory {
  constructor(now = Date.now) { this.now = now;this.entries = new Map(); }
  add(space, message) { this.entries.set(space, freshMessages([...(this.entries.get(space) || []), message], this.now())); }
  read(space) { return freshMessages(this.entries.get(space) || [], this.now()); }
  delete(space) { this.entries.delete(space); }
  sweep(notify = () => {}) {
    const now = this.now(), cutoff = now - CHAT_RETENTION_MS;
    for (const [space, messages] of this.entries) {
      const fresh = freshMessages(messages, now);
      if (fresh.length) this.entries.set(space, fresh);else this.entries.delete(space);
      // Notify even if an intervening add/read already removed expired entries.
      notify(space, cutoff);
    }
    return cutoff;
  }
}
