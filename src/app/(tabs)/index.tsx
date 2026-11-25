import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Card, Dot, Field, IconBtn, OutlineBtn, Pill, Press, Ring, Screen, SectionTitle, Txt, s } from '@/components/ui';
import { Icon, IconName } from '@/components/Icon';
import { COACH } from '@/data/seed';
import { notify, pendingCount, uid, useDB, useStore } from '@/data/store';
import { nm, useT } from '@/i18n';
import { today } from '@/logic/dates';
import { branchName, branchOf, initials, payLine, payStatus, playersIn, presentOn } from '@/logic/queries';
import { whatsapp } from '@/logic/whatsapp';
import { C } from '@/theme';

export default function Main() {
  const t = useT();
  const db = useDB();
  const branch = useStore((st) => st.branch);
  const branches = useStore((st) => st.branches);
  const lang = useStore((st) => st.lang);
  const outbox = useStore((st) => pendingCount(st.local));
  const auth = useStore((st) => st.auth);
  const [account, setAccount] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const setBranch = (b: string) => useStore.getState().set({ branch: b });

  const d = useMemo(() => {
    const ps = playersIn(db, branch);
    const present = presentOn(db, today(), branch);
    const st = ps.map((p) => ({ p, st: payStatus(db, p.id) }));
    const late = st.filter((x) => x.st.kind === 'late').sort((a, b) => b.st.days - a.st.days);
    const soon = st.filter((x) => x.st.kind === 'soon').sort((a, b) => a.st.days - b.st.days);
    return { total: ps.length, present: present.size, late, soon };
  }, [db, branch, lang]);

  const addBranch = () => {
    const name = newName.trim();
    if (!name) return;
    if (branches.some((b) => b.name === name)) return notify(t('الفرع ده موجود', 'Branch already exists'));
    const b = { id: uid('br'), name };
    useStore.getState().set({ branches: [...branches, b], branch: b.id });
    setNewName('');
    setAdding(false);
    notify(t(`اتضاف فرع ${name}`, `Added branch ${name}`));
  };

  const pct = d.total ? Math.round((d.present / d.total) * 100) : 0;
  const h = new Date().getHours();
  const reminders = [...d.late, ...d.soon].slice(0, 3);
  const coachName = auth?.name ? t(`كابتن ${auth.name}`, `Coach ${auth.name}`) : nm(COACH);
  const logout = () => {
    useStore.getState().set({ auth: null });
    router.replace('/login');
  };

  return (
    <Screen nav gap={18}>
      <View style={s.rowBetween}>
        <Press onPress={() => setAccount((x) => !x)} accessibilityLabel={t('الحساب', 'Account')} style={[s.row, { gap: 12 }]}>
          <Avatar ini={auth?.name ? initials(auth.name) : lang === 'ar' ? 'ك م' : 'CM'} size={36} ring />
          <View style={{ gap: 2 }}>
            <Txt size={12} color={C.muted}>{h < 12 ? t('صباح الخير', 'Good morning') : t('مساء الخير', 'Good evening')}</Txt>
            <Txt size={18} w={600}>{coachName}</Txt>
          </View>
        </Press>
        <View style={[s.row, { gap: 8 }]}>
          <Press accessibilityLabel={t('English', 'العربية')} onPress={() => useStore.getState().set({ lang: lang === 'ar' ? 'en' : 'ar' })}
            style={[s.row, { height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: C.surface, gap: 6 }]}>
            <Icon name="globe" size={18} color={C.accent} />
            <Txt size={13} w={600}>{lang === 'ar' ? 'EN' : 'ع'}</Txt>
          </Press>
          <IconBtn icon="bell" label={t('التنبيهات', 'Alerts')} dot={d.late.length + d.soon.length > 0}
            onPress={() => router.navigate({ pathname: '/players', params: { f: 'late' } })} />
        </View>
      </View>

      {account ? (
        <Card style={[s.rowBetween, { gap: 10, paddingVertical: 12 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt size={14} w={500}>{auth?.club || t('النادي', 'Club')}</Txt>
            <Txt size={11} color={C.muted} numberOfLines={1}>{auth?.email}</Txt>
          </View>
          <OutlineBtn icon="logout" label={t('تسجيل خروج', 'Sign out')} color={C.danger} onPress={logout} />
        </Card>
      ) : null}

      <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
        <Pill label={t('كل الفروع', 'All branches')} on={branch === 'all'} onPress={() => setBranch('all')} />
        {branches.map((b) => <Pill key={b.id} label={nm(b)} on={branch === b.id} onPress={() => setBranch(b.id)} />)}
        <Press accessibilityLabel={t('إضافة فرع', 'Add branch')} onPress={() => setAdding((a) => !a)}
          style={[s.center, { height: 36, width: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' }]}>
          <Icon name={adding ? 'close' : 'plus'} size={16} color={C.accent} stroke={2} />
        </Press>
      </View>

      {adding ? (
        <Card style={[s.row, { gap: 10, paddingVertical: 10 }]}>
          <Field style={{ flex: 1 }} value={newName} onChangeText={setNewName} placeholder={t('اسم الفرع الجديد', 'New branch name')}
            autoFocus onSubmitEditing={addBranch} returnKeyType="done" />
          <OutlineBtn label={t('إضافة', 'Add')} onPress={addBranch} h={40} />
        </Card>
      ) : null}

      {/* Hero: attendance today */}
      <Card accent radius={28} pad={20} style={{ gap: 14 }}>
        <View style={[s.rowBetween, { alignItems: 'flex-start' }]}>
          <View style={{ gap: 4 }}>
            <Txt size={14} w={500} color={C.bg}>{t('حاضرين النهارده', 'Here today')}</Txt>
            <View style={[s.row, { alignItems: 'baseline', gap: 6 }]}>
              <Txt size={44} w={700} color={C.bg} style={{ lineHeight: 50 }}>{d.present}</Txt>
              <Txt size={16} w={500} color={C.bg}>{t(`من ${d.total} لاعب`, `of ${d.total} players`)}</Txt>
            </View>
          </View>
          <Ring size={64} thickness={7} pct={pct} color={C.bg} track="rgba(11,12,10,.15)">
            <Txt size={14} w={700} color={C.bg}>{pct}%</Txt>
          </Ring>
        </View>
        <Press onPress={() => router.push('/attendance')} accessibilityRole="button"
          style={[s.row, { height: 46, borderRadius: 23, backgroundColor: C.bg, justifyContent: 'center', gap: 8 }]}>
          <Icon name="qr" size={18} color={C.accent} stroke={2} />
          <Txt size={14} w={500}>{t('تسجيل حضور', 'Check in players')}</Txt>
        </Press>
      </Card>

      {d.total === 0 ? (
        <Card style={[s.rowBetween, { gap: 10 }]}>
          <Txt size={13} color={C.text2} style={{ flex: 1 }}>{t(`مفيش لاعبين في فرع ${branchName(branch)} لسه`, `No players in ${branchName(branch)} yet`)}</Txt>
          <OutlineBtn label={t('+ لاعب', '+ Player')} onPress={() => router.push('/add-player')} />
        </Card>
      ) : null}

      <View style={[s.row, { gap: 12 }]}>
        <StatCard dot={C.danger} label={t('عليهم فلوس', 'Owe money')} value={d.late.length} sub={t('متأخرين عن ميعاد الدفع', 'Overdue payments')}
          onPress={() => router.navigate({ pathname: '/players', params: { f: 'late' } })} />
        <StatCard dot={C.warning} label={t('بتخلص قريب', 'Ending soon')} value={d.soon.length} sub={t('اشتراكات خلال 3 أيام', 'Within 3 days')}
          onPress={() => router.navigate({ pathname: '/players', params: { f: 'soon' } })} />
      </View>

      <View style={{ gap: 10 }}>
        <Txt size={16} w={600}>{t('ابدأ بسرعة', 'Quick start')}</Txt>
        <View style={[s.row, { gap: 10 }]}>
          <Quick icon="timer" label={t('تمرين', 'Workout')} primary onPress={() => router.navigate('/workout')} />
          <Quick icon="glove" label={t('سبارينج', 'Sparring')} onPress={() => router.push('/sparring')} />
          <Quick icon="pulse" label={t('جولات هوا', 'Shadow')} onPress={() => router.push('/shadow')} />
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title={t('تذكيرات الدفع', 'Payment reminders')} right={
          <Press onPress={() => router.navigate({ pathname: '/players', params: { f: 'late' } })}><Txt size={12} color={C.accent}>{t('عرض الكل', 'See all')}</Txt></Press>
        } />
        {reminders.length === 0 ? <Txt size={13} color={C.muted}>{t('كله دافع', 'Everyone has paid')}</Txt> : null}
        {reminders.map(({ p, st }) => (
          <Press key={p.id} onPress={() => router.push(`/player/${p.id}`)}
            style={[s.row, { backgroundColor: C.surface, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 12, gap: 10 }]}>
            <Avatar ini={initials(nm(p))} uri={p.photoUri} size={38} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt size={14} w={500}>{nm(p)}</Txt>
              <Txt size={11} color={st.kind === 'late' ? C.danger : C.warning}>{payLine(st)} · {branchName(branchOf(db, p.id))}</Txt>
            </View>
            <OutlineBtn label={t('تذكير واتساب', 'WhatsApp')} onPress={() => whatsapp(p.phone, nm(p), payLine(st))} />
          </Press>
        ))}
      </View>

      {outbox > 0 ? (
        <View style={[s.row, { gap: 8, justifyContent: 'center' }]}>
          <Dot color={C.warning} size={6} />
          <Txt size={11} color={C.muted}>{t(`${outbox} تسجيل محفوظ على الموبايل · هيتزامن لما النت يرجع`, `${outbox} records saved on this phone · will sync when online`)}</Txt>
        </View>
      ) : null}
    </Screen>
  );
}

function StatCard({ dot, label, value, sub, onPress }: { dot: string; label: string; value: number; sub: string; onPress?: () => void }) {
  return (
    <Press onPress={onPress} style={{ flex: 1, backgroundColor: C.surface, borderRadius: 22, padding: 16, gap: 8 }}>
      <View style={[s.row, { gap: 6 }]}><Dot color={dot} /><Txt size={12} color={C.muted}>{label}</Txt></View>
      <Txt size={28} w={700}>{value}</Txt>
      <Txt size={11} color={C.muted}>{sub}</Txt>
    </Press>
  );
}

function Quick({ icon, label, primary, onPress }: { icon: IconName; label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="button"
      style={{ flex: 1, backgroundColor: C.surface, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', gap: 10 }}>
      <View style={[s.center, { width: 44, height: 44, borderRadius: 22, backgroundColor: primary ? C.accent : C.surface2 }]}>
        <Icon name={icon} size={20} color={primary ? C.bg : C.accent} stroke={2} />
      </View>
      <Txt size={12} w={500}>{label}</Txt>
    </Press>
  );
}
