// Run: npm test   (node --test with built-in TypeScript type stripping)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allowed, buildSchedule, key, recheck, type Fighter, type RoundPlan } from '../src/logic/rotation.ts';

/** Deterministic RNG so failures are reproducible. */
const seeded = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const same = (n: number, weight = 70, level = 1): Fighter[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, weight, level }));

function assertValid(plan: RoundPlan[], fighters: Fighter[]) {
  const ids = new Set(fighters.map((f) => f.id));
  for (const [r, round] of plan.entries()) {
    const seen = new Set<string>();
    for (const p of round.pairs) {
      assert.notEqual(p.red, p.blue, `round ${r + 1}: player paired with themself`);
      for (const id of [p.red, p.blue]) {
        assert.ok(ids.has(id), `unknown player ${id}`);
        assert.ok(!seen.has(id), `round ${r + 1}: ${id} appears twice`);
        seen.add(id);
      }
    }
    if (round.bye) {
      assert.ok(!seen.has(round.bye), `round ${r + 1}: bye also fights`);
      seen.add(round.bye);
    }
    assert.equal(seen.size, fighters.length, `round ${r + 1}: not everyone placed`);
    assert.equal(round.bye !== null, fighters.length % 2 === 1, `round ${r + 1}: bye only when odd`);
  }
}

const repeats = (plan: RoundPlan[]) => {
  const seen = new Set<string>();
  let n = 0;
  for (const r of plan) for (const p of r.pairs) { const k = key(p.red, p.blue); if (seen.has(k)) n++; seen.add(k); }
  return n;
};

describe('rotation: no repeats when possible', () => {
  for (const n of [4, 5, 8, 9, 12]) {
    // with n players every pair can meet once in n−1 rounds (even) or n rounds (odd, one bye each)
    const maxRounds = n % 2 ? n : n - 1;
    for (const rounds of [3, maxRounds]) {
      it(`${n} players, ${rounds} rounds`, () => {
        for (let seed = 1; seed <= 5; seed++) {
          const f = same(n);
          const plan = buildSchedule(f, rounds, { hard: false, maxDiff: 5, rand: seeded(seed) });
          assert.equal(plan.length, rounds);
          assertValid(plan, f);
          assert.equal(repeats(plan), 0, `seed ${seed}: repeated pair`);
          assert.ok(plan.every((r) => r.pairs.every((p) => !p.warn)), `seed ${seed}: unexpected warning`);
        }
      });
    }
  }
});

describe('rotation: constraints', () => {
  it('respects the weight limit (two weight groups of 4 → 3 clean rounds)', () => {
    const f: Fighter[] = [60, 61, 62, 63, 80, 81, 82, 83].map((w, i) => ({ id: `p${i}`, weight: w, level: 1 }));
    for (let seed = 1; seed <= 5; seed++) {
      const plan = buildSchedule(f, 3, { hard: false, maxDiff: 5, rand: seeded(seed) });
      assertValid(plan, f);
      assert.equal(repeats(plan), 0);
      for (const r of plan) for (const p of r.pairs) {
        const a = f.find((x) => x.id === p.red)!, b = f.find((x) => x.id === p.blue)!;
        assert.ok(allowed(a, b, { hard: false, maxDiff: 5 }), `${p.red} vs ${p.blue} breaks the weight limit`);
      }
    }
  });

  it('hard sparring: beginner never meets pro when avoidable', () => {
    const f: Fighter[] = [0, 0, 0, 1, 1, 2, 2, 2].map((lvl, i) => ({ id: `p${i}`, weight: 70, level: lvl }));
    const plan = buildSchedule(f, 3, { hard: true, maxDiff: 5, rand: seeded(7) });
    assertValid(plan, f);
    for (const r of plan) for (const p of r.pairs) {
      const a = f.find((x) => x.id === p.red)!, b = f.find((x) => x.id === p.blue)!;
      assert.ok(Math.abs(a.level - b.level) <= 1, `${p.red}(${a.level}) vs ${p.blue}(${b.level})`);
    }
  });

  it('light sparring allows any level gap', () => {
    const f: Fighter[] = [0, 2].map((lvl, i) => ({ id: `p${i}`, weight: 70, level: lvl }));
    const plan = buildSchedule(f, 1, { hard: false, maxDiff: 5, rand: seeded(1) });
    assert.equal(plan[0].pairs.length, 1);
    assert.equal(plan[0].pairs[0].warn, undefined);
  });
});

