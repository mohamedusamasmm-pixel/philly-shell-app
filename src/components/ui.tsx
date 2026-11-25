import { ReactNode, useEffect, useRef } from 'react';
import {
  Pressable, PressableProps, ScrollView, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Animated, Easing, Image, TextInput, TextInputProps } from 'react-native';
import { useStore } from '@/data/store';
import { tr } from '@/i18n';
import { C, FONT, PAD, Weight, tint } from '@/theme';
import { Icon, IconName } from './Icon';

/* ---------- Text ---------- */
type TxtProps = TextProps & { size?: number; w?: Weight; color?: string; ltr?: boolean; center?: boolean };
export function Txt({ size = 14, w = 400, color = C.text, ltr, center, style, ...rest }: TxtProps) {
  const ar = useStore((st) => st.lang) === 'ar';
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: FONT[w], fontSize: size, color, writingDirection: ar ? 'rtl' : 'ltr' },
        ltr && { writingDirection: 'ltr' },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}

/* ---------- Press ---------- */
export function Press({ style, ...rest }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [style, pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] }, rest.disabled && { opacity: 0.4 }]}
    />
  );
}

/* ---------- Screen ---------- */
const APP_BG = require('../../assets/bg/ring.jpg');

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  nav?: boolean; // reserve room for the floating bottom nav
  footer?: ReactNode; // pinned bottom area (CTA)
  gap?: number;
};
export function Screen({ children, scroll = true, nav, footer, gap = 16 }: ScreenProps) {
  const ins = useSafeAreaInsets();
  const bottomRoom = (nav ? 100 : 0) + (footer ? 96 : 0) + 24;
  const inner = { paddingTop: ins.top + 20, paddingHorizontal: PAD, paddingBottom: bottomRoom + ins.bottom, gap };
  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={APP_BG} resizeMode="cover" style={{ width: '100%', height: '100%', opacity: 0.08 }} />
      </View>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[inner, { flex: 1 }]}>{children}</View>
      )}
      {footer ? (
        <View style={[s.footer, { bottom: (nav ? 96 : 0) + ins.bottom + 20 }]}>{footer}</View>
      ) : null}
    </View>
  );
}

/* ---------- Header ---------- */
export function Header({ title, sub, right, onBack }: { title?: string; sub?: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <View style={s.rowBetween}>
      <IconBtn icon="back" label={tr('رجوع', 'Back')} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} />
      <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
        {title ? <Txt size={16} w={500}>{title}</Txt> : null}
        {sub ? <Txt size={11} color={C.muted}>{sub}</Txt> : null}
      </View>
      {right ?? <View style={{ width: 44 }} />}
    </View>
  );
}

export function IconBtn({ icon, label, onPress, bg = C.surface, color = C.text, size = 44, dot }: {
  icon: IconName; label: string; onPress?: () => void; bg?: string; color?: string; size?: number; dot?: boolean;
}) {
  return (
    <Press accessibilityLabel={label} accessibilityRole="button" onPress={onPress}
      style={[s.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Icon name={icon} size={20} color={color} stroke={2} />
      {dot ? <View style={s.dot} /> : null}
    </Press>
  );
}

/* ---------- Cards ---------- */
export function Card({ children, style, accent, radius = 22, pad = 16 }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; accent?: boolean; radius?: number; pad?: number;
}) {
  return <View style={[{ backgroundColor: accent ? C.accent : C.surface, borderRadius: radius, padding: pad, gap: 12 }, style]}>{children}</View>;
}

/* ---------- Pills & tabs ---------- */
export function Pill({ label, on, onPress, small }: { label: string; on?: boolean; onPress?: () => void; small?: boolean }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[s.pill, { backgroundColor: on ? C.text : C.surface, paddingHorizontal: small ? 14 : 16 }]}>
      <Txt size={small ? 12 : 13} w={on ? 500 : 400} color={on ? C.bg : C.text2}>{label}</Txt>
    </Press>
  );
}

export function OutlineBtn({ label, onPress, icon, color = C.accent, h = 36 }: { label: string; onPress?: () => void; icon?: IconName; color?: string; h?: number }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" style={[s.outline, { height: h, borderRadius: h / 2 }]}>
      {icon ? <Icon name={icon} size={14} color={color} stroke={2} /> : null}
      <Txt size={12} color={color}>{label}</Txt>
    </Press>
  );
}

export function Segmented<T extends string>({ options, value, onChange, h = 38 }: {
  options: { key: T; label: string }[]; value: T; onChange: (k: T) => void; h?: number;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Press key={o.key} onPress={() => onChange(o.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[s.center, { flex: 1, height: h, borderRadius: h / 2, backgroundColor: on ? C.accent : 'transparent' }]}>
            <Txt size={13} w={on ? 600 : 400} color={on ? C.bg : C.text2}>{o.label}</Txt>
          </Press>
        );
      })}
    </View>
  );
}

export function BigButton({ label, onPress, light, icon, disabled }: { label: string; onPress?: () => void; light?: boolean; icon?: IconName; disabled?: boolean }) {
  return (
    <Press onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={[s.big, { backgroundColor: light ? C.text : C.accent }]}>
      {icon ? <Icon name={icon} size={18} color={C.bg} stroke={2} /> : null}
      <Txt size={16} w={600} color={C.bg}>{label}</Txt>
    </Press>
  );
}

