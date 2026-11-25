/**
 * Every number in the app is a date-range query over append-only records (SPEC §5).
 * These mirror the SQL the Supabase version will run.
 */
import { C } from '@/theme';
import type { Bout, DB, Level, Round } from '@/data/types';
import { useStore } from '@/data/store';
import { isAr, nm, plural, tr } from '@/i18n';
import { addDays, dayMonth, diffDays, inRange, Range, today, weekStart } from './dates';

/* ---------- indexes (cached per DB snapshot) ---------- */
type Idx = {
  bout: Map<string, Bout>;
  roundsByPlayer: Map<string, { r: Round; b: Bout; side: 'red' | 'blue' }[]>;
};
const cache = new WeakMap<DB, Idx>();
function idx(db: DB): Idx {
  let i = cache.get(db);
  if (i) return i;
  const bout = new Map(db.bouts.map((b) => [b.id, b]));
  const roundsByPlayer = new Map<string, { r: Round; b: Bout; side: 'red' | 'blue' }[]>();
  for (const r of db.rounds) {
    const b = bout.get(r.boutId);
    if (!b) continue;
    for (const side of ['red', 'blue'] as const) {
      const pid = b[side];
      if (!roundsByPlayer.has(pid)) roundsByPlayer.set(pid, []);
      roundsByPlayer.get(pid)!.push({ r, b, side });
    }
  }
  i = { bout, roundsByPlayer };
  cache.set(db, i);
  return i;
}

const latest = <T extends { date?: string; fromDate?: string; createdAt: string }>(rows: T[], at: string) => {
  let best: T | undefined;
  for (const x of rows) {
    const d = (x.date ?? x.fromDate)!;
    if (d > at) continue;
    if (!best || d > (best.date ?? best.fromDate)! || (d === (best.date ?? best.fromDate) && x.createdAt > best.createdAt)) best = x;
  }
  return best;
};

/* ---------- player facts ---------- */
export const branchOf = (db: DB, pid: string, at = today()) => latest(db.branchHistory.filter((x) => x.playerId === pid), at)?.branchId ?? '';
export const weightOf = (db: DB, pid: string, at = today()) => latest(db.weights.filter((x) => x.playerId === pid), at)?.weightKg ?? 0;
export const levelOf = (db: DB, pid: string, at = today()): Level => latest(db.levels.filter((x) => x.playerId === pid), at)?.level ?? 'beginner';
export const levelName = (l: Level) =>
  (isAr() ? { beginner: 'مبتدئ', intermediate: 'متوسط', pro: 'محترف' } : { beginner: 'Beginner', intermediate: 'Intermediate', pro: 'Pro' })[l];
export const LEVEL_N: Record<Level, number> = { beginner: 0, intermediate: 1, pro: 2 };
export const branchName = (id: string) => nm(useStore.getState().branches.find((b) => b.id === id));
export const player = (db: DB, pid: string) => db.players.find((p) => p.id === pid);
/** Player display name in the current language. */
export const pname = (db: DB, pid: string) => nm(player(db, pid));
export const initials = (name: string) => {
  const parts = name.split(' ').filter(Boolean);
  if (!isAr()) return parts.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
};
export const firstName = (name: string) => name.split(' ')[0];

export function playersIn(db: DB, branch: string) {
  return db.players.filter((p) => !p.archived && (branch === 'all' || branchOf(db, p.id) === branch));
}

/* ---------- subscriptions ---------- */
export type PayKind = 'ok' | 'soon' | 'late';
export const PAY_COLOR: Record<PayKind, string> = { ok: C.accent, soon: C.warning, late: C.danger };
export const payLabel = (k: PayKind) =>
  (isAr() ? { ok: 'دافع', soon: 'قرّب يخلص', late: 'متأخر' } : { ok: 'Paid', soon: 'Ending soon', late: 'Overdue' })[k];
