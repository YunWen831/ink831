import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RemoteMotion } from '../../../courtyard/motion.js';
import { canStand, WORLD } from '../../../courtyard/world.js';

const player = (x, y, ack = 0) => ({ x, y, ack, connected: true });

test('remote display follows regular updates with less added lag than the previous 85 ms filter', () => {
  const motion = new RemoteMotion(player(300, 400), 0);
  let previousX = 300, oldX = 300, targetX = 300, oldError = 0, newError = 0;
  for (let frame = 1; frame <= 120; frame++) {
    const now = frame * 1000 / 60;
    if (frame % 3 === 0) {
      targetX = 300 + WORLD.speed * now / 1000;
      motion.update(player(targetX, 400, frame), now);
    }
    oldX += (targetX - oldX) * (1 - Math.exp(-(1000 / 60) / 85));
    const next = motion.sample(now);
    assert.ok(next.x >= previousX - 1e-8, 'steady movement must not move backwards');
    if (frame > 30) {
      oldError += 300 + WORLD.speed * now / 1000 - oldX;
      newError += Math.abs(300 + WORLD.speed * now / 1000 - next.x);
    }
    previousX = next.x;
  }
  assert.ok(newError < oldError * 0.5, `display error ${newError} vs previous ${oldError}`);
});

test('stalled updates have bounded prediction, duplicate state does not extend it, and stopping settles', () => {
  const motion = new RemoteMotion(player(300, 400), 0);
  const latest = player(307.8, 400, 5);
  motion.update(latest, 50);
  for (let now = 60; now <= 700; now += 10) {
    motion.update(latest, now);
    const point = motion.sample(now);
    assert.ok(point.x <= latest.x + WORLD.speed * 0.06 + 1e-8);
    assert.ok(canStand(point.x, point.y));
  }
  assert.ok(Math.abs(motion.position.x - latest.x) < 0.001);
  motion.update({ ...latest, connected: false }, 710);
  assert.deepEqual(motion.velocity, { x: 0, y: 0 });
});

test('prediction respects obstacles, caps corrupt velocity and resets after reconnect corrections', () => {
  const motion = new RemoteMotion(player(408, 300), 0);
  motion.update(player(411.12, 300, 1), 20);
  for (let now = 30; now <= 140; now += 10) {
    const point = motion.sample(now);
    assert.ok(canStand(point.x, point.y), 'prediction must not enter the fountain');
    assert.ok(point.x < 415);
  }
  motion.update(player(300, 400, 0), 160);
  assert.deepEqual(motion.sample(160), { x: 300, y: 400 });
  motion.update(player(330, 400, 1), 180);
  assert.ok(Math.hypot(motion.velocity.x, motion.velocity.y) <= WORLD.speed);
});
