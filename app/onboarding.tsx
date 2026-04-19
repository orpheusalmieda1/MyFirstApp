import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkAndSchedule, requestPermissions } from '@/services/notifications';
import { identifyUser, trackOnboardingCompleted } from '@/services/analytics';
import { KEYS } from '@/services/storage';

const REMINDER_HOURS = [6, 7, 8, 9, 10] as const;
type ReminderHour = (typeof REMINDER_HOURS)[number];

// ── Main screen ────────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const [userName, setUserName] = useState('');
  const [notifHour, setNotifHour] = useState<ReminderHour>(9);

  function transitionTo(nextStep: number) {
    Keyboard.dismiss();
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }

  async function handleEnableReminders() {
    await AsyncStorage.setItem(KEYS.NOTIF_HOUR, String(notifHour));
    const granted = await requestPermissions();
    await AsyncStorage.setItem(KEYS.NOTIF_PREFS, JSON.stringify({ enabled: granted }));
    if (granted) await checkAndSchedule();
    await finishOnboarding();
  }

  async function handleSkipReminders() {
    await AsyncStorage.setItem(KEYS.NOTIF_HOUR, String(notifHour));
    await AsyncStorage.setItem(KEYS.NOTIF_PREFS, JSON.stringify({ enabled: false }));
    await finishOnboarding();
  }

  async function finishOnboarding() {
    const trimmedName = userName.trim();
    await AsyncStorage.setItem(KEYS.USER_NAME, trimmedName);
    await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETE, '1');
    trackOnboardingCompleted(trimmedName);
    identifyUser(trimmedName);
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[styles.flex, { opacity }]}>
          {step === 0 && <WelcomeStep onNext={() => transitionTo(1)} />}
          {step === 1 && (
            <NameStep
              name={userName}
              onChangeName={setUserName}
              onNext={() => transitionTo(2)}
            />
          )}
          {step === 2 && (
            <NotifStep
              hour={notifHour}
              onChangeHour={setNotifHour}
              onEnable={handleEnableReminders}
              onSkip={handleSkipReminders}
            />
          )}
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Progress dots — outside animation so they update instantly */}
      <View style={styles.dotsRow}>
        {[0, 1, 2].map(i => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>
    </SafeAreaView>
  );
}

// ── Step 1: Welcome ────────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <View style={s.step}>
      <View style={s.content}>
        <GlucoDiaryLogo />
        <Text style={s.heading}>{'Welcome to\nGlucoDiary'}</Text>
        <Text style={s.sub}>Your personal sugar intake tracker</Text>
      </View>
      <View style={s.actions}>
        <Pressable style={btn.primary} onPress={onNext}>
          <Text style={btn.primaryText}>Get Started</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Step 2: Name ───────────────────────────────────────────────────────────────

