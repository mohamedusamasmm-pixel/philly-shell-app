/**
 * Sparring rotation — a different opponent every round (SPEC §10).
 *
 * Graph: each player is a node; an edge joins two players who may spar
 * (weight gap ≤ maxDiff, and in hard sparring a level gap ≤ 1).
 * For each round we find a perfect matching on the unused edges with randomized
 * backtracking (most-constrained player first), then remove the used edges.
 * Odd count: one player sits out; the bye goes to someone with the fewest byes so far,
 * so nobody sits out twice before everyone has sat out once.
 * If no complete matching exists without repeats, the pair that met longest ago is
 * repeated and flagged 'repeat'. If even that is impossible (constraints too tight),
 * the closest-weight pairing is used and flagged 'weight' / 'level'.
 * The whole schedule is generated several times and the one with the fewest flags wins.
 *
 * Pure TypeScript, no app imports — tested by tests/rotation.test.ts (node --test).
 */
export type Fighter = { id: string; weight: number; level: number };
export type Warn = 'weight' | 'level' | 'repeat';
export type Pair = { red: string; blue: string; warn?: Warn[] };
export type RoundPlan = { pairs: Pair[]; bye: string | null };
export type RotationOpts = {
  hard: boolean;
  maxDiff: number;
  /** pairs that already fought earlier today ("a|b"), avoided like repeats */
  avoid?: Set<string>;
  /** byes already taken (keeps the rotation fair across a regenerate) */
  byeCount?: Record<string, number>;
  rand?: () => number;
  attempts?: number;
};

export const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function allowed(a: Fighter, b: Fighter, o: Pick<RotationOpts, 'hard' | 'maxDiff'>) {
  return Math.abs(a.weight - b.weight) <= o.maxDiff && (!o.hard || Math.abs(a.level - b.level) <= 1);
}

export function warnsFor(a: Fighter, b: Fighter, o: Pick<RotationOpts, 'hard' | 'maxDiff'>, repeat: boolean): Warn[] | undefined {
  const w: Warn[] = [];
  if (Math.abs(a.weight - b.weight) > o.maxDiff) w.push('weight');
  if (o.hard && Math.abs(a.level - b.level) > 1) w.push('level');
  if (repeat) w.push('repeat');
  return w.length ? w : undefined;
}

