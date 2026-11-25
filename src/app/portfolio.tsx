import { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Avatar, Field, Header, IconBtn, OutlineBtn, Press, Screen, Toggle, Txt, s } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { ClubsEditor, ProfileEditor, ScheduleEditor } from '@/components/PortfolioEditors';
import { COACH } from '@/data/seed';
import { Portfolio as P, SocialKey, notify, uid, useDB, useStore } from '@/data/store';
import { nm, useT } from '@/i18n';
import { dayFull, fmtTime, toMin } from '@/logic/dates';
import { initials } from '@/logic/queries';
import { C } from '@/theme';

const slug = (name: string, email?: string) => {
  const latin = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return latin || (email ?? 'coach').split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-');
};
const SOCIAL: { key: SocialKey; label: string; base: string }[] = [
  { key: 'instagram', label: 'Instagram', base: 'https://instagram.com/' },
  { key: 'facebook', label: 'Facebook', base: 'https://facebook.com/' },
  { key: 'tiktok', label: 'TikTok', base: 'https://tiktok.com/@' },
  { key: 'youtube', label: 'YouTube', base: 'https://youtube.com/@' },
];
const socialUrl = (k: SocialKey, v: string) => (/^https?:\/\//.test(v) ? v : SOCIAL.find((x) => x.key === k)!.base + v.replace(/^@/, ''));

/** Coach portfolio (SPEC §9.3): profile, stats, achievements, social links, clubs & schedule, public link. */
export default function Portfolio() {
  const t = useT();
  const db = useDB();
  const pf = useStore((st) => st.portfolio);
  const auth = useStore((st) => st.auth);
  const [edit, setEdit] = useState(false);
  const [ach, setAch] = useState('');
  const [achYear, setAchYear] = useState('');

  const save = (p: Partial<P>) => useStore.getState().set({ portfolio: { ...useStore.getState().portfolio, ...p } });
  const name = pf.fullName || auth?.name || nm(COACH);
  const link = `coach.app/c/${slug(name, auth?.email)}`;
  const stats = useMemo(() => ({ players: db.players.filter((p) => !p.archived).length, rounds: db.rounds.length }), [db]);

  const addAchievement = () => {
    if (!ach.trim()) return;
    const y = parseInt(achYear, 10);
    save({ achievements: [...pf.achievements, { id: uid('ac'), title: ach.trim(), year: y > 1950 && y < 2100 ? y : undefined }] });
    setAch(''); setAchYear('');
  };

  return (
    <Screen gap={16}>
      <Header title={t('البورتفوليو بتاعي', 'My portfolio')}
        right={<IconBtn icon={edit ? 'check' : 'edit'} label={edit ? t('تم', 'Done') : t('تعديل', 'Edit')} onPress={() => setEdit((e) => !e)} bg={edit ? C.accent : C.surface} color={edit ? C.bg : C.text} />} />

      {edit ? <ProfileEditor /> : (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Avatar ini={initials(name)} uri={pf.photoUri} size={88} ring />
          <Txt size={24} w={700} center>{t(`كابتن ${name.replace(/^كابتن\s*/, '')}`, `Coach ${name.replace(/^Coach\s*/, '')}`)}</Txt>
          <Txt size={13} color={C.text2} center style={{ lineHeight: 22, maxWidth: 320 }}>
            {pf.bio || t('اضغط على القلم وضيف نبذة عنك: بتدرّب مين، وبتركّز على إيه.', 'Tap the pencil to add a bio: who you coach and what you focus on.')}
          </Txt>
        </View>
      )}

      <View style={[s.row, { backgroundColor: C.surface, borderRadius: 22, paddingVertical: 14 }]}>
        <Stat value={String(pf.years || '–')} label={t('سنين خبرة', 'Years exp.')} accent border />
        <Stat value={String(stats.players)} label={t('لاعب', 'Players')} border />
        <Stat value={stats.rounds.toLocaleString('en-US')} label={t('جولة', 'Rounds')} />
      </View>

      <View style={[s.row, { backgroundColor: C.accent, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 12 }]}>
        <Press style={{ flex: 1, gap: 2, minWidth: 0 }} disabled={!pf.public}
          onPress={async () => { await Clipboard.setStringAsync(`https://${link}`); notify(t('اتنسخ اللينك', 'Link copied')); }}>
          <Txt size={14} w={600} color={C.bg}>{pf.public ? t('البورتفوليو عام · أي حد معاه اللينك يشوفه', 'Public · anyone with the link can see it') : t('البورتفوليو مخفي', 'Portfolio hidden')}</Txt>
          <Txt size={11} color={C.bg} ltr numberOfLines={1}>{pf.public ? `${link}  ·  ${t('اضغط للنسخ', 'tap to copy')}` : t('فعّله علشان تاخد لينك تشاركه', 'Turn on to get a link to share')}</Txt>
        </Press>
        <Toggle dark label={t('البورتفوليو عام', 'Public portfolio')} on={pf.public} onChange={(v) => save({ public: v })} />
      </View>
      {pf.public ? <Txt size={11} color={C.muted} style={{ marginTop: -8 }}>{t('اللينك هيفتح للناس لما نربط السيرفر', 'The link goes live once the server is connected')}</Txt> : null}

      {/* achievements */}
      <View style={{ gap: 8 }}>
        <Txt size={15} w={600}>{t('الإنجازات والشهادات', 'Achievements & certificates')}</Txt>
        <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
          {pf.achievements.map((a) => (
            <Press key={a.id} onPress={() => edit && save({ achievements: pf.achievements.filter((x) => x.id !== a.id) })}
              style={[s.row, { height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.surface, gap: 6 }]}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
              <Txt size={12}>{a.title}{a.year ? ` · ${a.year}` : ''}</Txt>
              {edit ? <Icon name="close" size={12} color={C.muted} stroke={2} /> : null}
            </Press>
          ))}
          {pf.achievements.length === 0 && !edit ? <Txt size={12} color={C.muted}>{t('لسه مفيش إنجازات', 'No achievements yet')}</Txt> : null}
        </View>
        {edit ? (
          <View style={[s.row, { gap: 8 }]}>
            <Field value={ach} onChangeText={setAch} placeholder={t('شهادة تدريب', 'Coaching certificate')} style={{ flex: 1, height: 40 }} />
            <Field value={achYear} onChangeText={setAchYear} placeholder={t('السنة', 'Year')} keyboardType="number-pad" maxLength={4} style={{ width: 74, height: 40 }} />
            <OutlineBtn label={t('+ إضافة', '+ Add')} onPress={addAchievement} />
          </View>
        ) : null}
      </View>

      {/* social links */}
      <View style={{ gap: 8 }}>
        <Txt size={15} w={600}>{t('السوشيال ميديا', 'Social links')}</Txt>
        {edit ? SOCIAL.map((x) => (
          <View key={x.key} style={[s.row, { gap: 10 }]}>
            <Txt size={12} color={C.muted} style={{ width: 80 }}>{x.label}</Txt>
            <Field value={pf.social[x.key] ?? ''} onChangeText={(v) => save({ social: { ...pf.social, [x.key]: v.trim() } })}
              placeholder="@username" autoCapitalize="none" style={{ flex: 1, height: 40, writingDirection: 'ltr' }} />
          </View>
        )) : (
          <View style={[s.row, { flexWrap: 'wrap', gap: 8 }]}>
            {SOCIAL.filter((x) => pf.social[x.key]).map((x) => (
              <Press key={x.key} onPress={() => Linking.openURL(socialUrl(x.key, pf.social[x.key]!))}
                style={[s.row, { height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.surface, gap: 6 }]}>
                <Icon name="globe" size={14} color={C.accent} />
                <Txt size={12}>{x.label}</Txt>
              </Press>
            ))}
            {!SOCIAL.some((x) => pf.social[x.key]) ? <Txt size={12} color={C.muted}>{t('ضيف حساباتك من زرار التعديل', 'Add your accounts via edit')}</Txt> : null}
          </View>
        )}
      </View>

      {/* clubs & schedule */}
      <Txt size={15} w={600} style={{ marginTop: 4 }}>{t('النوادي والمواعيد', 'Clubs & schedule')}</Txt>
      {edit ? (
        <>
          <ClubsEditor />
          <ScheduleEditor />
        </>
      ) : (
        <>
          {pf.clubs.map((c) => {
            const slots = pf.schedule.filter((x) => x.clubId === c.id).sort((a, b) => a.day - b.day || toMin(a.start) - toMin(b.start));
            const days = [...new Set(slots.map((x) => x.day))];
            return (
              <View key={c.id} style={{ backgroundColor: C.surface, borderRadius: 24, padding: 14, gap: 10 }}>
                <View style={[s.row, { gap: 10 }]}>
                  <View style={[s.center, { width: 40, height: 40, borderRadius: 14, backgroundColor: C.surface2 }]}><Icon name="pin" size={18} color={C.accent} /></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt size={15} w={600}>{c.name || t('نادي', 'Club')}</Txt>
                    <Txt size={11} color={C.muted}>{c.address || t('من غير عنوان', 'No address')}</Txt>
                  </View>
                  <Txt size={11} color={C.accent}>{t(`${days.length} أيام · ${slots.length} فترات`, `${days.length} days · ${slots.length} slots`)}</Txt>
                </View>
                {days.map((d) => (
                  <View key={d} style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
                    <Txt size={12} color={C.text2} style={{ width: 62 }}>{dayFull(d)}</Txt>
                    {slots.filter((x) => x.day === d).map((x) => (
                      <View key={x.id} style={[s.row, { height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: C.surface2, gap: 6 }]}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
                        <Txt size={11}>{fmtTime(x.start)} – {fmtTime(x.end)}</Txt>
                      </View>
                    ))}
                  </View>
                ))}
                {!slots.length ? <Txt size={12} color={C.muted}>{t('مفيش مواعيد لسه', 'No slots yet')}</Txt> : null}
              </View>
            );
          })}
          {!pf.clubs.length ? <Txt size={12} color={C.muted}>{t('ضيف نواديك من زرار التعديل', 'Add your clubs via edit')}</Txt> : null}
        </>
      )}
    </Screen>
  );
}

function Stat({ value, label, accent, border }: { value: string; label: string; accent?: boolean; border?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4, borderEndWidth: border ? 1 : 0, borderColor: C.surface2 }}>
      <Txt size={22} w={700} color={accent ? C.accent : C.text}>{value}</Txt>
      <Txt size={11} color={C.muted}>{label}</Txt>
    </View>
  );
}
