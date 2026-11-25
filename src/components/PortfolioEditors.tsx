/** Editors shared by onboarding (3 steps) and the portfolio page. */
import { useState } from 'react';
import { View } from 'react-native';
import * as Location from 'expo-location';
import { Club, Portfolio, Slot, notify, uid, useStore } from '@/data/store';
import { nm, tr } from '@/i18n';
import { dayFull, daysShort, fmtTime, toMin } from '@/logic/dates';
import { pickPhoto } from '@/logic/photos';
import { initials } from '@/logic/queries';
import { normTime, overlap } from '@/logic/schedule';
import { C } from '@/theme';
import { Icon } from './Icon';
import { Avatar, Field, OutlineBtn, Pill, Press, Txt, s } from './ui';

const savePf = (p: Partial<Portfolio>) => useStore.getState().set({ portfolio: { ...useStore.getState().portfolio, ...p } });

/* ---------- Step 1: details ---------- */
export function ProfileEditor() {
  const pf = useStore((st) => st.portfolio);
  const auth = useStore((st) => st.auth);
  const name = pf.fullName || auth?.name || '';
  const choose = async (src: 'camera' | 'gallery') => {
    const uri = await pickPhoto(src);
    if (uri === 'denied') return notify(tr('محتاجين إذن الكاميرا أو الصور', 'Allow camera / photos access'));
    if (uri) savePf({ photoUri: uri });
  };
  return (
    <View style={{ gap: 12 }}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Avatar ini={initials(name || 'ك')} uri={pf.photoUri} size={88} ring />
        <View style={[s.row, { gap: 8 }]}>
          <OutlineBtn icon="camera" label={tr('الكاميرا', 'Camera')} onPress={() => choose('camera')} />
          <OutlineBtn icon="upload" label={tr('من الصور', 'Gallery')} onPress={() => choose('gallery')} />
        </View>
      </View>
      <Label text={tr('الاسم بالكامل', 'Full name')} />
      <Field value={pf.fullName || auth?.name || ''} onChangeText={(v) => savePf({ fullName: v })} placeholder={tr('محمود علي', 'Mahmoud Ali')} />
      <Label text={tr('نبذة عنك كمدرب', 'Short bio')} />
      <Field value={pf.bio} onChangeText={(v) => savePf({ bio: v })} multiline placeholder={tr('بدرّب مبتدئين ومحترفين، وبركّز على الدفاع والفوتوورك…', 'I coach beginners and pros, focusing on defence and footwork…')}
        style={{ height: 96, paddingTop: 12, textAlignVertical: 'top' }} />
      <View style={[s.row, { gap: 10 }]}>
        <Txt size={13} color={C.text2} style={{ flex: 1 }}>{tr('سنين الخبرة', 'Years of experience')}</Txt>
        <Field value={pf.years ? String(pf.years) : ''} onChangeText={(v) => savePf({ years: Math.min(60, parseInt(v, 10) || 0) })} keyboardType="number-pad" placeholder="0" style={{ width: 90 }} />
      </View>
    </View>
  );
}