const shuffle = <T,>(arr: T[], rand: () => number) => {
  const x = [...arr];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

type Ctx = {
  f: Map<string, Fighter>;
  o: RotationOpts;
  used: Map<string, number>; // pair key → last round it happened (−1 = earlier today)
  rand: () => number;
};

/**
 * Perfect matching on `ids` using only edges accepted by `ok`, preferring lower `rank`.
 * Randomized backtracking with a step budget; null when none found.
 */
function match(ids: string[], ctx: Ctx, ok: (a: string, b: string) => boolean, rank: (a: string, b: string) => number): [string, string][] | null {
  let steps = 0;
  const LIMIT = 40_000;
  const go = (left: string[]): [string, string][] | null => {
    if (!left.length) return [];
    if (++steps > LIMIT) return null;
    // most constrained player first
    let best = -1, bestOpts: string[] = [];
    for (let i = 0; i < left.length; i++) {
      const opts = left.filter((y) => y !== left[i] && ok(left[i], y));
      if (best === -1 || opts.length < bestOpts.length) { best = i; bestOpts = opts; }
      if (!opts.length) return null;
    }
    const v = left[best];
    const ordered = shuffle(bestOpts, ctx.rand).sort((a, b) => rank(v, a) - rank(v, b));
    for (const w of ordered) {
      const rest = go(left.filter((x) => x !== v && x !== w));
      if (rest) return [[v, w], ...rest];
      if (steps > LIMIT) return null;
    }
    return null;
  };
  return go(ids);
}

function roundMatching(ids: string[], ctx: Ctx): [string, string][] {
  const F = (id: string) => ctx.f.get(id)!;
  const isAllowed = (a: string, b: string) => allowed(F(a), F(b), ctx.o);
  const lastMet = (a: string, b: string) => ctx.used.get(key(a, b));
  // 1) allowed and never met
  const fresh = match(ids, ctx, (a, b) => isAllowed(a, b) && lastMet(a, b) === undefined, () => 0);
  if (fresh) return fresh;
  // 2) allowed, repeats allowed — longest-ago meeting first
  const rep = match(ids, ctx, isAllowed, (a, b) => { const m = lastMet(a, b); return m === undefined ? -1e9 : m; });
  if (rep) return rep;
  // 3) anything — closest weight, then fresh
  return match(ids, ctx, () => true, (a, b) => Math.abs(F(a).weight - F(b).weight) * 100 + (lastMet(a, b) === undefined ? 0 : 1 + (lastMet(a, b) ?? 0)))
    ?? greedyByWeight(ids, ctx);
}

function greedyByWeight(ids: string[], ctx: Ctx): [string, string][] {
  const s = [...ids].sort((a, b) => ctx.f.get(a)!.weight - ctx.f.get(b)!.weight);
  const out: [string, string][] = [];
  for (let i = 0; i + 1 < s.length; i += 2) out.push([s[i], s[i + 1]]);
  return out;
}

function pickBye(ids: string[], byes: Record<string, number>, rand: () => number) {
  const min = Math.min(...ids.map((i) => byes[i] ?? 0));
  const c = ids.filter((i) => (byes[i] ?? 0) === min);
  return shuffle(c, rand);
}

/** Circle method: a perfect round-robin when every pair is allowed (guarantees no repeats). */
function circle(ids: string[], rounds: number, rand: () => number): [string, string][][] | null {
  const list = shuffle(ids, rand);
  if (list.length % 2) list.push('__bye__');
  const n = list.length;
  if (rounds > n - 1) return null;
  const out: [string, string][][] = [];
  let arr = [...list];
  for (let r = 0; r < rounds; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) pairs.push([arr[i], arr[n - 1 - i]]);
    out.push(pairs);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return out;
}

function scoreOf(plan: RoundPlan[]) {
  let s = 0;
  for (const r of plan) for (const p of r.pairs) for (const w of p.warn ?? []) s += w === 'repeat' ? 10 : 100;
  return s;
}

function attempt(fighters: Fighter[], rounds: number, o: RotationOpts, rand: () => number): RoundPlan[] {
  const f = new Map(fighters.map((x) => [x.id, x]));
  const used = new Map<string, number>();
  for (const k of o.avoid ?? []) {
    const [a, b] = k.split('|');
    if (f.has(a) && f.has(b)) used.set(key(a, b), -1);
  }
  const ctx: Ctx = { f, o, used, rand };
  const byes: Record<string, number> = { ...(o.byeCount ?? {}) };
  const ids = fighters.map((x) => x.id);
  const plan: RoundPlan[] = [];

  // fast path: everyone may face everyone and nothing to avoid → round-robin
  const complete = ids.every((a) => ids.every((b) => a === b || allowed(f.get(a)!, f.get(b)!, o))) && used.size === 0 && !Object.keys(byes).length;
  const rr = complete ? circle(ids, rounds, rand) : null;

  for (let r = 0; r < rounds; r++) {
    let bye: string | null = null;
    let pairs: [string, string][];
    if (rr) {
      pairs = rr[r].filter(([a, b]) => {
        if (a === '__bye__') { bye = b; return false; }
        if (b === '__bye__') { bye = a; return false; }
        return true;
      });
    } else if (ids.length % 2) {
      // try the fairest bye candidates; keep the first that allows a repeat-free round
      let best: { bye: string; pairs: [string, string][]; reps: number } | null = null;
      for (const cand of pickBye(ids, byes, rand)) {
        const m = roundMatching(ids.filter((x) => x !== cand), ctx);
        const reps = m.filter(([a, b]) => used.has(key(a, b)) || !allowed(f.get(a)!, f.get(b)!, o)).length;
        if (!best || reps < best.reps) best = { bye: cand, pairs: m, reps };
        if (!reps) break;
      }
      bye = best!.bye;
      pairs = best!.pairs;
    } else {
      pairs = roundMatching(ids, ctx);
    }
    if (bye) byes[bye] = (byes[bye] ?? 0) + 1;
    plan.push({
      bye,
      pairs: pairs.map(([a, b]) => {
        const rep = used.has(key(a, b));
        const [red, blue] = rand() < 0.5 ? [a, b] : [b, a];
        return { red, blue, warn: warnsFor(f.get(a)!, f.get(b)!, o, rep) };
      }),
    });
    for (const [a, b] of pairs) used.set(key(a, b), r);
  }
  return plan;
}

/** Generate the full rotation for `rounds` rounds. */
export function buildSchedule(fighters: Fighter[], rounds: number, o: RotationOpts): RoundPlan[] {
  const rand = o.rand ?? Math.random;
  if (fighters.length < 2) return Array.from({ length: rounds }, () => ({ pairs: [], bye: fighters[0]?.id ?? null }));
  let best: RoundPlan[] | null = null, bestScore = Infinity;
  const tries = o.attempts ?? 60;
  for (let i = 0; i < tries && bestScore > 0; i++) {
    const plan = attempt(fighters, rounds, o, rand);
    const sc = scoreOf(plan);
    if (sc < bestScore) { best = plan; bestScore = sc; }
  }
  return best!;
}

/** Re-check a round after a manual swap: constraints + repeats against the other rounds. */
export function recheck(plan: RoundPlan[], roundIdx: number, fighters: Map<string, Fighter>, o: Pick<RotationOpts, 'hard' | 'maxDiff'>): RoundPlan {
  const others = new Set<string>();
  plan.forEach((r, i) => { if (i !== roundIdx) r.pairs.forEach((p) => others.add(key(p.red, p.blue))); });
  const r = plan[roundIdx];
  return {
    bye: r.bye,
    pairs: r.pairs.map((p) => ({ ...p, warn: warnsFor(fighters.get(p.red)!, fighters.get(p.blue)!, o, others.has(key(p.red, p.blue))) })),
  };
}
