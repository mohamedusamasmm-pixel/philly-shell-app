import { isAr, plural } from '@/i18n';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Week starts on Saturday. Index 0 = Saturday. */
const DAYS_SHORT_AR = ['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربع', 'خميس', 'جمعة'];
const DAYS_SHORT_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAYS_FULL_AR = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربع', 'الخميس', 'الجمعة'];
const DAYS_FULL_EN = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const months = () => (isAr() ? MONTHS_AR : MONTHS_EN);
export const monthShort = (i: number) => (isAr() ? MONTHS_AR[i] : MONTHS_EN[i].slice(0, 3));
export const daysShort = () => (isAr() ? DAYS_SHORT_AR : DAYS_SHORT_EN);
export const dayFull = (i: number) => (isAr() ? DAYS_FULL_AR : DAYS_FULL_EN)[i];

/** Local YYYY-MM-DD */
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const today = () => ymd(new Date());
export const diffDays = (a: string, b: string) => Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000);
/** 0 = Saturday … 6 = Friday */
export const satIndex = (s: string) => (parse(s).getDay() + 1) % 7;
export const weekStart = (s: string) => addDays(s, -satIndex(s));

export const dayMonth = (s: string) => {
  const d = parse(s);
  return isAr() ? `${d.getDate()} ${MONTHS_AR[d.getMonth()]}` : `${MONTHS_EN[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
};
export const fullDate = (s: string) => {
  const d = parse(s);
  return isAr() ? `${d.getDate()} ${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}` : `${MONTHS_EN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

export function monthsBetween(from: string, to: string) {
  const a = parse(from), b = parse(to);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  if (b.getDate() < a.getDate()) m--;
  return Math.max(0, m);
}

const monthsWord = (m: number) => (m === 1 ? 'شهر' : m === 2 ? 'شهرين' : m <= 10 ? `${m} شهور` : `${m} شهر`);
const yearsWord = (y: number) => (y === 1 ? 'سنة' : y === 2 ? 'سنتين' : y <= 10 ? `${y} سنين` : `${y} سنة`);

/** Time since joining, e.g. "سنة و3 شهور" / "1 year 3 months" */
export function tenure(from: string, to = today()) {
  const m = monthsBetween(from, to);
  const y = Math.floor(m / 12), r = m % 12;
  if (!isAr()) {
    if (m < 1) return 'under a month';
    return [y ? plural(y, 'year') : '', r ? plural(r, 'month') : ''].filter(Boolean).join(' ');
  }
  if (m < 1) return 'أقل من شهر';
  if (!y) return monthsWord(r);
  if (!r) return yearsWord(y);
  return `${yearsWord(y)} و${r === 1 ? 'شهر' : r === 2 ? 'شهرين' : `${r} شهور`}`;
}

export type Range = { from: string; to: string };
export type PeriodKind = 'week' | 'month' | 'year' | 'custom';

/** Period containing `anchor`, shifted by `offset` periods. */
export function periodRange(kind: PeriodKind, anchor: string, offset = 0): Range {
  const d = parse(anchor);
  if (kind === 'week') {
    const from = addDays(weekStart(anchor), offset * 7);
    return { from, to: addDays(from, 6) };
  }
  if (kind === 'month') {
    const a = new Date(d.getFullYear(), d.getMonth() + offset, 1);
    const b = new Date(a.getFullYear(), a.getMonth() + 1, 0);
    return { from: ymd(a), to: ymd(b) };
  }
  if (kind === 'year') {
    const y = d.getFullYear() + offset;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  // custom: rolling 90 days
  const to = addDays(anchor, offset * 90);
  return { from: addDays(to, -89), to };
}
export const prevRange = (kind: PeriodKind, r: Range): Range => periodRange(kind, r.from, -1);

export function periodLabel(kind: PeriodKind, r: Range) {
  const a = parse(r.from);
  if (kind === 'month') return `${months()[a.getMonth()]} ${a.getFullYear()}`;
  if (kind === 'year') return `${a.getFullYear()}`;
  return `${dayMonth(r.from)} – ${dayMonth(r.to)}`;
}
export const prevLabel = (kind: PeriodKind) =>
  isAr()
    ? ({ week: 'الأسبوع اللي فات', month: 'الشهر اللي فات', year: 'السنة اللي فاتت', custom: 'الفترة اللي قبلها' })[kind]
    : ({ week: 'last week', month: 'last month', year: 'last year', custom: 'previous period' })[kind];

export const inRange = (date: string, r: Range) => date >= r.from && date <= r.to;

export const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.max(0, sec) % 60).padStart(2, '0')}`;
export const timeNow = () => {
  const d = new Date();
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? (isAr() ? 'ص' : 'AM') : isAr() ? 'م' : 'PM'}`;
};

/** '17:30' → '5:30 م' / '5:30 PM' */
export const fmtTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? (isAr() ? 'ص' : 'AM') : isAr() ? 'م' : 'PM'}`;
};
export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** "25/11/2008" → "2008-11-25" */
export function parseDMY(s: string) {
  const m = s.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export const toDMY = (iso?: string) => {
  if (!iso) return '';
  const d = parse(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};
