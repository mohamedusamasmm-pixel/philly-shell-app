import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { today } from '@/logic/dates';
import { BRANCHES, buildSeed, EXERCISES } from './seed';
import type { Branch, DB, Exercise, Mode, SparType, Table, Winner } from './types';

export type Lang = 'ar' | 'en';
export type IntervalCfg = { rounds: number; restSec: number };
/** Signed-in coach. Local placeholder until Supabase Auth is wired (no password is stored). */
export type Auth = { name: string; club: string; email: string; onboarded?: boolean };

/* ---- Settings pages ---- */
export type SoundEvent = 'round_start' | 'half_round' | 'last_10_sec' | 'round_end' | 'rest_end';
export type CustomSound = { uri: string; name: string };
export type SoundCfg = { custom: Partial<Record<SoundEvent, CustomSound>>; volume: number; vibrate: boolean };

export type TrainLead = '1h' | '2h' | '1d';
export type ReminderRules = {
  payBefore: boolean; // X days before due
  payBeforeDays: number; // default 3
  payDue: boolean; // on the due day
  payOverdue: boolean; // every X days while overdue
  overdueEvery: number; // default 3
  trainBefore: boolean; // before each session in the schedule
  trainLead: TrainLead; // how long before the session
  trainBranches: string[]; // empty = all branches
  trainAbsent: boolean; // absent more than 7 days
};
export type ReminderCfg = { rules: ReminderRules; templates: { pay: string; train: string; absent: string } };

/** CoachProfile / CoachAchievement / CoachClub / CoachSchedule (SPEC §9.3). */
export type Club = { id: string; name: string; address: string; lat?: number; lng?: number; branchId: string };
export type Slot = { id: string; clubId: string; day: number; start: string; end: string }; // day 0 = Saturday, HH:MM 24h
export type SocialKey = 'instagram' | 'facebook' | 'tiktok' | 'youtube';
export type Portfolio = {
  fullName: string;
  bio: string;
  years: number;
  photoUri?: string;
  public: boolean;
  achievements: { id: string; title: string; year?: number }[];
  social: Partial<Record<SocialKey, string>>;
  clubs: Club[];
  schedule: Slot[];
};

export const DEFAULT_RULES: ReminderRules = {
  payBefore: true, payBeforeDays: 3, payDue: true, payOverdue: true, overdueEvery: 3,
  trainBefore: true, trainLead: '2h', trainBranches: [], trainAbsent: false,
};

const DEFAULT_PORTFOLIO: Portfolio = {
  fullName: '', bio: '', years: 0, public: false, achievements: [], social: {},
  clubs: [
    { id: 'c1', name: 'نادي المعادي', address: '', branchId: 'b1' },
    { id: 'c2', name: 'نادي مدينة نصر', address: '', branchId: 'b2' },
  ],
  schedule: [
    { id: 's1', clubId: 'c1', day: 0, start: '17:00', end: '18:00' },
    { id: 's2', clubId: 'c1', day: 0, start: '21:00', end: '22:00' },
    { id: 's3', clubId: 'c1', day: 2, start: '17:00', end: '18:00' },
    { id: 's4', clubId: 'c1', day: 2, start: '21:00', end: '22:00' },
    { id: 's5', clubId: 'c1', day: 4, start: '18:00', end: '19:30' },
    { id: 's6', clubId: 'c2', day: 1, start: '19:00', end: '20:30' },
    { id: 's7', clubId: 'c2', day: 3, start: '19:00', end: '20:30' },
  ],
};

/** Older saves had schedule slots keyed by branch and no clubs list. */
function migratePortfolio(p: Partial<Portfolio> & { schedule?: (Slot & { branchId?: string })[] } | undefined, branches: Branch[]): Portfolio {
  if (!p) return DEFAULT_PORTFOLIO;
  if (p.clubs) return { ...DEFAULT_PORTFOLIO, ...p } as Portfolio;
  const clubs: Club[] = branches.map((b) => ({ id: `c_${b.id}`, name: b.name, address: b.address ?? '', branchId: b.id }));
  const schedule = ((p.schedule ?? []) as (Slot & { branchId?: string })[]).map((x) => ({ id: x.id, clubId: x.clubId ?? `c_${x.branchId}`, day: x.day, start: x.start, end: x.end }));
  return { ...DEFAULT_PORTFOLIO, ...p, social: {}, clubs, schedule } as Portfolio;
}

