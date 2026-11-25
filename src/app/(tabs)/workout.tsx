import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Card, Field, Header, IconBtn, OutlineBtn, Press, Pulse, Ring, Screen, Segmented, Stepper, Txt, s } from '@/components/ui';
import { planIntervals, useBackgroundCues } from '@/logic/timerBackground';
import { Icon } from '@/components/Icon';
import { KeepAwake } from '@/components/Toast';
import { notify, uid, useDB, useExercises, useStore } from '@/data/store';
import type { Mode } from '@/data/types';
import { nm, useT } from '@/i18n';
import { mmss, today } from '@/logic/dates';
import { presentOn } from '@/logic/queries';
import { roundCues, tap, useSounds, useTicker } from '@/logic/useSounds';
import { C } from '@/theme';

type Phase = 'idle' | 'work' | 'rest' | 'done';

export default function Workout() {
  const t = useT();
  const db = useDB();
  const exercises = useExercises();
  const branch = useStore((st) => st.branch);
  const sound = useStore((st) => st.sound);
  const cfg = useStore((st) => st.interval);
  const play = useSounds();

  const [ex, setEx] = useState(0);
  const e = exercises[Math.min(ex, exercises.length - 1)];
  const [mode, setMode] = useState<Mode>(e.mode);
  const [count, setCount] = useState(0);
  const [workSec, setWorkSec] = useState(e.seconds);
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(1);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [leftMs, setLeftMs] = useState(e.seconds * 1000);
  const [settings, setSettings] = useState(false);
  const [adding, setAdding] = useState(false);
  const lastSec = useRef(-1);

  const running = endsAt !== null;
  useTicker(running, 200);
  useBackgroundCues(() => (running && (phase === 'work' || phase === 'rest') && endsAt
    ? planIntervals({ phase, endsAt, round, rounds: cfg.rounds, workSec, restSec: cfg.restSec })
    : []));
  const left = running ? Math.max(0, endsAt! - Date.now()) : leftMs;
  const leftSec = Math.ceil(left / 1000);
  const phaseTotal = (phase === 'rest' ? cfg.restSec : workSec) * 1000;
  const present = presentOn(db, today(), branch).size;

  const workDone = () => {
    const finished = (round - 1) * workSec;
    if (phase === 'work') return finished + Math.round((workSec * 1000 - left) / 1000);
    if (phase === 'rest' || phase === 'done') return round * workSec;
    return 0;
  };

  const goDistribute = (value: number) => {
    if (!value) return notify(mode === 'count' ? t('عدّ الأول قبل التوزيع', 'Count first, then assign') : t('شغّل التايمر الأول', 'Start the timer first'));
    useStore.getState().set({ pendingWorkout: { exerciseId: e.id, mode, value, at: Date.now() } });
    setEndsAt(null);
    router.push('/results');
  };

  // interval engine: work → rest → work … → done (auto-assign)
  useEffect(() => {
    if (!running || leftSec === lastSec.current) return;
    const prev = lastSec.current;
    lastSec.current = leftSec;
    if (leftSec > 0) {
      if (phase === 'work' && prev > 0) roundCues(prev, leftSec, workSec);
      return;
    }
    if (phase === 'work' && round < cfg.rounds && cfg.restSec > 0) {
      play('round_end'); setPhase('rest'); setEndsAt(Date.now() + cfg.restSec * 1000);
    } else if (phase === 'work' && round < cfg.rounds) {
      play('round_start'); setRound(round + 1); setEndsAt(Date.now() + workSec * 1000);
    } else if (phase === 'rest') {
      play('rest_end'); setRound(round + 1); setPhase('work'); setEndsAt(Date.now() + workSec * 1000);
    } else {
      play('round_end'); setPhase('done'); setEndsAt(null); setLeftMs(0);
      const total = cfg.rounds * workSec;
      setTimeout(() => goDistribute(total), 1200);
    }
  });

  const reset = (sec = workSec) => {
    setCount(0); setEndsAt(null); setPhase('idle'); setRound(1); setLeftMs(sec * 1000); lastSec.current = -1;
  };
  const pick = (i: number) => {
    const x = exercises[i];
    setEx(i); setMode(x.mode); setWorkSec(x.seconds); reset(x.seconds);
  };
  const toggleTimer = () => {
    if (running) { setLeftMs(left); setEndsAt(null); return; }
    if (phase === 'done') return reset();
    if (phase === 'idle') { play('round_start'); setPhase('work'); }
    setEndsAt(Date.now() + leftMs);
  };
  const setCfg = (p: Partial<typeof cfg>) => useStore.getState().set({ interval: { ...cfg, ...p } });

  const isCount = mode === 'count';
  const target = e.target || 30;
  const pct = isCount ? Math.min(100, (count / target) * 100) : phase === 'done' ? 100 : ((phaseTotal - left) / phaseTotal) * 100;
  const warn = !isCount && phase === 'work' && leftSec <= 10 && leftSec > 0;
  const ringColor = warn ? C.danger : phase === 'rest' ? C.blue : C.accent;
  const big = isCount ? String(count) : mmss(phase === 'idle' ? workSec : leftSec);
  const top = isCount || cfg.rounds === 1 ? nm(e) : phase === 'rest' ? t('راحة', 'Rest') : t(`الجولة ${round} من ${cfg.rounds}`, `Round ${round} of ${cfg.rounds}`);
  const sub = isCount
    ? t(`الهدف ${target} · اضغط للعدّ`, `Target ${target} · tap to count`)
    : phase === 'done' ? t('خلص · بيوزّع على الحاضرين', 'Done · assigning to players') : warn ? t('آخر 10 ثواني!', 'Last 10 seconds!') : phase === 'rest' ? t('الجولة الجاية قربت', 'Next round soon') : t('متبقي', 'remaining');

  return (
    <Screen nav gap={14} footer={
      <Press onPress={() => goDistribute(isCount ? count : workDone())} accessibilityRole="button"
        style={[s.row, { height: 56, borderRadius: 28, backgroundColor: C.text, justifyContent: 'center', gap: 8 }]}>
        <Icon name="usersCheck" size={18} color={C.bg} stroke={2} />
        <Txt size={15} w={600} color={C.bg}>{t(`وزّع ${nm(e)} على الحاضرين`, `Assign ${nm(e)} to players`)}</Txt>
      </Press>
    }>
      {running ? <KeepAwake /> : null}
      <Header title={t('تمرين الحصة', "Today's workout")} sub={t(`${present} لاعب حاضر`, `${present} players here`)}
        right={<IconBtn icon={sound ? 'sound' : 'mute'} label={t('الصوت', 'Sound')} onPress={() => useStore.getState().set({ sound: !sound })} />} />

      <View style={s.rowBetween}>
        <Txt size={15} w={600}>{t('اختار التمرين', 'Pick an exercise')}</Txt>
        <OutlineBtn h={32} label={adding ? t('إلغاء', 'Cancel') : t('+ تمرين جديد', '+ New exercise')} onPress={() => setAdding((a) => !a)} />
      </View>

      {adding ? <AddExercise onDone={() => setAdding(false)} /> : null}

      <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
        {exercises.map((x, i) => {
          const on = i === ex;
          return (
            <Press key={x.id} onPress={() => pick(i)} accessibilityState={{ selected: on }}
              style={[s.center, { width: '31.5%', flexGrow: 1, height: 60, borderRadius: 18, gap: 3, backgroundColor: on ? C.accent : C.surface }]}>
              <Txt size={14} w={600} color={on ? C.bg : C.text} numberOfLines={1}>{nm(x)}</Txt>
              <Txt size={10} color={on ? C.bg : C.text} style={{ opacity: 0.75 }}>{x.mode === 'count' ? t('بالعدد', 'Reps') : t('بالوقت', 'Timed')}</Txt>
            </Press>
          );
        })}
      </View>

      <Segmented<Mode> h={38} value={mode} onChange={(m) => { setMode(m); reset(); }}
        options={[{ key: 'count', label: t('بالعدد', 'Reps') }, { key: 'time', label: t('بالوقت', 'Timed') }]} />

      {!isCount ? (
        <Card style={{ gap: 12, paddingVertical: 12 }}>
          <Press onPress={() => setSettings((x) => !x)} style={s.rowBetween}>
            <View style={[s.row, { gap: 8 }]}>
              <Icon name="sliders" size={18} color={C.accent} />
              <Txt size={13} w={500}>
                {t(`${cfg.rounds} × ${mmss(workSec)} · راحة ${mmss(cfg.restSec)}`, `${cfg.rounds} × ${mmss(workSec)} · rest ${mmss(cfg.restSec)}`)}
              </Txt>
            </View>
            <Txt size={12} color={C.accent}>{settings ? t('تم', 'Done') : t('ظبط', 'Edit')}</Txt>
          </Press>
          {settings ? (
            <View pointerEvents={phase === 'idle' ? 'auto' : 'none'} style={{ gap: 12, opacity: phase === 'idle' ? 1 : 0.5 }}>
              <Stepper label={t('وقت الجولة', 'Work time')} value={workSec / 15} min={1} max={40} fmt={(v) => mmss(v * 15)}
                onChange={(v) => { setWorkSec(v * 15); setLeftMs(v * 15000); }} />
              <Stepper label={t('عدد الجولات', 'Rounds')} value={cfg.rounds} min={1} max={20} onChange={(v) => setCfg({ rounds: v })} />
              <Stepper label={t('الراحة', 'Rest')} value={cfg.restSec / 15} min={0} max={20} fmt={(v) => (v ? mmss(v * 15) : t('من غير', 'None'))}
                onChange={(v) => setCfg({ restSec: v * 15 })} />
              <Txt size={11} color={C.muted}>{t('التايمر بيلف لوحده جولة وراحة، وفي الآخر بيوزّع على الحاضرين', 'Runs work and rest on its own, then assigns to everyone checked in')}</Txt>
            </View>
          ) : null}
        </Card>
      ) : null}

      <View style={{ alignItems: 'center' }}>
        <Press accessibilityLabel={isCount ? t('زود عدّة', 'Add a rep') : t('تشغيل التايمر', 'Start timer')}
          onPress={() => { if (isCount) { tap(); setCount((c) => c + 1); } else toggleTimer(); }}>
          <Pulse active={warn}>
          <Ring size={200} thickness={11} pct={pct} color={ringColor}>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Txt size={13} color={phase === 'rest' ? C.blue : C.text2}>{top}</Txt>
              <Txt size={52} w={600} ltr style={{ lineHeight: 60 }} color={warn ? C.danger : C.text}>{big}</Txt>
              <Txt size={11} color={warn ? C.danger : C.muted}>{sub}</Txt>
            </View>
          </Ring>
          </Pulse>
        </Press>
      </View>

      {!isCount && cfg.rounds > 1 ? (
        <View style={[s.row, { justifyContent: 'center', gap: 6 }]}>
          {Array.from({ length: cfg.rounds }, (_, i) => (
            <View key={i} style={{ width: 22, height: 6, borderRadius: 3, backgroundColor: i < round - (phase === 'work' || phase === 'idle' ? 1 : 0) || phase === 'done' ? C.accent : i === round - 1 && phase === 'work' ? C.text2 : C.surface2 }} />
          ))}
        </View>
      ) : null}

      <View style={[s.row, { justifyContent: 'center', gap: 24 }]}>
        <Press accessibilityLabel={t('ناقص واحد', 'Minus one')} disabled={!isCount}
          onPress={() => setCount((c) => Math.max(0, c - 1))}
          style={[s.center, { width: 52, height: 52, borderRadius: 26, backgroundColor: C.surface }]}>
          <Txt size={22}>−</Txt>
        </Press>
        <Press accessibilityLabel={t('تشغيل أو إيقاف', 'Play or pause')} onPress={isCount ? () => { tap(); setCount((c) => c + 1); } : toggleTimer}
          style={[s.center, { width: 64, height: 64, borderRadius: 32, backgroundColor: C.accent }]}>
          {isCount ? <Icon name="plus" size={26} color={C.bg} stroke={2.4} /> : <Icon name={running ? 'pause' : 'play'} size={24} color={C.bg} />}
        </Press>
        <Press accessibilityLabel={t('إعادة', 'Reset')} onPress={() => reset()}
          style={[s.center, { width: 52, height: 52, borderRadius: 26, backgroundColor: C.surface }]}>
          <Icon name="reset" size={20} stroke={2} />
        </Press>
      </View>
    </Screen>
  );
}

