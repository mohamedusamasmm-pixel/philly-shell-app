import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { SoundEvent, useStore } from '@/data/store';

/** Bundled defaults — work offline. Custom uploads (Settings › Sounds) override per event. */
export const DEFAULT_SOUNDS: Record<SoundEvent, number> = {
  round_start: require('../../assets/bell.wav'),
  half_round: require('../../assets/half.wav'),
  last_10_sec: require('../../assets/last10.wav'),
  round_end: require('../../assets/bell_end.wav'),
  rest_end: require('../../assets/whistle.wav'),
};
export const SOUND_EVENTS: SoundEvent[] = ['round_start', 'half_round', 'last_10_sec', 'round_end', 'rest_end'];

/* One player per event, kept for the app's lifetime and swapped when the source changes. */
const players: Partial<Record<SoundEvent, { player: AudioPlayer; key: string }>> = {};
function playerFor(ev: SoundEvent) {
  const custom = useStore.getState().sounds.custom[ev];
  const key = custom?.uri ?? 'default';
  const cur = players[ev];
  if (cur && cur.key === key) return cur.player;
  const src = custom ? { uri: custom.uri } : DEFAULT_SOUNDS[ev];
  if (cur) {
    try { cur.player.replace(src); cur.key = key; return cur.player; } catch { try { cur.player.remove(); } catch {} }
  }
  const player = createAudioPlayer(src);
  players[ev] = { player, key };
  return player;
}

const buzz = (ev: SoundEvent) => {
  if (Platform.OS === 'web' || !useStore.getState().sounds.vibrate) return;
  const strong = ev === 'round_start' || ev === 'round_end' || ev === 'rest_end';
  (strong
    ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  ).catch(() => {});
};

/** Play an event sound (respects the mute toggle, volume and vibration settings). */
export function playEvent(ev: SoundEvent, force = false) {
  const st = useStore.getState();
  // in the background the scheduled notification rings instead (timerBackground.ts)
  if (!force && AppState.currentState !== 'active') return;
  buzz(ev);
  if (!st.sound && !force) return;
  try {
    const p = playerFor(ev);
    p.volume = st.sounds.volume;
    p.seekTo(0);
    p.play();
  } catch {}
}

export function stopEvent(ev: SoundEvent) {
  try { players[ev]?.player.pause(); } catch {}
}

export function useSounds() {
  return useCallback((ev: SoundEvent) => playEvent(ev), []);
}

export const tap = () => {
  if (Platform.OS !== 'web' && useStore.getState().sounds.vibrate) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Re-render every `ms` while `active`. */
export function useTicker(active: boolean, ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [active, ms]);
}

/**
 * Fires the in-round cues for a running countdown: half-way and "last 10 seconds".
 * Call on every tick with the remaining & total seconds of a work round.
 */
export function roundCues(prevSec: number, sec: number, totalSec: number) {
  // once at elapsed == duration / 2, once at remaining == 10
  const half = Math.ceil(totalSec / 2);
  if (prevSec > half && sec <= half && sec > 0) playEvent('half_round');
  if (totalSec > 10 && prevSec > 10 && sec <= 10 && sec > 0) playEvent('last_10_sec');
}