export const DEFAULT_TEMPLATES = {
  ar: {
    pay: 'أهلاً يا {اسم_اللاعب}، ده تذكير إن اشتراك الشهر بيستحق يوم {تاريخ_الاستحقاق}. المبلغ {المبلغ}. شكراً يا بطل',
    train: 'أهلاً يا {اسم_اللاعب}، مستنيينك في حصة {الميعاد} في فرع {الفرع}. متتأخرش يا بطل',
    absent: 'أهلاً يا {اسم_اللاعب}، وحشتنا! بقالك {أيام_الغياب} يوم مجيتش. مستنيينك في حصة {الميعاد} في فرع {الفرع}',
  },
  en: {
    pay: 'Hi {player_name}, a reminder that this month’s subscription is due on {due_date}. Amount: {amount}. Thanks, champ',
    train: 'Hi {player_name}, see you at the {time} session at {branch}. Don’t be late, champ',
    absent: 'Hi {player_name}, we miss you! It’s been {days_absent} days. See you at the {time} session at {branch}',
  },
};

const SEED = buildSeed();
const EMPTY: DB = {
  players: [], playerEdits: [], coachNotes: [], branchHistory: [], weights: [], levels: [], attendance: [], subscriptions: [], payments: [],
  sessions: [], results: [], sparrings: [], bouts: [], rounds: [], reminderLogs: [],
};

export type LivePair = { red: string; blue: string; warn?: string };
/** One round of the pre-generated rotation: pairs + who sits out. */
export type RoundPlan = { pairs: LivePair[]; bye: string | null };
export type Phase = 'idle' | 'round' | 'rest' | 'await' | 'done';
export type LiveSparring = {
  id: string;
  date: string;
  /** branch filter the session was built for ('all' or a branch id) */
  scope: string;
  branchId: string;
  type: SparType;
  rounds: number;
  roundSec: number;
  restSec: number;
  maxDiff: number;
  participants: string[];
  /** full rotation, one entry per round (SPEC §10) */
  schedule: RoundPlan[];
  /** current round mirrors schedule[round-1] */
  pairs: LivePair[];
  bye: string | null;
  byeCount: Record<string, number>;
  round: number; // 1-based current round
  phase: Phase;
  endsAt: number | null; // epoch ms while running
  leftMs: number; // remaining when paused
  running: boolean;
  /** red/blue → boutId, so each pair keeps one bout across rounds */
  boutIds: Record<string, string>;
};

export type PendingWorkout = { exerciseId: string; mode: Mode; value: number; at: number };

type State = {
  /** Locally created records (append-only). `synced:false` = waiting in the outbox for Supabase. */
  local: DB;
  lang: Lang;
  auth: Auth | null;
  /** "افتكرني": keep the session after the app restarts */
  remember: boolean;
  branches: Branch[];
  /** Workout time mode: work time comes from the exercise; rounds & rest here. */
  interval: IntervalCfg;
  branch: 'all' | string;
  sound: boolean;
  customExercises: Exercise[];
  shadow: { rounds: number; roundSec: number; restSec: number };
  pendingWorkout: PendingWorkout | null;
  spar: LiveSparring | null;
  toast: { msg: string; at: number } | null;
  sounds: SoundCfg;
  reminders: ReminderCfg;
  portfolio: Portfolio;

  append: <T extends Table>(table: T, rows: Omit<DB[T][number], 'id' | 'createdAt' | 'synced'>[]) => string[];
  /** Only local, not-yet-synced rows can be withdrawn (same-day correction). */
  withdraw: (table: Table, id: string) => void;
  set: (p: Partial<Pick<State, 'branch' | 'sound' | 'shadow' | 'pendingWorkout' | 'spar' | 'customExercises' | 'lang' | 'branches' | 'interval' | 'auth' | 'remember' | 'sounds' | 'reminders' | 'portfolio'>>) => void;
  patchSpar: (p: Partial<LiveSparring>) => void;
  notify: (msg: string) => void;
};

