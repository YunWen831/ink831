import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const safeNumber = (value, max = 1e9) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : 0;

// Only escaped runs are recorded. The file lives in the backed-up data directory
// and is replaced atomically; the in-memory top list is always the source for reads.
export class CityLeaderboard {
  constructor(directory) {
    this.directory = directory;
    this.path = join(directory, 'city-leaderboard.json');
    this.data = { version: 1, entries: [] };
    this.queue = Promise.resolve();
  }
  async load() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.entries)) throw new Error('Invalid city leaderboard save');
      this.data = { version: 1, entries: data.entries.filter(entry => this.valid(entry)).slice(0, 100) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return this;
  }
  valid(entry) {
    return entry && typeof entry.name === 'string' && entry.name.length > 0 && entry.name.length <= 24
      && typeof entry.userId === 'string' && entry.userId.length <= 64
      && Number.isFinite(entry.total) && Number.isFinite(entry.seconds) && Number.isFinite(entry.at)
      && entry.stats && typeof entry.stats === 'object';
  }
  rank(entries) {
    return [...entries].sort((a, b) => b.total - a.total || a.seconds - b.seconds || (b.stats.kills || 0) - (a.stats.kills || 0)).slice(0, 100);
  }
  record(input) {
    const entry = {
      id: randomUUID(),
      name: String(input?.name || '匿名').replace(/[\u0000-\u001f]/g, '').slice(0, 24) || '匿名',
      userId: typeof input?.userId === 'string' ? input.userId.slice(0, 64) : '',
      cash: safeNumber(input?.cash),
      bank: safeNumber(input?.bank),
      total: safeNumber((input?.cash || 0) + (input?.bank || 0)),
      seconds: safeNumber(input?.seconds, 86400),
      stats: {
        jobs: safeNumber(input?.stats?.jobs), robberies: safeNumber(input?.stats?.robberies),
        kills: safeNumber(input?.stats?.kills), deaths: safeNumber(input?.stats?.deaths),
        contracts: safeNumber(input?.stats?.contracts), raceWins: safeNumber(input?.stats?.raceWins),
        heists: safeNumber(input?.stats?.heists)
      },
      rule: String(input?.rule || '').slice(0, 24),
      chaos: safeNumber(input?.chaos, 100),
      at: Date.now()
    };
    this.data.entries = this.rank([...this.data.entries, entry]);
    this.save();
    return this.top();
  }
  top(limit = 10) {
    return this.rank(this.data.entries).slice(0, limit).map(({ id, name, cash, bank, total, seconds, stats, rule, chaos, at }) => ({ id, name, cash, bank, total, seconds, stats, rule, chaos, at }));
  }
  save() {
    const task = this.queue.then(async () => {
      const raw = JSON.stringify(this.data);
      await writeFile(this.path + '.tmp', raw, { mode: 0o600 });
      try { await copyFile(this.path, this.path + '.bak'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      await rename(this.path + '.tmp', this.path);
    });
    this.queue = task.catch(() => {});
    return task;
  }
  flush() { return this.queue; }
}
