import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, Badge, Bars, Card, Dot, Header, IconBtn, OutlineBtn, Press, Screen, SectionTitle, Segmented, Txt, s } from '@/components/ui';
import { PACKAGES } from '@/data/seed';
import { notify, useDB, useExercises, useStore } from '@/data/store';
import { nm, useT } from '@/i18n';
import {
  PeriodKind, addDays, dayMonth, daysShort, fullDate, monthShort, months, monthsBetween, parse, periodLabel, periodRange, prevLabel, prevRange, today, weekStart,
} from '@/logic/dates';
import {
  PAY_COLOR, attendedDays, bestResult, branchName, branchOf, deltaColor, deltaText, exerciseSum, firstName, headToHead, initials,
  levelName, levelOf, monthlyAverages, payLabel, payLine, payStatus, pct, player, pname, roundStats, thisWeek, timeline, weightOf, winRate,
} from '@/logic/queries';
import { whatsapp } from '@/logic/whatsapp';
import { C } from '@/theme';

const TOTAL_EX = ['e1', 'e2', 'e3', 'e6', 'e4', 'e5'];

export default function Profile() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDB();
  const exercises = useExercises();
  const lang = useStore((st) => st.lang);
  const [kind, setKind] = useState<PeriodKind>('month');
  const [menu, setMenu] = useState(false);
  const p = player(db, id);

  const d = useMemo(() => {
    if (!p) return null;
    const T = today();
    const range = periodRange(kind, T);
    const prev = prevRange(kind, range);
    const week = thisWeek();
    const att = attendedDays(db, p.id, week);
    const ws = weekStart(T);
    const days = daysShort().map((n, i) => {
      const date = addDays(ws, i);
      return { n, num: parse(date).getDate(), came: att.has(date), isToday: date === T };
    });
    const rs = roundStats(db, p.id, range), rsPrev = roundStats(db, p.id, prev);
    const all = roundStats(db, p.id, { from: '2000-01-01', to: T });
    const avg = monthlyAverages(db, p.id, 'e1', 6);
    const best = bestResult(db, p.id, 'e1');
    const lastTwo = avg.filter((x) => x.avg).slice(-2);
    const trend = lastTwo.length === 2 ? pct(lastTwo[1].avg, lastTwo[0].avg) : 0;
    const totals = TOTAL_EX.map((eid) => {
      const ex = exercises.find((e) => e.id === eid)!;
      const val = (r: { from: string; to: string }) => {
        const x = exerciseSum(db, p.id, eid, r);
        return ex.mode === 'count' ? x.reps : Math.round(x.seconds / 60);
      };
      const cur = val(range);
      return { name: nm(ex), count: ex.mode === 'count', cur, today: val({ from: T, to: T }), week: val(week), delta: pct(cur, val(prev)) };
    });
    return {
      range, rs, rsPrev, all, days, avg, best, trend, totals,
      h2h: headToHead(db, p.id).slice(0, 3),
      log: timeline(db, p.id, (eid) => nm(exercises.find((e) => e.id === eid))),
      weight: weightOf(db, p.id), level: levelOf(db, p.id), branch: branchOf(db, p.id),
      months: monthsBetween(p.joinedAt, T), pay: payStatus(db, p.id),
    };
  }, [db, p, kind, exercises, lang]);

  if (!p || !d) return <Screen><Header title={t('ملف اللاعب', 'Player profile')} /><Txt color={C.muted}>{t('اللاعب مش موجود', 'Player not found')}</Txt></Screen>;

  const name = nm(p);
  const recordPayment = () => {
    const st = useStore.getState();
    const pk = PACKAGES[0];
    const start = d.pay.end && d.pay.end >= today() ? addDays(d.pay.end, 1) : today();
    const [sid] = st.append('subscriptions', [{ playerId: p.id, packageId: pk.id, startDate: start, endDate: addDays(start, 30) }]);
    st.append('payments', [{ playerId: p.id, subscriptionId: sid, amount: pk.price, date: today(), method: 'cash' }]);
    setMenu(false);
    notify(t(`اتسجّل دفع ${pk.price} جنيه لـ ${firstName(name)}`, `Recorded EGP ${pk.price} for ${firstName(name)}`));
  };

  const rsDiff = d.rs.total - d.rsPrev.total;
  const periodName = kind === 'month' ? months()[parse(d.range.from).getMonth()] : periodLabel(kind, d.range);
  const unit = (count: boolean) => (count ? t('عدّة', 'reps') : t('دقيقة', 'min'));

  return (
    <Screen gap={18}>
      <Header title={t('ملف اللاعب', 'Player profile')} right={<IconBtn icon="dots" label={t('خيارات', 'Options')} onPress={() => setMenu((m) => !m)} />} />

      {menu ? (
        <Card style={{ gap: 10 }}>
          <View style={s.rowBetween}>
            <Txt size={13} color={C.text2}>{t('الاشتراك:', 'Subscription:')} <Txt size={13} color={PAY_COLOR[d.pay.kind]}>{payLine(d.pay)}</Txt></Txt>
            {d.pay.end ? <Txt size={11} color={C.muted}>{t('لحد', 'until')} {dayMonth(d.pay.end)}</Txt> : null}
          </View>
          <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
            <OutlineBtn label={t(`سجّل دفع شهر · ${PACKAGES[0].price} ج`, `Record 1 month · EGP ${PACKAGES[0].price}`)} onPress={recordPayment} />
            <OutlineBtn label={t('تذكير واتساب', 'WhatsApp reminder')} color={C.text2} onPress={() => whatsapp(p.phone, name, payLine(d.pay))} />
            <OutlineBtn icon="edit" label={t('تعديل البيانات', 'Edit details')} color={C.text2} onPress={() => { setMenu(false); router.push({ pathname: '/add-player', params: { id: p.id } }); }} />
          </View>
        </Card>
      ) : null}

      <View style={{ alignItems: 'center', gap: 6 }}>
        <Avatar ini={initials(name)} uri={p.photoUri} size={80} ring />
        <Txt size={24} w={700}>{name}</Txt>
        <Txt size={12} color={C.muted} center>
          {t(`فرع ${branchName(d.branch)} · مستوى ${levelName(d.level)} · اشترك ${fullDate(p.joinedAt)}`, `${branchName(d.branch)} · ${levelName(d.level)} · joined ${fullDate(p.joinedAt)}`)}
        </Txt>
        {p.archived ? <Badge label={t('في الأرشيف', 'Archived')} color={C.muted} /> : <Badge label={payLabel(d.pay.kind)} color={PAY_COLOR[d.pay.kind]} />}
      </View>

      <View style={[s.row, { paddingVertical: 4 }]}>
        <Stat value={`${Math.round(winRate(d.all) * 100)}%`} label={t('نسبة الفوز', 'Win rate')} accent border />
        <Stat value={`${d.weight}`} unit={t(' كجم', ' kg')} label={t('الوزن', 'Weight')} border />
        <Stat value={`${d.months}`} unit={t(' شهر', ' mo')} label={t('بقاله معانا', 'With us')} />
      </View>

      <Segmented<PeriodKind> value={kind} onChange={setKind}
        options={[{ key: 'week', label: t('الأسبوع', 'Week') }, { key: 'month', label: t('الشهر', 'Month') }, { key: 'year', label: t('السنة', 'Year') }, { key: 'custom', label: t('3 شهور', '3 months') }]} />

      <View style={[s.row, { gap: 6 }]}>
        {d.days.map((x) => (
          <View key={x.n} style={{
            flex: 1, backgroundColor: C.surface, borderRadius: 14, paddingVertical: 8, alignItems: 'center', gap: 4,
            borderWidth: 1.5, borderColor: x.isToday ? C.accent : 'transparent',
          }}>
            <Dot size={6} color={x.came ? C.accent : C.border} />
            <Txt size={10} color={C.muted}>{x.n}</Txt>
            <Txt size={14} w={500}>{x.num}</Txt>
          </View>
        ))}
      </View>

      {/* Rounds */}
      <Card radius={26} pad={18} style={{ gap: 14 }}>
        <View style={s.rowBetween}>
          <Txt size={15} w={600}>{t('الجولات', 'Rounds')} · {periodName}</Txt>
          <Txt size={12} color={C.muted}>{t(`${d.rs.light} لايت · ${d.rs.hard} هارد`, `${d.rs.light} light · ${d.rs.hard} hard`)}</Txt>
        </View>
        <View style={[s.row, { alignItems: 'baseline', gap: 8 }]}>
          <Txt size={40} w={700} style={{ lineHeight: 46 }}>{d.rs.total}</Txt>
          <Txt size={13} color={C.muted}>{t('جولة', 'rounds')}</Txt>
          <View style={{ flex: 1 }} />
          <Txt size={12} color={rsDiff >= 0 ? C.accent : C.danger}>{rsDiff >= 0 ? '↑' : '↓'} {Math.abs(rsDiff)} {t('عن', 'vs')} {prevLabel(kind)}</Txt>
        </View>
        {d.rs.total ? (
          <View style={[s.row, { height: 12, gap: 3 }]}>
            {d.rs.win ? <View style={{ flex: d.rs.win, height: 12, borderRadius: 6, backgroundColor: C.accent }} /> : null}
            {d.rs.draw ? <View style={{ flex: d.rs.draw, height: 12, borderRadius: 6, backgroundColor: C.draw }} /> : null}
            {d.rs.loss ? <View style={{ flex: d.rs.loss, height: 12, borderRadius: 6, backgroundColor: C.danger }} /> : null}
          </View>
        ) : <View style={{ height: 12, borderRadius: 6, backgroundColor: C.track }} />}
        <View style={s.rowBetween}>
          <Legend color={C.accent} label={`${t('كسب', 'Won')} ${d.rs.win}`} />
          <Legend color={C.draw} label={`${t('تعادل', 'Draw')} ${d.rs.draw}`} />
          <Legend color={C.danger} label={`${t('خسارة', 'Lost')} ${d.rs.loss}`} />
        </View>
      </Card>

      {/* Push-up progress */}
      <Card accent radius={26} pad={18} style={{ gap: 14 }}>
        <View style={[s.rowBetween, { alignItems: 'flex-start' }]}>
          <View style={{ gap: 4 }}>
            <Txt size={15} w={600} color={C.bg}>{t('تطور الضغط', 'Push-up progress')}</Txt>
            <Txt size={12} color={C.bg}>{t('متوسط العدّة في الحصة', 'Average reps per session')}</Txt>
          </View>
          <View style={{ height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.bg, justifyContent: 'center' }}>
            <Txt size={12} w={600} color={C.accent}>{deltaText(d.trend)}</Txt>
          </View>
        </View>
        <Bars height={110} showValues
          data={d.avg.map((x, i) => ({ label: monthShort(x.m), value: x.avg, color: i === d.avg.length - 1 ? C.bg : 'rgba(11,12,10,.22)', text: C.bg }))} />
        {d.best ? <Txt size={12} w={500} color={C.bg}>{t(`أفضل رقم: ${d.best.reps} ضغطة · ${dayMonth(d.best.date)}`, `Best: ${d.best.reps} push-ups · ${dayMonth(d.best.date)}`)}</Txt> : null}
      </Card>

      {/* Exercise totals */}
      <View style={{ gap: 10 }}>
        <SectionTitle title={`${t('إجمالي التمارين', 'Exercise totals')} · ${periodName}`} right={<Txt size={11} color={C.muted}>{t('اليوم · الأسبوع · الفترة', 'Today · week · period')}</Txt>} />
        <View style={[s.row, { flexWrap: 'wrap', gap: 10 }]}>
          {d.totals.map((x) => (
            <View key={x.name} style={{ width: '48%', flexGrow: 1, backgroundColor: C.surface, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, gap: 4 }}>
              <View style={s.rowBetween}>
                <Txt size={12} color={C.muted}>{x.name}</Txt>
                <Txt size={10} color={deltaColor(x.delta)}>{deltaText(x.delta)}</Txt>
              </View>
              <Txt size={22} w={700}>{x.cur.toLocaleString('en-US')}<Txt size={11} color={C.muted}> {unit(x.count)}</Txt></Txt>
              <Txt size={10} color={C.muted}>{t('اليوم', 'Today')} {x.today} · {t('الأسبوع', 'Week')} {x.week}</Txt>
            </View>
          ))}
        </View>
      </View>

      {/* Head to head */}
      <View style={{ gap: 10 }}>
        <Txt size={16} w={600}>{t('مواجهات مباشرة', 'Head to head')}</Txt>
        {d.h2h.map((o) => {
          const opp = pname(db, o.opp);
          return (
            <View key={o.opp} style={[s.row, { backgroundColor: C.surface, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 14, gap: 12 }]}>
              <Avatar ini={initials(opp)} size={38} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt size={14} w={500}>{opp}</Txt>
                <Txt size={11} color={C.muted}>{t(`${o.rounds} جولات · آخر مرة ${dayMonth(o.last)}`, `${o.rounds} rounds · last ${dayMonth(o.last)}`)}</Txt>
              </View>
              <Txt size={16} w={700} ltr color={o.me >= o.them ? C.accent : C.danger}>{o.me} - {o.them}</Txt>
            </View>
          );
        })}
        {d.h2h.length === 0 ? <Txt size={13} color={C.muted}>{t('لسه ملعبش سبارينج', 'No sparring yet')}</Txt> : null}
      </View>

      {/* Timeline */}
      <View style={{ gap: 12 }}>
        <Txt size={16} w={600}>{t('السجل', 'Timeline')}</Txt>
        {d.log.map((l, i) => (
          <View key={i} style={[s.row, { gap: 12, alignItems: 'stretch' }]}>
            <View style={{ alignItems: 'center', gap: 4, paddingTop: 4 }}>
              <Dot size={10} color={l.c} />
              <View style={{ width: 2, flex: 1, backgroundColor: C.surface2 }} />
            </View>
            <View style={{ flex: 1, gap: 2, paddingBottom: 6 }}>
              <Txt size={11} color={C.muted}>{l.label}</Txt>
              <Txt size={13} style={{ lineHeight: 20 }}>{l.text}</Txt>
            </View>
          </View>
        ))}
        {d.log.length === 0 ? <Txt size={13} color={C.muted}>{t('لسه مفيش أحداث', 'Nothing recorded yet')}</Txt> : null}
      </View>
      <Press onPress={() => notify(t('ملاحظات الكابتن جاية قريب', 'Coach notes coming soon'))}><Txt size={12} color={C.muted} center>{t('+ إضافة ملاحظة', '+ Add note')}</Txt></Press>
    </Screen>
  );
}

function Stat({ value, unit, label, accent, border }: { value: string; unit?: string; label: string; accent?: boolean; border?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4, borderEndWidth: border ? 1 : 0, borderColor: C.surface2 }}>
      <Txt size={22} w={700} color={accent ? C.accent : C.text}>{value}{unit ? <Txt size={12}>{unit}</Txt> : null}</Txt>
      <Txt size={11} color={C.muted}>{label}</Txt>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={[s.row, { gap: 6 }]}><Dot color={color} /><Txt size={12}>{label}</Txt></View>;
}
