/**
 * Builds the WhatsApp reminders that are ready now (SPEC §9.1). Nothing is sent automatically:
 * the coach taps each one, the NotificationChannel opens WhatsApp, and a ReminderLog row is appended.
 * Session times come from the coach's clubs schedule (Portfolio › clubs & schedule).
 */
import { C } from '@/theme';
import { PACKAGES } from '@/data/seed';
import { DEFAULT_TEMPLATES, type Club, type Portfolio, type ReminderCfg, type Slot, type TrainLead } from '@/data/store';
import type { DB, Player } from '@/data/types';
import { isAr, nm, tr } from '@/i18n';
import { addDays, dayMonth, diffDays, fmtTime, parse, satIndex, toMin, ymd } from './dates';
import { branchName, branchOf, payStatus } from './queries';

export type Reason = 'pay_before' | 'pay_due' | 'pay_overdue' | 'train_session' | 'train_absent';
export type Reminder = {
  key: string;
  kind: 'pay' | 'train';
  reason: Reason;
  player: Player;
  tag: string;
  tagColor: string;
  message: string;
  sent: boolean;
};

export const LEAD_MS: Record<TrainLead, number> = { '1h': 3600e3, '2h': 7200e3, '1d': 86400e3 };

/** Both Arabic and English placeholder names work in any template. */
export const VARS = {
  pay: [['{اسم_اللاعب}', '{player_name}'], ['{المبلغ}', '{amount}'], ['{تاريخ_الاستحقاق}', '{due_date}']],
  train: [['{اسم_اللاعب}', '{player_name}'], ['{الميعاد}', '{time}'], ['{الفرع}', '{branch}']],
  absent: [['{اسم_اللاعب}', '{player_name}'], ['{أيام_الغياب}', '{days_absent}'], ['{الميعاد}', '{time}'], ['{الفرع}', '{branch}']],
} as const;

/** A template left at its default follows the app language. */
export function templateFor(cfg: ReminderCfg, k: 'pay' | 'train' | 'absent') {
  const cur = cfg.templates[k];
  const isDefault = cur === DEFAULT_TEMPLATES.ar[k] || cur === DEFAULT_TEMPLATES.en[k];
  return isDefault ? DEFAULT_TEMPLATES[isAr() ? 'ar' : 'en'][k] : cur;
}

export function fill(template: string, v: Record<string, string | undefined>) {
  let out = template;
  const map: [string, string, string | undefined][] = [
    ['{اسم_اللاعب}', '{player_name}', v.name], ['{المبلغ}', '{amount}', v.amount], ['{تاريخ_الاستحقاق}', '{due_date}', v.due],
    ['{الميعاد}', '{time}', v.time], ['{الفرع}', '{branch}', v.branch], ['{أيام_الغياب}', '{days_absent}', v.days],
  ];
  for (const [a, b, val] of map) if (val !== undefined) out = out.split(a).join(val).split(b).join(val);
  return out;
}

const money = (n: number) => (isAr() ? `${n.toLocaleString('en-US')} ج` : `EGP ${n.toLocaleString('en-US')}`);
const at = (date: string, hhmm: string) => {
  const d = parse(date);
  const m = toMin(hhmm);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};

export type Session = { start: Date; date: string; slot: Slot; club: Club };

