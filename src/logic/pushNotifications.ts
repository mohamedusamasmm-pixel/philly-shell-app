/**
 * Local notifications for the coach (no server needed):
 *  • "You have N reminders ready" at (session − lead) and a daily payment digest at noon,
 *    tapping opens the Reminders screen;
 *  • timer cues while the screen is locked / app in background (see timerBackground.ts).
 * Push from a server can replace the reminder part later without touching the screens.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Portfolio, ReminderCfg, SoundEvent } from '@/data/store';
import type { DB } from '@/data/types';
import { plural, tr } from '@/i18n';
import { addDays, fmtTime, parse, ymd } from './dates';
import { branchOf } from './queries';
import { LEAD_MS, buildReminders, upcomingSessions } from './reminders';

export const REMINDERS_CHANNEL = 'reminders';
/** Android notification sounds must be bundled (app.json › expo-notifications › sounds). */
export const TIMER_SOUND_FILES: Record<SoundEvent, string> = {
  round_start: 'bell.wav',
  half_round: 'half.wav',
  last_10_sec: 'last10.wav',
  round_end: 'bell_end.wav',
  rest_end: 'whistle.wav',
};
export const timerChannel = (ev: SoundEvent) => `timer_${ev}`;

let ready = false;
export async function initNotifications() {
  if (ready || Platform.OS === 'web') return;
  ready = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL, {
        name: 'Reminders', importance: Notifications.AndroidImportance.HIGH,
      });
      for (const ev of Object.keys(TIMER_SOUND_FILES) as SoundEvent[]) {
        await Notifications.setNotificationChannelAsync(timerChannel(ev), {
          name: `Timer · ${ev}`, importance: Notifications.AndroidImportance.MAX, sound: TIMER_SOUND_FILES[ev],
          vibrationPattern: [0, 250, 150, 250], lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }
    }
  } catch {}
}

export async function ensurePermission() {
  if (Platform.OS === 'web') return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

async function cancelByType(type: string) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.content.data?.type === type).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/** Re-plan the coach's "reminders ready" notifications for the next 7 days. */
export async function scheduleReminderPushes(db: DB, cfg: ReminderCfg, portfolio: Portfolio) {
  if (Platform.OS === 'web') return;
  try {
    await initNotifications();
    if (!(await ensurePermission())) return;
    await cancelByType('reminders');
    const now = new Date();
    const jobs: { at: Date; title: string; body: string }[] = [];
    const active = db.players.filter((p) => !p.archived && !p.noReminders);
    const r = cfg.rules;

    if (r.trainBefore) {
      const lead = LEAD_MS[r.trainLead];
      const seen = new Set<string>();
      for (const s of upcomingSessions(portfolio, now, 7)) {
        const b = s.club.branchId;
        if (r.trainBranches.length && !r.trainBranches.includes(b)) continue;
        const at = new Date(s.start.getTime() - lead);
        const key = `${at.getTime()}|${b}`;
        if (at <= now || seen.has(key)) continue;
        seen.add(key);
        const n = active.filter((p) => branchOf(db, p.id) === b).length;
        if (!n) continue;
        jobs.push({
          at,
          title: tr(`عندك ${n} تذكيرات حصة جاهزة`, `You have ${plural(n, 'session reminder')} ready`),
          body: tr(`${s.club.name} · ${fmtTime(s.slot.start)} · دوس علشان تبعتهم`, `${s.club.name} · ${fmtTime(s.slot.start)} · tap to send`),
        });
      }
    }

    // payment digest at 12:00 for the next 7 days
    for (let k = 0; k < 7; k++) {
      const noon = parse(addDays(ymd(now), k));
      noon.setHours(12, 0, 0, 0);
      if (noon <= now) continue;
      const n = buildReminders(db, cfg, portfolio, 'all', noon).pay.filter((x) => !x.sent).length;
      if (!n) continue;
      jobs.push({
        at: noon,
        title: tr(`عندك ${n} تذكيرات دفع جاهزة`, `You have ${plural(n, 'payment reminder')} ready`),
        body: tr('دوس علشان تبعتهم على واتساب', 'Tap to send them on WhatsApp'),
      });
    }

    // iOS keeps at most 64 pending notifications; timers need room too
    for (const j of jobs.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 40)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: j.title, body: j.body, data: { type: 'reminders', url: '/reminders' }, sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: j.at, channelId: REMINDERS_CHANNEL },
      });
    }
  } catch {}
}

/** Schedule one timer cue (used only while the app is in the background). */
export function scheduleTimerCue(ev: SoundEvent, at: Date, title: string) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title, sound: Platform.OS === 'ios' ? TIMER_SOUND_FILES[ev] : undefined, data: { type: 'timer' },
      interruptionLevel: 'timeSensitive',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: timerChannel(ev) },
  });
}
export const cancelTimerCues = () => cancelByType('timer').catch(() => {});
