import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {
  cancelReminder,
  checkAndSchedule,
  hasPermissions,
  requestPermissions,
  sendTestNotification,
  type NotifPrefs,
} from '@/services/notifications';
import { KEYS } from '@/services/storage';

type Status = 'idle' | 'sending' | 'sent';

export default function SettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  const [permGranted, setPermGranted] = useState<boolean | null>(null);
  const [testStatus, setTestStatus] = useState<Status>('idle');

  useEffect(() => {
    async function load() {
      const [prefsRaw, granted] = await Promise.all([
        AsyncStorage.getItem(KEYS.NOTIF_PREFS),
        hasPermissions(),
      ]);
      const prefs: NotifPrefs = prefsRaw ? JSON.parse(prefsRaw) : { enabled: true };
      setEnabled(prefs.enabled);
      setPermGranted(granted);
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
        // Revert toggle — no permission
        setEnabled(false);
        await AsyncStorage.setItem(KEYS.NOTIF_PREFS, JSON.stringify({ enabled: false }));
        Alert.alert(
          'Permission Required',
          'Please enable notifications for Sugar Tracker in your device Settings to use reminders.',
          [{ text: 'OK' }],
        );
      }
    } else {
      await cancelReminder();
    }
  }

  async function handleTestNotification() {
    if (!(await hasPermissions())) {
      Alert.alert(
        'Permission Required',
        'Enable reminders first to send a test notification.',
      );
      return;
    }
    setTestStatus('sending');
    await sendTestNotification();
    setTestStatus('sent');
    setTimeout(() => setTestStatus('idle'), 4000);
  }

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
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Daily 9 AM Reminder</Text>
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
            <View style={[styles.statusDot, enabled && permGranted ? styles.dotActive : styles.dotInactive]} />
            <Text style={styles.statusText}>
              {enabled && permGranted
                ? 'Active — fires at 9:00 AM if previous day is unlogged'
                : enabled && permGranted === false
                  ? 'Notifications permission denied — check device Settings'
                  : 'Disabled'}
            </Text>
          </View>
        </View>

        {/* ── How it works ── */}
        <View style={styles.card}>
          <Text style={styles.infoHeading}>How it works</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoBullet}>›</Text>
            <Text style={styles.infoText}>
              Every day at 9 AM, the app checks if you logged data for the previous day.
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

        {/* ── Test button ── */}
        <Pressable
          style={[styles.testBtn, testStatus === 'sending' && styles.testBtnDisabled]}
          onPress={handleTestNotification}
          disabled={testStatus === 'sending'}>
          {testStatus === 'sending' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.testBtnText}>
              {testStatus === 'sent' ? 'Notification sent! (check in ~3s)' : 'Send Test Notification'}
            </Text>
          )}
        </Pressable>

        <Text style={styles.testHint}>
          The test notification will appear in ~3 seconds. Minimize the app to see it.
        </Text>
      </View>
    </SafeAreaView>
  );
}

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
  testBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  testBtnDisabled: {
    backgroundColor: '#1e3a5f',
  },
  testBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  testHint: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginTop: 2,
  },
});
