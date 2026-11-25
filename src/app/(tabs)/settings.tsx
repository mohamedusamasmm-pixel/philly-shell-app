import { View } from 'react-native';
import { router } from 'expo-router';
import { AppLogoMark } from '@/components/AppLogo';
import { Avatar, ListRow, Press, Screen, Txt, s } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { COACH } from '@/data/seed';
import { useDB, useStore } from '@/data/store';
import { nm, plural, useT } from '@/i18n';
import { mmss } from '@/logic/dates';
import { initials } from '@/logic/queries';
import { useReminderCounts } from '@/logic/useReminders';
import { C } from '@/theme';

/** Settings tab (design: Settings.dc.html). */
export default function Settings() {
  const t = useT();
  const db = useDB();
  const auth = useStore((st) => st.auth);
  const lang = useStore((st) => st.lang);
  const portfolio = useStore((st) => st.portfolio);
  const spar = useStore((st) => st.spar);
  const { payTodo, trainTodo, todo } = useReminderCounts();

  const name = portfolio.fullName || auth?.name || nm(COACH);
  const coach = t(`كابتن ${name.replace(/^كابتن\s*/, '')}`, `Coach ${name.replace(/^Coach\s*/, '')}`);
  const clubs = portfolio.clubs.length;
  const rounds = spar ?? { rounds: 3, roundSec: 180, restSec: 60, maxDiff: 5 };
  const active = db.players.filter((p) => !p.archived).length;

  return (
    <Screen nav gap={14}>
      <Txt size={30} w={700}>{t('الإعدادات', 'Settings')}</Txt>

      <Press onPress={() => router.push('/portfolio')} style={[s.row, { backgroundColor: C.surface, borderRadius: 26, padding: 14, gap: 12 }]}>
        <Avatar ini={initials(name)} size={46} ring />
        <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
          <Txt size={17} w={600} numberOfLines={1}>{coach}</Txt>
          <Txt size={12} color={C.muted} ltr numberOfLines={1}>{auth?.email ?? ''}</Txt>
        </View>
        <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.surface2, justifyContent: 'center' }}>
          <Txt size={12} color={C.accent}>{t('البورتفوليو', 'Portfolio')}</Txt>
        </View>
      </Press>

      <View style={[s.row, { backgroundColor: C.accent, borderRadius: 26, paddingVertical: 14, paddingHorizontal: 16, gap: 12 }]}>
        <View style={[s.center, { width: 46, height: 46, borderRadius: 16, backgroundColor: 'rgba(11,12,10,.12)' }]}>
          <Icon name="message" size={22} color={C.bg} stroke={2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt size={16} w={600} color={C.bg}>{todo ? t(`${todo} رسايل جاهزة`, `${plural(todo, 'message')} ready`) : t('مفيش رسايل النهارده', 'No messages today')}</Txt>
          <Txt size={12} color={C.bg}>{t(`${payTodo} تذكير دفع · ${trainTodo} تذكير تدريب`, `${payTodo} payment · ${trainTodo} training`)}</Txt>
        </View>
        <Press onPress={() => router.push('/reminders')} style={{ height: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: C.bg, justifyContent: 'center' }}>
          <Txt size={13} w={500}>{todo ? t('ابعتهم', 'Send') : t('افتح', 'Open')}</Txt>
        </Press>
      </View>

      <Group title={t('اللاعبين والتواصل', 'Players & messaging')}>
        <ListRow icon="userPlus" label={t('اللاعبين', 'Players')} meta={t(`${active} لاعب · الأرقام والصور · إضافة لاعب`, `${active} players · numbers & photos · add a player`)} onPress={() => router.push('/players-manage')} />
        <ListRow icon="bell" label={t('التذكيرات', 'Reminders')} meta={t('ميعاد التدريب والدفع · قوالب الرسايل', 'Training & payment · message templates')} onPress={() => router.push('/reminders')} />
        <ListRow icon="share" label={t('مشاركة الإحصائيات', 'Share stats')} meta={t('اختار لاعبين وابعت تقريرهم واتساب', 'Pick players and send their report on WhatsApp')} onPress={() => router.push('/share-stats')} last />
      </Group>

      <Group title={t('الكابتن', 'Coach')}>
        <ListRow icon="card" label={t('البورتفوليو بتاعي', 'My portfolio')} meta={t('النبذة · الإنجازات · لينك عام', 'Bio · achievements · public link')} onPress={() => router.push('/portfolio')} />
        <ListRow icon="clock" label={t('النوادي والمواعيد', 'Clubs & schedule')}
          meta={t(`${clubs === 1 ? 'نادي واحد' : clubs === 2 ? 'ناديين' : `${clubs} نوادي`} · ${portfolio.schedule.length} فترات في الأسبوع`, `${plural(clubs, 'club')} · ${plural(portfolio.schedule.length, 'slot')} a week`)}
          onPress={() => router.push({ pathname: '/portfolio', params: { focus: 'clubs' } })} last />
      </Group>

      <Group title={t('التمرين', 'Training')}>
        <ListRow icon="sound" label={t('الأصوات', 'Sounds')} meta={t('بداية · نص الجولة · آخر 10 ثواني · نهاية', 'Start · half round · last 10 s · end')} onPress={() => router.push('/sounds')} />
        <ListRow icon="rounds" label={t('إعدادات الجولات', 'Round settings')}
          meta={t(`${rounds.rounds} جولات × ${mmss(rounds.roundSec)} · راحة ${mmss(rounds.restSec)} · فرق وزن ${rounds.maxDiff} كجم`, `${rounds.rounds} × ${mmss(rounds.roundSec)} · rest ${mmss(rounds.restSec)} · ${rounds.maxDiff} kg gap`)}
          onPress={() => router.push('/sparring')} last />
      </Group>

      <Group title={t('الحساب', 'Account')}>
        <ListRow icon="globe" label={t('الحساب', 'Account')}
          meta={t(`${auth?.email ?? ''} · اللغة: العربية · تسجيل الخروج`, `${auth?.email ?? ''} · Language: English · sign out`)}
          onPress={() => router.push('/account')} last />
      </Group>
      <View style={[s.row, { justifyContent: 'center', gap: 6 }]}>
        <AppLogoMark size={16} color={C.accent} />
        <Txt size={10} color={C.muted}>{lang === 'ar' ? 'كابتن · نسخة 1.0' : 'Coach App · version 1.0'}</Txt>
      </View>
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt size={12} color={C.muted} style={{ paddingHorizontal: 6 }}>{title}</Txt>
      <View style={{ backgroundColor: C.surface, borderRadius: 22, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}
