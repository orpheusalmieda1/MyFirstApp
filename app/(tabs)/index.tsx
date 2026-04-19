import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { DayModal } from '@/components/day-modal';
import {
  checkAndSchedule,
  registerBackgroundTask,
  requestPermissions,
} from '@/services/notifications';
import { useAppUpdate } from '@/hooks/use-app-update';
import { KEYS, loadAppData, runMigrations, saveAppData } from '@/services/storage';
import type { AppData, DayData } from '@/types/sugar';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function makeDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const EMPTY_DAY: DayData = { hadSugar: null, foods: [] };

export default function SugarTracker() {
  const router = useRouter();
  const { updateAvailable, isDownloading, applyUpdate } = useAppUpdate();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [appData, setAppData] = useState<AppData>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Track if we've done the first-launch permission request
  const permRequestedRef = useRef(false);

  // ── load data & init notifications ────────────────────────────────────────
  useEffect(() => {
    async function init() {
      // Migrate stored data to the current schema (safe no-op if up to date)
      await runMigrations();

      // Load persisted tracker data
      setAppData(await loadAppData());

      // First-launch: ask for notification permission if not yet asked
      if (!permRequestedRef.current) {
        permRequestedRef.current = true;
        const prefsRaw = await AsyncStorage.getItem(KEYS.NOTIF_PREFS);
        const prefs = prefsRaw ? JSON.parse(prefsRaw) : null;

        if (!prefs) {
          // Very first launch — request permission and default to enabled
          const granted = await requestPermissions();
          await AsyncStorage.setItem(
            KEYS.NOTIF_PREFS,
            JSON.stringify({ enabled: granted }),
          );
        }

        // Register background task (no-op if already registered)
        await registerBackgroundTask();

        // Sync notification schedule with current data state
        await checkAndSchedule();
      }
    }

    init();
  }, []);

  // ── data helpers ──────────────────────────────────────────────────────────

  function saveData(next: AppData) {
    setAppData(next);
    saveAppData(next);
  }

  async function handleDayUpdate(key: string, data: DayData) {
    const next = { ...appData, [key]: data };
    saveData(next);
    // Re-evaluate notification schedule: user may have just logged the target day
    await checkAndSchedule();
  }

  // ── month navigation ──────────────────────────────────────────────────────

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  // ── calendar grid ─────────────────────────────────────────────────────────

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();

  const isViewingFutureMonth =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  let sugarCount = 0;
  let cleanCount = 0;
  let notLoggedCount = 0;

  if (!isViewingFutureMonth) {
    const lastCountDay =
      viewYear === today.getFullYear() && viewMonth === today.getMonth()
        ? today.getDate()
        : daysInMonth;
    for (let d = 1; d <= lastCountDay; d++) {
      const entry = appData[makeDateKey(viewYear, viewMonth, d)];
      if (entry?.hadSugar === true) sugarCount++;
      else if (entry?.hadSugar === false) cleanCount++;
      else notLoggedCount++;
    }
  }

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const isToday = (day: number) =>
    day === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear();

  const isFutureDate = (day: number) => {
    if (viewYear > today.getFullYear()) return true;
    if (viewYear < today.getFullYear()) return false;
    if (viewMonth > today.getMonth()) return true;
    if (viewMonth < today.getMonth()) return false;
    return day > today.getDate();
  };

  const selectedDayData = selectedKey ? (appData[selectedKey] ?? EMPTY_DAY) : EMPTY_DAY;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <Text style={styles.appTitle}>GlucoDiary</Text>
          <Pressable
            style={styles.settingsBtn}
            onPress={() => router.push('/settings')}
            hitSlop={12}>
            <SettingsIcon />
          </Pressable>
        </View>

        {/* ── Update banner (shown only when OTA update is available) ── */}
        {updateAvailable && (
          <View style={styles.updateBanner}>
            <Text style={styles.updateText}>A new update is available!</Text>
            <Pressable
              style={styles.updateBtn}
              onPress={applyUpdate}
              disabled={isDownloading}>
              {isDownloading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.updateBtnText}>Update Now</Text>}
            </Pressable>
          </View>
        )}

        {/* ── Month navigation ── */}
        <View style={styles.header}>
          <Pressable onPress={prevMonth} style={styles.arrow} hitSlop={12}>
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>
          <Pressable onPress={nextMonth} style={styles.arrow} hitSlop={12}>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>

        {/* ── Day-of-week labels ── */}
        <View style={styles.row}>
          {DAY_NAMES.map((d) => (
            <View key={d} style={styles.cell}>
              <Text style={styles.dayLabel}>{d}</Text>
            </View>
          ))}
        </View>

        {/* ── Calendar grid ── */}
        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((day, ci) => {
              if (!day) return <View key={ci} style={styles.cell} />;
              const key = makeDateKey(viewYear, viewMonth, day);
              const dayData = appData[key];
              const hadSugar = dayData?.hadSugar ?? null;
              const hasFoods = (dayData?.foods?.length ?? 0) > 0;
              const future = isFutureDate(day);

              const dotStyle =
                future ? styles.futureDot
                : hadSugar === true ? styles.sugarDot
                : hadSugar === false ? styles.cleanDot
                : styles.unmarkedDot;

              return (
                <Pressable
                  key={ci}
                  style={styles.cell}
                  onPress={future ? undefined : () => setSelectedKey(key)}>
                  <View style={[
                    styles.dot,
                    dotStyle,
                    isToday(day) && styles.todayRing,
                  ]}>
                    <Text style={[styles.dayNum, future && styles.futureDayNum]}>{day}</Text>
                  </View>
                  {hasFoods && !future && <View style={styles.foodPip} />}
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* ── Monthly summary ── */}
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            <Text style={styles.cleanCount}>{cleanCount} clean</Text>
            {'  ·  '}
            <Text style={styles.sugarCount}>{sugarCount} sugar</Text>
            {'  ·  '}
            <Text style={styles.notLoggedCount}>{notLoggedCount} not logged</Text>
          </Text>
        </View>
      </View>

      <DayModal
        visible={selectedKey !== null}
        dateKey={selectedKey ?? ''}
        dayData={selectedDayData}
        onClose={() => setSelectedKey(null)}
        onUpdate={(data) => {
          if (selectedKey) handleDayUpdate(selectedKey, data);
        }}
      />
    </SafeAreaView>
  );
}

