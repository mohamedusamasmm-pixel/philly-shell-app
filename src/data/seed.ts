/**
 * Deterministic demo data (≈ 5 months of history) so every screen is computed
 * from dated, append-only records — exactly how the real backend will work.
 * Replace with Supabase data later; screens only read through selectors.
 */
import { addDays, parse, today, ymd } from '@/logic/dates';
import type { Branch, Coach, DB, Exercise, Level, Package, Winner } from './types';

export const GYM = { id: 'g1', name: 'أكاديمية الأبطال', nameEn: 'Champions Academy' };
export const COACH: Coach & { nameEn: string } = { id: 'c1', name: 'كابتن محمود', nameEn: 'Coach Mahmoud', role: 'owner' };
export const BRANCHES: Branch[] = [
  { id: 'b1', name: 'المعادي', nameEn: 'Maadi' },
  { id: 'b2', name: 'مدينة نصر', nameEn: 'Nasr City' },
];
export const PACKAGES: Package[] = [
  { id: 'k1', name: 'شهري', nameEn: 'Monthly', type: 'monthly', price: 600, days: 30 },
  { id: 'k2', name: '3 شهور', nameEn: '3 months', type: 'quarterly', price: 1600, days: 90 },
  { id: 'k3', name: '12 حصة', nameEn: '12 sessions', type: 'sessions', price: 700, sessions: 12, days: 60 },
];
export const EXERCISES: Exercise[] = [
  { id: 'e1', name: 'ضغط', nameEn: 'Push-ups', mode: 'count', target: 30, seconds: 45 },
  { id: 'e2', name: 'بطن', nameEn: 'Sit-ups', mode: 'count', target: 50, seconds: 60 },
  { id: 'e3', name: 'عقلة', nameEn: 'Pull-ups', mode: 'count', target: 10, seconds: 60 },
  { id: 'e4', name: 'نط حبل', nameEn: 'Jump rope', mode: 'time', target: 150, seconds: 60 },
  { id: 'e5', name: 'فوت وورك', nameEn: 'Footwork', mode: 'time', target: 0, seconds: 120 },
  { id: 'e6', name: 'سكوات', nameEn: 'Squats', mode: 'count', target: 40, seconds: 60 },
  { id: 'e7', name: 'بيربي', nameEn: 'Burpees', mode: 'count', target: 20, seconds: 60 },
  { id: 'e8', name: 'شادو', nameEn: 'Shadow', mode: 'time', target: 0, seconds: 180 },
  { id: 'e9', name: 'كيس', nameEn: 'Bag', mode: 'time', target: 0, seconds: 180 },
];

