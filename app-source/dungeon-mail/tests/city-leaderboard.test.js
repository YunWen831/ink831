import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CityLeaderboard } from '../city-leaderboard.js';

test('city leaderboard ranks escaped runs by total assets and reloads from disk', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'city-board-'));
  try {
    const board = await new CityLeaderboard(dir).load();
    board.record({ name: '甲', cash: 100, bank: 200, seconds: 90, stats: { kills: 2, contracts: 1 }, rule: '现金雨', chaos: 20 });
    board.record({ name: '乙', cash: 900, bank: 50, seconds: 40, stats: { kills: 0, contracts: 0 }, rule: '严打周', chaos: 5 });
    assert.equal(board.top()[0].name, '乙');
    await board.flush();
    const reloaded = await new CityLeaderboard(dir).load();
    assert.deepEqual(reloaded.top().map(row => row.name), ['乙', '甲']);
    assert.equal(reloaded.top()[0].total, 950);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
