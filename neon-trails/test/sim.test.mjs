// Headless soak test: bot-only matches must run to completion without errors.
import assert from 'node:assert';
import { Game, TICK_RATE } from '../client/shared/game.js';

for (let n = 1; n <= 4; n++) {
  for (let seed = 1; seed <= 6; seed++) {
    const players = Array.from({ length: n }, (_, i) => ({ name: 'B' + i, bot: true }));
    const g = new Game(players, { seed: seed * 97 + n });
    let ticks = 0;
    const limit = TICK_RATE * 60 * 30;
    while (g.state !== 'matchEnd' && ticks < limit) {
      g.step();
      g.drainSegs();
      g.drainEvents();
      ticks++;
    }
    assert.equal(g.state, 'matchEnd', `n=${n} seed=${seed} did not finish`);
    const s = g.snapshot();
    assert.ok(JSON.stringify(s).length < 2000);
    console.log(`n=${n} seed=${seed}: ${g.round} rounds, ${(ticks / TICK_RATE / 60).toFixed(1)} min, winner=${g.winner}, scores=${g.players.map((p) => p.score)}`);
  }
}
console.log('sim ok');
