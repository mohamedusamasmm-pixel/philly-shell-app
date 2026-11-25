import { View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { Txt } from '@/components/ui';
import { C } from '@/theme';

/**
 * In-app brand mark ("١ · الجولة" from the logo design):
 * timer progress ring around a boxing glove silhouette.
 */
export function AppLogoMark({ size = 32, color = C.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Circle cx={50} cy={54} r={36} stroke={color} strokeWidth={9} opacity={0.25} />
      <Circle
        cx={50}
        cy={54}
        r={36}
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray="170 400"
        transform="rotate(-90 50 54)"
      />
      <Rect x={43} y={4} width={14} height={8} rx={3} fill={color} />
      <Rect x={38} y={38} width={28} height={26} rx={11} fill={color} />
      <Rect x={32} y={47} width={11} height={16} rx={5.5} fill={color} />
      <Rect x={41} y={66} width={22} height={8} rx={3} fill={color} />
    </Svg>
  );
}

/** Brand badge + wordmark ("كابتن / BOXING COACH"). */
export function AppLogo({ size = 40 }: { size?: number }) {
  const pad = Math.round(size * 0.18);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: C.accent,
          padding: pad,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppLogoMark size={size - pad * 2} color={C.bg} />
      </View>
      <View style={{ gap: 1 }}>
        <Txt size={18} w={700} style={{ lineHeight: 21 }}>كابتن</Txt>
        <Txt size={9} w={500} color={C.muted} ltr style={{ letterSpacing: 2.2 }}>BOXING COACH</Txt>
      </View>
    </View>
  );
}
