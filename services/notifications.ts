/**
 * Notification service for the sugar tracker.
 *
 * Strategy:
 *  - Scheduling: one-shot DATE trigger for "next 9 AM", mentioning the specific
 *    date (the day before the trigger fires). Rescheduled on every app open /
 *    background-fetch run via checkAndSchedule().
 *  - Conditional: if the target date is already logged in AppData we skip (or
 *    cancel) the notification.
 *  - Foreground interception: setNotificationHandler suppresses the banner when
 *    the app is open and the date is already logged.
 *  - Background task: registered with expo-background-fetch so the OS wakes the
 *    app periodically and we can cancel/reschedule before 9 AM if needed.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { KEYS } from '@/services/storage';

// ─── constants ───────────────────────────────────────────────────────────────

const TASK_NAME = 'sugar-tracker-daily-check';

export type NotifPrefs = { enabled: boolean };

// ─── background task  (must live at module scope) ─────────────────────────
// Guard against web: expo-task-manager and expo-notifications have no web
// implementation and will throw if called during the web bundle.

if (Platform.OS !== 'web') {
  TaskManager.defineTask(TASK_NAME, async () => {
    try {
      await checkAndSchedule();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });

  // ── foreground notification handler (module scope) ─────────────────────

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const logDateKey = notification.request.content.data?.logDateKey as string | undefined;
      if (logDateKey) {
        const raw = await AsyncStorage.getItem(KEYS.APP_DATA);
        const data = raw ? (JSON.parse(raw) as Record<string, { hadSugar?: boolean | null }>) : {};
        const entry = data[logDateKey];
        if (entry?.hadSugar !== undefined && entry?.hadSugar !== null) {
          // Already logged (red or green) — suppress silently
          return { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false };
        }
      }
      return { shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function dateToKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function keyToDisplay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]} ${d}, ${y}`;
}

/**
 * Returns the next Date at 09:00:00.
 * If it's already past 9 AM today, returns tomorrow at 9 AM.
 */
function nextNineAM(): Date {
  const t = new Date();
  t.setHours(9, 0, 0, 0);
  if (Date.now() >= t.getTime()) t.setDate(t.getDate() + 1);
  return t;
}

/**
 * The date the notification will be ABOUT: the day before the next 9 AM.
 * This is "yesterday" from the perspective of when the notification fires.
 */
function targetLogDate(): string {
  const trigger = nextNineAM();
  const logDay = new Date(trigger);
  logDay.setDate(logDay.getDate() - 1);
  return dateToKey(logDay);
}

// ─── permissions ─────────────────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: current } = await Notifications.getPermissionsAsync();
  if (current === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return status === 'granted';
}

export async function hasPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// ─── scheduling ───────────────────────────────────────────────────────────────

export async function cancelReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  const id = await AsyncStorage.getItem(KEYS.NOTIF_ID);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await AsyncStorage.removeItem(KEYS.NOTIF_ID);
  }
}

export async function scheduleReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelReminder();

  const trigger = nextNineAM();
  const logDateKey = targetLogDate();
  const dateStr = keyToDisplay(logDateKey);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'GlucoDiary',
      body: `Did you have sugar yesterday? Don't forget to log your intake for ${dateStr}`,
      data: { logDateKey },
      sound: true,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date: trigger,
    },
  });

  await AsyncStorage.setItem(KEYS.NOTIF_ID, id);
}

/**
 * Core logic: check whether the target log date is already recorded and
 * either schedule or cancel the 9 AM reminder accordingly.
 */
export async function checkAndSchedule(): Promise<void> {
  if (Platform.OS === 'web') return;
  const prefsRaw = await AsyncStorage.getItem(KEYS.NOTIF_PREFS);
  const prefs: NotifPrefs = prefsRaw ? JSON.parse(prefsRaw) : { enabled: true };

  if (!prefs.enabled) {
    await cancelReminder();
    return;
  }

  if (!(await hasPermissions())) {
    await cancelReminder();
    return;
  }

  const logDateKey = targetLogDate();
  const raw = await AsyncStorage.getItem(KEYS.APP_DATA);
  const data = raw ? (JSON.parse(raw) as Record<string, { hadSugar?: boolean | null }>) : {};
  const entry = data[logDateKey];
  // Only cancel if the day is explicitly marked (green or red). Grey = remind.
  const alreadyLogged = entry?.hadSugar !== undefined && entry?.hadSugar !== null;

  if (alreadyLogged) {
    await cancelReminder();
  } else {
    await scheduleReminder();
  }
}

export async function sendTestNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'GlucoDiary',
      body: `Test reminder: Did you have sugar yesterday? Don't forget to log your intake for ${keyToDisplay(targetLogDate())}`,
      data: { test: true },
      sound: true,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
    },
  });
}

// ─── background task registration ────────────────────────────────────────────

export async function registerBackgroundTask(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (!registered) {
      await BackgroundFetch.registerTaskAsync(TASK_NAME, {
        minimumInterval: 60 * 60, // 1 hour (OS may run less frequently)
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (e) {
    // Background fetch not available (e.g. Expo Go simulator) — non-fatal
    console.log('[notifications] background task registration skipped:', e);
  }
}

export async function unregisterBackgroundTask(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
  } catch {
    // ignore if not registered
  }
}
