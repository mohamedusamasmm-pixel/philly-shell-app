/**
 * Smart random pairing for sparring (SPEC 4.5):
 * 1. sort by weight  2. groups with weight span ≤ maxDiff  3. hard: level gap ≤ 1
 * 4. shuffle inside each group, avoid pairs that fought today
 * 5. odd count → one player rests, rotating  7. no fit → nearest group + warning
 */
import { tr } from '@/i18n';

export type Fighter ={ id: string; weight: number; level: number };
export type Pair = { red: string; blue: string; warn?: string };

type Opts = {
  hard: boolean;
  maxDiff: number;
  avoid: Set<string>; // "a|b"
  byeCount: Record<string, number>;
  rand?: () => number;
};

const shuffle = <T,>(a: T[], rand: () => number) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

export function pickBye(ids: string[], byeCount: Record<string, number>, rand = Math.random) {
  const min = Math.min(...ids.map((i) => byeCount[i] ?? 0));
  const c = ids.filter((i) => (byeCount[i] ?? 0) === min);
  return c[Math.floor(rand() * c.length)];
}

function penalty(a: Fighter, b: Fighter, o: Opts) {
  let p = 0;
  const d = Math.abs(a.weight - b.weight);
  if (d > o.maxDiff) p += 50 + d;
  if (o.hard && Math.abs(a.level - b.level) > 1) p += 100;
  if (o.avoid.has(`${a.id}|${b.id}`)) p += 20;
  return p;
}

export function warnFor(a: Fighter, b: Fighter, o: Pick<Opts, 'hard' | 'maxDiff' | 'avoid'>) {
  const w: string[] = [];
  const d = Math.abs(a.weight - b.weight);
  if (d > o.maxDiff) w.push(tr(`فرق الوزن ${d} كجم`, `${d} kg weight gap`));
  if (o.hard && Math.abs(a.level - b.level) > 1) w.push(tr('فرق المستوى كبير للهارد', 'Level gap too big for hard'));
  if (o.avoid.has(`${a.id}|${b.id}`)) w.push(tr('لعبوا مع بعض النهارده', 'Already fought today'));
  return w.length ? w.join(' · ') : undefined;
}

/** Random perfect matching inside a group, best of K tries by constraint penalty. */
function matchGroup(g: Fighter[], o: Opts, rand: () => number) {
  let best: [Fighter, Fighter][] = [];
  let bestP = Infinity;
  for (let k = 0; k < 80 && bestP > 0; k++) {
    const s = shuffle(g, rand);
    const pairs: [Fighter, Fighter][] = [];
    let p = 0;
    for (let i = 0; i + 1 < s.length; i += 2) {
      pairs.push([s[i], s[i + 1]]);
      p += penalty(s[i], s[i + 1], o);
    }
    if (p < bestP) { bestP = p; best = pairs; }
  }
  return best;
}

export function makePairs(all: Fighter[], o: Opts): { pairs: Pair[]; bye: string | null } {
  const rand = o.rand ?? Math.random;
  let pool = [...all];
  let bye: string | null = null;
  if (pool.length % 2) {
    bye = pickBye(pool.map((p) => p.id), o.byeCount, rand);
    pool = pool.filter((p) => p.id !== bye);
  }
  pool.sort((a, b) => a.weight - b.weight);

  // weight groups
  const groups: Fighter[][] = [];
  for (const f of pool) {
    const g = groups[groups.length - 1];
    if (g && f.weight - g[0].weight <= o.maxDiff) g.push(f);
    else groups.push([f]);
  }
  // odd groups: carry the heaviest member into the next (nearest) group
  for (let i = 0; i < groups.length - 1; i++) {
    if (groups[i].length % 2) groups[i + 1].unshift(groups[i].pop()!);
  }

  const pairs: Pair[] = [];
  for (const g of groups.filter((x) => x.length)) {
    for (const [a, b] of matchGroup(g, o, rand)) {
      const [r, bl] = rand() < 0.5 ? [a, b] : [b, a];
      pairs.push({ red: r.id, blue: bl.id, warn: warnFor(a, b, o) });
    }
  }
  return { pairs, bye };
}

/**
 * Next round with an odd count: rotate who rests while keeping the other bouts.
 * The new resting player is the one with the fewest rests; the old bye takes their corner.
 */
export function rotateBye(pairs: Pair[], bye: string, byeCount: Record<string, number>, fighters: Map<string, Fighter>, o: Pick<Opts, 'hard' | 'maxDiff' | 'avoid'>) {
  const ids = pairs.flatMap((p) => [p.red, p.blue]);
  const min = Math.min(...ids.map((i) => byeCount[i] ?? 0));
  const old = fighters.get(bye)!;
  // among the least-rested, prefer one whose opponent is closest in weight to the player coming back
  let pick = ids[0], best = Infinity;
  for (const p of pairs) {
    for (const [me, opp] of [[p.red, p.blue], [p.blue, p.red]] as const) {
      if ((byeCount[me] ?? 0) !== min) continue;
      const d = Math.abs(fighters.get(opp)!.weight - old.weight) + Math.random() * 0.5;
      if (d < best) { best = d; pick = me; }
    }
  }
  const next = pairs.map((p) => {
    if (p.red !== pick && p.blue !== pick) return p;
    const red = p.red === pick ? bye : p.red, blue = p.blue === pick ? bye : p.blue;
    return { red, blue, warn: warnFor(fighters.get(red)!, fighters.get(blue)!, o) };
  });
  return { pairs: next, bye: pick };
}
