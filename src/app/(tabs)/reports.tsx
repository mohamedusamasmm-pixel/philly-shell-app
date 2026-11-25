import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Bars, Card, IconBtn, OutlineBtn, Press, Screen, SectionTitle, Segmented, Txt, s } from '@/components/ui';
import { notify, useDB, useStore } from '@/data/store';
import { daysShort, monthShort, PeriodKind, Range, addDays, diffDays, inRange, parse, periodLabel, periodRange, prevLabel, prevRange, today, ymd } from '@/logic/dates';
import { branchName, efficiency, playersIn, sessionDays } from '@/logic/queries';
import { nm, useT } from '@/i18n';
import type { DB } from '@/data/types';
import { C } from '@/theme';

type K = Exclude<PeriodKind, 'custom'>;

function attendanceRate(db: DB, r: Range, branch: string) {
  const days = sessionDays(db, r, branch);
  if (!days.size) return null;
  const roster = playersIn(db, branch);
  let possible = 0;
  days.forEach((d) => (possible += roster.filter((p) => p.joinedAt <= d).length));
  const ids = new Set(roster.map((p) => p.id));
  const came = db.attendance.filter((a) => inRange(a.date, r) && ids.has(a.playerId) && (branch === 'all' || a.branchId === branch)).length;
  return possible ? came / possible : 0;
}

function buckets(t: (a: string, b: string) => string, kind: K, r: Range): { label: string; range: Range }[] {
  if (kind === 'week') return daysShort().map((l, i) => ({ label: l, range: { from: addDays(r.from, i), to: addDays(r.from, i) } }));
  if (kind === 'year') return Array.from({ length: 12 }, (_, i) => {
    const y = parse(r.from).getFullYear();
    return { label: monthShort(i), range: { from: ymd(new Date(y, i, 1)), to: ymd(new Date(y, i + 1, 0)) } };
  });
  const out: { label: string; range: Range }[] = [];
  for (let from = r.from, i = 1; from <= r.to; from = addDays(from, 7), i++) {
    const to = addDays(from, 6) > r.to ? r.to : addDays(from, 6);
    out.push({ label: t(`أسبوع ${i}`, `Wk ${i}`), range: { from, to } });
  }
  return out;
}

