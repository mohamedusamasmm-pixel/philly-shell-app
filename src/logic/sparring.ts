import { useEffect, useRef } from 'react';
import { LiveSparring, RoundPlan, uid, useStore } from '@/data/store';
import type { DB, SparType } from '@/data/types';
import { tr } from '@/i18n';
import { today } from './dates';
import { Fighter, Warn, buildSchedule, recheck } from './rotation';
import { LEVEL_N, foughtToday, levelOf, presentOn, weightOf } from './queries';
import { roundCues, useSounds, useTicker } from './useSounds';
import { planIntervals, useBackgroundCues } from './timerBackground';

export function fightersOf(db: DB, ids: string[]) {
  return new Map<string, Fighter>(ids.map((id) => [id, { id, weight: weightOf(db, id), level: LEVEL_N[levelOf(db, id)] }]));
}

/** Rotation warnings → text for the pair card. */
export function warnText(w?: Warn[] | string) {
  if (!w) return undefined;
  if (typeof w === 'string') return w;
  return w.map((x) => (x === 'weight' ? tr('فرق الوزن أكبر من المسموح', 'Weight gap over the limit')
    : x === 'level' ? tr('فرق المستوى كبير للهارد', 'Level gap too big for hard')
    : tr('اتقابلوا قبل كده', 'Already met'))).join(' · ');
}

/** Full rotation for the session: a different opponent every round (rotation.ts). */
function makeSchedule(db: DB, participants: string[], rounds: number, type: SparType, maxDiff: number): RoundPlan[] {
  const f = fightersOf(db, participants);
  const plan = buildSchedule([...f.values()], rounds, { hard: type === 'hard', maxDiff, avoid: foughtToday(db) });
  return plan.map((r) => ({ bye: r.bye, pairs: r.pairs.map((p) => ({ red: p.red, blue: p.blue, warn: warnText(p.warn) })) }));
}

const rawWarns = (db: DB, sp: Pick<LiveSparring, 'participants' | 'type' | 'maxDiff'>, plan: RoundPlan[], idx: number) => {
  const r = recheck(plan.map((x) => ({ bye: x.bye, pairs: x.pairs.map((p) => ({ red: p.red, blue: p.blue })) })), idx,
    fightersOf(db, sp.participants), { hard: sp.type === 'hard', maxDiff: sp.maxDiff });
  return { bye: r.bye, pairs: r.pairs.map((p) => ({ red: p.red, blue: p.blue, warn: warnText(p.warn) })) };
};

export function newSession(db: DB, branch: string, prev?: LiveSparring | null): LiveSparring {
  const participants = [...presentOn(db, today(), branch).keys()];
  const type: SparType = prev?.type ?? 'hard';
  const base = { rounds: prev?.rounds ?? 3, roundSec: prev?.roundSec ?? 180, restSec: prev?.restSec ?? 60, maxDiff: prev?.maxDiff ?? 5 };
  const schedule = makeSchedule(db, participants, base.rounds, type, base.maxDiff);
  return {
    id: uid('spar'), date: today(), scope: branch, branchId: branch === 'all' ? useStore.getState().branches[0].id : branch, type, ...base,
    participants, schedule, pairs: schedule[0]?.pairs ?? [], bye: schedule[0]?.bye ?? null, byeCount: {},
    round: 1, phase: 'idle', endsAt: null, leftMs: base.roundSec * 1000, running: false, boutIds: {},
  };
}

/** Regenerate the whole schedule (new shuffle, type, weight limit or round count). Only before round 1 is saved. */
export function reshuffle(db: DB, sp: LiveSparring, patch: Partial<LiveSparring> = {}) {
  const next = { ...sp, ...patch };
  const schedule = makeSchedule(db, next.participants, next.rounds, next.type, next.maxDiff);
  useStore.getState().patchSpar({ ...patch, schedule, pairs: schedule[0]?.pairs ?? [], bye: schedule[0]?.bye ?? null });
}

/** Manual swap of two players inside one round (corners or the resting player); constraints re-checked live. */
export function swapPlayers(db: DB, sp: LiveSparring, roundIdx: number, a: string, b: string) {
  const sw = (x: string) => (x === a ? b : x === b ? a : x);
  const plan = sp.schedule.map((r, i) => (i !== roundIdx ? r : { bye: r.bye ? sw(r.bye) : null, pairs: r.pairs.map((p) => ({ red: sw(p.red), blue: sw(p.blue) })) }));
  // a swap can create or clear repeats in other rounds too → recheck every round
  const schedule = plan.map((_, i) => rawWarns(db, sp, plan, i));
  const cur = schedule[sp.round - 1];
  useStore.getState().patchSpar({ schedule, pairs: cur?.pairs ?? [], bye: cur?.bye ?? null });
}

