(() => {
  'use strict';
  const scene = document.querySelector('#scene');
  const world = document.querySelector('#world');
  const bird = document.querySelector('#bird');
  const status = document.querySelector('#status');
  const marker = document.querySelector('#destination');
  const motionButton = document.querySelector('#motion');
  const homeButton = document.querySelector('#home');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const home = { x: 36, y: 76, name: '枝头' };
  const state = { x: home.x, y: home.y, flight: null, destination: { ...home }, facing: 1, keyboard: { x: 61, y: 42 }, paused: false };
  let lastTime = 0;
  let frame = 0;
  let ticking = false;
  let destinationTimer;

  const image = new Image();
  image.src = './scene.webp';
  image.onload = () => {
    world.classList.add('ready');
    updateMotion();
    resize();
    requestAnimationFrame(tick);
  };
  image.onerror = () => {
    document.querySelector('#loading').textContent = '风景加载失败，请刷新重试。';
    scene.setAttribute('aria-label', '风景加载失败，请刷新重试。');
  };

  function resize() {
    const bounds = scene.getBoundingClientRect();
    const scale = Math.min(bounds.width / 1280, bounds.height / 720);
    bird.style.width = `${255 * scale}px`;
    bird.style.height = `${204 * scale}px`;
    drawBird(state.x, state.y);
  }

  function drawBird(x, y) {
    const bounds = scene.getBoundingClientRect();
    const width = parseFloat(bird.style.width) || 116;
    const height = parseFloat(bird.style.height) || 85;
    const offsetX = state.facing > 0 ? width * (46 / 255) : width * (1 - 46 / 255);
    const offsetY = height * (206 / 204);
    const jitter = !reducedMotion.matches && !state.flight ? Math.round(Math.sin(performance.now() / 370)) * 0.1 : 0;
    bird.style.left = `${Math.round(x / 100 * bounds.width - offsetX)}px`;
    bird.style.top = `${Math.round(y / 100 * bounds.height - offsetY + jitter)}px`;
  }

  function placeName(x, y) {
    if (x < 28 && y > 31 && y < 58) return '小屋';
    if (x > 72 && y < 31) return '城堡';
    if (x > 80 && y > 31 && y < 66) return '瀑布';
    if (x > 48 && x < 88 && y > 49) return '河畔';
    if (y < 35) return '云边';
    return '山谷';
  }

  function setStatus(text) {
    status.textContent = text;
  }

  function showMarker(x, y) {
    clearTimeout(destinationTimer);
    marker.classList.remove('visible');
    marker.style.left = `${x}%`;
    marker.style.top = `${y}%`;
    void marker.offsetWidth;
    marker.classList.add('visible');
    destinationTimer = setTimeout(() => marker.classList.remove('visible'), 1150);
  }

  function flyTo(x, y, name) {
    if (!world.classList.contains('ready')) return;
    const destination = {
      x: Math.max(6, Math.min(94, x)),
      y: Math.max(13, Math.min(88, y)),
    };
    const distance = Math.hypot(destination.x - state.x, destination.y - state.y);
    if (state.flight) {
      state.flight = null;
      bird.classList.remove('is-flying');
    }
    state.destination = { ...destination, name: name || placeName(destination.x, destination.y) };
    state.facing = destination.x < state.x ? -1 : 1;
    bird.classList.toggle('facing-left', state.facing < 0);
    drawBird(state.x, state.y);
    showMarker(destination.x, destination.y);
    if (distance < 1.5) {
      setStatus(`就在这里，${state.destination.name}。`);
      drawBird(state.x, state.y);
      return;
    }
    if (reducedMotion.matches) {
      state.x = destination.x;
      state.y = destination.y;
      setStatus(`到了，${state.destination.name}。`);
      bird.setAttribute('aria-label', `停在${state.destination.name}的小鸟`);
      drawBird(state.x, state.y);
      return;
    }
    state.flight = {
      startX: state.x, startY: state.y,
      endX: destination.x, endY: destination.y,
      elapsed: 0,
      duration: Math.max(900, Math.min(4200, distance * 50)),
      arc: Math.min(23, 5 + distance * 0.23),
    };
    bird.classList.add('is-flying');
    bird.setAttribute('aria-label', `正飞向${state.destination.name}的小鸟`);
    setStatus(`拍拍翅膀，去${state.destination.name}。`);
  }

  function tick(time) {
    if (ticking) return;
    ticking = true;
    const delta = Math.min(time - (lastTime || time), 50);
    lastTime = time;
    if (!state.paused && state.flight) {
      const flight = state.flight;
      flight.elapsed += delta;
      const t = Math.min(flight.elapsed / flight.duration, 1);
      const ease = t * t * (3 - 2 * t);
      state.x = flight.startX + (flight.endX - flight.startX) * ease;
      state.y = flight.startY + (flight.endY - flight.startY) * ease - Math.sin(Math.PI * t) * flight.arc;
      drawBird(state.x, state.y);
      if (t === 1) {
        state.flight = null;
        bird.classList.remove('is-flying');
        bird.setAttribute('aria-label', `停在${state.destination.name}的小鸟`);
        setStatus(`到了，${state.destination.name}。`);
      }
    } else if (!state.paused) {
      drawBird(state.x, state.y);
    }
    frame = requestAnimationFrame(tick);
    ticking = false;
  }

  function updateMotion() {
    const stopped = reducedMotion.matches || motionButton.getAttribute('aria-pressed') === 'true';
    world.classList.toggle('animated', !stopped);
    motionButton.setAttribute('aria-pressed', String(stopped));
    motionButton.title = stopped ? '开启轻微像素抖动' : '关闭轻微像素抖动';
    motionButton.firstChild.textContent = stopped ? '轻动已停 ' : '轻动 ';
    motionButton.setAttribute('aria-label', stopped ? '开启轻微像素抖动' : '关闭轻微像素抖动');
  }

  scene.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    scene.focus({ preventScroll: true });
    const bounds = scene.getBoundingClientRect();
    flyTo((event.clientX - bounds.left) / bounds.width * 100, (event.clientY - bounds.top) / bounds.height * 100);
  });

  scene.addEventListener('keydown', event => {
    if (event.key === ' ' || event.key === 'Home') {
      event.preventDefault();
      flyTo(home.x, home.y, home.name);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      flyTo(state.keyboard.x, state.keyboard.y);
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      if (event.key === 'ArrowLeft') state.keyboard.x -= 5;
      if (event.key === 'ArrowRight') state.keyboard.x += 5;
      if (event.key === 'ArrowUp') state.keyboard.y -= 5;
      if (event.key === 'ArrowDown') state.keyboard.y += 5;
      state.keyboard.x = Math.max(6, Math.min(94, state.keyboard.x));
      state.keyboard.y = Math.max(13, Math.min(88, state.keyboard.y));
      showMarker(state.keyboard.x, state.keyboard.y);
      setStatus(`落点已选，按回车前往${placeName(state.keyboard.x, state.keyboard.y)}。`);
    }
  });
  motionButton.addEventListener('click', updateMotion);
  homeButton.addEventListener('click', () => flyTo(home.x, home.y, home.name));
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    state.paused = document.hidden;
    lastTime = 0;
    if (document.hidden) {
      cancelAnimationFrame(frame);
      ticking = false;
    } else if (!ticking) requestAnimationFrame(tick);
  });
  reducedMotion.addEventListener('change', updateMotion);
})();