/* ---------- Step 2: clubs ---------- */
export function ClubsEditor() {
  const pf = useStore((st) => st.portfolio);
  const branches = useStore((st) => st.branches);
  const [locating, setLocating] = useState<string | null>(null);
  const setClub = (id: string, p: Partial<Club>) => savePf({ clubs: useStore.getState().portfolio.clubs.map((c) => (c.id === id ? { ...c, ...p } : c)) });

  const addClub = () => {
    const club: Club = { id: uid('club'), name: '', address: '', branchId: branches[0]?.id ?? '' };
    savePf({ clubs: [...pf.clubs, club] });
  };
  const removeClub = (id: string) => {
    savePf({ clubs: pf.clubs.filter((c) => c.id !== id), schedule: pf.schedule.filter((x) => x.clubId !== id) });
  };
  /** A club needs a branch so its players get the session reminders; "new branch" creates one named like the club. */
  const newBranchFor = (c: Club) => {
    const n = c.name.trim() || tr('فرع جديد', 'New branch');
    const b = { id: uid('br'), name: n, address: c.address };
    useStore.getState().set({ branches: [...useStore.getState().branches, b] });
    setClub(c.id, { branchId: b.id });
  };
  const locate = async (c: Club) => {
    setLocating(c.id);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return notify(tr('محتاجين إذن الموقع', 'Location permission needed'));
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = pos.coords;
      let address = c.address;
      try {
        const [g] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (g && !address) address = [g.street, g.district, g.city].filter(Boolean).join('، ');
      } catch {}
      setClub(c.id, { lat, lng, address });
    } catch {
      notify(tr('معرفناش نحدد المكان', 'Couldn’t get the location'));
    } finally {
      setLocating(null);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {pf.clubs.map((c) => (
        <View key={c.id} style={{ backgroundColor: C.surface, borderRadius: 22, padding: 14, gap: 10 }}>
          <View style={[s.row, { gap: 10 }]}>
            <View style={[s.center, { width: 36, height: 36, borderRadius: 12, backgroundColor: C.surface2 }]}><Icon name="pin" size={18} color={C.accent} /></View>
            <Field value={c.name} onChangeText={(v) => setClub(c.id, { name: v })} placeholder={tr('اسم النادي', 'Club name')} style={{ flex: 1, height: 42 }} />
            <Press accessibilityLabel={tr('مسح النادي', 'Remove club')} onPress={() => removeClub(c.id)} style={[s.center, { width: 36, height: 36 }]}>
              <Icon name="trash" size={16} color={C.muted} stroke={1.9} />
            </Press>
          </View>
          <Field value={c.address} onChangeText={(v) => setClub(c.id, { address: v })} placeholder={tr('العنوان', 'Address')} style={{ height: 42 }} />
          <View style={[s.row, { gap: 8 }]}>
            <OutlineBtn icon="pin" label={locating === c.id ? '…' : c.lat ? tr('اتحدد الموقع ✓', 'Location set ✓') : tr('موقعي الحالي', 'Use my location')} onPress={() => locate(c)} />
            {c.lat ? <Txt size={10} color={C.muted} ltr>{c.lat.toFixed(4)}, {c.lng?.toFixed(4)}</Txt> : null}
          </View>
          <Txt size={11} color={C.muted}>{tr('الفرع (لاعيبته هيوصلهم تذكير الحصص)', 'Branch (its players get session reminders)')}</Txt>
          <View style={[s.row, { gap: 6, flexWrap: 'wrap' }]}>
            {branches.map((b) => <Pill small key={b.id} label={nm(b)} on={c.branchId === b.id} onPress={() => setClub(c.id, { branchId: b.id })} />)}
            <Pill small label={tr('+ فرع جديد', '+ New branch')} onPress={() => newBranchFor(c)} />
          </View>
        </View>
      ))}
      <Press onPress={addClub} style={[s.row, { justifyContent: 'center', gap: 8, height: 48, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border }]}>
        <Txt size={14} w={500} color={C.accent}>{tr('+ نادي', '+ Club')}</Txt>
      </Press>
    </View>
  );
}

