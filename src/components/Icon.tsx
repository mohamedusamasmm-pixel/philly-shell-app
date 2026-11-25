import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useStore } from '@/data/store';

export type IconName =
  | 'bell' | 'qr' | 'timer' | 'glove' | 'pulse' | 'home' | 'users' | 'bolt' | 'chart'
  | 'plus' | 'search' | 'sort' | 'back' | 'next' | 'prev' | 'dots' | 'sound' | 'mute'
  | 'play' | 'pause' | 'reset' | 'usersCheck' | 'check' | 'shuffle' | 'coffee' | 'sliders'
  | 'download' | 'whatsapp' | 'alert' | 'swap' | 'close' | 'globe' | 'eye' | 'eyeOff' | 'logout'
  | 'gear' | 'userPlus' | 'share' | 'card' | 'clock' | 'rounds' | 'message' | 'send' | 'upload' | 'edit' | 'camera'
  | 'pin' | 'info' | 'copy' | 'trash' | 'phone';

type Props = { name: IconName; size?: number; color?: string; stroke?: number };

/** Lucide-style stroke icons copied from the design screens. */
export function Icon({ name, size = 22, color = '#F4F5F0', stroke = 1.8 }: Props) {
  const rtl = useStore((s) => s.lang) === 'ar';
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const body = (() => {
    switch (name) {
      case 'bell': return <><Path {...p} d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><Path {...p} d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>;
      case 'qr': return <><Rect {...p} x={3} y={3} width={7} height={7} rx={1} /><Rect {...p} x={14} y={3} width={7} height={7} rx={1} /><Rect {...p} x={3} y={14} width={7} height={7} rx={1} /><Path {...p} d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></>;
      case 'timer': return <><Circle {...p} cx={12} cy={13} r={8} /><Path {...p} d="M12 9v4l2 2M9 2h6" /></>;
      case 'glove': return <><Path {...p} d="M7 4h6a4 4 0 0 1 4 4v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2z" /><Path {...p} d="M8 16v4h7v-4M5 10h4" /></>;
      case 'pulse': return <Path {...p} d="M3 12h3l3-8 4 16 3-8h5" />;
      case 'home': return <Path {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />;
      case 'users': return <><Circle {...p} cx={9} cy={8} r={4} /><Path {...p} d="M2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 9M22 21a7 7 0 0 0-4-6.3" /></>;
      case 'usersCheck': return <><Circle {...p} cx={9} cy={8} r={4} /><Path {...p} d="M2 21a7 7 0 0 1 14 0M17 11l2 2 4-4" /></>;
      case 'bolt': return <Path {...p} d="M13 2 4 14h7l-1 8 9-12h-7z" />;
      case 'chart': return <Path {...p} d="M4 20V10M10 20V4M16 20v-8M22 20H2" />;
      case 'plus': return <Path {...p} d="M12 5v14M5 12h14" />;
      case 'search': return <><Circle {...p} cx={11} cy={11} r={7} /><Path {...p} d="m20 20-4-4" /></>;
      case 'sort': return <Path {...p} d="M4 6h16M7 12h10M10 18h4" />;
      // In RTL "back" points to the right, like the design.
      case 'back': return <Path {...p} d="M9 6l6 6-6 6" />;
      case 'next': return <Path {...p} d="M15 6l-6 6 6 6" />;
      case 'prev': return <Path {...p} d="M9 6l6 6-6 6" />;
      case 'dots': return <><Circle cx={12} cy={5} r={1.8} fill={color} /><Circle cx={12} cy={12} r={1.8} fill={color} /><Circle cx={12} cy={19} r={1.8} fill={color} /></>;
      case 'sound': return <Path {...p} d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />;
      case 'mute': return <Path {...p} d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6" />;
      // media icons never mirror
      case 'play': return <Path d="M7 5v14l11-7z" fill={color} />;
      case 'pause': return <><Rect x={6} y={5} width={4} height={14} rx={1} fill={color} /><Rect x={14} y={5} width={4} height={14} rx={1} fill={color} /></>;
      case 'reset': return <Path {...p} d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />;
      case 'check': return <Path {...p} d="M20 6 9 17l-5-5" />;
      case 'shuffle': return <Path {...p} d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />;
      case 'coffee': return <Path {...p} d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" />;
      case 'sliders': return <><Path {...p} d="M4 7h10M18 7h2M4 17h4M12 17h8" /><Circle {...p} cx={16} cy={7} r={2} /><Circle {...p} cx={10} cy={17} r={2} /></>;
      case 'download': return <Path {...p} d="M12 3v12M7 10l5 5 5-5M4 21h16" />;
      case 'whatsapp': return <Path {...p} d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3z" />;
      case 'alert': return <><Path {...p} d="M12 3 2 20h20z" /><Path {...p} d="M12 10v4M12 17v.01" /></>;
      case 'swap': return <Path {...p} d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />;
      case 'close': return <Path {...p} d="M6 6l12 12M18 6 6 18" />;
      case 'eye': return <><Path {...p} d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><Circle {...p} cx={12} cy={12} r={3} /></>;
      case 'eyeOff': return <><Path {...p} d="M2 12s3.5-7 10-7c2 0 3.7.6 5.1 1.5M22 12s-3.5 7-10 7c-2 0-3.7-.6-5.1-1.5" /><Path {...p} d="M3 3l18 18" /></>;
      case 'logout': return <Path {...p} d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11" />;
      case 'gear': return <><Circle {...p} cx={12} cy={12} r={3} /><Path {...p} d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>;
      case 'userPlus': return <Path {...p} d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M19 8v6M16 11h6" />;
      case 'share': return <Path {...p} d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13" />;
      case 'card': return <Path {...p} d="M3 5h18v14H3zM7 9h4v4H7zM14 10h4M14 14h3" />;
      case 'clock': return <Path {...p} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />;
      case 'rounds': return <Path {...p} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18M3 12h18" />;
      case 'message': return <Path {...p} d="M21 12a9 9 0 0 1-13.4 7.9L3 21l1.2-4.4A9 9 0 1 1 21 12zM9 10h6M9 14h4" />;
      case 'send': return <Path {...p} d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />;
      case 'upload': return <Path {...p} d="M12 15V3M7 8l5-5 5 5M4 21h16" />;
      case 'edit': return <Path {...p} d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />;
      case 'camera': return <><Path {...p} d="M3 8a2 2 0 0 1 2-2h2l2-3h6l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><Circle {...p} cx={12} cy={13} r={3.5} /></>;
      case 'pin': return <><Path {...p} d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><Circle {...p} cx={12} cy={10} r={2.5} /></>;
      case 'info': return <><Circle {...p} cx={12} cy={12} r={9} /><Path {...p} d="M12 8v5M12 16h.01" /></>;
      case 'copy': return <><Rect {...p} x={9} y={9} width={12} height={12} rx={2} /><Path {...p} d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>;
      case 'trash': return <Path {...p} d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3" />;
      case 'phone': return <Path {...p} d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />;
      case 'globe': return <><Circle {...p} cx={12} cy={12} r={9} /><Path {...p} d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>;
    }
  })();
  // back / next / prev are drawn for RTL; mirror them in English (LTR)
  const flip = !rtl && (name === 'back' || name === 'next' || name === 'prev');
  return <Svg width={size} height={size} viewBox="0 0 24 24" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>{body}</Svg>;
}
