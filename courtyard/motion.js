import { WORLD, move } from './world.js?v=0.2.0';

// Use acknowledged simulation time for direction, since packets can arrive
// together after a tunnel stall. This never changes authoritative game state.
export class RemoteMotion {
  constructor(player, now) {
    this.reset(player, now);
  }
  reset(player, now) {
    this.latest = { ...player };
    this.receivedAt = this.renderedAt = now;
    this.position = { x: player.x, y: player.y };
    this.velocity = { x: 0, y: 0 };
  }
  update(player, now) {
    const previous = this.latest;
    if (player.ack === previous.ack && player.x === previous.x && player.y === previous.y && player.connected === previous.connected) return;
    if (player.ack < previous.ack || Math.hypot(player.x - previous.x, player.y - previous.y) > 80) {
      this.reset(player, now);
      return;
    }
    const seconds = Math.max(WORLD.stepMs, (player.ack - previous.ack) * WORLD.stepMs) / 1000;
    let x = (player.x - previous.x) / seconds, y = (player.y - previous.y) / seconds;
    const scale = Math.max(1, Math.hypot(x, y) / WORLD.speed);
    this.velocity = player.connected ? { x: x / scale, y: y / scale } : { x: 0, y: 0 };
    this.latest = { ...player };
    this.receivedAt = now;
  }
  sample(now, tiles) {
    const age = Math.max(0, now - this.receivedAt);
    // Predict at most 60 ms (9.36 world pixels), then settle at the last
    // confirmed position if updates stop. No extra snapshot buffering delay.
    const ahead = age <= 140 ? Math.min(age, 60) : Math.max(0, 60 * (260 - age) / 120);
    let target = { x: this.latest.x, y: this.latest.y };
    for (let remaining = ahead; remaining > 0; remaining -= WORLD.stepMs) {
      const fraction = Math.min(remaining, WORLD.stepMs) / WORLD.stepMs;
      target = move(target, this.velocity.x / WORLD.speed * fraction, this.velocity.y / WORLD.speed * fraction, tiles);
    }
    const dt = Math.min(100, Math.max(0, now - this.renderedAt));
    this.renderedAt = now;
    const factor = 1 - Math.exp(-dt / 20);
    this.position = {
      x: this.position.x + (target.x - this.position.x) * factor,
      y: this.position.y + (target.y - this.position.y) * factor,
    };
    return this.position;
  }
}