export function payStatus(db: DB, pid: string, at = today()): { kind: PayKind; days: number; end: string | null } {
  const subs = db.subscriptions.filter((s) => s.playerId === pid && s.startDate <= at);
  if (!subs.length) return { kind: 'late', days: 0, end: null };
  const end = subs.reduce((m, s) => (s.endDate > m ? s.endDate : m), subs[0].endDate);
  const left = diffDays(end, at);
  if (left < 0) return { kind: 'late', days: -left, end };
  if (left <= 3) return { kind: 'soon', days: left, end };
  return { kind: 'ok', days: left, end };
}
export function payLine(st: ReturnType<typeof payStatus>) {
  if (!isAr()) {
    if (st.kind === 'late') return `${plural(st.days, 'day')} overdue`;
    if (st.kind === 'soon') return st.days === 0 ? 'ends today' : st.days === 1 ? 'ends tomorrow' : `ends in ${st.days} days`;
    return 'paid';
  }
  if (st.kind === 'late') return st.days === 1 ? 'متأخر يوم' : st.days === 2 ? 'متأخر يومين' : `متأخر ${st.days} أيام`;
  if (st.kind === 'soon') return st.days === 0 ? 'بيخلص النهارده' : st.days === 1 ? 'بيخلص بكرة' : `بيخلص بعد ${st.days} أيام`;
  return 'دافع';
}

/* ---------- attendance ---------- */
export function presentOn(db: DB, date: string, branch = 'all') {
  const set = new Map<string, string>(); // pid → attendance id
  for (const a of db.attendance) if (a.date === date && (branch === 'all' || a.branchId === branch)) set.set(a.playerId, a.id);
  return set;
}
export const attendedDays = (db: DB, pid: string, r: Range) =>
  new Set(db.attendance.filter((a) => a.playerId === pid && inRange(a.date, r)).map((a) => a.date));

/** Distinct training days of a branch in a range = denominator for attendance %. */
export function sessionDays(db: DB, r: Range, branch = 'all') {
  return new Set(db.attendance.filter((a) => inRange(a.date, r) && (branch === 'all' || a.branchId === branch)).map((a) => a.date));
}

/* ---------- sparring ---------- */
export type RoundStats = { total: number; light: number; hard: number; win: number; draw: number; loss: number };
export function roundStats(db: DB, pid: string, r: Range): RoundStats {
  const s: RoundStats = { total: 0, light: 0, hard: 0, win: 0, draw: 0, loss: 0 };
  for (const { r: rd, b, side } of idx(db).roundsByPlayer.get(pid) ?? []) {
    if (!inRange(rd.date, r)) continue;
    s.total++;
    s[b.type]++;
    if (rd.winner === 'draw') s.draw++;
    else if (rd.winner === side) s.win++;
    else s.loss++;
  }
  return s;
}
export const winRate = (s: RoundStats) => (s.total ? s.win / s.total : 0);

export function headToHead(db: DB, pid: string) {
  const by = new Map<string, { opp: string; me: number; them: number; rounds: number; last: string }>();
  for (const { r, b, side } of idx(db).roundsByPlayer.get(pid) ?? []) {
    const opp = side === 'red' ? b.blue : b.red;
    const x = by.get(opp) ?? { opp, me: 0, them: 0, rounds: 0, last: '' };
    x.rounds++;
    if (r.winner === side) x.me++;
    else if (r.winner !== 'draw') x.them++;
    if (r.date > x.last) x.last = r.date;
    by.set(opp, x);
  }
  return [...by.values()].sort((a, c) => c.rounds - a.rounds || c.last.localeCompare(a.last));
}

/** Pairs that already fought today (avoid repeats, SPEC 4.5.4). */
export function foughtToday(db: DB, date = today()) {
  const s = new Set<string>();
  for (const b of db.bouts) if (b.date === date) { s.add(`${b.red}|${b.blue}`); s.add(`${b.blue}|${b.red}`); }
  return s;
}

/* ---------- exercises ---------- */
export function exerciseSum(db: DB, pid: string, exId: string, r: Range) {
  let reps = 0, seconds = 0, sessions = 0;
  for (const x of db.results) {
    if (x.playerId !== pid || x.exerciseId !== exId || !inRange(x.date, r)) continue;
    reps += x.reps ?? 0; seconds += x.seconds ?? 0; sessions++;
  }
  return { reps, seconds, sessions };
}
export const pct = (cur: number, prev: number) => (prev ? Math.round(((cur - prev) / prev) * 100) : cur ? 100 : 0);
export const deltaText = (d: number) => (d >= 0 ? `↑ ${d}%` : `↓ ${Math.abs(d)}%`);
export const deltaColor = (d: number) => (d >= 0 ? C.accent : C.danger);

