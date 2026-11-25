import { View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, PAD } from '@/theme';
import { useT } from '@/i18n';
import { useReminderCounts } from '@/logic/useReminders';
import { Icon, IconName } from './Icon';
import { Press } from './ui';

const TABS: { href: '/' | '/players' | '/workout' | '/reports' | '/settings'; icon: IconName; label: string; en: string }[] = [
  { href: '/', icon: 'home', label: 'الرئيسية', en: 'Home' },
  { href: '/players', icon: 'users', label: 'اللاعبين', en: 'Players' },
  { href: '/workout', icon: 'bolt', label: 'التمرين', en: 'Workout' },
  { href: '/reports', icon: 'chart', label: 'التقارير', en: 'Reports' },
  { href: '/settings', icon: 'gear', label: 'الإعدادات', en: 'Settings' },
];

/** Floating capsule nav (DESIGN.md › Bottom nav). The gear shows a dot when reminders are ready. */
export function BottomNav() {
  const tr = useT();
  const path = usePathname();
  const ins = useSafeAreaInsets();
  const { todo } = useReminderCounts();
  return (
    <View
      style={{
        position: 'absolute', left: PAD, right: PAD, bottom: ins.bottom + 20, height: 64, borderRadius: 32,
        backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
        paddingHorizontal: 6, boxShadow: '0 -20px 30px #0B0C0A',
      }}
    >
      {TABS.map((t) => {
        const on = t.href === '/' ? path === '/' : path.startsWith(t.href);
        return (
          <Press key={t.href} accessibilityRole="tab" accessibilityLabel={tr(t.label, t.en)} accessibilityState={{ selected: on }}
            onPress={() => router.navigate(t.href)}
            style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.accent : 'transparent' }}>
            <Icon name={t.icon} size={22} color={on ? C.bg : C.muted} stroke={on ? 2 : 1.8} />
            {t.href === '/settings' && todo > 0 && !on ? (
              <View style={{ position: 'absolute', top: 10, end: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent }} />
            ) : null}
          </Press>
        );
      })}
    </View>
  );
}
