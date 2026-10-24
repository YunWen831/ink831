(function () {
  'use strict';

  const Rules = window.YieldRules;
  const $ = id => document.getElementById(id);
  const board = $('board');
  const result = $('result');
  const message = $('message');
  const storageKey = 'yield-progress-v1';
  const params = new URLSearchParams(window.location.search);
  const requestedLevel = Number(params.get('level'));
  const initialLevel = Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= Rules.LEVELS.length
    ? requestedLevel - 1
    : 0;
  let audioContext = null;
  let history = [];
  let resultPrimaryAction = null;
  let progress = loadProgress();
  let state = Rules.createState(params.has('level') ? initialLevel : Math.min(progress.lastLevel, progress.unlocked - 1));

  function loadProgress() {
    const fallback = { unlocked: 1, best: {}, lastLevel: 0, sound: true };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved || typeof saved !== 'object') return fallback;
      return {
        unlocked: Math.max(1, Math.min(Rules.LEVELS.length, Number(saved.unlocked) || 1)),
        best: saved.best && typeof saved.best === 'object' ? saved.best : {},
        lastLevel: Math.max(0, Math.min(Rules.LEVELS.length - 1, Number(saved.lastLevel) || 0)),
        sound: saved.sound !== false
      };
    } catch {
      return fallback;
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {}
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function makeElement(className, text) {
    const element = document.createElement('span');
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderBoard() {
    const focusedEnemy = document.activeElement && document.activeElement.dataset
      ? document.activeElement.dataset.enemyId
      : null;
    const intents = Rules.getIntents(state);
    board.replaceChildren();
    board.style.setProperty('--cols', state.width);
    board.style.setProperty('--ratio', state.width + ' / ' + state.height);
    board.setAttribute('aria-label', '第 ' + (state.levelIndex + 1) + ' 关棋盘。方向键移动，点击敌人换位。');

    for (let y = 0; y < state.height; y += 1) {
      for (let x = 0; x < state.width; x += 1) {
        const tile = Rules.tileAt(state, x, y);
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.x = x;
        cell.dataset.y = y;
        if (tile === '#') cell.classList.add('wall');
        if (tile === '^') cell.classList.add('void');
        if (x === state.exit.x && y === state.exit.y) {
          cell.classList.add('exit');
          if (!state.shards.length) cell.classList.add('open');
          cell.append(makeElement('exit-gate'));
        }
        if (state.shards.some(shard => shard.x === x && shard.y === y)) cell.append(makeElement('shard'));
        if (state.player.x === x && state.player.y === y) cell.append(makeElement('player'));

        const enemy = Rules.enemyAt(state, x, y);
        if (enemy) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'enemy';
          button.dataset.enemyId = enemy.id;
          button.setAttribute('aria-label', enemy.id + ' 号敌人，位于第 ' + (y + 1) + ' 行第 ' + (x + 1) + ' 列，点击交换位置');
          button.title = '与 ' + enemy.id + ' 号敌人换位';
          button.append(makeElement('enemy-number', enemy.id));
          cell.append(button);
        }

        const intent = intents.find(event => event.to.x === x && event.to.y === y);
        if (intent) {
          cell.append(makeElement('intent'));
          if (intent.catch) cell.classList.add('danger');
        }
        board.append(cell);
      }
    }

    if (focusedEnemy) {
      const replacement = board.querySelector('[data-enemy-id="' + focusedEnemy + '"]');
      if (replacement) replacement.focus({ preventScroll: true });
    }
  }

  function renderResult() {
    if (state.status === 'playing') {
      result.hidden = true;
      return;
    }
    result.hidden = false;
    if (state.status === 'won') {
      const isLast = state.levelIndex === Rules.LEVELS.length - 1;
      const best = progress.best[state.levelIndex];
      $('result-kicker').textContent = 'LEVEL CLEAR / ' + state.turns + ' TURNS';
      $('result-title').textContent = isLast ? '全盘皆让' : '位置正好';
      $('result-copy').textContent = '你用 ' + state.turns + ' 回合走出此局。' + (best === state.turns ? '这是目前的最佳路线。' : '最佳纪录为 ' + best + ' 回合。');
      $('result-primary').textContent = isLast ? '再走一次' : '下一局';
      $('result-secondary').textContent = '选择关卡';
      resultPrimaryAction = isLast ? 'restart' : 'next';
    } else {
      $('result-kicker').textContent = 'TURN LOST';
      $('result-title').textContent = state.reason.includes('裂隙') ? '一步踏空' : '被追上了';
      $('result-copy').textContent = state.reason + (history.length ? ' 可以撤销这一步，换一条路线。' : ' 再看一眼落点，重新来。');
      $('result-primary').textContent = history.length ? '撤销一步' : '重新开始';
      $('result-secondary').textContent = history.length ? '重新开始' : '选择关卡';
      resultPrimaryAction = history.length ? 'undo' : 'restart';
    }
  }

  function render() {
    const level = Rules.LEVELS[state.levelIndex];
    const collected = state.totalShards - state.shards.length;
    $('level-number').textContent = '第 ' + pad(state.levelIndex + 1) + ' 局 / ' + pad(Rules.LEVELS.length);
    $('level-name').textContent = level.name;
    $('level-subtitle').textContent = level.subtitle;
    $('level-hint').textContent = level.hint;
    $('turn-count').textContent = pad(state.turns);
    $('best-score').textContent = progress.best[state.levelIndex] ? '最佳 ' + pad(progress.best[state.levelIndex]) : '最佳 —';
    $('shard-count').textContent = collected + ' / ' + state.totalShards;
    $('shard-progress').style.width = (collected / state.totalShards * 100) + '%';
    $('exit-status').textContent = state.shards.length ? '门未开' : '门已开';
    $('undo-button').disabled = !history.length;
    $('unlock-count').textContent = progress.unlocked + ' / ' + Rules.LEVELS.length;
    $('sound-button').textContent = progress.sound ? '声音 开' : '声音 关';
    $('sound-button').setAttribute('aria-pressed', String(progress.sound));
    document.title = level.name + ' · 让位';
    renderBoard();
    renderResult();
  }

  function setMessage(text, urgent) {
    message.textContent = text;
    message.classList.toggle('urgent', Boolean(urgent));
  }

  function animateBoard(className) {
    board.classList.remove(className);
    void board.offsetWidth;
    board.classList.add(className);
    board.addEventListener('animationend', () => board.classList.remove(className), { once: true });
  }

  function getAudioContext() {
    if (!progress.sound) return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!audioContext) audioContext = new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  }

  function tone(frequency, duration, delay, volume, type) {
    const context = getAudioContext();
    if (!context) return;
    const start = context.currentTime + (delay || 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type || 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || 0.035, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playSounds(events) {
    if (!progress.sound) return;
    if (events.some(event => event.type === 'swap')) {
      tone(220, .12, 0, .035, 'triangle');
      tone(440, .14, .055, .025, 'triangle');
    } else if (events.some(event => event.type === 'move')) {
      tone(150, .07, 0, .018, 'sine');
    }
    if (events.some(event => event.type === 'collect')) {
      tone(523.25, .16, 0, .035);
      tone(659.25, .2, .08, .03);
    }
    if (events.some(event => event.type === 'enemyMove' && event.fall)) tone(110, .28, .03, .04, 'sawtooth');
    if (events.some(event => event.type === 'lose')) tone(82, .4, 0, .05, 'triangle');
    if (events.some(event => event.type === 'win')) {
      tone(392, .25, 0, .03);
      tone(523.25, .25, .1, .03);
      tone(659.25, .35, .2, .035);
    }
  }

  function actionMessage(next) {
    if (next.status === 'lost') return next.reason;
    if (next.status === 'won') return '门在身后合上。这一局，走完了。';
    const events = next.events;
    const fallen = events.find(event => event.type === 'enemyMove' && event.fall);
    if (events.some(event => event.type === 'collect') && !next.shards.length) return '纸鹤收齐，方门已开。';
    if (fallen) return fallen.enemyId + ' 号敌人坠入裂隙。危险也能借来一用。';
    if (events.some(event => event.type === 'swap')) return '换位完成。被换者愣了一拍，其余敌人照常行动。';
    if (events.some(event => event.type === 'collect')) return '收到一只纸鹤。还差 ' + next.shards.length + ' 只。';
    if (!events.some(event => event.type === 'move')) return '你停了一拍，敌人没有。';
    return '敌人按预告走了一步。';
  }

  function perform(action) {
    if (state.status !== 'playing') return false;
    const next = Rules.applyAction(state, action);
    if (!next) {
      setMessage('那边走不通。移动不能穿墙或撞上敌人，点击敌人才能换位。', true);
      animateBoard('invalid');
      return false;
    }
    history.push(Rules.cloneState(state));
    const wasSwap = action.type === 'swap';
    state = next;
    if (state.status === 'won') {
      const oldBest = progress.best[state.levelIndex];
      if (!oldBest || state.turns < oldBest) progress.best[state.levelIndex] = state.turns;
      progress.unlocked = Math.max(progress.unlocked, Math.min(Rules.LEVELS.length, state.levelIndex + 2));
      saveProgress();
    }
    setMessage(actionMessage(state), state.status === 'lost');
    playSounds(state.events);
    render();
    if (wasSwap) animateBoard('swap-flash');
    return true;
  }

  function undo() {
    if (!history.length) return;
    state = history.pop();
    setMessage('已撤销一步，回合数也已还原。', false);
    render();
    board.focus({ preventScroll: true });
  }

  function restart() {
    history = [];
    state = Rules.createState(state.levelIndex);
    setMessage(Rules.LEVELS[state.levelIndex].hint, false);
    render();
  }

  function startLevel(index) {
    if (index < 0 || index >= Rules.LEVELS.length) return;
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    history = [];
    state = Rules.createState(index);
    progress.lastLevel = index;
    saveProgress();
    setMessage(Rules.LEVELS[index].hint, false);
    render();
    board.focus({ preventScroll: true });
  }

  function showLevels() {
    const grid = $('level-grid');
    grid.replaceChildren();
    Rules.LEVELS.forEach((level, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level-card';
      button.disabled = index >= progress.unlocked;
      const number = makeElement('level-index', pad(index + 1));
      const title = document.createElement('strong');
      title.textContent = level.name;
      const score = document.createElement('small');
      score.textContent = button.disabled ? '尚未解锁' : progress.best[index] ? '最佳 ' + pad(progress.best[index]) + ' 回合' : '等待第一步';
      const lock = makeElement('lock', button.disabled ? 'LOCK' : index === state.levelIndex ? 'HERE' : '');
      button.append(number, title, score, lock);
      button.addEventListener('click', () => startLevel(index));
      grid.append(button);
    });
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    $('levels-dialog').showModal();
  }

  board.addEventListener('click', event => {
    const enemy = event.target.closest('.enemy');
    if (enemy) perform({ type: 'swap', enemyId: Number(enemy.dataset.enemyId) });
  });

  document.querySelectorAll('[data-move]').forEach(button => {
    button.addEventListener('click', () => {
      const [dx, dy] = button.dataset.move.split(',').map(Number);
      perform({ type: 'move', dx, dy });
    });
  });

  $('undo-button').addEventListener('click', undo);
  $('wait-button').addEventListener('click', () => perform({ type: 'wait' }));
  $('touch-wait').addEventListener('click', () => perform({ type: 'wait' }));
  $('restart-button').addEventListener('click', restart);
  $('levels-button').addEventListener('click', showLevels);
  $('intro-levels-button').addEventListener('click', showLevels);
  $('help-button').addEventListener('click', () => $('help-dialog').showModal());
  $('sound-button').addEventListener('click', () => {
    progress.sound = !progress.sound;
    saveProgress();
    render();
    if (progress.sound) tone(440, .12, 0, .025);
  });

  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => $(button.dataset.close).close());
  });

  $('start-button').addEventListener('click', () => {
    getAudioContext();
    startLevel(Math.min(progress.lastLevel, progress.unlocked - 1));
  });

  $('result-primary').addEventListener('click', () => {
    if (resultPrimaryAction === 'next') startLevel(state.levelIndex + 1);
    if (resultPrimaryAction === 'restart') restart();
    if (resultPrimaryAction === 'undo') undo();
  });
  $('result-secondary').addEventListener('click', () => {
    if (state.status === 'lost' && history.length) restart();
    else showLevels();
  });

  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]')) return;
    if (event.target.closest('button, a') && (event.code === 'Space' || event.code === 'Enter')) return;
    const key = event.key.toLowerCase();
    const moves = {
      arrowup: [0, -1], w: [0, -1],
      arrowleft: [-1, 0], a: [-1, 0],
      arrowright: [1, 0], d: [1, 0],
      arrowdown: [0, 1], s: [0, 1]
    };
    if (moves[key]) {
      event.preventDefault();
      const [dx, dy] = moves[key];
      perform({ type: 'move', dx, dy });
    } else if (event.code === 'Space') {
      event.preventDefault();
      perform({ type: 'wait' });
    } else if (key === 'z') {
      event.preventDefault();
      undo();
    } else if (key === 'r') {
      event.preventDefault();
      restart();
    }
  });

  if (progress.lastLevel > 0) $('start-button').textContent = '继续第 ' + (progress.lastLevel + 1) + ' 局';
  setMessage(Rules.LEVELS[state.levelIndex].hint, false);
  render();
  if (!params.has('play')) $('intro-dialog').showModal();

  window.YieldGame = Object.freeze({
    startLevel,
    perform,
    undo,
    restart,
    getState: () => Rules.cloneState(state)
  });
})();
