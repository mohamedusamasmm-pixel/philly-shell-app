/**
 * Timer sounds while the screen is locked or the app is in the background.
 *
 * In the foreground, timers play their cues through expo-audio (custom uploads included).
 * The moment the app leaves the foreground, every upcoming cue of the running timer is handed
 * to the OS as a scheduled local notification with the bundled sound, so the bell still rings
 * on a locked phone even if the OS pauses JavaScript. Coming back cancels them.
 */
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';
import type { SoundEvent } from '@/data/store';
import { tr } from '@/i18n';
import { cancelTimerCues, ensurePermission, initNotifications, scheduleTimerCue } from './pushNotifications';

export type Cue = { at: number; ev: SoundEvent };

let audioReady = false;
export function initTimerAudio() {
  if (audioReady || Platform.OS === 'web') return;
  audioReady = true;
  setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'duckOthers' }).catch(() => {});
}

export const isForeground = () => AppState.currentState === 'active';

/**
 * Cues for an interval timer from its current state.
 * phase 'work' ends at `endsAt`; after it: rest (if any) then the next work round, until `rounds`.
 * `stopAfterWork`: sparring waits for the coach to record winners after each round.
 */
export function planIntervals(o: {
  phase: 'work' | 'rest'; endsAt: number; round: number; rounds: number; workSec: number; restSec: number; stopAfterWork?: boolean;
}): Cue[] {
  const cues: Cue[] = [];
  const work = o.workSec * 1000, rest = o.restSec * 1000;
  const pushWork = (end: number) => {
    cues.push({ at: end - work / 2, ev: 'half_round' });
    if (o.workSec > 10) cues.push({ at: end - 10_000, ev: 'last_10_sec' });
    cues.push({ at: end, ev: 'round_end' });
  };
  let t = o.endsAt, round = o.round, phase = o.phase;
  for (let guard = 0; guard < 60; guard++) {
    if (phase === 'work') {
      pushWork(t);
      if (o.stopAfterWork || round >= o.rounds) break;
      if (rest > 0) { phase = 'rest'; t += rest; continue; }
      round++; t += work;
      cues.push({ at: t - work, ev: 'round_start' });
    } else {
      cues.push({ at: t, ev: 'rest_end' });
      round++; phase = 'work'; t += work;
    }
  }
  const now = Date.now();
  return cues.filter((c) => c.at > now + 500).sort((a, b) => a.at - b.at);
}

const TITLES: Record<SoundEvent, () => string> = {
  round_start: () => tr('بداية الجولة', 'Round start'),
  half_round: () => tr('نص الجولة', 'Half round'),
  last_10_sec: () => tr('آخر 10 ثواني', 'Last 10 seconds'),
  round_end: () => tr('نهاية الجولة', 'Round over'),
  rest_end: () => tr('خلصت الراحة', 'Rest over'),
};

/** Mount in a timer screen; `plan` returns the running timer's upcoming cues (or [] when stopped). */
export function useBackgroundCues(plan: () => Cue[]) {
  const ref = useRef(plan);
  ref.current = plan;
  useEffect(() => {
    if (Platform.OS === 'web') return;
    initTimerAudio();
    initNotifications();
    ensurePermission();
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') return cancelTimerCues();
      const cues = ref.current().slice(0, 20); // stay under the OS limit
      await cancelTimerCues();
      for (const c of cues) await scheduleTimerCue(c.ev, new Date(c.at), TITLES[c.ev]()).catch(() => {});
    });
    return () => { sub.remove(); cancelTimerCues(); };
  }, []);
}
