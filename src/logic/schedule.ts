import type { Slot } from '@/data/store';
import { toMin } from './dates';

/** Normalise "5", "5:3", "17.30" → "05:00" / "05:03" / "17:30". */
export function normTime(raw: string) {
  const s = raw.trim().replace('.', ':');
  const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2] ?? 0);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/** Slots on the same day may not overlap — even at different clubs. Touching ends are fine (5–6 then 6–7). */
export function overlap(schedule: Slot[], cand: Omit<Slot, 'id'>, ignoreId?: string) {
  const a = toMin(cand.start), b = toMin(cand.end);
  return schedule.find((x) => x.id !== ignoreId && x.day === cand.day && a < toMin(x.end) && toMin(x.start) < b) ?? null;
}
