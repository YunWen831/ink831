(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.YieldRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LEVELS = [
    {
      name: '请先行',
      subtitle: '换位，是最短的路。',
      hint: '点一下敌人，你们会交换位置。被换者会愣一拍。',
      map: [
        '#######',
        '#.....#',
        '#..o..#',
        '#.....#',
        '#P...E#',
        '#....X#',
        '#######'
      ]
    },
    {
      name: '一墙之隔',
      subtitle: '墙挡得住脚步，挡不住换位。',
      hint: '方向键或 WASD 移动；收齐纸鹤后，走进方门。',
      map: [
        '#######',
        '#..o..#',
        '#.###.#',
        '#.....#',
        '#E.P..#',
        '#....X#',
        '#######'
      ]
    },
    {
      name: '借深渊',
      subtitle: '危险也可以站在你这边。',
      hint: '裂隙会吞没任何人。把敌人引过去，自己别踩进去。',
      map: [
        '#######',
        '#.....#',
        '#..^..#',
        '#.EoE.#',
        '#..P..#',
        '#....X#',
        '#######'
      ]
    },
    {
      name: '错位',
      subtitle: '你离开的地方，同样有代价。',
      hint: '隔墙也能换位。先想清楚，换位之后谁离你最近。',
      map: [
        '#######',
        '#o...E#',
        '#.###.#',
        '#.....#',
        '#.P#o.#',
        '#E...X#',
        '#######'
      ]
    },
    {
      name: '针锋',
      subtitle: '别只看你将去哪，也看它们。',
      hint: '红色小点是敌人的下一步。有时最好的移动，是让敌人替你走。',
      map: [
        '#######',
        '#..E..#',
        '#.o#o.#',
        '#..^..#',
        '#E.P.E#',
        '#....X#',
        '#######'
      ]
    },
    {
      name: '四面',
      subtitle: '先后，也是地形的一部分。',
      hint: '编号是行动顺序。前一个让出的格子，后一个就能补上。',
      map: [
        '#######',
        '#E...E#',
        '#..o..#',
        '#.^#^.#',
        '#..P..#',
        '#E.o.X#',
        '#######'
      ]
    },
    {
      name: '回廊',
      subtitle: '没有捷径，只有取舍。',
      hint: '没有裂隙时，距离就是资源。别把自己换进死角。',
      map: [
        '########',
        '#......#',
        '#.####.#',
        '#o...E.#',
        '#.###..#',
        '#P...oX#',
        '########'
      ]
    },
    {
      name: '最后的位置',
      subtitle: '让所有追逐，都成为你的路。',
      hint: '收齐三只纸鹤，走出这盘棋。撤销不记步，放心推演。',
      map: [
        '########',
        '#E....E#',
        '#.o##o.#',
        '#..^^..#',
        '#.E..E.#',
        '#P..o.X#',
        '########'
      ]
    }
  ];

  function createState(levelIndex) {
    const level = LEVELS[levelIndex];
    if (!level) throw new Error('Unknown level: ' + levelIndex);
    const state = {
      levelIndex,
      width: level.map[0].length,
      height: level.map.length,
      player: null,
      exit: null,
      enemies: [],
      shards: [],
      totalShards: 0,
      turns: 0,
      status: 'playing',
      reason: '',
      events: []
    };
    level.map.forEach(function (row, y) {
      if (row.length !== state.width) throw new Error('Ragged map in level ' + (levelIndex + 1));
      Array.from(row).forEach(function (tile, x) {
        if (tile === 'P') state.player = { x, y };
        if (tile === 'X') state.exit = { x, y };
        if (tile === 'E') state.enemies.push({ id: state.enemies.length + 1, x, y });
        if (tile === 'o') state.shards.push({ x, y });
      });
    });
    state.totalShards = state.shards.length;
    if (!state.player || !state.exit || !state.enemies.length) {
      throw new Error('Incomplete level ' + (levelIndex + 1));
    }
    return state;
  }

  function cloneState(state) {
    return {
      ...state,
      player: { ...state.player },
      exit: { ...state.exit },
      enemies: state.enemies.map(enemy => ({ ...enemy })),
      shards: state.shards.map(shard => ({ ...shard })),
      events: []
    };
  }

  function tileAt(state, x, y) {
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return '#';
    return LEVELS[state.levelIndex].map[y][x];
  }

  function enemyAt(state, x, y) {
    return state.enemies.find(enemy => enemy.x === x && enemy.y === y) || null;
  }

  function samePosition(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function collectShard(state) {
    const index = state.shards.findIndex(shard => samePosition(shard, state.player));
    if (index === -1) return;
    state.shards.splice(index, 1);
    state.events.push({ type: 'collect', x: state.player.x, y: state.player.y });
  }

  function checkExit(state) {
    if (state.shards.length || !samePosition(state.player, state.exit)) return false;
    state.status = 'won';
    state.events.push({ type: 'win' });
    return true;
  }

  function directionsFor(enemy, player) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const horizontal = { dx: Math.sign(dx), dy: 0 };
    const vertical = { dx: 0, dy: Math.sign(dy) };
    const directions = Math.abs(dx) >= Math.abs(dy)
      ? [horizontal, vertical]
      : [vertical, horizontal];
    return directions.filter(direction => direction.dx || direction.dy);
  }

  function advanceEnemies(state, swappedId) {
    const order = state.enemies.slice();
    for (const enemy of order) {
      if (!state.enemies.includes(enemy)) continue;
      if (enemy.id === swappedId) {
        state.events.push({ type: 'stunned', enemyId: enemy.id, x: enemy.x, y: enemy.y });
        continue;
      }
      const from = { x: enemy.x, y: enemy.y };
      let destination = null;
      for (const direction of directionsFor(enemy, state.player)) {
        const x = enemy.x + direction.dx;
        const y = enemy.y + direction.dy;
        if (tileAt(state, x, y) === '#' || enemyAt(state, x, y)) continue;
        destination = { x, y };
        break;
      }
      if (!destination) {
        state.events.push({ type: 'blocked', enemyId: enemy.id, x: enemy.x, y: enemy.y });
        continue;
      }
      enemy.x = destination.x;
      enemy.y = destination.y;
      const event = {
        type: 'enemyMove',
        enemyId: enemy.id,
        from,
        to: { ...destination },
        fall: tileAt(state, enemy.x, enemy.y) === '^',
        catch: samePosition(enemy, state.player)
      };
      state.events.push(event);
      if (event.fall) {
        state.enemies = state.enemies.filter(candidate => candidate !== enemy);
        continue;
      }
      if (event.catch) {
        state.status = 'lost';
        state.reason = enemy.id + ' 号敌人走到了你的位置。';
        state.events.push({ type: 'lose' });
        break;
      }
    }
  }

  function applyAction(source, action) {
    if (source.status !== 'playing') return null;
    const state = cloneState(source);
    let swappedId = null;

    if (action.type === 'swap') {
      const enemy = state.enemies.find(candidate => candidate.id === action.enemyId);
      if (!enemy) return null;
      const oldPlayer = { ...state.player };
      state.player = { x: enemy.x, y: enemy.y };
      enemy.x = oldPlayer.x;
      enemy.y = oldPlayer.y;
      swappedId = enemy.id;
      state.events.push({ type: 'swap', enemyId: enemy.id, from: oldPlayer, to: { ...state.player } });
    } else if (action.type === 'move') {
      const { dx, dy } = action;
      if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
      const x = state.player.x + dx;
      const y = state.player.y + dy;
      if (tileAt(state, x, y) === '#' || enemyAt(state, x, y)) return null;
      state.player = { x, y };
      state.events.push({ type: 'move', to: { x, y } });
      if (tileAt(state, x, y) === '^') {
        state.turns += 1;
        state.status = 'lost';
        state.reason = '你踏入了裂隙。';
        state.events.push({ type: 'lose' });
        return state;
      }
    } else if (action.type !== 'wait') {
      return null;
    }

    state.turns += 1;
    collectShard(state);
    if (checkExit(state)) return state;
    advanceEnemies(state, swappedId);
    return state;
  }

  function getIntents(state) {
    if (state.status !== 'playing') return [];
    const preview = cloneState(state);
    advanceEnemies(preview, null);
    return preview.events.filter(event => event.type === 'enemyMove');
  }

  function stateKey(state) {
    const enemies = state.enemies
      .slice()
      .sort((a, b) => a.id - b.id)
      .map(enemy => enemy.id + ':' + enemy.x + ',' + enemy.y)
      .join(';');
    const shards = state.shards
      .map(shard => shard.x + ',' + shard.y)
      .sort()
      .join(';');
    return state.player.x + ',' + state.player.y + '|' + enemies + '|' + shards;
  }

  return {
    LEVELS,
    createState,
    cloneState,
    tileAt,
    enemyAt,
    applyAction,
    getIntents,
    stateKey
  };
});