// [name, branch, weightKg, level, monthsAgoJoined, paymentState]
type P = [string, string, number, Level, number, 'ok' | 'soon' | 'late'];
const NAMES_EN = ["Ahmed Hassan","Youssef Ali","Karim Mostafa","Omar Samy","Mohamed Tarek","Ziad Khaled","Adel Fouad","Hossam Nabil","Mazen Raafat","Seif Walid","Iyad Sherif","Mostafa Ramadan","Anas Gamal","Khaled Abdallah","Belal Ashraf","Taha Ibrahim","Nour Samir","Ramy Fathy","Hesham Adel","Ali Hamdy","Shady Mounir","Tamer Salah","Fares Ayman","Hazem Yasser","Marwan Hany","Abdelrahman Saeed","Yassin Emad","Adham Kamal","Gamal Nasr","Walid Rashad","Hamza Magdy","Sameh Essam"];
const ROSTER: P[] = [
  ['أحمد حسن', 'b1', 72, 'intermediate', 15, 'ok'],
  ['يوسف علي', 'b1', 68, 'beginner', 4, 'late'],
  ['كريم مصطفى', 'b1', 81, 'pro', 24, 'ok'],
  ['عمر سامي', 'b1', 75, 'intermediate', 8, 'soon'],
  ['محمد طارق', 'b1', 64, 'beginner', 2, 'ok'],
  ['زياد خالد', 'b1', 91, 'intermediate', 11, 'late'],
  ['عادل فؤاد', 'b1', 66, 'beginner', 6, 'ok'],
  ['حسام نبيل', 'b1', 69, 'intermediate', 9, 'ok'],
  ['مازن رأفت', 'b1', 77, 'intermediate', 13, 'ok'],
  ['سيف الدين وليد', 'b1', 60, 'beginner', 3, 'ok'],
  ['إياد شريف', 'b1', 85, 'pro', 30, 'ok'],
  ['مصطفى رمضان', 'b1', 79, 'intermediate', 7, 'soon'],
  ['أنس جمال', 'b1', 71, 'beginner', 1, 'ok'],
  ['خالد عبد الله', 'b1', 88, 'intermediate', 18, 'ok'],
  ['بلال أشرف', 'b1', 62, 'intermediate', 10, 'late'],
  ['طه إبراهيم', 'b1', 74, 'pro', 26, 'ok'],
  ['نور الدين سمير', 'b1', 67, 'beginner', 5, 'ok'],
  ['رامي فتحي', 'b1', 83, 'intermediate', 14, 'ok'],
  ['هشام عادل', 'b2', 70, 'intermediate', 12, 'ok'],
  ['علي حمدي', 'b2', 65, 'beginner', 3, 'ok'],
  ['شادي منير', 'b2', 78, 'pro', 28, 'ok'],
  ['تامر صلاح', 'b2', 92, 'intermediate', 9, 'late'],
  ['فارس أيمن', 'b2', 73, 'beginner', 2, 'soon'],
  ['حازم ياسر', 'b2', 80, 'intermediate', 16, 'ok'],
  ['مروان هاني', 'b2', 63, 'beginner', 4, 'ok'],
  ['عبد الرحمن سعيد', 'b2', 76, 'intermediate', 7, 'ok'],
  ['ياسين عماد', 'b2', 69, 'pro', 20, 'ok'],
  ['أدهم كمال', 'b2', 86, 'intermediate', 11, 'late'],
  ['جمال الدين نصر', 'b2', 61, 'beginner', 1, 'ok'],
  ['وليد رشاد', 'b2', 74, 'intermediate', 13, 'ok'],
  ['حمزة مجدي', 'b2', 82, 'pro', 22, 'ok'],
  ['سامح عصام', 'b2', 67, 'intermediate', 6, 'ok'],
];

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LV = { beginner: 0, intermediate: 1, pro: 2 } as const;

