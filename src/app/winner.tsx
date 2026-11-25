import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { BigButton, Dot, Header, Press, Screen, Txt, s } from '@/components/ui';
import { notify, useDB } from '@/data/store';
import type { Winner as W } from '@/data/types';
import { firstName, pname } from '@/logic/queries';
import { useT } from '@/i18n';
import { saveRound, useSparClock } from '@/logic/sparring';
import { C } from '@/theme';

export default function Winner() {
  const t = useT();
  const db = useDB();
  const sp = useSparClock();
  const [picks, setPicks] = useState<Record<number, W>>({});

  const scores = useMemo(() => {
    const out: Record<string, { red: number; blue: number }> = {};
    const sessionId = sp?.boutIds.__session;
    if (!sessionId) return out;
    const sessionBouts = new Map(db.bouts.filter((b) => b.sparringId === sessionId).map((b) => [b.id, b]));
    for (const r of db.rounds) {
      const b = sessionBouts.get(r.boutId);
      if (!b) continue;
      const cur = (out[`${b.red}|${b.blue}`] ??= { red: 0, blue: 0 });
      if (r.winner === 'red') cur.red += 1;
      else if (r.winner === 'blue') cur.blue += 1;
    }
    return out;
  }, [db.bouts, db.rounds, sp?.boutIds.__session]);

  if (!sp) return <Screen><Header /></Screen>;
  const name = (id: string) => pname(db, id);
  const done = Object.keys(picks).length;
  const last = sp.round >= sp.rounds;

  const save = () => {
    if (!done) return notify(t('اختار نتيجة ثنائي واحد على الأقل', 'Pick a result for at least one pair'));
    const r = saveRound(sp, picks);
    notify(r === 'done' ? t('خلص السبارينج واتسجّل في التقارير', 'Sparring finished and saved to reports') : t(`اتسجّلت الجولة ${sp.round} · راحة`, `Round ${sp.round} saved · rest`));
    router.back();
  };

  return (
    <Screen gap={16} footer={<BigButton label={last ? t('حفظ · إنهاء السبارينج', 'Save · finish sparring') : t(`حفظ · ابدأ الجولة ${sp.round + 1}`, `Save · start round ${sp.round + 1}`)} onPress={save} />}>
      <Header title={sp.type === 'hard' ? t('هارد سبارينج', 'Hard sparring') : t('لايت سبارينج', 'Light sparring')} />
      <View style={{ gap: 4 }}>
        <Txt size={28} w={700}>{t(`مين كسب الجولة ${sp.round}؟`, `Who won round ${sp.round}?`)}</Txt>
        <Txt size={13} color={C.muted}>{t(`اختار لكل ثنائي · اتسجّل ${done} من ${sp.pairs.length}`, `Pick for each pair · ${done} of ${sp.pairs.length} done`)}</Txt>
      </View>

      <View style={{ gap: 12 }}>
        {sp.pairs.map((p, i) => {
          const k = picks[i];
          const sc = scores[`${p.red}|${p.blue}`] ?? { red: 0, blue: 0 };
          const sr = sc.red + (k === 'red' ? 1 : 0), sb = sc.blue + (k === 'blue' ? 1 : 0);
          const set = (w: W) => setPicks({ ...picks, [i]: w });
          return (
            <View key={i} style={{ backgroundColor: C.surface, borderRadius: 24, padding: 12, gap: 10 }}>
              <View style={[s.rowBetween, { paddingHorizontal: 4 }]}>
                <View style={[s.row, { gap: 6 }]}><Dot color={C.red} /><Txt size={13}>{name(p.red)}</Txt></View>
                <View style={[s.row, { gap: 6 }]}><Txt size={13}>{name(p.blue)}</Txt><Dot color={C.blue} /></View>
              </View>
              <View style={[s.row, { gap: 8 }]}>
                <Choice label={t('الأحمر كسب', 'Red won')} on={k === 'red'} onPress={() => set('red')} />
                <Choice label={t('تعادل', 'Draw')} on={k === 'draw'} draw onPress={() => set('draw')} />
                <Choice label={t('الأزرق كسب', 'Blue won')} on={k === 'blue'} onPress={() => set('blue')} />
              </View>
              <Txt size={11} color={C.muted} style={{ paddingHorizontal: 4 }}>
                {t('نتيجة الماتش لحد دلوقتي:', 'Match score so far:')} {firstName(name(p.red))} {sr} – {sb} {firstName(name(p.blue))}
              </Txt>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function Choice({ label, on, draw, onPress }: { label: string; on: boolean; draw?: boolean; onPress: () => void }) {
  const bg = on ? (draw ? C.text : C.accent) : C.surface2;
  return (
    <Press onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }}
      style={[s.center, { flex: 1, height: 44, borderRadius: 22, backgroundColor: bg }]}>
      <Txt size={13} w={500} color={on ? C.bg : C.text}>{label}</Txt>
    </Press>
  );
}