function AddExercise({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<Mode>('count');
  const [n, setN] = useState('30');
  const save = () => {
    if (!name.trim()) return;
    const v = Math.max(1, parseInt(n, 10) || 0);
    const st = useStore.getState();
    st.set({
      customExercises: [...st.customExercises, {
        id: uid('ex'), name: name.trim(), mode, custom: true, target: mode === 'count' ? v : 0, seconds: mode === 'time' ? v : 60,
      }],
    });
    notify(t(`اتضاف ${name.trim()}`, `Added ${name.trim()}`));
    onDone();
  };
  return (
    <Card style={{ gap: 10 }}>
      <Field value={name} onChangeText={setName} placeholder={t('اسم التمرين', 'Exercise name')} />
      <Segmented<Mode> h={34} value={mode} onChange={setMode} options={[{ key: 'count', label: t('بالعدد', 'Reps') }, { key: 'time', label: t('بالوقت', 'Timed') }]} />
      <View style={[s.row, { gap: 10 }]}>
        <Field value={n} onChangeText={setN} keyboardType="number-pad" style={{ flex: 1 }} />
        <Txt size={12} color={C.muted}>{mode === 'count' ? t('عدّة هدف', 'target reps') : t('ثانية', 'seconds')}</Txt>
        <OutlineBtn label={t('حفظ', 'Save')} onPress={save} />
      </View>
    </Card>
  );
}
