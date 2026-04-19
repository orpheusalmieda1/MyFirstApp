/**
 * Central storage service for Sugar Tracker.
 *
 * ─── Key registry ────────────────────────────────────────────────────────────
 * Every AsyncStorage key the app uses is defined in KEYS below.
 * Import KEYS wherever you need to read or write storage — never
 * hard-code a key string in another file.
 *
 * ─── Migration system ────────────────────────────────────────────────────────
 * DATA_VERSION is a plain integer that increases with each release that
 * needs to transform persisted data.  The "dataVersion" key in AsyncStorage
 * tracks which version the device is currently on.
 *
 * How to ship a migration with a future release (e.g. v1.1 → DATA_VERSION 2):
 *   1. Bump DATA_VERSION to 2.
 *   2. Add a `2: async () => { ... }` entry to the migrations map.
 *      The function receives data in the v1 shape and should write it back
 *      in the v2 shape.  It must be idempotent (safe to run more than once).
 *   3. Update the TypeScript types if the schema changed.
 *
 * Call runMigrations() once on app startup (before reading any other key).
 * It is a no-op when the stored version already equals DATA_VERSION.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppData } from '@/types/sugar';

// ─── key registry ────────────────────────────────────────────────────────────

export const KEYS = {
  /** Tracks which data-schema version the device has migrated to. */
  DATA_VERSION: 'dataVersion',
  /** Main daily sugar-log store: Record<"YYYY-MM-DD", DayData>. */
  APP_DATA: 'sugar_tracker_data',
  /** Notification preferences: { enabled: boolean }. */
  NOTIF_PREFS: 'sugar_notif_prefs',
  /** ID of the currently scheduled expo-notification (internal). */
  NOTIF_ID: 'sugar_notif_id',
  /** Hour (24-h integer) at which the daily reminder fires. Default 9. */
  NOTIF_HOUR: 'sugar_notif_hour',
  /** User's display name entered during onboarding. */
  USER_NAME: 'user_name',
  /** Set to '1' once the user has completed onboarding. */
  ONBOARDING_COMPLETE: 'onboarding_complete',
  /** Set to '1' once the main-screen coachmarks have been shown. */
  COACHMARK_SHOWN: 'coachmark_shown',
} as const;

// ─── versioning ───────────────────────────────────────────────────────────────

/**
 * Current data-schema version.
 * Increment this whenever you add a new entry to `migrations`.
 */
const DATA_VERSION = 1;

// ─── migrations ───────────────────────────────────────────────────────────────

type Migration = () => Promise<void>;

/**
 * Map of version-number → migration function.
 * Each function upgrades data FROM the previous version TO this version.
 *
 * v0 → v1: The original app stored each day as a raw boolean
 *           (true = had sugar, false = no sugar).  v1 uses a DayData
 *           object { hadSugar: boolean | null, foods: FoodItem[] }.
 */
const migrations: Record<number, Migration> = {
  1: async () => {
    const raw = await AsyncStorage.getItem(KEYS.APP_DATA);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const migrated: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'boolean') {
        // Old format — promote to full DayData
        migrated[key] = { hadSugar: value, foods: [] };
      } else {
        migrated[key] = value;
      }
    }
    await AsyncStorage.setItem(KEYS.APP_DATA, JSON.stringify(migrated));
  },
};

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Run all outstanding migrations and stamp the current DATA_VERSION.
 *
 * Must be called once on app startup, before any other AsyncStorage reads.
 * Safe to call multiple times (subsequent calls are instant no-ops).
 */
export async function runMigrations(): Promise<void> {
  const stored = await AsyncStorage.getItem(KEYS.DATA_VERSION);
  const storedVersion = stored !== null ? parseInt(stored, 10) : 0;

  if (storedVersion === DATA_VERSION) return;

  for (let v = storedVersion + 1; v <= DATA_VERSION; v++) {
    const migrate = migrations[v];
    if (migrate) await migrate();
  }

  await AsyncStorage.setItem(KEYS.DATA_VERSION, String(DATA_VERSION));
}

/**
 * Load the full daily-log data store.
 * Always call runMigrations() before this to ensure the schema is current.
 */
export async function loadAppData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(KEYS.APP_DATA);
  return raw ? (JSON.parse(raw) as AppData) : {};
}

/** Persist the full daily-log data store. */
export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(KEYS.APP_DATA, JSON.stringify(data));
}
