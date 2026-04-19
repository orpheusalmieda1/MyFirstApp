/**
 * Analytics service — thin wrapper around PostHog.
 *
 * All track/identify calls are wrapped in try/catch so a PostHog failure
 * can never crash the app.
 *
 * Usage:
 *   import { trackDayMarked } from '@/services/analytics';
 *   trackDayMarked('2025-04-19', true);
 */

import PostHog from 'posthog-react-native';

// ─── client (singleton) ───────────────────────────────────────────────────────

export const posthog = new PostHog(
  'phc_rbucryDrLZDhEg8nXK2G33RhnSbj7mRs2Q3AbfKBziqd',
  { host: 'https://app.posthog.com' },
);

// ─── identity ─────────────────────────────────────────────────────────────────

/** Call once after onboarding completes to link events to a named user. */
export function identifyUser(name: string): void {
  try {
    posthog.identify(name, { name });
  } catch {}
}

// ─── event helpers ────────────────────────────────────────────────────────────

export function trackAppOpened(): void {
  try {
    posthog.capture('app_opened');
  } catch {}
}

export function trackOnboardingCompleted(name: string): void {
  try {
    posthog.capture('onboarding_completed', { name });
  } catch {}
}

export function trackDayMarked(date: string, hadSugar: boolean): void {
  try {
    posthog.capture('day_marked', { date, had_sugar: hadSugar });
  } catch {}
}

export function trackFoodItemAdded(
  foodName: string,
  quantity: string,
  sugarGrams: number,
): void {
  try {
    posthog.capture('food_item_added', {
      food_name: foodName,
      quantity,
      sugar_grams: sugarGrams,
    });
  } catch {}
}

export function trackFoodItemDeleted(): void {
  try {
    posthog.capture('food_item_deleted');
  } catch {}
}

export function trackNotificationTimeChanged(newTime: number): void {
  try {
    posthog.capture('notification_time_changed', { new_time: newTime });
  } catch {}
}
