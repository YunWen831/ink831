const assert = require('node:assert/strict');
const Rules = require('./rules.js');

function actionsFor(state) {
  return [
    { type: 'move', dx: 0, dy: -1 },
    { type: 'move', dx: -1, dy: 0 },
    { type: 'move', dx: 1, dy: 0 },
    { type: 'move', dx: 0, dy: 1 },
    { type: 'wait' },
    ...state.enemies.map(enemy => ({ type: 'swap', enemyId: enemy.id }))
  ];
}

function solve(levelIndex, limit = 150000) {
  const initial = Rules.createState(levelIndex);
  const queue = [{ state: initial, parent: null, action: null }];
  const visited = new Set([Rules.stateKey(initial)]);
  let head = 0;

  while (head < queue.length && queue.length < limit) {
    const node = queue[head++];
    for (const action of actionsFor(node.state)) {
      const next = Rules.applyAction(node.state, action);
      if (!next || next.status === 'lost') continue;
      const key = Rules.stateKey(next);
      if (visited.has(key)) continue;
      const child = { state: next, parent: node, action };
      if (next.status === 'won') {
        const path = [];
        for (let cursor = child; cursor.parent; cursor = cursor.parent) path.push(cursor.action);
        return { path: path.reverse(), visited: queue.length };
      }
      visited.add(key);
      queue.push(child);
    }
  }
  throw new Error('Level ' + (levelIndex + 1) + ' was not solved within ' + limit + ' states');
}

const first = Rules.createState(0);
assert.equal(Rules.applyAction(first, { type: 'move', dx: -1, dy: 0 }), null);
assert.equal(first.turns, 0);
const swapped = Rules.applyAction(first, { type: 'swap', enemyId: 1 });
assert.deepEqual(swapped.player, { x: 5, y: 4 });
assert.deepEqual(swapped.enemies[0], { id: 1, x: 1, y: 4 });
assert.equal(swapped.turns, 1);
assert.ok(swapped.events.some(event => event.type === 'stunned'));

const collector = Rules.createState(0);
collector.player = { x: 3, y: 3 };
const collected = Rules.applyAction(collector, { type: 'move', dx: 0, dy: -1 });
assert.equal(collected.shards.length, 0);
assert.ok(collected.events.some(event => event.type === 'collect'));

const faller = Rules.createState(2);
faller.player = { x: 3, y: 1 };
faller.enemies = [{ id: 1, x: 3, y: 3 }];
const fallen = Rules.applyAction(faller, { type: 'wait' });
assert.equal(fallen.enemies.length, 0);
assert.equal(fallen.status, 'playing');
assert.ok(fallen.events.some(event => event.type === 'enemyMove' && event.fall));

for (let index = 0; index < Rules.LEVELS.length; index += 1) {
  const solution = solve(index);
  let state = Rules.createState(index);
  for (const action of solution.path) state = Rules.applyAction(state, action);
  assert.equal(state.status, 'won');
  console.log(
    'Level ' + (index + 1) + ' "' + Rules.LEVELS[index].name + '": ' +
    solution.path.length + ' turns, ' + solution.visited + ' states visited'
  );
}

console.log('All rule checks passed.');