export function buildSeed(): DB {
  const r = rng(42);
  const T = today();
  const db: DB = {
    players: [], playerEdits: [], coachNotes: [], branchHistory: [], weights: [], levels: [], attendance: [], subscriptions: [], payments: [],
    sessions: [], results: [], sparrings: [], bouts: [], rounds: [], reminderLogs: [],
  };
  let n = 0;
  const id = (p: string) => `${p}${++n}`;
  const meta = (date: string) => ({ createdAt: `${date}T18:00:00`, synced: true });

  // ---- players ----
  const info: Record<string, { branch: string; weight: number; lvl: number; skill: number; rate: number; base: Record<string, number>; joined: string }> = {};
  ROSTER.forEach(([name, branch, w, level, monthsAgo, pay], i) => {
    const d = new Date(); d.setMonth(d.getMonth() - monthsAgo); d.setDate(Math.max(1, d.getDate() - Math.floor(r() * 20)));
    const joined = ymd(d);
    const pid = `p${i + 1}`;
    db.players.push({ id: pid, name, nameEn: NAMES_EN[i], phone: `010${String(10000000 + Math.floor(r() * 89999999))}`, birthYear: 2000 + Math.floor(r() * 10), joinedAt: joined, ...meta(joined) });
    db.branchHistory.push({ id: id('bh'), playerId: pid, branchId: branch, fromDate: joined, ...meta(joined) });
    db.levels.push({ id: id('lv'), playerId: pid, level, date: joined, ...meta(joined) });
    // weight trending down ~2kg over the last 3 months
    [-90, -45, -15].forEach((off, k) => {
      const date = addDays(T, off);
      if (date >= joined) db.weights.push({ id: id('w'), playerId: pid, weightKg: Math.round(w + (2 - k) * (r() * 1.2)), date, ...meta(date) });
    });
    if (!db.weights.some((x) => x.playerId === pid)) db.weights.push({ id: id('w'), playerId: pid, weightKg: w, date: joined, ...meta(joined) });
    else db.weights.push({ id: id('w'), playerId: pid, weightKg: w, date: addDays(T, -3), ...meta(addDays(T, -3)) });

    // subscriptions: monthly, end date encodes payment state
    const end = pay === 'ok' ? addDays(T, 6 + Math.floor(r() * 20)) : pay === 'soon' ? addDays(T, 1 + Math.floor(r() * 3)) : addDays(T, -(2 + Math.floor(r() * 8)));
    const start = addDays(end, -30);
    const sid = id('s');
    db.subscriptions.push({ id: sid, playerId: pid, packageId: 'k1', startDate: start, endDate: end, ...meta(start) });
    db.payments.push({ id: id('pay'), playerId: pid, subscriptionId: sid, amount: 600, date: start, method: 'cash', ...meta(start) });

    const lvl = LV[level];
    info[pid] = {
      branch, weight: w, lvl, joined,
      skill: 0.35 + lvl * 0.2 + r() * 0.25,
      rate: pay === 'late' ? 0.45 + r() * 0.2 : 0.62 + r() * 0.33,
      base: { e1: 18 + lvl * 9 + r() * 8, e2: 30 + lvl * 12 + r() * 10, e3: 4 + lvl * 4 + r() * 3, e6: 25 + lvl * 8 + r() * 8, e7: 10 + lvl * 5 + r() * 4, e4: 60, e5: 120, e8: 180, e9: 180 },
    };
  });

  // ---- training days: Sat / Mon / Wed + today, last ~150 days ----
  const exRot = [['e1', 'e2', 'e4'], ['e1', 'e6', 'e5'], ['e1', 'e3', 'e7']];
  for (let off = -150; off <= 0; off++) {
    const date = addDays(T, off);
    const wd = parse(date).getDay(); // 6=Sat 1=Mon 3=Wed
    if (off !== 0 && ![6, 1, 3].includes(wd)) continue;
    const progress = (off + 150) / 150; // 0 → 1 over the window

    for (const b of BRANCHES) {
      const present = db.players.filter((p) => {
        const x = info[p.id];
        return x.branch === b.id && p.joinedAt <= date && r() < (off === 0 ? 0.55 : x.rate);
      });
      if (!present.length) continue;
      present.forEach((p) => db.attendance.push({ id: id('a'), playerId: p.id, branchId: b.id, date, method: r() < 0.3 ? 'qr' : 'manual', ...meta(date) }));
      if (off === 0) continue; // today's workout hasn't happened yet

      const ws = id('ws');
      db.sessions.push({ id: ws, branchId: b.id, coachId: COACH.id, date, ...meta(date) });
      for (const ex of exRot[Math.abs(off) % 3]) {
        const e = EXERCISES.find((x) => x.id === ex)!;
        present.forEach((p) => {
          if (r() < 0.08) return; // skipped this one
          const x = info[p.id];
          const growth = 1 + 0.35 * progress * (0.6 + x.skill);
          if (e.mode === 'count') {
            db.results.push({ id: id('r'), sessionId: ws, playerId: p.id, exerciseId: ex, mode: 'count', reps: Math.round(x.base[ex] * growth * (0.85 + r() * 0.3)), date, ...meta(date) });
          } else {
            db.results.push({ id: id('r'), sessionId: ws, playerId: p.id, exerciseId: ex, mode: 'time', seconds: e.seconds * (r() < 0.8 ? 2 : 3), date, ...meta(date) });
          }
        });
      }

      // sparring: light & hard alternate
      if (present.length >= 2) {
        const type = Math.abs(off) % 2 ? 'hard' : 'light';
        const sp = id('sp');
        db.sparrings.push({ id: sp, branchId: b.id, type, rounds: 3, roundSec: 180, restSec: 60, date, ...meta(date) });
        const byW = [...present].sort((a, c) => info[a.id].weight - info[c.id].weight);
        for (let i = 0; i + 1 < byW.length; i += 2) {
          const [ra, bl] = r() < 0.5 ? [byW[i], byW[i + 1]] : [byW[i + 1], byW[i]];
          const bt = id('bt');
          db.bouts.push({ id: bt, sparringId: sp, red: ra.id, blue: bl.id, date, type, ...meta(date) });
          for (let k = 1; k <= 3; k++) {
            const pa = info[ra.id].skill, pb = info[bl.id].skill;
            const x = r();
            const winner: Winner = x < 0.12 ? 'draw' : r() < pa / (pa + pb) ? 'red' : 'blue';
            db.rounds.push({ id: id('rd'), boutId: bt, number: k, winner, date, ...meta(date) });
          }
        }
      }
    }
  }
  return db;
}
