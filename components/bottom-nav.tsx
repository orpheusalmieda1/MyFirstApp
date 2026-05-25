import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { DS, F, TAB_BAR_HEIGHT } from '@/constants/theme';

type TabRoute = 'index' | 'history' | 'insights' | 'profile';

const TAB_CONFIG: Record<TabRoute, { label: string; icon: string }> = {
  index: { label: 'Home', icon: '⚡' },
  history: { label: 'History', icon: '📅' },
  insights: { label: 'Insights', icon: '📊' },
  profile: { label: 'Profile', icon: '👤' },
};

export function BottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const paddingBottom = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.container, { paddingBottom }]}>
      {/* Square fill that extends behind the safe area / home indicator */}
      <View style={styles.bgFill} />
      {/* Dark background with rounded top corners */}
      <View style={styles.bg} />

      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIG[route.name as TabRoute] ?? {
            label: route.name,
            icon: '•',
          };

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={onPress}
              hitSlop={4}>
              {isFocused ? (
                <LinearGradient
                  colors={['#cd96ff', '#c484ff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.activePill}>
                  <Text style={styles.activeIcon}>{config.icon}</Text>
                  <Text style={styles.activeLabel}>{config.label}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.inactivePill}>
                  <Text style={styles.inactiveIcon}>{config.icon}</Text>
                  <Text style={styles.inactiveLabel} numberOfLines={1}>{config.label}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  bgFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0e1a',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0e1a',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    shadowColor: DS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  activeIcon: {
    fontSize: 16,
  },
  activeLabel: {
    fontSize: 13,
    fontFamily: F.bodyBold,
    color: DS.black,
  },
  inactivePill: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 2,
  },
  inactiveIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  inactiveLabel: {
    fontSize: 10,
    fontFamily: F.bodySemiBold,
    color: '#64748b',
  },
});