/* ---------- Step 3: weekly schedule (several slots per day, no overlaps) ---------- */
export function ScheduleEditor() {
  const pf = useStore((st) => st.portfolio);
  const [adding, setAdding] = useState<{ clubId: string; day: number } | null>(null);
  const [from, setFrom] = useState('17:00');
  const [to, setTo] = useState('18:00');

  const add = () => {
    if (!adding) return;
    const start = normTime(from), end = normTime(to);
    if (!start || !end) return notify(tr('اكتب الوقت كده 17:00', 'Write times like 17:00'));
    if (toMin(end) <= toMin(start)) return notify(tr('النهاية لازم بعد البداية', 'End must be after start'));
    const cand = { clubId: adding.clubId, day: adding.day, start, end };
    const clash = overlap(pf.schedule, cand);
    if (clash) {
      const where = pf.clubs.find((c) => c.id === clash.clubId)?.name || tr('نادي تاني', 'another club');
      return notify(tr(`بتتداخل مع ${fmtTime(clash.start)}–${fmtTime(clash.end)} في ${where}`, `Overlaps ${fmtTime(clash.start)}–${fmtTime(clash.end)} at ${where}`));
    }
    savePf({ schedule: [...pf.schedule, { id: uid('sl'), ...cand }] });
    setAdding(null);
  };
  const remove = (id: string) => savePf({ schedule: pf.schedule.filter((x) => x.id !== id) });

  if (!pf.clubs.length) return <Txt size={13} color={C.muted}>{tr('ضيف نادي الأول', 'Add a club first')}</Txt>;

  return (
    <View style={{ gap: 12 }}>
      {pf.clubs.map((c) => {
        const slots = pf.schedule.filter((x) => x.clubId === c.id);
        return (
          <View key={c.id} style={{ backgroundColor: C.surface, borderRadius: 24, padding: 14, gap: 10 }}>
            <View style={s.rowBetween}>
              <Txt size={15} w={600}>{c.name || tr('نادي من غير اسم', 'Unnamed club')}</Txt>
              <Txt size={11} color={C.accent}>{tr(`${slots.length} فترة في الأسبوع`, `${slots.length} slot${slots.length === 1 ? '' : 's'} a week`)}</Txt>
            </View>
            <View style={[s.row, { gap: 4 }]}>
              {daysShort().map((n, i) => {
                const on = slots.some((x) => x.day === i);
                return (
                  <View key={i} style={[s.center, { flex: 1, height: 26, borderRadius: 9, backgroundColor: on ? C.accent : '#24261F' }]}>
                    <Txt size={10} color={on ? C.bg : '#6E7166'}>{n}</Txt>
                  </View>
                );
              })}
            </View>
            {Array.from({ length: 7 }, (_, d) => {
              const daySlots = slots.filter((x) => x.day === d).sort((a, b) => toMin(a.start) - toMin(b.start));
              const open = adding?.clubId === c.id && adding.day === d;
              return (
                <View key={d} style={{ gap: 8 }}>
                  <View style={[s.row, { gap: 8, flexWrap: 'wrap', minHeight: 34 }]}>
                    <Txt size={12} color={daySlots.length ? C.text2 : C.muted} style={{ width: 62 }}>{dayFull(d)}</Txt>
                    {daySlots.map((x) => <SlotChip key={x.id} slot={x} onRemove={() => remove(x.id)} />)}
                    <Press accessibilityLabel={tr(`إضافة فترة يوم ${dayFull(d)}`, `Add a slot on ${dayFull(d)}`)} onPress={() => setAdding(open ? null : { clubId: c.id, day: d })}
                      style={[s.row, { height: 30, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, gap: 4 }]}>
                      <Txt size={11} color={C.accent}>{tr('+ فترة', '+ Slot')}</Txt>
                    </Press>
                  </View>
                  {open ? (
                    <View style={{ backgroundColor: '#24261F', borderRadius: 16, padding: 12, gap: 10 }}>
                      <View style={[s.row, { gap: 8, direction: 'ltr' }]}>
                        <Txt size={12} color={C.muted}>{tr('من', 'From')}</Txt>
                        <Field value={from} onChangeText={setFrom} placeholder="17:00" keyboardType="numbers-and-punctuation" style={{ flex: 1, height: 40, textAlign: 'center' }} />
                        <Txt size={12} color={C.muted}>{tr('لـ', 'To')}</Txt>
                        <Field value={to} onChangeText={setTo} placeholder="18:00" keyboardType="numbers-and-punctuation" style={{ flex: 1, height: 40, textAlign: 'center' }} />
                      </View>
                      <View style={[s.row, { gap: 8, justifyContent: 'flex-end' }]}>
                        <Txt size={10} color={C.muted} style={{ flex: 1 }}>{tr('بنظام 24 ساعة: 17:00 يعني 5 م', '24-hour: 17:00 = 5 PM')}</Txt>
                        <OutlineBtn label={tr('حفظ', 'Save')} onPress={add} />
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}
      <View style={[s.row, { gap: 10, backgroundColor: 'rgba(255,138,61,.1)', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 }]}>
        <Icon name="info" size={18} color="#FFB27F" stroke={1.9} />
        <Txt size={12} color="#FFB27F" style={{ flex: 1, lineHeight: 19 }}>
          {tr('مينفعش فترتين يتداخلوا في نفس اليوم، حتى لو في ناديين مختلفين. دوس على الفترة علشان تمسحها.', 'Two slots on the same day can’t overlap, even at different clubs. Tap a slot to remove it.')}
        </Txt>
      </View>
    </View>
  );
}

function SlotChip({ slot, onRemove }: { slot: Slot; onRemove: () => void }) {
  return (
    <Press onPress={onRemove} accessibilityLabel={tr('مسح الفترة', 'Remove slot')}
      style={[s.row, { height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: C.surface2, gap: 6 }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
      <Txt size={11}>{fmtTime(slot.start)} – {fmtTime(slot.end)}</Txt>
      <Icon name="close" size={11} color={C.muted} stroke={2} />
    </Press>
  );
}

function Label({ text }: { text: string }) {
  return <Txt size={12} color={C.muted}>{text}</Txt>;
}
