import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useDB, useStore } from '@/data/store';
import { buildReminders } from './reminders';
import { initNotifications, scheduleReminderPushes } from './pushNotifications';

/** Minute clock so training reminders appear when their lead time starts. */
function useMinute() {
  const [m, setM] = useState(() => Math.floor(Date.now() / 60000));
  useEffect(() => {
    const h = setInterval(() => setM(Math.floor(Date.now() / 60000)), 30000);
    return () => clearInterval(h);
  }, []);
  return m;
}

export function useReminders(branch = 'all') {
  const db = useDB();
  const cfg = useStore((s) => s.reminders);
  const portfolio = useStore((s) => s.portfolio);
  const lang = useStore((s) => s.lang);
  const branches = useStore((s) => s.branches);
  const minute = useMinute();
  return useMemo(() => buildReminders(db, cfg, portfolio, branch, new Date()), [db, cfg, portfolio, branch, lang, branches, minute]);
}

export function useReminderCounts() {
  const { pay, train } = useReminders();
  const payTodo = pay.filter((r) => !r.sent).length;
  const trainTodo = train.filter((r) => !r.sent).length;
  return { payTodo, trainTodo, todo: payTodo + trainTodo };
}

/**
 * Mounted once (root layout): keeps the coach's "reminders ready" notifications planned,
 * and opens the right screen when one is tapped.
 */
export function useReminderPushes(enabled: boolean) {
  const db = useDB();
  const cfg = useStore((s) => s.reminders);
  const portfolio = useStore((s) => s.portfolio);
  const lang = useStore((s) => s.lang);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    const h = setTimeout(() => scheduleReminderPushes(db, cfg, portfolio), 2500);
    return () => clearTimeout(h);
  }, [enabled, db, cfg, portfolio, lang]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    initNotifications();
    const open = (url?: unknown) => typeof url === 'string' && router.push(url as '/reminders');
    try {
      const last = Notifications.getLastNotificationResponse();
      if (last) open(last.notification.request.content.data?.url);
      const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data?.url));
      return () => sub.remove();
    } catch {
      return undefined;
    }
  }, []);
}