describe('rotation: fallbacks', () => {
  it('repeats only when unavoidable, flags them, and picks the longest-ago pair', () => {
    const f = same(4);
    const plan = buildSchedule(f, 5, { hard: false, maxDiff: 5, rand: seeded(3) }); // only 3 distinct rounds exist
    assertValid(plan, f);
    assert.equal(repeats(plan.slice(0, 3)), 0, 'first 3 rounds must be clean');
    for (const r of plan.slice(3)) for (const p of r.pairs) assert.ok(p.warn?.includes('repeat'), 'repeat must be flagged');
    // round 4 repeats round 1 (longest ago), not round 3
    const r1 = new Set(plan[0].pairs.map((p) => key(p.red, p.blue)));
    assert.ok(plan[3].pairs.every((p) => r1.has(key(p.red, p.blue))), 'round 4 should reuse the round-1 pairs');
  });

  it('flags a weight problem when nobody fits', () => {
    const f: Fighter[] = [{ id: 'a', weight: 60, level: 1 }, { id: 'b', weight: 90, level: 1 }];
    const plan = buildSchedule(f, 1, { hard: false, maxDiff: 5, rand: seeded(1) });
    assert.deepEqual(plan[0].pairs[0].warn, ['weight']);
  });

  it('avoids pairs that already fought today', () => {
    const f = same(4);
    const avoid = new Set([key('p1', 'p2'), key('p3', 'p4')]);
    const plan = buildSchedule(f, 2, { hard: false, maxDiff: 5, avoid, rand: seeded(2) });
    for (const r of plan) for (const p of r.pairs) assert.ok(!avoid.has(key(p.red, p.blue)));
  });
});

describe('rotation: byes', () => {
  for (const n of [5, 9]) {
    it(`${n} players: nobody sits out twice before everyone sat out once`, () => {
      const f = same(n);
      const plan = buildSchedule(f, n + 2, { hard: false, maxDiff: 5, rand: seeded(11) });
      const byes = plan.map((r) => r.bye!);
      assert.equal(new Set(byes.slice(0, n)).size, n, `first ${n} byes must all be different`);
    });
  }
  it('works with a weight-split odd group too', () => {
    const f: Fighter[] = [60, 61, 62, 63, 64].map((w, i) => ({ id: `p${i}`, weight: w, level: 1 }));
    const plan = buildSchedule(f, 5, { hard: false, maxDiff: 5, rand: seeded(5) });
    assertValid(plan, f);
    assert.equal(new Set(plan.map((r) => r.bye)).size, 5);
    assert.equal(repeats(plan), 0);
  });
});

describe('rotation: manual swap re-check', () => {
  it('flags a swap that creates a repeat or breaks the weight limit', () => {
    const f: Fighter[] = [{ id: 'a', weight: 70, level: 1 }, { id: 'b', weight: 71, level: 1 }, { id: 'c', weight: 72, level: 1 }, { id: 'd', weight: 95, level: 1 }];
    const plan: RoundPlan[] = [
      { bye: null, pairs: [{ red: 'a', blue: 'b' }, { red: 'c', blue: 'd' }] },
      { bye: null, pairs: [{ red: 'a', blue: 'b' }, { red: 'c', blue: 'd' }] },
    ];
    const r = recheck(plan, 1, new Map(f.map((x) => [x.id, x])), { hard: false, maxDiff: 5 });
    assert.deepEqual(r.pairs[0].warn, ['repeat']);
    assert.deepEqual(r.pairs[1].warn, ['weight', 'repeat']);
  });
});

describe('rotation: general search (no round-robin shortcut)', () => {
  it('12 players spread 60–71 kg, limit 5 kg, 4 rounds: clean', () => {
    const f: Fighter[] = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, weight: 60 + i, level: 1 }));
    for (let seed = 1; seed <= 5; seed++) {
      const plan = buildSchedule(f, 4, { hard: false, maxDiff: 5, rand: seeded(seed) });
      assertValid(plan, f);
      assert.equal(repeats(plan), 0, `seed ${seed}`);
      assert.ok(plan.every((r) => r.pairs.every((p) => !p.warn)), `seed ${seed}: warning`);
    }
  });
  it('12 equal players with one pair to avoid, 6 rounds: clean', () => {
    const f = same(12);
    const avoid = new Set([key('p1', 'p2')]);
    for (let seed = 1; seed <= 5; seed++) {
      const plan = buildSchedule(f, 6, { hard: false, maxDiff: 5, avoid, rand: seeded(seed) });
      assertValid(plan, f);
      assert.equal(repeats(plan), 0, `seed ${seed}`);
      assert.ok(plan.every((r) => r.pairs.every((p) => !p.warn && key(p.red, p.blue) !== key('p1', 'p2'))), `seed ${seed}`);
    }
  });
});
