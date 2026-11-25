import { View } from 'react-native';
import { router } from 'expo-router';
import { Card, Field, Header, ListRow, Screen, Segmented, Txt } from '@/components/ui';
import { pendingCount, useStore } from '@/data/store';
import { useT } from '@/i18n';
import { C } from '@/theme';

/** Account: profile basics, language, offline outbox, sign out. */
export default function Account() {
  const t = useT();
  const auth = useStore((st) => st.auth);
  const lang = useStore((st) => st.lang);
  const outbox = useStore((st) => pendingCount(st.local));
  const setAuth = (p: Partial<NonNullable<typeof auth>>) => auth && useStore.getState().set({ auth: { ...auth, ...p } });

  return (
    <Screen gap={14}>
      <Header title={t('الحساب', 'Account')} />

      <Card style={{ gap: 10 }}>
        <Txt size={12} color={C.muted}>{t('اسم الكابتن', 'Coach name')}</Txt>
        <Field value={auth?.name ?? ''} onChangeText={(v) => setAuth({ name: v })} />
        <Txt size={12} color={C.muted}>{t('اسم النادي / الأكاديمية', 'Club / academy name')}</Txt>
        <Field value={auth?.club ?? ''} onChangeText={(v) => setAuth({ club: v })} />
        <Txt size={12} color={C.muted}>{t('الإيميل', 'Email')}</Txt>
        <Txt size={14} ltr>{auth?.email ?? '—'}</Txt>
      </Card>

      <Txt size={12} color={C.muted} style={{ paddingHorizontal: 6 }}>{t('اللغة', 'Language')}</Txt>
      <Segmented<'ar' | 'en'> value={lang} onChange={(l) => useStore.getState().set({ lang: l })}
        options={[{ key: 'ar', label: 'العربية' }, { key: 'en', label: 'English' }]} />

      <Card style={{ gap: 4 }}>
        <Txt size={14} w={500}>{t('البيانات', 'Data')}</Txt>
        <Txt size={12} color={C.muted} style={{ lineHeight: 19 }}>
          {outbox
            ? t(`${outbox} تسجيل محفوظ على الموبايل. هيتزامن مع السيرفر لما نربطه.`, `${outbox} records saved on this phone. They'll sync once the server is connected.`)
            : t('كل حاجة محفوظة على الموبايل.', 'Everything is saved on this phone.')}
        </Txt>
      </Card>

      <View style={{ backgroundColor: C.surface, borderRadius: 22, overflow: 'hidden' }}>
        <ListRow icon="logout" label={t('تسجيل الخروج', 'Sign out')} meta={t('هترجع لشاشة الدخول', 'Back to the sign-in screen')}
          color={C.danger} textColor={C.danger} last
          onPress={() => { useStore.getState().set({ auth: null }); router.replace('/login'); }} />
      </View>
    </Screen>
  );
}
