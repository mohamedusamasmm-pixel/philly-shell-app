import { View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useStore } from '@/data/store';
import { BottomNav } from '@/components/BottomNav';
import { C } from '@/theme';

/** Tabs navigator with the stock bar hidden; our floating capsule nav sits on top. */
export default function TabsLayout() {
  const signedIn = useStore((st) => !!st.auth);
  const needsOnboarding = useStore((st) => st.auth?.onboarded === false);
  if (!signedIn) return <Redirect href="/login" />;
  if (needsOnboarding) return <Redirect href="/onboarding" />;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' }, sceneStyle: { backgroundColor: C.bg } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="players" />
        <Tabs.Screen name="workout" />
        <Tabs.Screen name="reports" />
        <Tabs.Screen name="settings" />
      </Tabs>
      <BottomNav />
    </View>
  );
}
