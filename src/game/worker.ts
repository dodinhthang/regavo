import { Game } from './engine.ts';
import { TICK } from './data.ts';
import type { WorkerMessage } from './types.ts';
let game: Game | undefined;
let accumulator = 0,
  last = performance.now(),
  lastSnapshot = 0;
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  try {
    const m = event.data;
    if (m.type === 'start') {
      game = new Game(m.config);
      accumulator = 0;
      last = performance.now();
      self.postMessage({ type: 'snapshot', snapshot: game.snapshot() });
    }
    if (m.type === 'command') game?.command(m.command);
    if (m.type === 'save' && game) {
      const state = game.save();
      if (m.pausedOnLoad !== undefined) state.paused = m.pausedOnLoad;
      self.postMessage({ type: 'save', state, action: m.action ?? 'auto' });
    }
    if (m.type === 'load') {
      const loaded = new Game(m.state.config);
      loaded.load(m.state);
      game = loaded;
      accumulator = 0;
      self.postMessage({ type: 'snapshot', snapshot: game.snapshot() });
    }
  } catch (e) {
    self.postMessage({
      type: 'error',
      message: e instanceof Error ? e.message : 'Không thể xử lý yêu cầu.',
      action: event.data.type === 'save' ? event.data.action : undefined,
    });
  }
};
setInterval(() => {
  const now = performance.now(),
    elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!game) return;
  accumulator += elapsed * game.state.speed;
  let steps = 0;
  while (accumulator >= TICK && steps++ < 12) {
    game.step();
    accumulator -= TICK;
  }
  if (now - lastSnapshot > 120) {
    self.postMessage({ type: 'snapshot', snapshot: game.snapshot() });
    lastSnapshot = now;
  }
}, 25);
