import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { BigButton, Press, Screen, Txt, s } from '@/components/ui';
import { ClubsEditor, ProfileEditor, ScheduleEditor } from '@/components/PortfolioEditors';
import { notify, useStore } from '@/data/store';
import { useT } from '@/i18n';
import { C } from '@/theme';

/** Right after sign-up: your details → your clubs → your schedule. */
export default function Onboarding() {
  const t = useT();
  const [step, setStep] = useState(0);
  const pf = useStore((st) => st.portfolio);

  const steps = [
    { title: t('بياناتك', 'Your details'), sub: t('الاسم والصورة والنبذة اللي هتظهر في البورتفوليو', 'Name, photo and bio for your portfolio'), body: <ProfileEditor /> },
    { title: t('النوادي', 'Your clubs'), sub: t('النوادي اللي بتدرّب فيها، وكل نادي تابع لأنهي فرع', 'Where you coach, and which branch each club belongs to'), body: <ClubsEditor /> },
    { title: t('المواعيد', 'Your schedule'), sub: t('مواعيدك في الأسبوع. ممكن أكتر من فترة في نفس اليوم', 'Your weekly slots. A day can have more than one'), body: <ScheduleEditor /> },
  ];

  const finish = () => {
    const st = useStore.getState();
    if (st.auth) st.set({ auth: { ...st.auth, onboarded: true } });
    notify(t('أهلاً بيك يا كابتن', 'Welcome, coach'));
    router.replace('/');
  };
  const next = () => {
    if (step === 0 && !(pf.fullName || useStore.getState().auth?.name)) return notify(t('اكتب اسمك', 'Enter your name'));
    if (step === 1 && pf.clubs.some((c) => !c.name.trim())) return notify(t('اكتب اسم كل نادي أو امسحه', 'Name every club or remove it'));
    if (step < 2) setStep(step + 1);
    else finish();
  };

  return (
    <Screen gap={16} footer={<BigButton label={step < 2 ? t('التالي', 'Next') : t('يلا نبدأ', "Let's go")} onPress={next} />}>
      <View style={s.rowBetween}>
        {step > 0 ? (
          <Press onPress={() => setStep(step - 1)}><Txt size={13} color={C.muted}>{t('رجوع', 'Back')}</Txt></Press>
        ) : <View />}
        <Press onPress={finish}><Txt size={13} color={C.muted}>{t('تخطّي', 'Skip')}</Txt></Press>
      </View>

      <View style={[s.row, { gap: 6 }]}>
        {steps.map((_, i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? C.accent : C.surface2 }} />)}
      </View>

      <View style={{ gap: 4 }}>
        <Txt size={12} color={C.accent}>{t(`خطوة ${step + 1} من 3`, `Step ${step + 1} of 3`)}</Txt>
        <Txt size={28} w={700}>{steps[step].title}</Txt>
        <Txt size={13} color={C.muted} style={{ lineHeight: 20 }}>{steps[step].sub}</Txt>
      </View>

      {steps[step].body}
    </Screen>
  );
}
