import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, BigButton, Card, Field, Header, OutlineBtn, Pill, Press, Screen, Segmented, Toggle, Txt, s } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { PACKAGES } from '@/data/seed';
import { notify, useDB, useStore } from '@/data/store';
import type { Level } from '@/data/types';
import { nm, useT } from '@/i18n';
import { addDays, parse, parseDMY, toDMY, today } from '@/logic/dates';
import { pickPhoto } from '@/logic/photos';
import { branchOf, initials, levelName, levelOf, player, weightOf } from '@/logic/queries';
import { C, FONT } from '@/theme';

/** Egyptian mobile: user types 10 digits after +20 (1xxxxxxxxx). Stored as 01xxxxxxxxx. */
const EG_MOBILE = /^1[0125]\d{8}$/;

/** Add or edit a player. Edits are appended (PlayerEdit / WeightLog / LevelHistory / BranchHistory). */
export default function PlayerForm() {
  const t = useT();
  const db = useDB();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = id ? player(db, id) : undefined;
  const branches = useStore((st) => st.branches);
  const current = useStore((st) => st.branch);

  const init = useMemo(() => existing
    ? {
      name: existing.name, phone: existing.phone.replace(/^0/, ''), birth: toDMY(existing.birthDate), weight: String(weightOf(db, existing.id) || ''),
      level: levelOf(db, existing.id), branch: branchOf(db, existing.id), photo: existing.photoUri, noReminders: !!existing.noReminders,
    }
    : { name: '', phone: '', birth: '', weight: '', level: 'beginner' as Level, branch: current === 'all' ? branches[0]?.id : current, photo: undefined as string | undefined, noReminders: false },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [id]);

  const [name, setName] = useState(init.name);
  const [phone, setPhone] = useState(init.phone);
  const [birth, setBirth] = useState(init.birth);
  const [weight, setWeight] = useState(init.weight);
  const [level, setLevel] = useState<Level>(init.level);
  const [branch, setBranch] = useState(init.branch);
  const [photo, setPhoto] = useState(init.photo);
  const [noReminders, setNoReminders] = useState(init.noReminders);
  const [pkg, setPkg] = useState(PACKAGES[0].id);
  const [start, setStart] = useState(toDMY(today()));
  const [paid, setPaid] = useState(true);

  const choosePhoto = async (src: 'camera' | 'gallery') => {
    const uri = await pickPhoto(src);
    if (uri === 'denied') return notify(t('محتاجين إذن الكاميرا أو الصور من إعدادات الموبايل', 'Allow camera / photos access in the phone settings'));
    if (uri) setPhoto(uri);
  };

  const save = () => {
    const w = parseFloat(weight);
    const digits = phone.replace(/\D/g, '').replace(/^20/, '').replace(/^0/, '');
    const birthDate = birth.trim() ? parseDMY(birth) : undefined;
    if (!name.trim()) return notify(t('اكتب اسم اللاعب', 'Enter the player name'));
    if (digits && !EG_MOBILE.test(digits)) return notify(t('الرقم لازم يبقى موبايل مصري: 10 أرقام بعد +20', 'Phone must be an Egyptian mobile: 10 digits after +20'));
    if (birthDate === null) return notify(t('تاريخ الميلاد كده: 25/11/2008', 'Birth date like 25/11/2008'));
    if (!branch) return notify(t('اختار الفرع', 'Pick a branch'));
    if (!w || w < 20 || w > 200) return notify(t('اكتب وزن صحيح', 'Enter a valid weight'));
    const st = useStore.getState();
    const T = today();
    const phoneStored = digits ? `0${digits}` : '';

    if (existing) {
      const patch: Record<string, unknown> = {};
      if (name.trim() !== existing.name) patch.name = name.trim();
      if (phoneStored !== existing.phone) patch.phone = phoneStored;
      if ((birthDate ?? undefined) !== existing.birthDate) patch.birthDate = birthDate;
      if (photo !== existing.photoUri) patch.photoUri = photo;
      if (noReminders !== !!existing.noReminders) patch.noReminders = noReminders;
      if (Object.keys(patch).length) st.append('playerEdits', [{ playerId: existing.id, date: T, ...patch }]);
      if (String(Math.round(w)) !== init.weight) st.append('weights', [{ playerId: existing.id, weightKg: Math.round(w), date: T }]);
      if (level !== init.level) st.append('levels', [{ playerId: existing.id, level, date: T }]);
      if (branch !== init.branch) st.append('branchHistory', [{ playerId: existing.id, branchId: branch, fromDate: T }]);
      notify(t('اتحفظت التعديلات', 'Changes saved'));
      return router.back();
    }

    const startIso = parseDMY(start);
    if (!startIso) return notify(t('تاريخ بداية الاشتراك كده: 01/12/2026', 'Start date like 01/12/2026'));
    const [pid] = st.append('players', [{
      name: name.trim(), phone: phoneStored, birthYear: birthDate ? parse(birthDate).getFullYear() : 0, joinedAt: T,
      birthDate: birthDate ?? undefined, photoUri: photo, noReminders,
    }]);
    st.append('branchHistory', [{ playerId: pid, branchId: branch, fromDate: T }]);
    st.append('weights', [{ playerId: pid, weightKg: Math.round(w), date: T }]);
    st.append('levels', [{ playerId: pid, level, date: T }]);
    const p = PACKAGES.find((x) => x.id === pkg)!;
    const [sid] = st.append('subscriptions', [{ playerId: pid, packageId: p.id, startDate: startIso, endDate: addDays(startIso, p.days) }]);
    if (paid) st.append('payments', [{ playerId: pid, subscriptionId: sid, amount: p.price, date: T, method: 'cash' }]);
    notify(t(`اتضاف ${name.trim()}`, `Added ${name.trim()}`));
    router.back();
  };

  const archive = () => {
    if (!existing) return;
    useStore.getState().append('playerEdits', [{ playerId: existing.id, date: today(), archived: !existing.archived }]);
    notify(existing.archived ? t('رجع اللاعب للقايمة', 'Player restored') : t('اتأرشف اللاعب · تاريخه فاضل في التقارير', 'Player archived · history kept in reports'));
    router.back();
  };

  return (
    <Screen gap={14} footer={<BigButton label={existing ? t('حفظ التعديلات', 'Save changes') : t('حفظ اللاعب', 'Save player')} onPress={save} />}>
      <Header title={existing ? t('تعديل لاعب', 'Edit player') : t('لاعب جديد', 'New player')} />

      <View style={{ alignItems: 'center', gap: 10 }}>
        <Avatar ini={initials(name || '؟')} uri={photo} size={88} ring />
        <View style={[s.row, { gap: 8 }]}>
          <OutlineBtn icon="camera" label={t('الكاميرا', 'Camera')} onPress={() => choosePhoto('camera')} />
          <OutlineBtn icon="upload" label={t('من الصور', 'Gallery')} onPress={() => choosePhoto('gallery')} />
          {photo ? <OutlineBtn icon="trash" label={t('شيل', 'Remove')} color={C.danger} onPress={() => setPhoto(undefined)} /> : null}
        </View>
      </View>

      <Card style={{ gap: 12 }}>
        <Label text={t('الاسم', 'Name')} />
        <Field value={name} onChangeText={setName} placeholder={t('اسم اللاعب', 'Player name')} />
        <Label text={t('الموبايل', 'Mobile')} />
        <View style={[s.row, { backgroundColor: C.surface2, borderRadius: 18, height: 46, paddingHorizontal: 14, gap: 8, direction: 'ltr' }]}>
          <Txt size={14} color={C.muted} ltr>+20</Txt>
          <Field value={phone} onChangeText={setPhone} placeholder="10 1234 5678" keyboardType="phone-pad" maxLength={13}
            style={{ flex: 1, height: 46, backgroundColor: 'transparent', paddingHorizontal: 0, textAlign: 'left', writingDirection: 'ltr', fontFamily: FONT[400] }} />
        </View>
        <View style={[s.row, { gap: 10 }]}>
          <View style={{ flex: 1, gap: 8 }}>
            <Label text={t('تاريخ الميلاد', 'Date of birth')} />
            <Field value={birth} onChangeText={setBirth} placeholder="25/11/2008" keyboardType="numbers-and-punctuation" style={{ writingDirection: 'ltr' }} />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Label text={t('الوزن (كجم)', 'Weight (kg)')} />
            <Field value={weight} onChangeText={setWeight} placeholder="70" keyboardType="decimal-pad" />
          </View>
        </View>
      </Card>

      <Label text={t('المستوى', 'Level')} />
      <Segmented<Level> value={level} onChange={setLevel}
        options={(['beginner', 'intermediate', 'pro'] as Level[]).map((l) => ({ key: l, label: levelName(l) }))} />

      <Label text={t('الفرع', 'Branch')} />
      <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
        {branches.map((b) => <Pill key={b.id} label={nm(b)} on={branch === b.id} onPress={() => setBranch(b.id)} />)}
      </View>

      {!existing ? (
        <>
          <Label text={t('الباقة', 'Package')} />
          <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
            {PACKAGES.map((p) => <Pill key={p.id} label={`${nm(p)} · ${p.price}`} on={pkg === p.id} onPress={() => setPkg(p.id)} />)}
          </View>
          <Card style={{ gap: 10 }}>
            <Label text={t('بداية الاشتراك', 'Subscription start')} />
            <Field value={start} onChangeText={setStart} placeholder="01/12/2026" keyboardType="numbers-and-punctuation" style={{ writingDirection: 'ltr' }} />
            <View style={s.rowBetween}>
              <Txt size={13}>{t('دفع دلوقتي (كاش)', 'Paid now (cash)')}</Txt>
              <Toggle label={t('دفع', 'Paid')} on={paid} onChange={setPaid} />
            </View>
          </Card>
        </>
      ) : null}

      <Card style={[s.rowBetween, { paddingVertical: 12 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={14}>{t('متبعتش تذكيرات', "Don't send reminders")}</Txt>
          <Txt size={11} color={C.muted}>{t('مش هيظهر في تذكيرات الدفع والتدريب', "Won't appear in payment or training reminders")}</Txt>
        </View>
        <Toggle label={t('متبعتش تذكيرات', "Don't send reminders")} on={noReminders} onChange={setNoReminders} />
      </Card>

      {existing ? (
        <Press onPress={archive} style={[s.row, { justifyContent: 'center', gap: 8, paddingVertical: 12 }]}>
          <Icon name={existing.archived ? 'reset' : 'trash'} size={16} color={existing.archived ? C.accent : C.danger} stroke={2} />
          <Txt size={13} color={existing.archived ? C.accent : C.danger}>
            {existing.archived ? t('رجّع اللاعب من الأرشيف', 'Restore from archive') : t('أرشفة اللاعب (تاريخه يفضل في التقارير)', 'Archive player (history stays in reports)')}
          </Txt>
        </Press>
      ) : null}
    </Screen>
  );
}

function Label({ text }: { text: string }) {
  return <Txt size={12} color={C.muted}>{text}</Txt>;
}
