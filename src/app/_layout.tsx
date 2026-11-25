import { I18nManager, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts, ReadexPro_300Light, ReadexPro_400Regular, ReadexPro_500Medium, ReadexPro_600SemiBold, ReadexPro_700Bold,
} from '@expo-google-fonts/readex-pro';
import { Toast } from '@/components/Toast';
import { useHydrated, useStore } from '@/data/store';
import { useReminderPushes } from '@/logic/useReminders';
import { C } from '@/theme';

/*
 * Direction is driven by the app language, not the phone: the native RTL flag stays off
 * and the root view sets `direction`, so Arabic ↔ English switches instantly without a reload.
 */
if (Platform.OS !== 'web' && I18nManager.isRTL) {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}

export default function Root() {
  const [loaded] = useFonts({ ReadexPro_300Light, ReadexPro_400Regular, ReadexPro_500Medium, ReadexPro_600SemiBold, ReadexPro_700Bold });
  const lang = useStore((s) => s.lang);
  const hydrated = useHydrated();
  const signedIn = useStore((s) => !!s.auth);
  useReminderPushes(hydrated && signedIn);
  const rtl = lang === 'ar';
  const webDir = Platform.OS === 'web' ? ({ dir: rtl ? 'rtl' : 'ltr' } as object) : {};
  return (
    <SafeAreaProvider>
      <View key={lang} style={{ flex: 1, backgroundColor: C.bg, direction: rtl ? 'rtl' : 'ltr' }} {...webDir}>
        <StatusBar style="light" />
        {loaded && hydrated ? (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: rtl ? 'slide_from_left' : 'slide_from_right' }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="attendance" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="add-player" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          </Stack>
        ) : null}
        <Toast />
      </View>
    </SafeAreaProvider>
  );
}
