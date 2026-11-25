import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { AppLogo } from '@/components/AppLogo';
import { Icon } from '@/components/Icon';
import { Press, Txt, s } from '@/components/ui';
import { notify, useStore } from '@/data/store';
import { useT } from '@/i18n';
import { C, FONT } from '@/theme';

const PHOTOS = [
  require('../../assets/login/hero1.jpg'),
  require('../../assets/login/hero2.jpg'),
  require('../../assets/login/hero3.jpg'),
  require('../../assets/login/hero4.jpg'),
];
const INTERVAL = 4000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Tab = 'login' | 'signup';

/** Login / sign-up (design: تسجيل الدخول). Auth is local until Supabase Auth is connected. */
export default function Login() {
  const t = useT();
  const ins = useSafeAreaInsets();
  const lang = useStore((st) => st.lang);
  const [i, setI] = useState(0);
  const [tab, setTab] = useState<Tab>('login');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [f, setF] = useState({ name: '', club: '', email: '', pw: '', pw2: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  // cross-fading photo slideshow with a slow zoom (Ken Burns)
  const fades = useRef(PHOTOS.map((_, k) => new Animated.Value(k === 0 ? 1 : 0))).current;
  const zooms = useRef(PHOTOS.map(() => new Animated.Value(1))).current;
  useEffect(() => {
    const h = setInterval(() => setI((x) => (x + 1) % PHOTOS.length), INTERVAL);
    return () => clearInterval(h);
  }, []);
  useEffect(() => {
    PHOTOS.forEach((_, k) => {
      Animated.timing(fades[k], { toValue: k === i ? 1 : 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
      if (k === i) {
        zooms[k].setValue(1);
        Animated.timing(zooms[k], { toValue: 1.08, duration: 6000, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
      }
    });
  }, [i]);

  const signup = tab === 'signup';
  const submit = () => {
    const email = f.email.trim().toLowerCase();
    if (signup && !f.name.trim()) return notify(t('اكتب اسم الكابتن', 'Enter the coach name'));
    if (signup && !f.club.trim()) return notify(t('اكتب اسم النادي', 'Enter the club name'));
    if (!EMAIL.test(email)) return notify(t('الإيميل مش صحيح', 'That email isn’t valid'));
    if (f.pw.length < 6) return notify(t('الباسورد لازم 6 حروف على الأقل', 'Password must be at least 6 characters'));
    if (signup && f.pw !== f.pw2) return notify(t('الباسوردين مش زي بعض', 'Passwords don’t match'));
    const prev = useStore.getState().auth;
    const auth = signup
      ? { name: f.name.trim(), club: f.club.trim(), email, onboarded: false }
      : { name: prev?.email === email ? prev.name : email.split('@')[0], club: prev?.email === email ? prev.club : '', email };
    useStore.getState().set({ auth, remember: signup ? true : remember });
    notify(signup ? t(`أهلاً يا كابتن ${auth.name}`, `Welcome, Coach ${auth.name}`) : t('أهلاً بيك تاني', 'Welcome back'));
    router.replace(signup ? '/onboarding' : '/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* photos */}
      <View style={[StyleSheet.absoluteFill, { height: '62%', overflow: 'hidden' }]}>
        {PHOTOS.map((p, k) => (
          <Animated.Image key={k} source={p} resizeMode="cover"
            style={[StyleSheet.absoluteFill, { width: '100%', height: '100%', opacity: fades[k], transform: [{ scale: zooms[k] }] }]} />
        ))}
      </View>
      {/* fade to background, like the design's gradient */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0B0C0A" stopOpacity={0.55} />
            <Stop offset="0.18" stopColor="#0B0C0A" stopOpacity={0} />
            <Stop offset="0.34" stopColor="#0B0C0A" stopOpacity={0.2} />
            <Stop offset="0.58" stopColor="#0B0C0A" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#g)" />
      </Svg>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingTop: ins.top + 24, paddingBottom: ins.bottom + 28, paddingHorizontal: 22 }}>
          <View style={s.rowBetween}>
            <AppLogo size={42} />
            <View style={[s.row, { gap: 12 }]}>
              <View style={[s.row, { gap: 6 }]}>
                {PHOTOS.map((_, k) => (
                  <View key={k} style={{ height: 6, borderRadius: 3, width: k === i ? 22 : 6, backgroundColor: k === i ? C.accent : 'rgba(244,245,240,.4)' }} />
                ))}
              </View>
              <Press accessibilityLabel={t('English', 'العربية')} onPress={() => useStore.getState().set({ lang: lang === 'ar' ? 'en' : 'ar' })}
                style={[s.center, { height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(26,27,23,.7)' }]}>
                <Txt size={12} w={600}>{lang === 'ar' ? 'EN' : 'ع'}</Txt>
              </Press>
            </View>
          </View>

          <View style={{ flex: 1, minHeight: 160 }} />

          <View style={{ gap: 6, marginBottom: 20 }}>
            <Txt size={30} w={700} style={{ lineHeight: 39 }}>
              {signup ? t('ابدأ نادِيك\nفي دقيقة', 'Start your club\nin a minute') : t('أهلاً يا كابتن،\nالحلبة مستنياك', 'Welcome, coach.\nThe ring is waiting')}
            </Txt>
            <Txt size={13} color={C.text2} style={{ lineHeight: 21 }}>
              {signup ? t('سجّل حسابك وضيف فروعك ولاعبينك، وتابع كل جولة.', 'Create your account, add your branches and players, and track every round.')
                : t('ادخل بالإيميل والباسورد وكمّل من حيث ما وقفت.', 'Sign in with your email and password and pick up where you left off.')}
            </Txt>
          </View>

          <View style={[s.row, { gap: 24, marginBottom: 18 }]}>
            <TabBtn label={t('تسجيل الدخول', 'Sign in')} on={!signup} onPress={() => setTab('login')} />
            <TabBtn label={t('حساب جديد', 'New account')} on={signup} onPress={() => setTab('signup')} />
          </View>

          <View style={{ gap: 10 }}>
            {signup ? (
              <View style={[s.row, { gap: 10 }]}>
                <Labeled style={{ flex: 1 }} label={t('اسم الكابتن', 'Coach name')}>
                  <Input value={f.name} onChangeText={set('name')} placeholder={t('محمود علي', 'Mahmoud Ali')} />
                </Labeled>
                <Labeled style={{ flex: 1 }} label={t('اسم النادي', 'Club name')}>
                  <Input value={f.club} onChangeText={set('club')} placeholder={t('نادي النصر', 'Al Nasr Club')} />
                </Labeled>
              </View>
            ) : null}
            <Labeled label={t('الإيميل', 'Email')}>
              <Input value={f.email} onChangeText={set('email')} placeholder="coach@example.com" ltrValue
                keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            </Labeled>
            <Labeled label={t('الباسورد', 'Password')}>
              <View style={{ justifyContent: 'center' }}>
                <Input value={f.pw} onChangeText={set('pw')} placeholder="••••••••" ltrValue secureTextEntry={!showPw}
                  autoCapitalize="none" autoComplete={signup ? 'new-password' : 'password'} textContentType={signup ? 'newPassword' : 'password'}
                  style={{ paddingEnd: 50 }} onSubmitEditing={signup ? undefined : submit} returnKeyType={signup ? 'next' : 'go'} />
                <Press accessibilityLabel={t('إظهار الباسورد', 'Show password')} onPress={() => setShowPw((x) => !x)}
                  style={[s.center, { position: 'absolute', end: 4, width: 44, height: 44 }]}>
                  <Icon name={showPw ? 'eyeOff' : 'eye'} size={18} color={C.muted} />
                </Press>
              </View>
            </Labeled>
            {signup ? (
              <Labeled label={t('تأكيد الباسورد', 'Confirm password')}>
                <Input value={f.pw2} onChangeText={set('pw2')} placeholder="••••••••" ltrValue secureTextEntry={!showPw}
                  autoCapitalize="none" textContentType="newPassword" onSubmitEditing={submit} returnKeyType="go" />
              </Labeled>
            ) : (
              <View style={s.rowBetween}>
                <Press onPress={() => setRemember((r) => !r)} accessibilityRole="checkbox" accessibilityState={{ checked: remember }} style={[s.row, { gap: 8, minHeight: 32 }]}>
                  <View style={[s.center, { width: 18, height: 18, borderRadius: 5, backgroundColor: remember ? C.accent : 'transparent', borderWidth: remember ? 0 : 1.5, borderColor: C.muted }]}>
                    {remember ? <Icon name="check" size={13} color={C.bg} stroke={3} /> : null}
                  </View>
                  <Txt size={12} color={C.text2}>{t('افتكرني', 'Remember me')}</Txt>
                </Press>
                <Press onPress={() => notify(t('استرجاع الباسورد هيشتغل لما نربط السيرفر', 'Password reset will work once the server is connected'))} style={{ minHeight: 32, justifyContent: 'center' }}>
                  <Txt size={12} color={C.accent}>{t('نسيت الباسورد؟', 'Forgot password?')}</Txt>
                </Press>
              </View>
            )}

            <Press onPress={submit} accessibilityRole="button"
              style={[s.row, { marginTop: 8, height: 56, borderRadius: 28, backgroundColor: C.accent, justifyContent: 'center', gap: 10 }]}>
              <Txt size={16} w={600} color={C.bg}>{signup ? t('إنشاء حساب', 'Create account') : t('دخول', 'Sign in')}</Txt>
              <Icon name="next" size={18} color={C.bg} stroke={2.2} />
            </Press>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function TabBtn({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }}
      style={{ paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: on ? C.accent : 'transparent' }}>
      <Txt size={15} w={600} color={on ? C.text : '#8E9188'}>{label}</Txt>
    </Press>
  );
}

function Labeled({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Txt size={11} color={C.muted}>{label}</Txt>
      {children}
    </View>
  );
}

/** Email / password are typed left-to-right but sit aligned with the page, as in the design. */
function Input({ style, ltrValue, ...rest }: TextInputProps & { ltrValue?: boolean }) {
  const ar = useStore((st) => st.lang) === 'ar';
  return (
    <TextInput
      placeholderTextColor="#8E9188"
      {...rest}
      style={[
        {
          height: 50, borderRadius: 18, borderWidth: 1, borderColor: C.surface2, backgroundColor: 'rgba(26,27,23,.85)',
          color: C.text, paddingHorizontal: 16, fontFamily: FONT[400], fontSize: 14, textAlign: ar ? 'right' : 'left',
          writingDirection: ltrValue ? 'ltr' : undefined, outlineStyle: 'none',
        } as object,
        style,
      ]}
    />
  );
}