export const remaining = (sp: LiveSparring) => (sp.running && sp.endsAt ? Math.max(0, sp.endsAt - Date.now()) : sp.leftMs);

export function startPause(sp: LiveSparring) {
  const st = useStore.getState();
  if (sp.running) return st.patchSpar({ running: false, endsAt: null, leftMs: remaining(sp) });
  const phase = sp.phase === 'idle' || sp.phase === 'await' ? 'round' : sp.phase;
  st.patchSpar({ running: true, phase, endsAt: Date.now() + sp.leftMs });
}

/**
 * Drives the round / rest clock. Safe to mount in several screens at once:
 * transitions re-read the store, so they happen exactly once.
 */
export function useSparClock() {
  const sp = useStore((s) => s.spar);
  const play = useSounds();
  useTicker(!!sp?.running, 200);
  useBackgroundCues(() => {
    const cur = useStore.getState().spar;
    if (!cur?.running || !cur.endsAt || (cur.phase !== 'round' && cur.phase !== 'rest')) return [];
    return planIntervals({ phase: cur.phase === 'round' ? 'work' : 'rest', endsAt: cur.endsAt, round: cur.round, rounds: cur.rounds, workSec: cur.roundSec, restSec: cur.restSec, stopAfterWork: true });
  });
  const lastSec = useRef<number>(-1);
  const startedRef = useRef<string>('');

  // start bell when a round starts running
  useEffect(() => {
    if (!sp?.running || sp.phase !== 'round') return;
    const k = `${sp.id}:${sp.round}`;
    if (sp.leftMs === sp.roundSec * 1000 && startedRef.current !== k) {
      startedRef.current = k;
      play('round_start');
    }
  }, [sp?.running, sp?.phase, sp?.round]);

  useEffect(() => {
    const cur = useStore.getState().spar;
    if (!cur?.running || !cur.endsAt) return;
    const left = cur.endsAt - Date.now();
    const sec = Math.ceil(left / 1000);
    if (sec > 0 && sec !== lastSec.current && cur.phase === 'round' && lastSec.current > 0) roundCues(lastSec.current, sec, cur.roundSec);
    lastSec.current = sec;
    if (left > 0) return;
    if (cur.phase === 'round') {
      play('round_end');
      useStore.getState().patchSpar({ phase: 'await', running: false, endsAt: null, leftMs: 0 });
    } else if (cur.phase === 'rest') {
      play('rest_end');
      startedRef.current = `${cur.id}:${cur.round}`;
      useStore.getState().patchSpar({ phase: 'round', running: true, endsAt: Date.now() + cur.roundSec * 1000, leftMs: cur.roundSec * 1000 });
    }
  });
  return sp;
}

/**
 * Save the winners of the current round. Every round has its own bouts (new opponents each round),
 * stored as SparringSession → Bout(round) → Round. Then rest and move to the next round's pairs.
 */
export function saveRound(sp: LiveSparring, picks: Record<number, 'red' | 'blue' | 'draw'>) {
  const st = useStore.getState();
  const T = today();
  const boutIds = { ...sp.boutIds };
  let recId = boutIds.__session;
  if (!recId) {
    recId = st.append('sparrings', [{ branchId: sp.branchId, type: sp.type, rounds: sp.rounds, roundSec: sp.roundSec, restSec: sp.restSec, date: T }])[0];
    boutIds.__session = recId;
  }
  const played = sp.pairs.filter((_, i) => picks[i]);
  const ids = st.append('bouts', played.map((p) => ({ sparringId: recId!, red: p.red, blue: p.blue, date: T, type: sp.type, round: sp.round })));
  played.forEach((p, i) => (boutIds[`${sp.round}:${p.red}|${p.blue}`] = ids[i]));
  st.append('rounds', sp.pairs.flatMap((p, i) => (picks[i] ? [{ boutId: boutIds[`${sp.round}:${p.red}|${p.blue}`], number: sp.round, winner: picks[i], date: T }] : [])));

  const byeCount = { ...sp.byeCount };
  if (sp.bye) byeCount[sp.bye] = (byeCount[sp.bye] ?? 0) + 1;

  if (sp.round >= sp.rounds) {
    st.patchSpar({ boutIds, byeCount, phase: 'done', running: false, endsAt: null });
    return 'done' as const;
  }
  const next = sp.schedule[sp.round];
  st.patchSpar({
    boutIds, byeCount, pairs: next?.pairs ?? [], bye: next?.bye ?? null, round: sp.round + 1, phase: 'rest', running: true,
    endsAt: Date.now() + sp.restSec * 1000, leftMs: sp.restSec * 1000,
  });
  return 'next' as const;
}
