import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { createAudioPlayer } from 'expo-audio';
import { Dot, Header, Press, Screen, Toggle, Txt, s } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { SoundEvent, notify, useStore } from '@/data/store';
import { useT } from '@/i18n';
import { SOUND_EVENTS, playEvent, stopEvent } from '@/logic/useSounds';
import { C } from '@/theme';

const MAX_BYTES = 1024 * 1024;
const MAX_SEC = 5;
const EXT = /\.(mp3|wav|m4a)$/i;

/** Sounds (design: Sounds.dc.html). Used by the workout, sparring and shadow timers, offline. */
export default function Sounds() {
  const t = useT();
  const cfg = useStore((st) => st.sounds);
  const rtl = useStore((st) => st.lang) === 'ar';
  const [playing, setPlaying] = useState<SoundEvent | null>(null);
  const [busy, setBusy] = useState<SoundEvent | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const meta: Record<SoundEvent, { name: string; def: string; dot: string }> = {
    round_start: { name: t('بداية الجولة', 'Round start'), def: t('جرس الحلبة', 'Ring bell'), dot: C.text },
    half_round: { name: t('نص الجولة', 'Half round'), def: t('صفّارتين قصار', 'Two short beeps'), dot: C.accent },
    last_10_sec: { name: t('آخر 10 ثواني', 'Last 10 seconds'), def: t('خشبة 3 خبطات', 'Clapper, 3 knocks'), dot: C.danger },
    round_end: { name: t('نهاية الجولة', 'Round end'), def: t('جرس 3 مرات', 'Bell ×3'), dot: C.text },
    rest_end: { name: t('نهاية الراحة', 'Rest end'), def: t('صفارة', 'Whistle'), dot: C.muted },
  };

  const preview = (ev: SoundEvent) => {
    clearTimeout(timer.current);
    if (playing === ev) { stopEvent(ev); setPlaying(null); return; }
    playEvent(ev, true);
    setPlaying(ev);
    timer.current = setTimeout(() => setPlaying(null), 2500);
  };

  const upload = async (ev: SoundEvent) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (!EXT.test(a.name)) return notify(t('لازم mp3 أو wav أو m4a', 'Use an mp3, wav or m4a file'));
      if ((a.size ?? 0) > MAX_BYTES) return notify(t('الملف أكبر من 1 ميجا', 'File is larger than 1 MB'));
      setBusy(ev);
      const secs = await durationOf(a.uri);
      if (secs > MAX_SEC + 0.3) {
        setBusy(null);
        return notify(t(`الصوت ${secs.toFixed(1)} ثانية · الأقصى 5 ثواني`, `Sound is ${secs.toFixed(1)} s · max 5 s`));
      }
      const uri = await keep(a.uri, `${ev}-${Date.now()}${a.name.match(EXT)![0].toLowerCase()}`);
      const st = useStore.getState();
      st.set({ sounds: { ...st.sounds, custom: { ...st.sounds.custom, [ev]: { uri, name: a.name } } } });
      setBusy(null);
      notify(t('اتحفظ الصوت', 'Sound saved'));
      playEvent(ev, true);
    } catch {
      setBusy(null);
      notify(t('معرفناش نقرا الملف ده', 'Couldn’t read that file'));
    }
  };

  const reset = (ev: SoundEvent) => {
    const st = useStore.getState();
    const custom = { ...st.sounds.custom };
    const old = custom[ev];
    delete custom[ev];
    st.set({ sounds: { ...st.sounds, custom } });
    if (old) try { new File(old.uri).delete(); } catch {}
    notify(t('رجع الصوت الافتراضي', 'Back to the default sound'));
  };

  const setVolume = (v: number) => useStore.getState().set({ sounds: { ...useStore.getState().sounds, volume: Math.round(v * 20) / 20 } });

  return (
    <Screen gap={14}>
      <Header title={t('الأصوات', 'Sounds')} />
      <View style={{ gap: 4 }}>
        <Txt size={22} w={700}>{t('صوت لكل لحظة في الجولة', 'A sound for every moment of the round')}</Txt>
        <Txt size={12} color={C.muted} style={{ lineHeight: 19 }}>
          {t('بيشتغل في تايمر التمرين والسبارينج وجولات الهوا. ارفع mp3 أو wav، أقصى 5 ثواني.', 'Plays in the workout, sparring and shadow timers. Upload mp3 or wav, up to 5 seconds.')}
        </Txt>
      </View>

      {/* round timeline */}
      <View style={{ backgroundColor: C.surface, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 12 }}>
        <Txt size={11} color={C.muted}>{t('الجولة · 3 دقايق', 'Round · 3 minutes')}</Txt>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: C.surface2, marginHorizontal: 8 }}>
          <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, width: '50%', borderRadius: 5, backgroundColor: C.accent }} />
          {[{ at: 0, c: C.text }, { at: 50, c: C.accent }, { at: 94.4, c: C.danger }, { at: 100, c: C.text }].map((m, i) => (
            <View key={i} style={{ position: 'absolute', top: -5, start: `${m.at}%`, marginStart: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: m.c, borderWidth: 3, borderColor: C.bg }} />
          ))}
        </View>
        <View style={s.rowBetween}>
          <Txt size={10} color={C.muted}>0:00 {t('بداية', 'start')}</Txt>
          <Txt size={10} color={C.muted}>1:30 {t('نص الجولة', 'half')}</Txt>
          <Txt size={10} color={C.muted}>2:50 {t('آخر 10 ث', 'last 10s')}</Txt>
          <Txt size={10} color={C.muted}>3:00</Txt>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        {SOUND_EVENTS.map((ev) => {
          const on = playing === ev;
          const custom = cfg.custom[ev];
          return (
            <View key={ev} style={[s.row, { backgroundColor: C.surface, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 12, gap: 10, borderWidth: 1.5, borderColor: on ? C.accent : 'transparent' }]}>
              <Press accessibilityLabel={t(`معاينة ${meta[ev].name}`, `Preview ${meta[ev].name}`)} onPress={() => preview(ev)}
                style={[s.center, { width: 44, height: 44, borderRadius: 22, backgroundColor: on ? C.accent : C.surface2 }]}>
                <Icon name={on ? 'pause' : 'play'} size={18} color={on ? C.bg : C.text} />
              </Press>
              <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                <View style={[s.row, { gap: 6 }]}><Dot color={meta[ev].dot} /><Txt size={14} w={500}>{meta[ev].name}</Txt></View>
                <Txt size={11} color={C.muted} numberOfLines={1}>
                  {custom ? `${custom.name} · ${t('مرفوع', 'uploaded')}` : `${meta[ev].def} (${t('افتراضي', 'default')})`}
                </Txt>
              </View>
              {custom ? (
                <Press accessibilityLabel={t('رجوع للافتراضي', 'Reset to default')} onPress={() => reset(ev)}
                  style={[s.center, { width: 36, height: 36, borderRadius: 18 }]}>
                  <Icon name="reset" size={16} color={C.muted} stroke={2} />
                </Press>
              ) : null}
              <Press accessibilityLabel={t(`رفع صوت ${meta[ev].name}`, `Upload ${meta[ev].name}`)} onPress={() => upload(ev)} disabled={busy === ev}
                style={[s.row, { height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: C.border, gap: 6 }]}>
                <Icon name="upload" size={14} color={C.accent} stroke={2} />
                <Txt size={12} color={C.accent}>{busy === ev ? '…' : t('رفع', 'Upload')}</Txt>
              </Press>
            </View>
          );
        })}
      </View>

      <View style={{ backgroundColor: C.surface, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 14 }}>
        <View style={{ gap: 10 }}>
          <View style={s.rowBetween}>
            <Txt size={14}>{t('مستوى الصوت', 'Volume')}</Txt>
            <Txt size={14} color={C.accent}>{Math.round(cfg.volume * 100)}%</Txt>
          </View>
          <Slider value={cfg.volume} onChange={setVolume} rtl={rtl} label={t('مستوى الصوت', 'Volume')} />
        </View>
        <View style={s.rowBetween}>
          <Txt size={14}>{t('اهتزاز مع الصوت', 'Vibrate with sound')}</Txt>
          <Toggle label={t('اهتزاز مع الصوت', 'Vibrate with sound')} on={cfg.vibrate}
            onChange={(v) => useStore.getState().set({ sounds: { ...cfg, vibrate: v } })} />
        </View>
      </View>
    </Screen>
  );
}

