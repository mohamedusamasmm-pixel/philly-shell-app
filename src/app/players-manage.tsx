import { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Header, IconBtn, Pill, Press, Screen, SearchBox, Txt, s } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { notify, useDB, useStore } from '@/data/store';
import { nm, useT } from '@/i18n';
import { branchName, branchOf, initials } from '@/logic/queries';
import { C } from '@/theme';

const intlPhone = (p: string) => (p.startsWith('0') ? `+20 ${p.slice(1, 4)} ${p.slice(4, 7)} ${p.slice(7)}` : p);

/** Settings › Players: everyone with photo, number and branch; call / WhatsApp; add, edit, archive. */
export default function PlayersManage() {
  const t = useT();
  const db = useDB();
  const branches = useStore((st) => st.branches);
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState<'all' | string>('all');
  const [archived, setArchived] = useState(false);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return db.players
      .filter((p) => !!p.archived === archived)
      .filter((p) => branch === 'all' || branchOf(db, p.id) === branch)
      .filter((p) => !needle || p.name.includes(needle) || (p.nameEn ?? '').toLowerCase().includes(needle) || p.phone.includes(needle))
      .sort((a, b) => nm(a).localeCompare(nm(b)));
  }, [db, q, branch, archived]);
  const archivedCount = db.players.filter((p) => p.archived).length;

  const call = (phone: string) => (phone ? Linking.openURL(`tel:${phone}`) : notify(t('مفيش رقم', 'No number')));
  const wa = (phone: string) => (phone ? Linking.openURL(`https://wa.me/2${phone}`).catch(() => notify(t('واتساب مش متسطّب', 'WhatsApp isn’t installed'))) : notify(t('مفيش رقم', 'No number')));

  return (
    <Screen gap={14}>
      <Header title={t('اللاعبين', 'Players')}
        right={<IconBtn icon="plus" label={t('إضافة لاعب', 'Add player')} bg={C.accent} color={C.bg} onPress={() => router.push('/add-player')} />} />

      <SearchBox value={q} onChangeText={setQ} placeholder={t('ابحث بالاسم أو الرقم', 'Search by name or number')} />

      <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
        <Pill small label={t('كل الفروع', 'All branches')} on={branch === 'all'} onPress={() => setBranch('all')} />
        {branches.map((b) => <Pill small key={b.id} label={nm(b)} on={branch === b.id} onPress={() => setBranch(b.id)} />)}
      </View>

      <View style={s.rowBetween}>
        <Txt size={13} color={C.muted}>{archived ? t(`${list.length} في الأرشيف`, `${list.length} archived`) : t(`${list.length} لاعب`, `${list.length} players`)}</Txt>
        <Press onPress={() => setArchived((a) => !a)}>
          <Txt size={12} color={C.accent}>{archived ? t('رجوع للنشطين', 'Show active') : t(`الأرشيف (${archivedCount})`, `Archive (${archivedCount})`)}</Txt>
        </Press>
      </View>

      <Press onPress={() => router.push('/add-player')} style={[s.row, { justifyContent: 'center', gap: 8, height: 50, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border }]}>
        <Icon name="userPlus" size={18} color={C.accent} stroke={1.9} />
        <Txt size={14} w={500} color={C.accent}>{t('+ إضافة لاعب', '+ Add player')}</Txt>
      </Press>

      <View style={{ gap: 10 }}>
        {list.map((p) => (
          <Press key={p.id} onPress={() => router.push({ pathname: '/add-player', params: { id: p.id } })}
            style={[s.row, { backgroundColor: C.surface, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 12, gap: 12, opacity: p.archived ? 0.6 : 1 }]}>
            <Avatar ini={initials(nm(p))} uri={p.photoUri} size={44} />
            <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
              <Txt size={15} w={500} numberOfLines={1}>{nm(p)}</Txt>
              <Txt size={11} color={C.muted} ltr numberOfLines={1}>{p.phone ? intlPhone(p.phone) : t('مفيش رقم', 'No number')}</Txt>
              <Txt size={11} color={C.muted}>{branchName(branchOf(db, p.id))}{p.noReminders ? t(' · من غير تذكيرات', ' · no reminders') : ''}</Txt>
            </View>
            <Press accessibilityLabel={t(`اتصل بـ ${nm(p)}`, `Call ${nm(p)}`)} onPress={() => call(p.phone)}
              style={[s.center, { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface2 }]}>
              <Icon name="phone" size={18} color={C.text} stroke={1.9} />
            </Press>
            <Press accessibilityLabel={t(`واتساب ${nm(p)}`, `WhatsApp ${nm(p)}`)} onPress={() => wa(p.phone)}
              style={[s.center, { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(198,244,50,.14)' }]}>
              <Icon name="whatsapp" size={18} color={C.accent} stroke={1.9} />
            </Press>
          </Press>
        ))}
        {list.length === 0 ? <Txt size={13} color={C.muted} center style={{ paddingVertical: 20 }}>{t('مفيش لاعبين هنا', 'No players here')}</Txt> : null}
      </View>
    </Screen>
  );
}