export default function Reports() {
  const t = useT();
  const lang = useStore((st) => st.lang);
  const db = useDB();
  const branch = useStore((st) => st.branch);
  const [kind, setKind] = useState<K>('month');
  const [offset, setOffset] = useState(0);

  const d = useMemo(() => {
    const T = today();
    const range = periodRange(kind, T, offset);
    const prev = prevRange(kind, range);
    const rate = attendanceRate(db, range, branch) ?? 0;
    const prevRate = attendanceRate(db, prev, branch) ?? 0;
    const bars = buckets(t, kind, range).map((b) => ({
      label: b.label, value: (attendanceRate(db, b.range, branch) ?? 0) * 100,
      color: inRange(T, b.range) ? C.accent : C.dim,
    }));

    const spars = new Map(db.sparrings.filter((x) => branch === 'all' || x.branchId === branch).map((x) => [x.id, x]));
    const bouts = new Map(db.bouts.filter((b) => spars.has(b.sparringId)).map((b) => [b.id, b]));
    let light = 0, hard = 0;
    db.rounds.forEach((r) => {
      const b = bouts.get(r.boutId);
      if (b && inRange(r.date, range)) b.type === 'hard' ? hard++ : light++;
    });

    const sessions = sessionDays(db, range, branch).size;
    const weeks = Math.max(1, Math.round((Math.min(diffDays(range.to, range.from), diffDays(T, range.from)) + 1) / 7));
    const roster = playersIn(db, branch);
    const newPlayers = roster.filter((p) => inRange(p.joinedAt, range)).length;
    const seenPrev = new Set(db.attendance.filter((a) => inRange(a.date, prev)).map((a) => a.playerId));
    const seenNow = new Set(db.attendance.filter((a) => inRange(a.date, range)).map((a) => a.playerId));
    const dropped = roster.filter((p) => seenPrev.has(p.id) && !seenNow.has(p.id)).length;

    const top = roster
      .map((p) => ({ p, ...efficiency(db, p.id, range, prev, branch) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return { range, rate, delta: Math.round((rate - prevRate) * 100), bars, light, hard, sessions, perWeek: Math.round(sessions / weeks), newPlayers, dropped, top };
  }, [db, branch, kind, offset, lang]);

  const where = branch === 'all' ? t('كل الفروع', 'All branches') : t(`فرع ${branchName(branch)}`, branchName(branch));

  return (
    <Screen nav gap={14}>
      <View style={s.rowBetween}>
        <Txt size={28} w={700}>{t('التقارير', 'Reports')}</Txt>
        <OutlineBtn h={40} icon="download" label="PDF" color={C.text} onPress={() => notify(t('تصدير PDF بعد الـ MVP', 'PDF export comes after the MVP'))} />
      </View>

      <Segmented<K> value={kind} onChange={(k) => { setKind(k); setOffset(0); }}
        options={[{ key: 'week', label: t('أسبوعي', 'Weekly') }, { key: 'month', label: t('شهري', 'Monthly') }, { key: 'year', label: t('سنوي', 'Yearly') }]} />

      <View style={s.rowBetween}>
        <IconBtn icon="prev" size={40} label={t('الفترة اللي فاتت', 'Previous period')} onPress={() => setOffset((o) => o - 1)} />
        <Txt size={14} w={500}>{periodLabel(kind, d.range)} · {where}</Txt>
        <IconBtn icon="next" size={40} label={t('الفترة الجاية', 'Next period')} onPress={() => setOffset((o) => Math.min(0, o + 1))} />
      </View>

      <Card radius={26} style={{ gap: 12 }}>
        <View style={[s.rowBetween, { alignItems: 'flex-start' }]}>
          <View style={{ gap: 4 }}>
            <Txt size={12} color={C.muted}>{t('نسبة الحضور', 'Attendance')}</Txt>
            <Txt size={32} w={700} style={{ lineHeight: 38 }}>{Math.round(d.rate * 100)}%</Txt>
          </View>
          <Badge label={`${d.delta >= 0 ? '↑' : '↓'} ${Math.abs(d.delta)}% ${t('عن', 'vs')} ${prevLabel(kind)}`} color={d.delta >= 0 ? C.accent : C.danger} />
        </View>
        <Bars data={d.bars} height={96} />
      </Card>

      <View style={[s.row, { gap: 10 }]}>
        <Mini label={t('جولات', 'Rounds')} value={d.light + d.hard} sub={t(`${d.light} لايت · ${d.hard} هارد`, `${d.light} light · ${d.hard} hard`)} />
        <Mini label={t('حصص', 'Sessions')} value={d.sessions} sub={t(`${d.perWeek} في الأسبوع`, `${d.perWeek} per week`)} />
        <Mini label={t('لاعبين جداد', 'New players')} value={d.newPlayers} sub={t(`${d.dropped} انقطعوا`, `${d.dropped} dropped`)} />
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title={t('أعلى كفاءة', 'Top performers')} right={<Txt size={11} color={C.muted}>{t('من 100 · حضور 40 · تحسّن 35 · فوز 25', 'of 100 · att 40 · progress 35 · wins 25')}</Txt>} />
        {d.top.map((x, i) => (
          <Press key={x.p.id} onPress={() => router.push(`/player/${x.p.id}`)}
            style={[s.row, { backgroundColor: C.surface, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14, gap: 12 }]}>
            <View style={[s.center, { width: 28, height: 28, borderRadius: 14, backgroundColor: i === 0 ? C.accent : C.surface2 }]}>
              <Txt size={13} w={700} color={i === 0 ? C.bg : C.text}>{i + 1}</Txt>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={14} w={500}>{nm(x.p)}</Txt>
              <Txt size={11} color={C.muted}>{t(`حضور ${Math.round(x.att * 100)}% · فوز ${Math.round(x.wr * 100)}%`, `Attendance ${Math.round(x.att * 100)}% · wins ${Math.round(x.wr * 100)}%`)}</Txt>
            </View>
            <Txt size={20} w={700} color={C.accent}>{x.score}</Txt>
          </Press>
        ))}
      </View>
    </Screen>
  );
}

function Mini({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: 20, padding: 12, gap: 4 }}>
      <Txt size={11} color={C.muted}>{label}</Txt>
      <Txt size={20} w={700}>{value}</Txt>
      <Txt size={10} color={C.muted} numberOfLines={1}>{sub}</Txt>
    </View>
  );
}
