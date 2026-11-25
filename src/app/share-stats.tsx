import { useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Avatar, Field, Header, OutlineBtn, Pill, Press, Screen, Segmented, Txt, s } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { COACH } from '@/data/seed';
import { notify, useDB, useExercises, useStore } from '@/data/store';
import type { DB, Exercise, Player } from '@/data/types';
import { nm, tr, useT } from '@/i18n';
import { Range, addDays, diffDays, parseDMY, periodLabel, periodRange, prevRange, toDMY, today } from '@/logic/dates';
import { attendedDays, branchOf, initials, pct, playersIn, roundStats, sessionDays } from '@/logic/queries';
import { C, PAD } from '@/theme';

type K = 'week' | 'month' | 'custom';
type Stats = {
  att: number; rounds: number; win: number; draw: number; loss: number; up: number;
  totals: { name: string; value: number; unit: string }[];
};

function statsFor(db: DB, ex: Exercise[], pid: string, r: Range, prev: Range): Stats {
  const days = sessionDays(db, r, branchOf(db, pid)).size || 1;
  const rs = roundStats(db, pid, r);
  const sums = new Map<string, { reps: number; secs: number; n: number }>();
  const prevPush = { reps: 0, n: 0 };
  for (const x of db.results) {
    if (x.playerId !== pid) continue;
    if (x.date >= r.from && x.date <= r.to) {
      const s = sums.get(x.exerciseId) ?? { reps: 0, secs: 0, n: 0 };
      s.reps += x.reps ?? 0; s.secs += x.seconds ?? 0; s.n++;
      sums.set(x.exerciseId, s);
    } else if (x.exerciseId === 'e1' && x.date >= prev.from && x.date <= prev.to) {
      prevPush.reps += x.reps ?? 0; prevPush.n++;
    }
  }
  const push = sums.get('e1');
  const avg = push?.n ? push.reps / push.n : 0, avgPrev = prevPush.n ? prevPush.reps / prevPush.n : 0;
  const totals = ex
    .map((e) => {
      const s = sums.get(e.id);
      if (!s) return null;
      return e.mode === 'count'
        ? { name: nm(e), value: s.reps, unit: tr('عدّة', 'reps') }
        : { name: nm(e), value: Math.round(s.secs / 60), unit: tr('د', 'min') };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.value > 0);
  return {
    att: Math.round(Math.min(1, attendedDays(db, pid, r).size / days) * 100),
    rounds: rs.total, win: rs.win, draw: rs.draw, loss: rs.loss, up: pct(avg, avgPrev), totals,
  };
}

const fmt = (n: number) => n.toLocaleString('en-US');

/** Share stats (SPEC §9.4): pick players, preview cards, send one by one or share all. */
export default function ShareStats() {
  const t = useT();
  const db = useDB();
  const ex = useExercises();
  const auth = useStore((st) => st.auth);
  const lang = useStore((st) => st.lang);
  const branches = useStore((st) => st.branches);
  const { width } = useWindowDimensions();
  const cardW = Math.min(width, 480) - PAD * 2;

  const [branch, setBranch] = useState<string>(() => useStore.getState().branch);
  const [kind, setKind] = useState<K>('month');
  const [from, setFrom] = useState(toDMY(addDays(today(), -29)));
  const [to, setTo] = useState(toDMY(today()));
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = useRef<Record<string, React.ComponentRef<typeof View> | null>>({});
  const allRef = useRef<React.ComponentRef<typeof View>>(null);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const range: Range | null = useMemo(() => {
    if (kind !== 'custom') return periodRange(kind, today());
    const a = parseDMY(from), b = parseDMY(to);
    return a && b && a <= b ? { from: a, to: b } : null;
  }, [kind, from, to]);
  const prev = useMemo(() => {
    if (!range) return null;
    if (kind !== 'custom') return prevRange(kind, range);
    const len = diffDays(range.to, range.from) + 1;
    return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
  }, [range, kind]);

  const people = useMemo(() => playersIn(db, branch), [db, branch]);
  const chosen = people.filter((p) => on[p.id]);
  const chosenKey = chosen.map((p) => p.id).join();
  const allOn = people.length > 0 && chosen.length === people.length;
  const stats = useMemo(() => {
    const m: Record<string, Stats> = {};
    if (range && prev) for (const p of chosen) m[p.id] = statsFor(db, ex, p.id, range, prev);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, ex, chosenKey, range, prev, lang]);

  const coach = auth?.name ? tr(`كابتن ${auth.name}`, `Coach ${auth.name}`) : nm(COACH);
  const label = range ? periodLabel(kind === 'custom' ? 'custom' : kind, range) : '—';
  const lastNote = (pid: string) => db.coachNotes.filter((n) => n.playerId === pid).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.text ?? '';
  const noteOf = (p: Player) => notes[p.id] ?? lastNote(p.id);
  const current = chosen[Math.min(page, Math.max(0, chosen.length - 1))];

  const saveNote = (p: Player) => {
    const text = notes[p.id]?.trim();
    if (text && text !== lastNote(p.id)) useStore.getState().append('coachNotes', [{ playerId: p.id, coachId: COACH.id, text, date: today() }]);
  };

  const shareCard = async (p: Player) => {
    const idx = chosen.findIndex((x) => x.id === p.id);
    scroller.current?.scrollTo({ x: idx * (cardW + 12), animated: true });
    setPage(idx);
    await new Promise((r) => setTimeout(r, 300));
    saveNote(p);
    const uri = await captureRef(refs.current[p.id] as never, { format: 'png', quality: 1, result: 'tmpfile' });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: tr(`ابعت لـ ${nm(p)}${p.phone ? ` (${p.phone})` : ''}`, `Send to ${nm(p)}${p.phone ? ` (${p.phone})` : ''}`) });
  };

  const guard = async (fn: () => Promise<void>) => {
    if (!range) return notify(t('الفترة المخصصة مش صحيحة', 'The custom period isn’t valid'));
    if (!chosen.length) return notify(t('اختار لاعب واحد على الأقل', 'Select at least one player'));
    if (!(await Sharing.isAvailableAsync())) return notify(t('المشاركة مش متاحة هنا', 'Sharing isn’t available here'));
    setBusy(true);
    try { await fn(); } catch { notify(t('معرفناش نعمل الصورة', 'Couldn’t create the image')); } finally { setBusy(false); }
  };

  /** One player → share sheet; several → a "send next" queue. */
  const sendMain = () => guard(async () => {
    if (chosen.length === 1) return shareCard(chosen[0]);
    const q = queue ?? chosen.map((p) => p.id);
    const p = chosen.find((x) => x.id === q[0]);
    if (!p) { setQueue(null); return; }
    await shareCard(p);
    const rest = q.slice(1);
    setQueue(rest.length ? rest : null);
    if (!rest.length) notify(t('اتبعت للكل', 'Sent to everyone'));
  });

  /** Everyone in one tall image, for a group chat. */
  const shareAll = () => guard(async () => {
    chosen.forEach(saveNote);
    await new Promise((r) => setTimeout(r, 200));
    const uri = await captureRef(allRef.current as never, { format: 'png', quality: 1, result: 'tmpfile' });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: tr('شارك في الجروب', 'Share to a group') });
  });

  const nextName = queue?.length ? nm(chosen.find((x) => x.id === queue[0])).split(' ')[0] : null;
  const mainLabel = !chosen.length
    ? t('اختار لاعبين', 'Select players')
    : chosen.length === 1 ? t(`ابعت لـ ${nm(chosen[0]).split(' ')[0]} على واتساب`, `Send to ${nm(chosen[0]).split(' ')[0]} on WhatsApp`)
    : nextName ? t(`ابعت التالي: ${nextName} (${chosen.length - queue!.length + 1} من ${chosen.length})`, `Send next: ${nextName} (${chosen.length - queue!.length + 1} of ${chosen.length})`)
    : t(`ابعت لـ ${chosen.length} واحد واحد`, `Send to ${chosen.length}, one by one`);

  const toggle = (id: string) => { setOn((o) => ({ ...o, [id]: !o[id] })); setQueue(null); };
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <Screen gap={14} footer={
      <View style={[s.row, { gap: 10 }]}>
        <Press onPress={sendMain} disabled={busy} accessibilityRole="button"
          style={[s.row, { flex: 1, height: 56, borderRadius: 28, backgroundColor: C.accent, justifyContent: 'center', gap: 8, opacity: chosen.length ? 1 : 0.5 }]}>
          <Icon name="send" size={18} color={C.bg} stroke={2.2} />
          <Txt size={14} w={600} color={C.bg} numberOfLines={1}>{busy ? '…' : mainLabel}</Txt>
        </Press>
        <Press accessibilityLabel={t('شارك الكل كصور للجروب', 'Share all as images')} onPress={shareAll} disabled={busy}
          style={[s.center, { width: 56, height: 56, borderRadius: 28, backgroundColor: C.surface }]}>
          <Icon name="share" size={20} stroke={1.9} />
        </Press>
      </View>
    }>
      <Header title={t('مشاركة الإحصائيات', 'Share stats')} />

      <Segmented<K> value={kind} onChange={(k) => { setKind(k); setQueue(null); }}
        options={[{ key: 'week', label: t('الأسبوع', 'Week') }, { key: 'month', label: t('الشهر', 'Month') }, { key: 'custom', label: t('مخصص', 'Custom') }]} />
      {kind === 'custom' ? (
        <View style={[s.row, { gap: 8 }]}>
          <Field value={from} onChangeText={setFrom} placeholder="01/11/2026" style={{ flex: 1, height: 40, writingDirection: 'ltr' }} keyboardType="numbers-and-punctuation" />
          <Txt size={13} color={C.muted}>→</Txt>
          <Field value={to} onChangeText={setTo} placeholder="30/11/2026" style={{ flex: 1, height: 40, writingDirection: 'ltr' }} keyboardType="numbers-and-punctuation" />
        </View>
      ) : null}

      {chosen.length && range ? (
        <View style={{ gap: 8 }}>
          <View style={s.rowBetween}>
            <Txt size={12} color={C.muted}>{t('معاينة الكروت اللي هتتبعت', 'Preview of the cards')}</Txt>
            <Txt size={12} color={C.muted}>{Math.min(page + 1, chosen.length)} / {chosen.length}</Txt>
          </View>
          {/* carousel laid out left-to-right so paging behaves the same in both languages */}
          <ScrollView ref={scroller} horizontal snapToInterval={cardW + 12} decelerationRate="fast" showsHorizontalScrollIndicator={false}
            style={{ direction: 'ltr', marginHorizontal: -PAD }} contentContainerStyle={{ paddingHorizontal: PAD, gap: 12 }}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (cardW + 12)))}>
            {chosen.map((p) => (
              <View key={p.id} ref={(r) => { refs.current[p.id] = r; }} collapsable={false} style={{ width: cardW, direction: dir }}>
                <StatCardView p={p} st={stats[p.id]} note={noteOf(p)} coach={coach} label={label} />
              </View>
            ))}
          </ScrollView>
          {current ? (
            <Field value={noteOf(current)} onChangeText={(v) => setNotes((n) => ({ ...n, [current.id]: v }))}
              placeholder={t(`ملاحظة الكابتن لـ ${nm(current).split(' ')[0]}`, `Coach's note for ${nm(current).split(' ')[0]}`)} multiline
              style={{ height: 64, paddingTop: 10, textAlignVertical: 'top' }} />
          ) : null}
        </View>
      ) : (
        <View style={{ backgroundColor: C.surface, borderRadius: 22, padding: 16 }}>
          <Txt size={13} color={C.muted}>{range ? t('اختار لاعبين من تحت وهتظهر كروتهم هنا', 'Pick players below to preview their cards') : t('اكتب الفترة كده: 01/11/2026 → 30/11/2026', 'Write the period like 01/11/2026 → 30/11/2026')}</Txt>
        </View>
      )}

      <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
        <Pill small label={t('كل الفروع', 'All branches')} on={branch === 'all'} onPress={() => { setBranch('all'); setQueue(null); }} />
        {branches.map((b) => <Pill small key={b.id} label={nm(b)} on={branch === b.id} onPress={() => { setBranch(b.id); setQueue(null); }} />)}
      </View>

      <View style={s.rowBetween}>
        <Txt size={15} w={600}>{t(`اختار اللاعبين · ${chosen.length}`, `Pick players · ${chosen.length}`)}</Txt>
        <OutlineBtn h={34} label={allOn ? t('شيل الكل', 'Clear all') : t('اختار الكل', 'Select all')}
          onPress={() => { setOn(Object.fromEntries(people.map((p) => [p.id, !allOn]))); setQueue(null); }} />
      </View>

      <View style={{ gap: 8 }}>
        {people.map((p) => {
          const o = !!on[p.id];
          return (
            <Press key={p.id} accessibilityRole="checkbox" accessibilityState={{ checked: o }} onPress={() => toggle(p.id)}
              style={[s.row, { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12, gap: 12, borderWidth: 1.5, borderColor: o ? C.accent : 'transparent', backgroundColor: o ? 'rgba(198,244,50,.06)' : C.surface }]}>
              <View style={[s.center, { width: 26, height: 26, borderRadius: 9, backgroundColor: o ? C.accent : 'transparent', borderWidth: o ? 0 : 2, borderColor: C.off }]}>
                {o ? <Icon name="check" size={16} color={C.bg} stroke={3} /> : null}
              </View>
              <Avatar ini={initials(nm(p))} uri={p.photoUri} size={38} />
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <Txt size={14} w={500} numberOfLines={1}>{nm(p)}</Txt>
                <Txt size={11} color={C.muted} ltr>{p.phone ? `+20 ${p.phone.slice(1)}` : t('مفيش رقم', 'No number')}</Txt>
              </View>
            </Press>
          );
        })}
      </View>

      {/* hidden: all selected cards stacked, captured as one image for "share all" */}
      {chosen.length && range ? (
        <View style={{ position: 'absolute', left: -10000, top: 0, width: cardW + 32 }} pointerEvents="none">
          <View ref={allRef} collapsable={false} style={{ backgroundColor: C.bg, padding: 16, gap: 12, direction: dir }}>
            <Txt size={16} w={700}>{t(`تقرير ${label} · ${coach}`, `${label} report · ${coach}`)}</Txt>
            {chosen.map((p) => <StatCardView key={p.id} p={p} st={stats[p.id]} note={noteOf(p)} coach={coach} label={label} />)}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function StatCardView({ p, st, note, coach, label }: { p: Player; st?: Stats; note: string; coach: string; label: string }) {
  if (!st) return null;
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 26, padding: 16, gap: 12, borderWidth: 1, borderColor: C.surface2 }}>
      <View style={[s.row, { gap: 10 }]}>
        <Avatar ini={initials(nm(p))} uri={p.photoUri} size={40} ring />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={16} w={600} numberOfLines={1}>{nm(p)}</Txt>
          <Txt size={11} color={C.muted} numberOfLines={1}>{tr(`تقرير ${label} · ${coach}`, `${label} · ${coach}`)}</Txt>
        </View>
        <View style={{ height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: st.up >= 0 ? C.accent : 'rgba(255,138,61,.18)', justifyContent: 'center' }}>
          <Txt size={12} w={700} color={st.up >= 0 ? C.bg : C.danger}>{st.up >= 0 ? '↑' : '↓'} {Math.abs(st.up)}%</Txt>
        </View>
      </View>
      <View style={[s.row, { gap: 8 }]}>
        <Box label={tr('الحضور', 'Attendance')} value={`${st.att}%`} accent />
        <Box label={tr('الجولات', 'Rounds')} value={String(st.rounds)} />
        <Box label={tr('كسب · تعادل · خسارة', 'W · D · L')} value={`${st.win} · ${st.draw} · ${st.loss}`} small />
      </View>
      {st.totals.length ? (
        <View style={[s.row, { flexWrap: 'wrap', gap: 6 }]}>
          {st.totals.map((x) => (
            <View key={x.name} style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: '#24261F', justifyContent: 'center' }}>
              <Txt size={11}>{x.name} {fmt(x.value)} {x.unit}</Txt>
            </View>
          ))}
        </View>
      ) : <Txt size={11} color={C.muted}>{tr('مفيش تمارين متسجّلة في الفترة دي', 'No exercises recorded in this period')}</Txt>}
      {note.trim() ? (
        <View style={{ backgroundColor: 'rgba(198,244,50,.08)', borderRadius: 14, padding: 10, gap: 2 }}>
          <Txt size={10} color={C.accent}>{tr('ملاحظة الكابتن', "Coach's note")}</Txt>
          <Txt size={12} style={{ lineHeight: 19 }}>{note.trim()}</Txt>
        </View>
      ) : null}
    </View>
  );
}

function Box({ label, value, accent, small }: { label: string; value: string; accent?: boolean; small?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#24261F', borderRadius: 16, padding: 10, gap: 2 }}>
      <Txt size={10} color={C.muted} numberOfLines={1}>{label}</Txt>
      <Txt size={small ? 14 : 18} w={700} color={accent ? C.accent : C.text}>{value}</Txt>
    </View>
  );
}
