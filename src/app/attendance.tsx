import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, BigButton, Header, IconBtn, OutlineBtn, Pill, Press, Screen, SearchBox, Txt, s } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { notify, useDB, useStore } from '@/data/store';
import { nm, useT } from '@/i18n';
import { dayFull, dayMonth, satIndex, today } from '@/logic/dates';
import { branchOf, initials, presentOn } from '@/logic/queries';
import { tap } from '@/logic/useSounds';
import { C } from '@/theme';

/** Manual check-in (SPEC 4.2). QR scanning needs a development build with expo-camera. */
export default function Attendance() {
  const t = useT();
  const db = useDB();
  const local = useStore((st) => st.local.attendance);
  const branches = useStore((st) => st.branches);
  const [branch, setBranch] = useState(() => {
    const st = useStore.getState();
    return st.branch === 'all' ? st.branches[0].id : st.branch;
  });
  const [q, setQ] = useState('');
  const T = today();

  const present = presentOn(db, T, branch);
  const roster = useMemo(() => db.players.filter((p) => !p.archived && branchOf(db, p.id) === branch), [db, branch]);
  const needle = q.trim().toLowerCase();
  const list = roster.filter((p) => !needle || p.name.includes(needle) || (p.nameEn ?? '').toLowerCase().includes(needle));

  const toggle = (pid: string) => {
    tap();
    const st = useStore.getState();
    const id = present.get(pid);
    if (!id) return st.append('attendance', [{ playerId: pid, branchId: branch, date: T, method: 'manual' }]);
    // append-only: only an unsynced check-in from this device can be withdrawn
    if (local.some((a) => a.id === id && !a.synced)) return st.withdraw('attendance', id);
    notify(t('الحضور ده اتزامن خلاص ومينفعش يتشال', 'This check-in is already synced and can’t be removed'));
  };

  return (
    <Screen gap={14} footer={<BigButton label={t(`تمام · ${present.size} حاضر`, `Done · ${present.size} here`)} onPress={() => router.back()} />}>
      <Header title={t('تسجيل حضور', 'Check-in')} sub={`${dayFull(satIndex(T))} ${dayMonth(T)}`}
        right={<IconBtn icon="qr" label={t('مسح QR', 'Scan QR')} onPress={() => notify(t('مسح الـ QR محتاج نسخة الموبايل (development build)', 'QR scanning needs the installed app build'))} />} />

      <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
        {branches.map((b) => <Pill key={b.id} label={nm(b)} on={branch === b.id} onPress={() => setBranch(b.id)} />)}
      </View>

      <SearchBox value={q} onChangeText={setQ} placeholder={t('ابحث باسم اللاعب', 'Search players')} />

      <Txt size={13} color={C.text2}>{t(`${present.size} من ${roster.length} حاضرين`, `${present.size} of ${roster.length} here`)}</Txt>

      {roster.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
          <Txt size={13} color={C.muted}>{t('مفيش لاعبين في الفرع ده لسه', 'No players in this branch yet')}</Txt>
          <OutlineBtn label={t('+ إضافة لاعب', '+ Add player')} onPress={() => router.push('/add-player')} />
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        {list.map((p) => {
          const on = present.has(p.id);
          return (
            <Press key={p.id} onPress={() => toggle(p.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={[s.row, { backgroundColor: C.surface, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 12, gap: 12 }]}>
              <Avatar ini={initials(nm(p))} uri={p.photoUri} size={38} />
              <Txt size={14} w={500} style={{ flex: 1 }}>{nm(p)}</Txt>
              <View style={[s.center, { width: 28, height: 28, borderRadius: 9, backgroundColor: on ? C.accent : 'transparent', borderWidth: on ? 0 : 2, borderColor: C.off }]}>
                {on ? <Icon name="check" size={16} color={C.bg} stroke={3} /> : null}
              </View>
            </Press>
          );
        })}
      </View>
    </Screen>
  );
}