let counter = 0;
export const uid = (p: string) => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}`;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      local: EMPTY,
      lang: 'ar',
      auth: null,
      remember: true,
      branches: BRANCHES,
      interval: { rounds: 1, restSec: 30 },
      branch: 'all',
      sound: true,
      customExercises: [],
      shadow: { rounds: 3, roundSec: 180, restSec: 60 },
      pendingWorkout: null,
      spar: null,
      toast: null,
      sounds: { custom: {}, volume: 0.8, vibrate: true },
      reminders: { rules: DEFAULT_RULES, templates: DEFAULT_TEMPLATES.ar },
      portfolio: DEFAULT_PORTFOLIO,

      append: (table, rows) => {
        const now = new Date().toISOString();
        const made = rows.map((r) => ({ ...r, id: uid(table.slice(0, 2)), createdAt: now, synced: false }));
        set((s) => ({ local: { ...s.local, [table]: [...s.local[table], ...made] } }));
        return made.map((m) => m.id);
      },
      withdraw: (table, id) =>
        set((s) => ({ local: { ...s.local, [table]: (s.local[table] as { id: string; synced?: boolean }[]).filter((r) => r.id !== id || r.synced) } })),
      set: (p) => set(p),
      patchSpar: (p) => {
        const cur = get().spar;
        if (cur) set({ spar: { ...cur, ...p } });
      },
      notify: (msg) => set({ toast: { msg, at: Date.now() } }),
    }),
    {
      name: 'boxing-coach-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ toast, ...rest }) => rest,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const auth = p.remember === false ? null : (p.auth ?? null);
        const branches = p.branches ?? current.branches;
        return {
          ...current, ...p, auth,
          local: { ...EMPTY, ...(p.local ?? {}) },
          reminders: { ...current.reminders, ...(p.reminders ?? {}), rules: { ...DEFAULT_RULES, ...(p.reminders?.rules ?? {}) } },
          portfolio: migratePortfolio(p.portfolio, branches),
          // live sparring format changed (per-round schedule); drop an old one
          spar: p.spar && (p.spar as LiveSparring).schedule ? p.spar : null,
        };
      },
    },
  ),
);

/** True once the persisted state has loaded from storage (avoids a login flash on start). */
export function useHydrated() {
  const [ok, setOk] = useState(() => useStore.persist.hasHydrated());
  useEffect(() => {
    if (ok) return;
    const unsub = useStore.persist.onFinishHydration(() => setOk(true));
    if (useStore.persist.hasHydrated()) setOk(true);
    return unsub;
  }, [ok]);
  return ok;
}

/** Seed + local records, merged. All screens read through this. */
export function useDB(): DB {
  const local = useStore((s) => s.local);
  return useMemo(() => {
    const out = {} as DB;
    (Object.keys(SEED) as Table[]).forEach((k) => {
      (out as Record<Table, unknown[]>)[k] = local[k].length ? [...SEED[k], ...local[k]] : SEED[k];
    });
    // apply append-only profile edits (latest value per field wins)
    if (out.playerEdits.length) {
      const edits = [...out.playerEdits].sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
      const byId = new Map(out.players.map((p) => [p.id, { ...p }]));
      for (const e of edits) {
        const p = byId.get(e.playerId);
        if (!p) continue;
        const { id: _i, createdAt: _c, synced: _s, playerId: _p, date: _d, ...patch } = e;
        for (const [k, v] of Object.entries(patch)) if (v !== undefined) (p as Record<string, unknown>)[k] = v;
        if (patch.name) p.nameEn = undefined; // a typed name replaces the demo English name
      }
      out.players = out.players.map((p) => byId.get(p.id)!);
    }
    return out;
  }, [local]);
}

export function useExercises(): Exercise[] {
  const custom = useStore((s) => s.customExercises);
  return useMemo(() => [...EXERCISES, ...custom], [custom]);
}

export const pendingCount = (local: DB) =>
  (Object.values(local) as { synced?: boolean }[][]).reduce((n, rows) => n + rows.filter((r) => !r.synced).length, 0);

export const notify = (msg: string) => useStore.getState().notify(msg);
export const todayStr = today;
export type { Winner };
