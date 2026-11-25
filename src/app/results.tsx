import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { BigButton, Card, Header, OutlineBtn, Press, Screen, Txt, s } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { COACH } from '@/data/seed';
import { notify, useDB, useExercises, useStore } from '@/data/store';
import { nm, plural, useT } from '@/i18n';
import { dayFull, dayMonth, mmss, satIndex, timeNow, today } from '@/logic/dates';
import { exerciseSum, player, presentOn, thisWeek } from '@/logic/queries';
import { C } from '@/theme';

/** Assign the counted / timed exercise to everyone the coach checked in today (SPEC 4.4). */
export default function Results() {
  const t = useT();
  const db = useDB();
  const exercises = useExercises();
  const branch = useStore((st) => st.branch);
  const pw = useStore((st) => st.pendingWorkout);
  const e = exercises.find((x) => x.id === pw?.exerciseId);

  const people = useMemo(() => {
    const present = [...presentOn(db, today(), branch).keys()].map((id) => player(db, id)!).filter(Boolean);
    return present.map((p) => ({ p, week: pw ? exerciseSum(db, p.id, pw.exerciseId, thisWeek()) : { reps: 0, seconds: 0 } }));
  }, [db, branch, pw]);

  const [on, setOn] = useState<Record<string, boolean>>({});
  const [v, setV] = useState<Record<string, number>>({});

  if (!pw || !e) {
    return <Screen><Header title={t('وزّع على اللاعبين', 'Assign to players')} /><Txt color={C.muted}>{t('مفيش تمرين متعدّ. ارجع للتمرين.', 'Nothing counted yet. Go back to the workout.')}</Txt></Screen>;
  }

  const isCount = pw.mode === 'count';
  const step = isCount ? 1 : 15;
  const isOn = (id: string) => on[id] ?? true;
  const val = (id: string) => v[id] ?? pw.value;
  const chosen = people.filter((x) => isOn(x.p.id));
  const total = chosen.reduce((a, x) => a + val(x.p.id), 0);
  const allOn = chosen.length === people.length;
  const fmt = (n: number) => (isCount ? String(n) : mmss(n));

  const save = () => {
    if (!chosen.length) return notify(t('اختار لاعب واحد على الأقل', 'Select at least one player'));
    const st = useStore.getState();
    const T = today();
    const sessionId = st.local.sessions.find((x) => x.date === T)?.id
      ?? st.append('sessions', [{ branchId: branch === 'all' ? st.branches[0].id : branch, coachId: COACH.id, date: T }])[0];
    st.append('results', chosen.map((x) => ({
      sessionId, playerId: x.p.id, exerciseId: e.id, mode: pw.mode, date: T,
      ...(isCount ? { reps: val(x.p.id) } : { seconds: val(x.p.id) }),
    })));
    st.set({ pendingWorkout: null });
    notify(t(`اتسجّل ${nm(e)} لـ ${chosen.length} لاعب`, `Saved ${nm(e)} for ${plural(chosen.length, 'player')}`));
    router.back();
  };

  const totalTxt = isCount ? t(`${total} عدّة`, `${total} reps`) : t(`${Math.round(total / 60)} دقيقة`, `${Math.round(total / 60)} min`);

  return (
    <Screen gap={14} footer={
      <>
        <Txt size={12} color={C.muted} center>
          {t(`هيتسجّل في تقرير ${chosen.length} لاعبين · إجمالي ${totalTxt}`, `Goes into ${plural(chosen.length, 'player')}' reports · total ${totalTxt}`)}
        </Txt>
        <BigButton label={t('حفظ · التمرين التالي', 'Save · next exercise')} onPress={save} />
      </>
    }>
      <Header title={t('وزّع على اللاعبين', 'Assign to players')} />

      <Card accent radius={24} style={[s.row, { gap: 12 }]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt size={12} color={C.bg}>{isCount ? t('التمرين اللي اتعدّ', 'Counted exercise') : t('التمرين اللي اتعمل', 'Timed exercise')}</Txt>
          <Txt size={24} w={700} color={C.bg}>{nm(e)} · {isCount ? t(`${pw.value} عدّة`, `${pw.value} reps`) : mmss(pw.value)}</Txt>
          <Txt size={11} color={C.bg}>{dayFull(satIndex(today()))} {dayMonth(today())} · {timeNow()}</Txt>
        </View>
        <Icon name="check" size={40} color={C.bg} stroke={1.6} />
      </Card>

      <View style={s.rowBetween}>
        <Txt size={13} color={C.text2}>{t(`الحاضرين النهارده · ${chosen.length} من ${people.length}`, `Checked in today · ${chosen.length} of ${people.length}`)}</Txt>
        {people.length ? (
          <OutlineBtn h={34} label={allOn ? t('شيل الكل', 'Clear all') : t('اختار الكل', 'Select all')}
            onPress={() => setOn(Object.fromEntries(people.map((x) => [x.p.id, !allOn])))} />
        ) : null}
      </View>

      {people.length === 0 ? (
        <Card style={{ gap: 12 }}>
          <Txt size={13} color={C.muted}>{t('مفيش حد متسجّل حضوره النهارده. سجّل الحضور الأول وهيتوزّع عليهم تلقائي.', 'No one is checked in today. Check players in and the exercise is assigned to them automatically.')}</Txt>
          <OutlineBtn label={t('تسجيل حضور', 'Check in players')} icon="qr" onPress={() => router.push('/attendance')} />
        </Card>
      ) : null}

      <View style={{ gap: 8 }}>
        {people.map(({ p, week }) => {
          const o = isOn(p.id), n = val(p.id);
          const wk = (isCount ? week.reps : Math.round(week.seconds / 60)) + (o ? (isCount ? n : Math.round(n / 60)) : 0);
          return (
            <View key={p.id} style={[s.row, { backgroundColor: C.surface, borderRadius: 20, paddingVertical: 8, paddingStart: 8, paddingEnd: 10, gap: 10, opacity: o ? 1 : 0.55 }]}>
              <Press accessibilityLabel={nm(p)} onPress={() => setOn({ ...on, [p.id]: !o })} style={[s.center, { width: 44, height: 44 }]}>
                <View style={[s.center, { width: 26, height: 26, borderRadius: 9, backgroundColor: o ? C.accent : 'transparent', borderWidth: o ? 0 : 2, borderColor: C.off }]}>
                  {o ? <Icon name="check" size={16} color={C.bg} stroke={3} /> : null}
                </View>
              </Press>
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <Txt size={14} w={500} numberOfLines={1}>{nm(p)}</Txt>
                <Txt size={11} color={C.muted}>{t('الأسبوع ده:', 'This week:')} {wk} {isCount ? t('عدّة', 'reps') : t('دقيقة', 'min')}</Txt>
              </View>
              <Press accessibilityLabel="−" disabled={!o} onPress={() => setV({ ...v, [p.id]: Math.max(0, n - step) })}
                style={[s.center, { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface2 }]}><Txt size={18}>−</Txt></Press>
              <Txt size={isCount ? 20 : 15} w={700} ltr center style={{ minWidth: isCount ? 34 : 50 }}
                color={o && n < pw.value ? C.danger : C.text}>{o ? fmt(n) : '–'}</Txt>
              <Press accessibilityLabel="+" disabled={!o} onPress={() => setV({ ...v, [p.id]: n + step })}
                style={[s.center, { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface2 }]}><Txt size={18}>+</Txt></Press>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
