import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  cancelReminder,
  checkAndSchedule,
  hasPermissions,
  requestPermissions,
  type NotifPrefs,
} from '@/services/notifications';
import { KEYS } from '@/services/storage';

const REMINDER_HOURS = [6, 7, 8, 9, 10] as const;
type ReminderHour = typeof REMINDER_HOURS[number];

function hourLabel(h: number): string {
  return `${h} AM`;
}

function hourLongLabel(h: number): string {
  return `${h}:00 AM`;
}

export default function SettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  const [notifHour, setNotifHour] = useState<ReminderHour>(9);

  useEffect(() => {
    async function load() {
      const [prefsRaw, granted, hourRaw] = await Promise.all([
        AsyncStorage.getItem(KEYS.NOTIF_PREFS),
        hasPermissions(),
        AsyncStorage.getItem(KEYS.NOTIF_HOUR),
      ]);
      const prefs: NotifPrefs = prefsRaw ? JSON.parse(prefsRaw) : { enabled: true };
      setEnabled(prefs.enabled);
      setPermGranted(granted);
      if (hourRaw !== null) {
        const h = parseInt(hourRaw, 10) as ReminderHour;
        if (REMINDER_HOURS.includes(h)) setNotifHour(h);
      }
    }
    load();
  }, []);

  async function handleToggle(value: boolean) {
    setEnabled(value);
    await AsyncStorage.setItem(KEYS.NOTIF_PREFS, JSON.stringify({ enabled: value }));

    if (value) {
      const granted = await requestPermissions();
      setPermGranted(granted);
      if (granted) {
        await checkAndSchedule();
      } else {
        setEnabled(false);
        await AsyncStorage.setItem(KEYS.NOTIF_PREFS, JSON.stringify({ enabled: false }));
        Alert.alert(
          'Permission Required',
          'Please enable notifications for GlucoDiary in your device Settings to use reminders.',
          [{ text: 'OK' }],
        );
      }
    } else {
      await cancelReminder();
    }
  }

  async function handleHourChange(hour: ReminderHour) {
    setNotifHour(hour);
    await AsyncStorage.setItem(KEYS.NOTIF_HOUR, String(hour));
    // Reschedule at the new time (no-op if notifications are off)
    await checkAndSchedule();
  }

  const isActive = enabled && !!permGranted;

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen
        options={{
          title: 'Reminders',
          headerStyle: { backgroundColor: '#1e293b' },
          headerTintColor: '#f1f5f9',
          headerShadowVisible: false,
          presentation: 'modal',
        }}
      />

      <View style={styles.container}>
        {/* ── Reminder toggle card ── */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <ClockIcon />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Daily Reminder</Text>
              <Text style={styles.cardSub}>
                Get notified each morning if you haven't logged the previous day
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              trackColor={{ false: '#334155', true: '#16a34a' }}
              thumbColor="#ffffff"
              ios_backgroundColor="#334155"
            />
          </View>

          {/* Status badge */}
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isActive ? styles.dotActive : styles.dotInactive]} />
            <Text style={styles.statusText}>
              {isActive
                ? `Active — fires at ${hourLongLabel(notifHour)} if previous day is unlogged`
                : enabled && permGranted === false
                  ? 'Notifications permission denied — check device Settings'
                  : 'Disabled'}
            </Text>
          </View>
        </View>

        {/* ── Time picker ── */}
        <View style={styles.card}>
          <Text style={styles.timePickerHeading}>Reminder Time</Text>
          <View style={styles.timePickerRow}>
            {REMINDER_HOURS.map(h => {
              const selected = h === notifHour;
              return (
                <Pressable
                  key={h}
                  style={[styles.timeOption, selected && styles.timeOptionSelected]}
                  onPress={() => handleHourChange(h)}>
                  <Text style={[styles.timeOptionText, selected && styles.timeOptionTextSelected]}>
                    {hourLabel(h)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── How it works ── */}
        <View style={styles.card}>
          <Text style={styles.infoHeading}>How it works</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoBullet}>›</Text>
            <Text style={styles.infoText}>
              Every day at your chosen time, the app checks if you logged data for the previous day.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoBullet}>›</Text>
            <Text style={styles.infoText}>
              If the previous day is already marked (sugar or clean), no notification is sent.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoBullet}>›</Text>
            <Text style={styles.infoText}>
              Works in the background so you don't need to open the app.
            </Text>
          </View>
          {Platform.OS === 'ios' && (
            <View style={styles.infoRow}>
              <Text style={styles.infoBullet}>›</Text>
              <Text style={styles.infoText}>
                On iOS, background checks are approximate. Opening the app ensures the schedule is up to date.
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Clock icon ───────────────────────────────────────────────────────────────

function ClockIcon() {
  const size = 22;
  const r = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      {/* Face */}
      <View style={{
        position: 'absolute', width: size, height: size,
        borderRadius: r, borderWidth: 2, borderColor: '#94a3b8',
      }} />
      {/* Minute hand — pointing up (12 o'clock) */}
      <View style={{
        position: 'absolute', width: 2, height: r - 3,
        backgroundColor: '#94a3b8', borderRadius: 1,
        left: r - 1, top: 3,
      }} />
      {/* Hour hand — pointing left (9 o'clock) */}
      <View style={{
        position: 'absolute', width: r - 3, height: 2,
        backgroundColor: '#94a3b8', borderRadius: 1,
        left: 3, top: r - 1,
      }} />
      {/* Center dot */}
      <View style={{
        position: 'absolute', width: 4, height: 4,
        borderRadius: 2, backgroundColor: '#94a3b8',
        left: r - 2, top: r - 2,
      }} />
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 3,
  },
  cardSub: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#334155',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: { backgroundColor: '#22c55e' },
  dotInactive: { backgroundColor: '#475569' },
  statusText: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
  },
  timePickerHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  timePickerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeOptionSelected: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  timeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  timeOptionTextSelected: {
    color: '#ffffff',
  },
  infoHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  infoBullet: {
    fontSize: 14,
    color: '#475569',
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 19,
  },
});