/** Average reps per session, grouped by month (last n months). */
export function monthlyAverages(db: DB, pid: string, exId: string, months = 6) {
  const now = new Date();
  const out: { y: number; m: number; avg: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const a = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const b = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    const pad = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const s = exerciseSum(db, pid, exId, { from: pad(a), to: pad(b) });
    out.push({ y: a.getFullYear(), m: a.getMonth(), avg: s.sessions ? s.reps / s.sessions : 0 });
  }
  return out;
}
export function bestResult(db: DB, pid: string, exId: string) {
  let best: { reps: number; date: string } | null = null;
  for (const x of db.results) if (x.playerId === pid && x.exerciseId === exId && (x.reps ?? 0) > (best?.reps ?? 0)) best = { reps: x.reps!, date: x.date };
  return best;
}

/* ---------- efficiency index (SPEC 4.7): 40 attendance / 35 improvement / 25 win ---------- */
export function efficiency(db: DB, pid: string, r: Range, prev: Range, branch = 'all', w = { att: 40, imp: 35, win: 25 }) {
  const days = sessionDays(db, r, branch).size || 1;
  const att = Math.min(1, attendedDays(db, pid, r).size / days);
  const cur = exerciseSum(db, pid, 'e1', r), old = exerciseSum(db, pid, 'e1', prev);
  const ca = cur.sessions ? cur.reps / cur.sessions : 0, oa = old.sessions ? old.reps / old.sessions : 0;
  // improvement vs. the player's own baseline: −10% → 0, +20% → 1
  const imp = oa ? Math.max(0, Math.min(1, ((ca - oa) / oa + 0.1) / 0.3)) : 0.5;
  const wr = winRate(roundStats(db, pid, r));
  return { score: Math.round(w.att * att + w.imp * imp + w.win * wr), att, wr };
}

/* ---------- timeline ---------- */
export function timeline(db: DB, pid: string, exName: (id: string) => string, limit = 8) {
  type Ev = { date: string; text: string; c: string };
  const ev: Ev[] = [];
  const days = new Map<string, { att: boolean; ex: string[]; w: number; l: number; d: number; t?: string }>();
  const day = (d: string) => days.get(d) ?? (days.set(d, { att: false, ex: [], w: 0, l: 0, d: 0 }), days.get(d)!);
  db.attendance.forEach((a) => a.playerId === pid && (day(a.date).att = true));
  db.results.forEach((x) => {
    if (x.playerId !== pid || x.mode !== 'count') return;
    day(x.date).ex.push(`${x.reps} ${exName(x.exerciseId)}`);
  });
  for (const { r, b, side } of idx(db).roundsByPlayer.get(pid) ?? []) {
    const d = day(r.date);
    d.t = b.type === 'hard' ? tr('هارد', 'hard') : tr('لايت', 'light');
    if (r.winner === 'draw') d.d++; else if (r.winner === side) d.w++; else d.l++;
  }
  days.forEach((v, date) => {
    const n = v.w + v.l + v.d;
    const rounds = !n ? '' : isAr()
      ? `${n} جولات ${v.t} (كسب ${v.w}، خسر ${v.l}${v.d ? `، تعادل ${v.d}` : ''})`
      : `${n} ${v.t} rounds (won ${v.w}, lost ${v.l}${v.d ? `, drew ${v.d}` : ''})`;
    const parts = [v.att ? tr('حضر', 'Attended') : '', ...v.ex.slice(0, 2), rounds].filter(Boolean);
    if (parts.length) ev.push({ date, text: parts.join(' · '), c: C.accent });
  });
  const ws = db.weights.filter((x) => x.playerId === pid).sort((a, c) => a.date.localeCompare(c.date));
  ws.forEach((x, i) => {
    if (i && ws[i - 1].weightKg !== x.weightKg) ev.push({ date: x.date, text: tr(`الوزن اتسجّل ${x.weightKg} كجم (كان ${ws[i - 1].weightKg})`, `Weight logged ${x.weightKg} kg (was ${ws[i - 1].weightKg})`), c: C.muted });
  });
  db.payments.forEach((p) => p.playerId === pid && ev.push({ date: p.date, text: tr(`دفع اشتراك · ${p.amount} جنيه`, `Paid subscription · EGP ${p.amount}`), c: C.muted }));
  return ev.sort((a, c) => c.date.localeCompare(a.date)).slice(0, limit).map((e) => ({ ...e, label: dayMonth(e.date) }));
}

export const thisWeek = (): Range => {
  const from = weekStart(today());
  return { from, to: addDays(from, 6) };
};