/** Minimal slider (tap or drag). Fills from the reading start side. */
function Slider({ value, onChange, rtl, label }: { value: number; onChange: (v: number) => void; rtl: boolean; label: string }) {
  const box = useRef<React.ComponentRef<typeof View>>(null);
  const geo = useRef({ x: 0, w: 1 });
  const at = (pageX: number) => {
    const f = Math.max(0, Math.min(1, (pageX - geo.current.x) / geo.current.w));
    onChange(rtl ? 1 - f : f);
  };
  return (
    <View
      ref={box}
      accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      onLayout={() => box.current?.measure((_x: number, _y: number, w: number, _h: number, px: number) => (geo.current = { x: px, w: w || 1 }))}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => { box.current?.measure((_x: number, _y: number, w: number, _h: number, px: number) => (geo.current = { x: px, w: w || 1 })); at(e.nativeEvent.pageX); }}
      onResponderMove={(e) => at(e.nativeEvent.pageX)}
      style={{ height: 28, justifyContent: 'center' }}
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.surface2 }}>
        <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, width: `${value * 100}%`, borderRadius: 3, backgroundColor: C.accent }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', start: `${value * 100}%`, marginStart: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: C.text, borderWidth: 3, borderColor: C.accent }} />
    </View>
  );
}

/** Load the file briefly to read its duration (seconds). */
async function durationOf(uri: string) {
  const p = createAudioPlayer({ uri });
  try {
    for (let i = 0; i < 40; i++) {
      if (p.isLoaded && p.duration > 0) return p.duration;
      await new Promise((r) => setTimeout(r, 100));
    }
    return 0; // unknown → accept; the 1 MB limit still applies
  } finally {
    try { p.remove(); } catch {}
  }
}

/** Copy the picked file into the app's documents (the picker's cache copy can be cleared). */
async function keep(src: string, name: string) {
  try {
    const dir = new Directory(Paths.document, 'sounds');
    if (!dir.exists) dir.create();
    const dest = new File(dir, name);
    await (new File(src) as unknown as { copy: (d: File) => unknown }).copy(dest);
    return dest.uri;
  } catch {
    return src;
  }
}
