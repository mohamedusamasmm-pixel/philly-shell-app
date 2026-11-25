import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Avatar, Badge, OutlineBtn, Pill, Press, Screen, SearchBox, Txt, s } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useDB, useStore } from '@/data/store';
import { nm, plural, useT } from '@/i18n';
import { tenure } from '@/logic/dates';
import { PAY_COLOR, PayKind, branchName, initials, levelName, levelOf, payLabel, payStatus, playersIn, weightOf } from '@/logic/queries';
import { C } from '@/theme';

type F = 'all' | PayKind;

export default function Players() {
  const t = useT();
  const db = useDB();
  const branch = useStore((st) => st.branch);
  const branches = useStore((st) => st.branches);
  const params = useLocalSearchParams<{ f?: F }>();
  const [f, setF] = useState<F>('all');
  const [q, setQ] = useState('');
  const [byWeight, setByWeight] = useState(false);

  useEffect(() => {
    if (params.f) setF(params.f);
  }, [params.f]);

  const rows = useMemo(
    () => playersIn(db, branch).map((p) => ({ p, w: weightOf(db, p.id), lvl: levelOf(db, p.id), st: payStatus(db, p.id) })),
    [db, branch],
  );
  const counts = useMemo(() => {
    const c = { all: rows.length, ok: 0, soon: 0, late: 0 };
    rows.forEach((r) => c[r.st.kind]++);
    return c;
  }, [rows]);

  const needle = q.trim().toLowerCase();
  const list = rows
    .filter((r) => f === 'all' || r.st.kind === f)
    .filter((r) => !needle || r.p.name.includes(needle) || (r.p.nameEn ?? '').toLowerCase().includes(needle) || r.p.phone.includes(needle))
    .sort((a, b) => (byWeight ? a.w - b.w : 0));

  const nBranches = branch === 'all' ? branches.length : 1;
  const where = branch === 'all' ? t('كل الفروع', 'All branches') : t(`فرع ${branchName(branch)}`, `${branchName(branch)} branch`);
  const sub = t(
    `${rows.length} لاعب في ${nBranches === 1 ? 'فرع واحد' : nBranches === 2 ? 'فرعين' : `${nBranches} فروع`}`,
    `${plural(rows.length, 'player')} in ${plural(nBranches, 'branch', 'branches')}`,
  );

  return (
    <Screen nav>
      <View style={s.rowBetween}>
        <View style={{ gap: 2 }}>
          <Txt size={30} w={700}>{t('اللاعبين', 'Players')}</Txt>
          <Txt size={12} color={C.muted}>{sub}</Txt>
        </View>
        <Press accessibilityLabel={t('إضافة لاعب', 'Add player')} onPress={() => router.push('/add-player')}
          style={[s.center, { width: 48, height: 48, borderRadius: 24, backgroundColor: C.accent }]}>
          <Icon name="plus" size={22} color={C.bg} stroke={2.2} />
        </Press>
      </View>

      <SearchBox value={q} onChangeText={setQ} placeholder={t('ابحث باسم اللاعب أو التليفون', 'Search by name or phone')} accessibilityLabel={t('بحث', 'Search')} />

      <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
        <Pill small label={`${t('الكل', 'All')} ${counts.all}`} on={f === 'all'} onPress={() => setF('all')} />
        <Pill small label={`${payLabel('ok')} ${counts.ok}`} on={f === 'ok'} onPress={() => setF('ok')} />
        <Pill small label={`${payLabel('soon')} ${counts.soon}`} on={f === 'soon'} onPress={() => setF('soon')} />
        <Pill small label={`${payLabel('late')} ${counts.late}`} on={f === 'late'} onPress={() => setF('late')} />
      </View>

      <View style={s.rowBetween}>
        <Txt size={13} color={C.muted}>{where} · {t(`${list.length} لاعب`, plural(list.length, 'player'))}</Txt>
        <OutlineBtn h={32} icon="sort" label={byWeight ? t('مترتب بالوزن', 'By weight') : t('ترتيب بالوزن', 'Sort by weight')} color={byWeight ? C.accent : C.text2}
          onPress={() => setByWeight((x) => !x)} />
      </View>

      <View style={{ gap: 10 }}>
        {list.map(({ p, w, lvl, st }) => (
          <Press key={p.id} onPress={() => router.push(`/player/${p.id}`)}
            style={[s.row, { backgroundColor: C.surface, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, gap: 12 }]}>
            <Avatar ini={initials(nm(p))} uri={p.photoUri} size={44} />
            <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
              <Txt size={15} w={500} numberOfLines={1}>{nm(p)}</Txt>
              <Txt size={11} color={C.muted} numberOfLines={1}>{w} {t('كجم', 'kg')} · {levelName(lvl)} · {t('بقاله', 'for')} {tenure(p.joinedAt)}</Txt>
            </View>
            <Badge label={payLabel(st.kind)} color={PAY_COLOR[st.kind]} />
          </Press>
        ))}
        {list.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
            <Txt size={13} color={C.muted} center>{rows.length ? t('مفيش لاعبين بالفلتر ده', 'No players match this filter') : t('مفيش لاعبين في الفرع ده لسه', 'No players in this branch yet')}</Txt>
            {!rows.length ? <OutlineBtn label={t('+ إضافة لاعب', '+ Add player')} onPress={() => router.push('/add-player')} /> : null}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
