import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useStore } from '@/data/store';
import { C, PAD } from '@/theme';
import { Txt } from './ui';

export function Toast() {
  const t = useStore((s) => s.toast);
  const ins = useSafeAreaInsets();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!t) return;
    setShow(true);
    const h = setTimeout(() => setShow(false), 2400);
    return () => clearTimeout(h);
  }, [t]);
  if (!show || !t) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: ins.top + 12, left: PAD, right: PAD, alignItems: 'center' }}>
      <View style={{ backgroundColor: C.text, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, maxWidth: 360 }}>
        <Txt size={13} w={500} color={C.bg} center>{t.msg}</Txt>
      </View>
    </View>
  );
}

/** Keeps the screen on while mounted (timers). */
export function KeepAwake() {
  useKeepAwake();
  return null;
}
