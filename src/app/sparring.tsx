import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { BigButton, Card, Header, IconBtn, OutlineBtn, Press, Pulse, Screen, Segmented, Stepper, Txt, s } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { KeepAwake } from '@/components/Toast';
import { useDB, useStore } from '@/data/store';
import type { SparType } from '@/data/types';
import { mmss, today } from '@/logic/dates';
import { firstName, pname, weightOf } from '@/logic/queries';
import { useT } from '@/i18n';
import { newSession, remaining, reshuffle, startPause, swapPlayers, useSparClock } from '@/logic/sparring';
import { C } from '@/theme';

/** Sparring: full rotation preview (a new opponent every round), round timer, winners per round. */
export default function Sparring() {
  const t = useT();
  const db = useDB();
  const branch = useStore((st) => st.branch);
  const sp = useSparClock();
  const [settings, setSettings] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [view, setView] = useState(0); // round tab being previewed (0-based)

  // fresh session each day / after finishing / when the branch changes before starting
  useEffect(() => {
    const cur = useStore.getState().spar;
    const stale = !cur || cur.phase === 'done' || cur.date !== today() || cur.participants.length === 0 ||
      (cur.scope !== branch && cur.phase === 'idle' && !Object.keys(cur.boutIds).length);
    if (stale) useStore.getState().set({ spar: newSession(db, branch, cur) });
  }, [branch]);

  // follow the live round
  useEffect(() => { if (sp) setView(sp.round - 1); }, [sp?.round, sp?.id]);

  if (!sp) return <Screen><Header title={t('سبارينج', 'Sparring')} /></Screen>;

  const started = sp.phase !== 'idle' || Object.keys(sp.boutIds).length > 0;
  const name = (id: string) => pname(db, id);
  const plan = sp.schedule[view] ?? { pairs: [], bye: null };
  const played = view < sp.round - 1 || (view === sp.round - 1 && sp.phase === 'done');
  // the live round can still be edited before its bell, or during the rest before it
  const editable = !played && (view > sp.round - 1 || sp.phase === 'idle' || sp.phase === 'rest');
  const pick = (id: string) => {
    if (!editable) return;
    if (!sel) return setSel(id);
    if (sel !== id) swapPlayers(db, sp, view, sel, id);
    setSel(null);
  };

  const leftSec = Math.ceil(remaining(sp) / 1000);
  const phaseLabel =
    sp.phase === 'rest' ? t(`راحة · الجولة ${sp.round} بعدها`, `Rest · round ${sp.round} next`) :
    sp.phase === 'await' ? t(`خلصت الجولة ${sp.round} · سجّل الفايز`, `Round ${sp.round} over · record winners`) :
    sp.phase === 'done' ? t('خلص السبارينج', 'Sparring finished') : t(`الجولة ${sp.round} من ${sp.rounds}`, `Round ${sp.round} of ${sp.rounds}`);
  const shown = sp.phase === 'idle' && !sp.running ? sp.roundSec : leftSec;
  const filled = sp.phase === 'idle' ? 0 : sp.phase === 'rest' ? sp.round - 1 : sp.phase === 'done' ? sp.rounds : sp.round;
  // last 10 seconds: the card turns orange and pulses
  const warn = sp.phase === 'round' && leftSec <= 10 && leftSec > 0 && sp.running;
  const flagged = sp.schedule.reduce((n, r) => n + r.pairs.filter((p) => p.warn).length, 0);

  if (sp.participants.length < 2) {
    return (
      <Screen>
        <Header title={t('سبارينج', 'Sparring')} />
        <Card><Txt size={14} color={C.text2}>{t('محتاج لاعبين اتنين على الأقل حاضرين النهارده. سجّل الحضور الأول.', 'Need at least two players checked in today. Check players in first.')}</Txt></Card>
        <BigButton label={t('تسجيل حضور', 'Check in players')} icon="qr" onPress={() => router.push('/attendance')} />
        <OutlineBtn label={t('تحديث', 'Refresh')} onPress={() => useStore.getState().set({ spar: newSession(db, branch, sp) })} />
      </Screen>
    );
  }

  return (
    <Screen gap={16} footer={
      sp.phase === 'done'
        ? <BigButton label={t('سبارينج جديد', 'New sparring')} onPress={() => useStore.getState().set({ spar: newSession(db, branch, sp) })} />
        : <BigButton light={sp.phase !== 'await'} label={t('نهاية الجولة · سجّل الفايز', 'End round · record winners')} onPress={() => {
            if (sp.running && sp.phase === 'round') startPause(sp);
            router.push('/winner');
          }} disabled={sp.phase === 'rest' || sp.phase === 'idle'} />
    }>
      {sp.running ? <KeepAwake /> : null}
      <Header title={t('سبارينج', 'Sparring')} right={<IconBtn icon="sliders" label={t('إعدادات الجولات', 'Round settings')} onPress={() => setSettings((x) => !x)} />} />

      <Segmented<SparType> h={40} value={sp.type}
        onChange={(k) => (started ? null : reshuffle(db, sp, { type: k }))}
        options={[{ key: 'light', label: t('لايت سبارينج', 'Light') }, { key: 'hard', label: t('هارد سبارينج', 'Hard') }]} />

      {settings ? (
        <Card style={{ gap: 12 }}>
          <Txt size={15} w={600}>{t('إعدادات الجولات', 'Round settings')}</Txt>
          {started ? <Txt size={11} color={C.muted}>{t('الإعدادات بتتقفل بعد ما السبارينج يبدأ', 'Settings lock once sparring starts')}</Txt> : null}
          <View pointerEvents={started ? 'none' : 'auto'} style={{ gap: 12, opacity: started ? 0.5 : 1 }}>
            <Stepper label={t('عدد الجولات', 'Rounds')} value={sp.rounds} min={1} max={12} onChange={(v) => reshuffle(db, sp, { rounds: v })} />
            <Stepper label={t('مدة الجولة', 'Round length')} value={sp.roundSec / 30} min={2} max={10} fmt={(v) => mmss(v * 30)}
              onChange={(v) => useStore.getState().patchSpar({ roundSec: v * 30, leftMs: v * 30000 })} />
            <Stepper label={t('الراحة', 'Rest')} value={sp.restSec / 15} min={2} max={12} fmt={(v) => mmss(v * 15)}
              onChange={(v) => useStore.getState().patchSpar({ restSec: v * 15 })} />
            <Stepper label={t('أقصى فرق وزن', 'Max weight gap')} value={sp.maxDiff} min={1} max={20} fmt={(v) => t(`${v} كجم`, `${v} kg`)}
              onChange={(v) => reshuffle(db, sp, { maxDiff: v })} />
          </View>
        </Card>
      ) : null}

      {/* Round timer hero */}
      <Pulse active={warn}>
        <Card accent radius={26} pad={18} style={[s.rowBetween, { paddingVertical: 16 }, warn && { backgroundColor: C.danger }]}>
          <View style={{ gap: 4 }}>
            <Txt size={13} w={500} color={C.bg}>{warn ? t('آخر 10 ثواني!', 'Last 10 seconds!') : phaseLabel}</Txt>
            <Txt size={44} w={700} ltr color={C.bg} style={{ lineHeight: 50 }}>{mmss(shown)}</Txt>
            <Txt size={11} color={C.bg}>{t(`جولة ${mmss(sp.roundSec)} · راحة ${mmss(sp.restSec)}`, `Round ${mmss(sp.roundSec)} · rest ${mmss(sp.restSec)}`)}</Txt>
          </View>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <View style={[s.row, { gap: 6 }]}>
              {Array.from({ length: sp.rounds }, (_, i) => (
                <View key={i} style={{ width: 12, height: 40, borderRadius: 6, backgroundColor: i < filled ? C.bg : 'rgba(11,12,10,.18)' }} />
              ))}
            </View>
            {sp.phase !== 'done' && sp.phase !== 'await' ? (
              <Press accessibilityLabel={sp.running ? t('إيقاف', 'Pause') : t('ابدأ', 'Start')} onPress={() => startPause(sp)}
                style={[s.center, { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg }]}>
                <Icon name={sp.running ? 'pause' : 'play'} size={20} color={warn ? C.danger : C.accent} />
              </Press>
            ) : null}
          </View>
        </Card>
      </Pulse>

      <View style={s.rowBetween}>
        <Txt size={15} w={600}>{t(`جدول الجولات · ${sp.participants.length} لاعبين`, `Round schedule · ${sp.participants.length} players`)}</Txt>
        {!started ? <OutlineBtn icon="shuffle" label={t('تقسيم جديد', 'Reshuffle')} onPress={() => { setSel(null); reshuffle(db, sp); }} /> : null}
      </View>

      {/* round tabs */}
      <View style={[s.row, { gap: 6, flexWrap: 'wrap' }]}>
        {sp.schedule.map((r, i) => {
          const on = i === view;
          const done = i < sp.round - 1 || (i === sp.round - 1 && sp.phase === 'done');
          const live = i === sp.round - 1 && !done;
          const warns = r.pairs.some((p) => p.warn);
          return (
            <Press key={i} onPress={() => { setView(i); setSel(null); }} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={[s.row, { height: 36, paddingHorizontal: 12, borderRadius: 18, gap: 6, backgroundColor: on ? C.text : C.surface, borderWidth: live && !on ? 1.5 : 0, borderColor: C.accent }]}>
              {done ? <Icon name="check" size={12} color={on ? C.bg : C.accent} stroke={3} /> : null}
              <Txt size={12} w={on ? 600 : 400} color={on ? C.bg : C.text2}>{t(`الجولة ${i + 1}`, `Round ${i + 1}`)}</Txt>
              {warns ? <Txt size={11} color={on ? C.bg : C.warning}>⚠️</Txt> : null}
            </Press>
          );
        })}
      </View>
      <Txt size={11} color={C.muted} style={{ marginTop: -8 }}>
        {!editable
          ? played ? t('الجولة دي اتلعبت', 'This round has been played') : t('الجولة شغالة دلوقتي', 'This round is in progress')
          : sel ? t(`اختار اللاعب اللي هيتبدّل مع ${firstName(name(sel))}`, `Pick who swaps with ${firstName(name(sel))}`)
          : t('كل لاعب بيقابل حد مختلف كل جولة. دوس على لاعبين علشان تبدّلهم', 'A different opponent every round. Tap two players to swap them')}
      </Txt>
      {flagged && !started ? (
        <Txt size={11} color={C.warning} style={{ marginTop: -6 }}>
          {t(`⚠️ ${flagged} ثنائي مش مثالي (تكرار أو وزن). جرّب "تقسيم جديد" أو زوّد فرق الوزن`, `⚠️ ${flagged} pair(s) not ideal (repeat or weight). Try "Reshuffle" or raise the weight gap`)}
        </Txt>
      ) : null}

      <View style={{ gap: 10, opacity: played ? 0.7 : 1 }}>
        {plan.pairs.map((p) => (
          <View key={`${view}:${p.red}|${p.blue}`} style={{ backgroundColor: C.surface, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, gap: 8 }}>
            <View style={[s.row, { gap: 10 }]}>
              <Corner side="red" name={name(p.red)} w={weightOf(db, p.red)} sel={sel === p.red} onPress={() => pick(p.red)} />
              <View style={[s.center, { width: 34, height: 34, borderRadius: 17, backgroundColor: C.surface2 }]}>
                <Txt size={11} w={600} color={C.accent}>VS</Txt>
              </View>
              <Corner side="blue" name={name(p.blue)} w={weightOf(db, p.blue)} sel={sel === p.blue} onPress={() => pick(p.blue)} />
            </View>
            {p.warn ? (
              <View style={[s.row, { gap: 6 }]}>
                <Txt size={11}>⚠️</Txt>
                <Txt size={11} color={C.warning}>{p.warn}</Txt>
              </View>
            ) : null}
          </View>
        ))}
        {plan.bye ? (
          <Press onPress={() => pick(plan.bye!)}
            style={[s.row, { borderWidth: 1, borderStyle: 'dashed', borderColor: sel === plan.bye ? C.accent : C.border, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, gap: 10 }]}>
            <Icon name="coffee" size={18} color={C.text2} />
            <Txt size={13} color={C.text2}>{t(`${name(plan.bye)} بيرتاح الجولة دي`, `${name(plan.bye)} rests this round`)}</Txt>
          </Press>
        ) : null}
      </View>
    </Screen>
  );
}

function Corner({ side, name, w, sel, onPress }: { side: 'red' | 'blue'; name: string; w: number; sel: boolean; onPress: () => void }) {
  const t = useT();
  const red = side === 'red';
  const bar = <View style={{ width: 4, height: 34, borderRadius: 2, backgroundColor: red ? C.red : C.blue }} />;
  return (
    <Press onPress={onPress} accessibilityLabel={`${name} ${red ? t('الركن الأحمر', 'red corner') : t('الركن الأزرق', 'blue corner')}`}
      style={[s.row, { flex: 1, gap: 8, minWidth: 0, justifyContent: red ? 'flex-start' : 'flex-end', borderRadius: 12, padding: 2, backgroundColor: sel ? 'rgba(198,244,50,.14)' : 'transparent' }]}>
      {red ? bar : null}
      <View style={{ gap: 2, alignItems: red ? 'flex-start' : 'flex-end', flexShrink: 1 }}>
        <Txt size={14} w={500} numberOfLines={1}>{name}</Txt>
        <Txt size={11} color={C.muted}>{w} {t('كجم', 'kg')}</Txt>
      </View>
      {red ? null : bar}
    </Press>
  );
}