/* ---------- Avatar ---------- */
/** Round avatar: the photo if there is one, else the initials. */
export function Avatar({ ini, size = 44, ring, uri }: { ini: string; size?: number; ring?: boolean; uri?: string }) {
  const a = uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surface2 }} />
  ) : (
    <View style={[s.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: C.surface2 }]}>
      <Txt size={Math.round(size * 0.32)} w={600}>{ini}</Txt>
    </View>
  );
  if (!ring) return a;
  const o = size + Math.round(size * 0.2) + 4;
  return <View style={[s.center, { width: o, height: o, borderRadius: o / 2, borderWidth: 2, borderStyle: 'dashed', borderColor: C.accent }]}>{a}</View>;
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.badge, { backgroundColor: tint(color) }]}>
      <Txt size={11} w={500} color={color}>{label}</Txt>
    </View>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/* ---------- Progress ring (replaces conic-gradient) ---------- */
export function Ring({ size, thickness, pct, color = C.accent, track = C.track, children }: {
  size: number; thickness: number; pct: number; color?: string; track?: string; children?: ReactNode;
}) {
  const r = (size - thickness) / 2;
  const len = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <View style={[s.center, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={thickness} fill="none" />
        {p > 0 ? (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={thickness} fill="none"
            strokeDasharray={`${(len * p) / 100} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

/* ---------- Bar chart ---------- */
export function Bars({ data, height = 100, showValues }: {
  data: { label: string; value: number; color: string; text?: string }[]; height?: number; showValues?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' }}>
          {showValues ? <Txt size={10} w={600} color={d.text ?? C.text}>{Math.round(d.value)}</Txt> : null}
          <View style={{ width: '100%', borderRadius: 10, backgroundColor: d.color, height: `${Math.max(6, (d.value / max) * 78)}%` }} />
          <Txt size={10} color={d.text ?? C.muted} numberOfLines={1}>{d.label}</Txt>
        </View>
      ))}
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={s.rowBetween}>
      <Txt size={16} w={600}>{title}</Txt>
      {right}
    </View>
  );
}

export function Stepper({ label, value, onChange, min = 0, max = 99, fmt }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; fmt?: (v: number) => string;
}) {
  return (
    <View style={s.rowBetween}>
      <Txt size={13} color={C.text2}>{label}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Press accessibilityLabel={`− ${label}`} onPress={() => onChange(Math.max(min, value - 1))} style={s.step}><Txt size={18}>−</Txt></Press>
        <Txt size={15} w={600} style={{ minWidth: 64, textAlign: 'center' }}>{fmt ? fmt(value) : value}</Txt>
        <Press accessibilityLabel={`+ ${label}`} onPress={() => onChange(Math.min(max, value + 1))} style={s.step}><Txt size={18}>+</Txt></Press>
      </View>
    </View>
  );
}

/** Text field that aligns to the current language. */
export function Field({ style, search, ...rest }: TextInputProps & { search?: boolean }) {
  const ar = useStore((st) => st.lang) === 'ar';
  return (
    <TextInput
      placeholderTextColor={C.muted}
      {...rest}
      style={[
        { color: C.text, fontFamily: FONT[400], fontSize: 13, textAlign: ar ? 'right' : 'left', outlineStyle: 'none' } as object,
        search ? { flex: 1, height: 48 } : { backgroundColor: C.surface2, borderRadius: 18, height: 46, paddingHorizontal: 14 },
        style,
      ]}
    />
  );
}

export function SearchBox(props: TextInputProps) {
  return (
    <View style={[s.row, { height: 48, borderRadius: 24, backgroundColor: C.surface, gap: 10, paddingHorizontal: 16 }]}>
      <Icon name="search" size={18} color={C.muted} />
      <Field search {...props} />
    </View>
  );
}

export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footer: { position: 'absolute', left: PAD, right: PAD, gap: 10 },
  dot: { position: 'absolute', top: 10, end: 11, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent },
  pill: { height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  outline: { paddingHorizontal: 12, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
  seg: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 24, padding: 4 },
  big: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  badge: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  step: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' },
});

export type { TextStyle };

/** On/off switch from the settings designs (50×30, knob 24). */
export function Toggle({ on, onChange, label, dark }: { on: boolean; onChange: (v: boolean) => void; label: string; dark?: boolean }) {
  const bg = dark ? (on ? C.bg : 'rgba(11,12,10,.25)') : on ? C.accent : C.border;
  const knob = dark && on ? C.accent : C.text;
  return (
    <Press accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={() => onChange(!on)}
      style={{ width: 50, height: 30, borderRadius: 15, padding: 3, flexDirection: 'row', justifyContent: on ? 'flex-start' : 'flex-end', backgroundColor: bg }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: knob }} />
    </Press>
  );
}

/** Grouped list row used by the settings screens. */
export function ListRow({ icon, label, meta, onPress, color = C.accent, textColor = C.text, last }: {
  icon: IconName; label: string; meta?: string; onPress?: () => void; color?: string; textColor?: string; last?: boolean;
}) {
  return (
    <Press onPress={onPress} accessibilityRole="button"
      style={[s.row, { minHeight: 56, paddingVertical: 8, paddingHorizontal: 14, gap: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#24261F' }]}>
      <View style={[s.center, { width: 36, height: 36, borderRadius: 12, backgroundColor: C.surface2 }]}>
        <Icon name={icon} size={18} color={color} stroke={1.9} />
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Txt size={14} w={500} color={textColor}>{label}</Txt>
        {meta ? <Txt size={11} color={C.muted} numberOfLines={1}>{meta}</Txt> : null}
      </View>
      <Icon name="next" size={16} color="#6E7166" stroke={2} />
    </Press>
  );
}

/** Pulses its child (last 10 seconds of a round). */
export function Pulse({ active, children }: { active: boolean; children: ReactNode }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) { v.stopAnimation(); v.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1.06, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return <Animated.View style={{ transform: [{ scale: v }] }}>{children}</Animated.View>;
}
