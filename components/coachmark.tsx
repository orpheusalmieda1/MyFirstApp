import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

export type Rect = { x: number; y: number; width: number; height: number };

type Props = {
  visible: boolean;
  targetRect: Rect;
  tooltip: string;
  buttonLabel: string;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
};

const PADDING = 10;
const DARK = 'rgba(0,0,0,0.80)';
const PURPLE = '#7c3aed';

export function CoachmarkOverlay({
  visible,
  targetRect,
  tooltip,
  buttonLabel,
  stepIndex,
  totalSteps,
  onNext,
}: Props) {
  const { width: SW, height: SH } = useWindowDimensions();

  if (!visible) return null;

  // Highlight box (target + padding)
  const hx = Math.max(0, targetRect.x - PADDING);
  const hy = Math.max(0, targetRect.y - PADDING);
  const hw = Math.min(SW - hx, targetRect.width + PADDING * 2);
  const hh = targetRect.height + PADDING * 2;

  // Tooltip goes above when target is in the lower half of the screen
  const inBottomHalf = hy + hh / 2 > SH / 2;
  const tooltipPos = inBottomHalf
    ? { bottom: SH - hy + 16 }
    : { top: hy + hh + 16 };

  // Rounded corners that feel circular for small targets (settings icon)
  // and rectangular for large areas (calendar grid)
  const ringRadius = Math.min(Math.min(hw, hh) / 2, 20);

  return (
    <Modal transparent visible statusBarTranslucent animationType="fade">
      {/* ── Dark cutout overlay (4 rectangles around the highlight) ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Top */}
        <View style={[s.dark, { top: 0, left: 0, right: 0, height: hy }]} />
        {/* Bottom */}
        <View style={[s.dark, { top: hy + hh, left: 0, right: 0, bottom: 0 }]} />
        {/* Left */}
        <View style={[s.dark, { top: hy, left: 0, width: hx, height: hh }]} />
        {/* Right */}
        <View style={[s.dark, { top: hy, left: hx + hw, right: 0, height: hh }]} />

        {/* Purple highlight ring around the target */}
        <View
          pointerEvents="none"
          style={[
            s.ring,
            { left: hx, top: hy, width: hw, height: hh, borderRadius: ringRadius },
          ]}
        />

        {/* Tooltip card */}
        <View style={[s.card, tooltipPos]}>
          <Text style={s.tipText}>{tooltip}</Text>

          <View style={s.footer}>
            <View style={s.stepDots}>
              {Array.from({ length: totalSteps }).map((_, i) => (
                <View
                  key={i}
                  style={[s.dot, i === stepIndex - 1 && s.dotActive]}
                />
              ))}
            </View>

            <Pressable style={s.btn} onPress={onNext}>
              <Text style={s.btnText}>{buttonLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  dark: {
    position: 'absolute',
    backgroundColor: DARK,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: PURPLE,
  },
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: PURPLE,
    borderRadius: 18,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  tipText: {
    fontSize: 15,
    lineHeight: 23,
    color: '#ffffff',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepDots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: '#ffffff',
    width: 16,
    borderRadius: 3,
  },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