// ─── Inline gear icon (avoids external dependency for a simple shape) ────────

function SettingsIcon() {
  return (
    <View style={icon.wrap}>
      {/* Outer ring */}
      <View style={icon.ring} />
      {/* Center circle */}
      <View style={icon.center} />
      {/* 8 teeth */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 45 * Math.PI) / 180;
        const x = 10 + 8.5 * Math.cos(angle) - 2;
        const y = 10 + 8.5 * Math.sin(angle) - 3;
        return (
          <View
            key={i}
            style={[
              icon.tooth,
              {
                left: x,
                top: y,
                transform: [{ rotate: `${i * 45}deg` }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const icon = StyleSheet.create({
  wrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: '#94a3b8',
  },
  center: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#94a3b8',
  },
  tooth: {
    position: 'absolute',
    width: 4,
    height: 6,
    borderRadius: 1,
    backgroundColor: '#94a3b8',
  },
});

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  topBarSpacer: {
    width: 36,
  },
  appTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  arrow: { padding: 8 },
  arrowText: { fontSize: 32, color: '#94a3b8', lineHeight: 36 },
  monthTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unmarkedDot: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  cleanDot: { backgroundColor: '#16a34a' },
  sugarDot: { backgroundColor: '#dc2626' },
  futureDot: { backgroundColor: 'transparent' },
  todayRing: { borderWidth: 2.5, borderColor: '#f8fafc' },
  dayNum: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  futureDayNum: { color: '#334155' },
  foodPip: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94a3b8',
    marginTop: 2,
  },
  summary: {
    marginTop: 'auto',
    paddingVertical: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  summaryText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  cleanCount: { color: '#4ade80', fontWeight: '700' },
  sugarCount: { color: '#f87171', fontWeight: '700' },
  notLoggedCount: { color: '#64748b', fontWeight: '700' },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 12,
  },
  updateText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  updateBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  updateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
