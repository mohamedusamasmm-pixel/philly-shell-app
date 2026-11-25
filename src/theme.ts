// Design tokens from DESIGN.md
export const C = {
  bg: '#0B0C0A',
  surface: '#1A1B17',
  surface2: '#2A2C26',
  border: '#3A3D35',
  text: '#F4F5F0',
  text2: '#C9CBC2',
  muted: '#A3A69C',
  accent: '#C6F432',
  warning: '#F4D03F',
  danger: '#FF8A3D',
  red: '#FF5A4E',
  blue: '#4C8DFF',
  track: '#1F201C',
  draw: '#6E7166',
  dim: '#2F312B',
  off: '#4A4D44',
} as const;

/** Status badge background: token at 14% opacity */
export const tint = (hex: string, a = 0.14) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export const FONT = {
  300: 'ReadexPro_300Light',
  400: 'ReadexPro_400Regular',
  500: 'ReadexPro_500Medium',
  600: 'ReadexPro_600SemiBold',
  700: 'ReadexPro_700Bold',
} as const;

export type Weight = keyof typeof FONT;

export const PAD = 20;
