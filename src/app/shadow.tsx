import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Card, Header, IconBtn, Press, Pulse, Ring, Screen, Stepper, Txt, s } from '@/components/ui';
import { planIntervals, useBackgroundCues } from '@/logic/timerBackground';
import { Icon } from '@/components/Icon';
import { KeepAwake } from '@/components/Toast';
import { notify, useStore } from '@/data/store';
import { mmss } from '@/logic/dates';
import { roundCues, useSounds, useTicker } from '@/logic/useSounds';
import { useT } from '@/i18n';
import { C } from '@/theme';

/** Shadow-boxing preset timer (SPEC 4.6): 3 × 3 min + 1 min rest, editable and saved. */
export default function Shadow() {
  const t = useT();
  const preset = useStore((st) => st.shadow);
  const sound = useStore((st) => st.sound);
  const play = useSounds();
  const [cfg, setCfg] = useState(preset);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<'idle' | 'round' | 'rest' | 'done'>('idle');
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [leftMs, setLeftMs] = useState(cfg.roundSec * 1000);
  const last = useRef(-1);

  const running = endsAt !== null;
  useTicker(running, 200);
  useBackgroundCues(() => (running && (phase === 'round' || phase === 'rest') && endsAt
    ? planIntervals({ phase: phase === 'round' ? 'work' : 'rest', endsAt, round, rounds: cfg.rounds, workSec: cfg.roundSec, restSec: cfg.restSec })
    : []));
  const left = running ? Math.max(0, endsAt! - Date.now()) : leftMs;
  const sec = Math.ceil(left / 1000);
  const total = (phase === 'rest' ? cfg.restSec : cfg.roundSec) * 1000;

  useEffect(() => {
    if (!running || sec === last.current) return;
    const prev = last.current;
    last.current = sec;
    if (sec > 0 && phase === 'round' && prev > 0) roundCues(prev, sec, cfg.roundSec);
    if (sec > 0) return;
    if (phase === 'round' && round >= cfg.rounds) {
      play('round_end'); setPhase('done'); setEndsAt(null); setLeftMs(0);
    } else if (phase === 'round') {
      play('round_end'); setPhase('rest'); setEndsAt(Date.now() + cfg.restSec * 1000);
    } else {
      play('rest_end'); setRound((r) => r + 1); setPhase('round'); setEndsAt(Date.now() + cfg.roundSec * 1000);
    }
  });

  const toggle = () => {
    if (running) { setLeftMs(left); setEndsAt(null); return; }
    if (phase === 'done') return reset();
    if (phase === 'idle') { play('round_start'); setPhase('round'); }
    setEndsAt(Date.now() + leftMs);
  };
  const reset = () => { setEndsAt(null); setPhase('idle'); setRound(1); setLeftMs(cfg.roundSec * 1000); last.current = -1; };
  const edit = (p: Partial<typeof cfg>) => {
    const n = { ...cfg, ...p };
    setCfg(n);
    if (phase === 'idle') setLeftMs(n.roundSec * 1000);
  };
  const label = phase === 'rest' ? t('راحة', 'Rest') : phase === 'done' ? t('خلصت الجولات', 'All rounds done') : t(`الجولة ${round} من ${cfg.rounds}`, `Round ${round} of ${cfg.rounds}`);

  return (
    <Screen gap={18}>
      {running ? <KeepAwake /> : null}
      <Header title={t('جولات هوا', 'Shadow rounds')} sub={t('شادو', 'Shadow boxing')}
        right={<IconBtn icon={sound ? 'sound' : 'mute'} label={t('الصوت', 'Sound')} onPress={() => useStore.getState().set({ sound: !sound })} />} />

      <View style={{ alignItems: 'center', paddingTop: 8 }}>
        <Pulse active={phase === 'round' && running && Math.ceil(left / 1000) <= 10 && left > 0}>
        <Ring size={240} thickness={12} pct={phase === 'done' ? 100 : ((total - left) / total) * 100} color={phase === 'rest' ? C.blue : C.accent}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Txt size={14} color={C.text2}>{label}</Txt>
            <Txt size={64} w={600} ltr style={{ lineHeight: 72 }} color={phase === 'round' && sec <= 10 && running ? C.danger : C.text}>{mmss(sec)}</Txt>
            <View style={[s.row, { gap: 6 }]}>
              {Array.from({ length: cfg.rounds }, (_, i) => (
                <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i < round - (phase === 'idle' ? 1 : 0) ? C.accent : C.border }} />
              ))}
            </View>
          </View>
        </Ring>
        </Pulse>
      </View>

      <View style={[s.row, { justifyContent: 'center', gap: 24 }]}>
        <Press accessibilityLabel={t('إعادة', 'Reset')} onPress={reset} style={[s.center, { width: 52, height: 52, borderRadius: 26, backgroundColor: C.surface }]}>
          <Icon name="reset" size={20} stroke={2} />
        </Press>
        <Press accessibilityLabel={t('تشغيل أو إيقاف', 'Play or pause')} onPress={toggle} style={[s.center, { width: 72, height: 72, borderRadius: 36, backgroundColor: C.accent }]}>
          <Icon name={running ? 'pause' : 'play'} size={28} color={C.bg} />
        </Press>
      </View>

      <Card style={{ gap: 12 }}>
        <View style={s.rowBetween}>
          <Txt size={15} w={600}>{t('الإعدادات', 'Settings')}</Txt>
          <Press onPress={() => { useStore.getState().set({ shadow: cfg }); notify(t('اتحفظ كإعداد افتراضي', 'Saved as default')); }}>
            <Txt size={12} color={C.accent}>{t('حفظ كافتراضي', 'Save as default')}</Txt>
          </Press>
        </View>
        <View pointerEvents={phase === 'idle' ? 'auto' : 'none'} style={{ gap: 12, opacity: phase === 'idle' ? 1 : 0.5 }}>
          <Stepper label={t('عدد الجولات', 'Rounds')} value={cfg.rounds} min={1} max={12} onChange={(v) => edit({ rounds: v })} />
          <Stepper label={t('مدة الجولة', 'Round length')} value={cfg.roundSec / 30} min={1} max={10} fmt={(v) => mmss(v * 30)} onChange={(v) => edit({ roundSec: v * 30 })} />
          <Stepper label={t('الراحة', 'Rest')} value={cfg.restSec / 15} min={1} max={12} fmt={(v) => mmss(v * 15)} onChange={(v) => edit({ restSec: v * 15 })} />
        </View>
      </Card>
    </Screen>
  );
}