function NameStep({
  name,
  onChangeName,
  onNext,
}: {
  name: string;
  onChangeName: (v: string) => void;
  onNext: () => void;
}) {
  const ready = name.trim().length > 0;
  return (
    <View style={s.step}>
      <View style={s.content}>
        <PersonIcon />
        <Text style={s.heading}>{'What should we\ncall you?'}</Text>
        <Text style={s.sub}>Let's personalize your experience</Text>
        <TextInput
          style={s.input}
          placeholder="Enter your name"
          placeholderTextColor="#475569"
          value={name}
          onChangeText={onChangeName}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={ready ? onNext : undefined}
          maxLength={40}
        />
      </View>
      <View style={s.actions}>
        <Pressable
          style={[btn.primary, !ready && btn.primaryDisabled]}
          onPress={onNext}
          disabled={!ready}>
          <Text style={[btn.primaryText, !ready && btn.primaryTextDisabled]}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Step 3: Notifications ──────────────────────────────────────────────────────

function NotifStep({
  hour,
  onChangeHour,
  onEnable,
  onSkip,
}: {
  hour: ReminderHour;
  onChangeHour: (h: ReminderHour) => void;
  onEnable: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={s.step}>
      <View style={s.content}>
        <LargeClockIcon />
        <Text style={s.heading}>Stay on track!</Text>
        <Text style={s.sub}>
          {"We'll remind you each morning if\nyou haven't logged the previous day"}
        </Text>

        <View style={s.timeCard}>
          <Text style={s.timeLabel}>Reminder Time</Text>
          <View style={s.timeRow}>
            {REMINDER_HOURS.map(h => (
              <Pressable
                key={h}
                style={[s.timeOpt, h === hour && s.timeOptSel]}
                onPress={() => onChangeHour(h)}>
                <Text style={[s.timeOptText, h === hour && s.timeOptTextSel]}>{h} AM</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View style={s.actions}>
        <Pressable style={btn.primary} onPress={onEnable}>
          <Text style={btn.primaryText}>Enable Reminders</Text>
        </Pressable>
        <Pressable style={btn.ghost} onPress={onSkip}>
          <Text style={btn.ghostText}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function GlucoDiaryLogo() {
  return (
    <View style={logo.circle}>
      <Text style={logo.letter}>G</Text>
    </View>
  );
}

function PersonIcon() {
  return (
    <View style={pi.container}>
      <View style={pi.head} />
      <View style={pi.body} />
    </View>
  );
}

function LargeClockIcon() {
  const sz = 36;
  const r = sz / 2;
  return (
    <View style={lci.circle}>
      <View style={{ width: sz, height: sz }}>
        {/* Face ring */}
        <View
          style={{
            position: 'absolute',
            width: sz,
            height: sz,
            borderRadius: r,
            borderWidth: 2.5,
            borderColor: 'rgba(255,255,255,0.95)',
          }}
        />
        {/* Minute hand — pointing up (12) */}
        <View
          style={{
            position: 'absolute',
            width: 2.5,
            height: r - 4,
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderRadius: 1.5,
            left: r - 1.25,
            top: 4,
          }}
        />
        {/* Hour hand — pointing left (9) */}
        <View
          style={{
            position: 'absolute',
            height: 2.5,
            width: r - 4,
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderRadius: 1.5,
            top: r - 1.25,
            left: 4,
          }}
        />
        {/* Center dot */}
        <View
          style={{
            position: 'absolute',
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: 'rgba(255,255,255,0.95)',
            left: r - 2.5,
            top: r - 2.5,
          }}
        />
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f172a' },
  flex: { flex: 1 },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#334155',
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: '#7c3aed',
  },
});

// Per-step layout (shared across steps)
const s = StyleSheet.create({
  step: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 16,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontSize: 34,
    fontWeight: '800',
    color: '#f1f5f9',
    textAlign: 'center',
    lineHeight: 42,
    marginBottom: 14,
  },
  sub: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
    marginBottom: 36,
  },
  input: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    color: '#f1f5f9',
  },
  actions: {
    gap: 10,
    paddingBottom: 8,
  },
  timeCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeOpt: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  timeOptSel: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  timeOptText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  timeOptTextSel: {
    color: '#ffffff',
  },
});

// Shared button styles
const btn = StyleSheet.create({
  primary: {
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryDisabled: {
    backgroundColor: '#1e293b',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  primaryTextDisabled: {
    color: '#475569',
  },
  ghost: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#475569',
  },
});

// Icon-specific styles
const logo = StyleSheet.create({
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  letter: {
    fontSize: 58,
    fontWeight: '800',
    color: '#ffffff',
    lineHeight: 68,
    includeFontPadding: false,
  },
});

const pi = StyleSheet.create({
  container: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    alignItems: 'center',
    marginBottom: 32,
  },
  head: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#7c3aed',
    marginTop: 14,
  },
  body: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7c3aed',
    marginTop: 6,
  },
});

const lci = StyleSheet.create({
  circle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
});