/** All schedule occurrences between `from` and `from + days`, sorted. */
export function upcomingSessions(p: Portfolio, from: Date, days = 7): Session[] {
  const out: Session[] = [];
  const base = ymd(from);
  for (let k = 0; k <= days; k++) {
    const date = addDays(base, k);
    for (const slot of p.schedule) {
      if (slot.day !== satIndex(date)) continue;
      const club = p.clubs.find((c) => c.id === slot.clubId);
      if (!club) continue;
      const start = at(date, slot.start);
      if (start >= from) out.push({ start, date, slot, club });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** "النهارده 5:00 م" / "بكرة 9:00 م" / "25 نوفمبر 5:00 م" */
export function sessionWhen(s: Session, now: Date) {
  const d = diffDays(s.date, ymd(now));
  const time = fmtTime(s.slot.start);
  if (d === 0) return tr(`النهارده ${time}`, `today ${time}`);
  if (d === 1) return tr(`بكرة ${time}`, `tomorrow ${time}`);
  return `${dayMonth(s.date)} ${time}`;
}

export function buildReminders(db: DB, cfg: ReminderCfg, portfolio: Portfolio, branch = 'all', now = new Date()): { pay: Reminder[]; train: Reminder[] } {
  const T = ymd(now);
  const r = cfg.rules;
  const logs = db.reminderLogs;
  const loggedSince = (pid: string, kind: 'pay' | 'train', sinceDate: string) =>
    logs.some((l) => l.playerId === pid && l.kind === kind && l.date >= sinceDate);
  // archived players and players marked "don't send reminders" are skipped
  const players = db.players.filter((p) => !p.archived && !p.noReminders && (branch === 'all' || branchOf(db, p.id) === branch));
  const first = (p: Player) => nm(p).split(' ')[0];

  /* ---------- payment ---------- */
  const pay: Reminder[] = [];
  for (const p of players) {
    const st = payStatus(db, p.id, T);
    if (!st.end) continue;
    const sub = db.subscriptions.filter((x) => x.playerId === p.id).sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
    const price = (PACKAGES.find((k) => k.id === sub?.packageId) ?? PACKAGES[0]).price;
    const left = diffDays(st.end, T);
    let reason: Reason | null = null;
    let since = T;
    if (left < 0 && r.payOverdue) { reason = 'pay_overdue'; since = addDays(T, -(Math.max(1, r.overdueEvery) - 1)); }
    else if (left === 0 && r.payDue) { reason = 'pay_due'; since = T; }
    else if (left > 0 && left <= r.payBeforeDays && r.payBefore) { reason = 'pay_before'; since = addDays(st.end, -r.payBeforeDays); }
    if (!reason) continue;
    const tag = reason === 'pay_overdue'
      ? tr(`متأخر ${-left} ${-left === 1 ? 'يوم' : 'أيام'} · ${money(price)}`, `${-left} day${left === -1 ? '' : 's'} overdue · ${money(price)}`)
      : reason === 'pay_due' ? tr(`يستحق النهارده · ${money(price)}`, `Due today · ${money(price)}`)
      : tr(`يستحق بعد ${left} ${left === 1 ? 'يوم' : 'أيام'} · ${money(price)}`, `Due in ${left} day${left === 1 ? '' : 's'} · ${money(price)}`);
    pay.push({
      key: `pay:${p.id}`, kind: 'pay', reason, player: p, tag,
      tagColor: reason === 'pay_overdue' ? C.danger : C.warning,
      message: fill(templateFor(cfg, 'pay'), { name: first(p), amount: money(price), due: dayMonth(st.end) }),
      sent: loggedSince(p.id, 'pay', since),
    });
  }
  pay.sort((a, b) => (a.reason === 'pay_overdue' ? 0 : 1) - (b.reason === 'pay_overdue' ? 0 : 1));

  /* ---------- training ---------- */
  const train: Reminder[] = [];
  const lead = LEAD_MS[r.trainLead];
  const branchOk = (b: string) => !r.trainBranches.length || r.trainBranches.includes(b);
  const sessions = upcomingSessions(portfolio, now, 8);
  const lastSeen = new Map<string, string>();
  for (const a of db.attendance) if (!lastSeen.has(a.playerId) || a.date > lastSeen.get(a.playerId)!) lastSeen.set(a.playerId, a.date);

  for (const p of players) {
    const b = branchOf(db, p.id);
    if (!branchOk(b)) continue;
    const next = sessions.find((x) => x.club.branchId === b);
    const absentDays = diffDays(T, lastSeen.get(p.id) ?? p.joinedAt);
    const where = next ? next.club.name || branchName(b) : branchName(b);
    if (r.trainAbsent && absentDays > 7 && next) {
      train.push({
        key: `absent:${p.id}`, kind: 'train', reason: 'train_absent', player: p,
        tag: tr(`غايب ${absentDays} يوم · ${branchName(b)}`, `Absent ${absentDays} days · ${branchName(b)}`), tagColor: C.danger,
        message: fill(templateFor(cfg, 'absent'), { name: first(p), days: String(absentDays), time: sessionWhen(next, now), branch: where }),
        sent: loggedSince(p.id, 'train', T),
      });
      continue;
    }
    // ready from (session start − lead) until the session starts
    if (r.trainBefore && next && next.start.getTime() - now.getTime() <= lead) {
      const readyAt = new Date(next.start.getTime() - lead).toISOString();
      train.push({
        key: `train:${p.id}`, kind: 'train', reason: 'train_session', player: p,
        tag: tr(`حصة ${sessionWhen(next, now)} · ${where}`, `Session ${sessionWhen(next, now)} · ${where}`), tagColor: C.muted,
        message: fill(templateFor(cfg, 'train'), { name: first(p), time: sessionWhen(next, now), branch: where }),
        sent: logs.some((l) => l.playerId === p.id && l.kind === 'train' && l.createdAt >= readyAt),
      });
    }
  }
  return { pay, train };
}
