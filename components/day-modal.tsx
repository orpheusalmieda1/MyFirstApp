import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { DayData, FoodItem } from '@/types/sugar';
import { trackDayMarked, trackFoodItemAdded, trackFoodItemDeleted } from '@/services/analytics';

// ─── helpers ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatKey(dateKey: string): string {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DOW_NAMES[date.getDay()]}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// ─── types ───────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  dateKey: string;
  dayData: DayData;
  onClose: () => void;
  onUpdate: (data: DayData) => void;
};

type FormState = { name: string; quantity: string; sugarGrams: string };
const EMPTY_FORM: FormState = { name: '', quantity: '', sugarGrams: '' };

// ─── DayModal ────────────────────────────────────────────────────────────────

export function DayModal({ visible, dateKey, dayData, onClose, onUpdate }: Props) {
  const slideAnim = useRef(new Animated.Value(700)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const nameRef = useRef<TextInput>(null);
  const qtyRef = useRef<TextInput>(null);
  const sugarRef = useRef<TextInput>(null);

  // Mount when visible opens
  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  // Animate on open/close
  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      slideAnim.setValue(700);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0.65, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 700, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setMounted(false);
        setForm(EMPTY_FORM);
        setEditingId(null);
      });
    }
  }, [mounted, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form when switching days
  useEffect(() => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }, [dateKey]);

  // ── handlers ───────────────────────────────────────────────────────────────

  function selectSugar(hadSugar: boolean) {
    onUpdate({ ...dayData, hadSugar });
    trackDayMarked(dateKey, hadSugar);
    // Switching to No Sugar: also clear food form state
    if (!hadSugar) {
      setForm(EMPTY_FORM);
      setEditingId(null);
      Keyboard.dismiss();
    }
  }

  function handleAddItem() {
    const name = form.name.trim();
    if (!name) return;
    const quantity = form.quantity.trim();
    const sugarGrams = parseFloat(form.sugarGrams) || 0;

    if (editingId) {
      onUpdate({
        ...dayData,
        foods: dayData.foods.map((f) =>
          f.id === editingId ? { ...f, name, quantity, sugarGrams } : f,
        ),
      });
      setEditingId(null);
    } else {
      const item: FoodItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        quantity,
        sugarGrams,
      };
      onUpdate({ ...dayData, foods: [...dayData.foods, item] });
      trackFoodItemAdded(name, quantity, sugarGrams);
    }
    setForm(EMPTY_FORM);
    Keyboard.dismiss();
  }

  function handleEditItem(item: FoodItem) {
    setEditingId(item.id);
    setForm({ name: item.name, quantity: item.quantity, sugarGrams: String(item.sugarGrams) });
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function handleDeleteItem(id: string) {
    onUpdate({ ...dayData, foods: dayData.foods.filter((f) => f.id !== id) });
    trackFoodItemDeleted();
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    Keyboard.dismiss();
  }

  // ── derived ────────────────────────────────────────────────────────────────

  const totalSugar = dayData.foods.reduce((s, f) => s + (f.sugarGrams || 0), 0);
  const canSave = form.name.trim().length > 0;

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible={mounted}
      onRequestClose={onClose}
      statusBarTranslucent
      animationType="none">

      {/* Backdrop */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.overlay, { opacity: fadeAnim }]}
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      {/* KAV pushes sheet up when keyboard opens */}
      <KeyboardAvoidingView
        style={styles.kavWrapper}
        behavior="padding"
        pointerEvents="box-none">

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>

          {/* ── Fixed header ── */}
          <View style={styles.handle} />
          <Text style={styles.dateText}>{formatKey(dateKey)}</Text>

          {/* Had Sugar / No Sugar buttons */}
          <View style={styles.choiceRow}>
            <Pressable
              style={[styles.choiceBtn, styles.sugarBtn, dayData.hadSugar === true && styles.sugarBtnActive]}
              onPress={() => selectSugar(true)}>
              <Text style={[styles.choiceBtnText, dayData.hadSugar === true && styles.choiceBtnTextActive]}>
                Had Sugar
              </Text>
            </Pressable>
            <Pressable
              style={[styles.choiceBtn, styles.cleanBtn, dayData.hadSugar === false && styles.cleanBtnActive]}
              onPress={() => selectSugar(false)}>
              <Text style={[styles.choiceBtnText, dayData.hadSugar === false && styles.choiceBtnTextActive]}>
                No Sugar
              </Text>
            </Pressable>
          </View>

          {/* ── Scrollable body (only when Had Sugar is selected) ── */}
          {dayData.hadSugar === true && (
            <>
              <View style={styles.divider} />

              {/*
               * flexShrink: 1 on the ScrollView is the key fix.
               * The parent (Animated.View) has only maxHeight, not a fixed height.
               * flex: 1 collapses in this context; flexShrink: 1 correctly
               * lets the scroll area shrink to fit within the parent's max height.
               */}
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>

                {/* ── Add / Edit form (above the list) ── */}
                <Text style={styles.sectionLabel}>
                  {editingId ? 'Edit Food Item' : 'Log Food Item'}
                </Text>

                <TextInput
                  ref={nameRef}
                  style={styles.input}
                  placeholder="Food name *"
                  placeholderTextColor="#475569"
                  value={form.name}
                  onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                  returnKeyType="next"
                  onSubmitEditing={() => qtyRef.current?.focus()}
                />

                <View style={styles.formRow}>
                  <TextInput
                    ref={qtyRef}
                    style={[styles.input, styles.inputFlex]}
                    placeholder="Qty (e.g. 1 cup)"
                    placeholderTextColor="#475569"
                    value={form.quantity}
                    onChangeText={(t) => setForm((f) => ({ ...f, quantity: t }))}
                    returnKeyType="next"
                    onSubmitEditing={() => sugarRef.current?.focus()}
                  />
                  <TextInput
                    ref={sugarRef}
                    style={[styles.input, styles.inputSugar]}
                    placeholder="Sugar g"
                    placeholderTextColor="#475569"
                    value={form.sugarGrams}
                    onChangeText={(t) => setForm((f) => ({ ...f, sugarGrams: t }))}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleAddItem}
                  />
                </View>

                <View style={styles.formButtons}>
                  {editingId && (
                    <Pressable style={styles.cancelBtn} onPress={handleCancelEdit}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                    onPress={handleAddItem}
                    disabled={!canSave}>
                    <Text style={styles.saveBtnText}>
                      {editingId ? 'Update Item' : 'Add Item'}
                    </Text>
                  </Pressable>
                </View>

                {/* ── Food items list (below the form) ── */}
                {dayData.foods.length > 0 && (
                  <>
                    <View style={styles.listDivider} />
                    <Text style={styles.sectionLabel}>Added Items</Text>

                    {dayData.foods.map((item) => (
                      <FoodRow
                        key={item.id}
                        item={item}
                        isEditing={editingId === item.id}
                        onEdit={handleEditItem}
                        onDelete={handleDeleteItem}
                      />
                    ))}

                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total sugar</Text>
                      <Text style={[styles.totalValue, totalSugar > 25 ? styles.totalHigh : styles.totalOk]}>
                        {fmt(totalSugar)}g
                      </Text>
                    </View>
                  </>
                )}

              </ScrollView>
            </>
          )}

          {/* ── Clean day confirmation ── */}
          {dayData.hadSugar === false && (
            <View style={styles.cleanSection}>
              <Text style={styles.cleanIcon}>✓</Text>
              <Text style={styles.cleanMsg}>Clean day logged!</Text>
              <Text style={styles.cleanSub}>No sugar recorded for this day.</Text>
            </View>
          )}

          {/* ── Prompt when nothing selected yet ── */}
          {dayData.hadSugar === null && (
            <View style={styles.promptSection}>
              <Text style={styles.promptText}>Select an option above to log this day.</Text>
            </View>
          )}

        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── FoodRow ─────────────────────────────────────────────────────────────────

function FoodRow({
  item,
  isEditing,
  onEdit,
  onDelete,
}: {
  item: FoodItem;
  isEditing: boolean;
  onEdit: (item: FoodItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={[styles.foodRow, isEditing && styles.foodRowEditing]}>
      <View style={styles.foodMeta}>
        <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
        {item.quantity ? (
          <Text style={styles.foodQty} numberOfLines={1}>{item.quantity}</Text>
        ) : null}
      </View>
      <Text style={styles.foodSugar}>{fmt(item.sugarGrams)}g</Text>
      <Pressable
        style={styles.foodActionBtn}
        onPress={() => onEdit(item)}
        hitSlop={6}>
        <Text style={styles.foodEditText}>Edit</Text>
      </Pressable>
      <Pressable
        style={[styles.foodActionBtn, styles.foodDeleteBtn]}
        onPress={() => onDelete(item.id)}
        hitSlop={6}>
        <Text style={styles.foodDeleteText}>✕</Text>
      </Pressable>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: '#000',
  },
  kavWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },

  // ── Choice buttons ──────────────────────────────────────────────────────────
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  choiceBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  sugarBtn: { borderColor: '#dc2626', backgroundColor: '#1a0505' },
  sugarBtnActive: { backgroundColor: '#dc2626' },
  cleanBtn: { borderColor: '#16a34a', backgroundColor: '#051a0a' },
  cleanBtnActive: { backgroundColor: '#16a34a' },
  choiceBtnText: { fontSize: 15, fontWeight: '700', color: '#64748b' },
  choiceBtnTextActive: { color: '#ffffff' },

  divider: { height: 1, backgroundColor: '#334155' },

  // ── Scrollable area ─────────────────────────────────────────────────────────
  // flexShrink: 1 (not flex: 1) is intentional — see comment in JSX above.
  scrollArea: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
  },

  // ── Form ────────────────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputFlex: { flex: 1 },
  inputSugar: { width: 96 },
  formButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: '#94a3b8', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#2d1b69' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // ── Food list ───────────────────────────────────────────────────────────────
  listDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginTop: 16,
    marginBottom: 14,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 8,
    marginBottom: 6,
    gap: 8,
  },
  foodRowEditing: {
    backgroundColor: '#2d1b69',
    borderWidth: 1,
    borderColor: '#7c3aed',
  },
  foodMeta: { flex: 1 },
  foodName: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  foodQty: { fontSize: 12, color: '#64748b', marginTop: 2 },
  foodSugar: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fb923c',
    minWidth: 36,
    textAlign: 'right',
  },
  foodActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodEditText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  foodDeleteBtn: { backgroundColor: '#3f0d0d' },
  foodDeleteText: { fontSize: 12, fontWeight: '700', color: '#f87171' },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 10,
    marginTop: 4,
  },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  totalValue: { fontSize: 22, fontWeight: '800' },
  totalOk: { color: '#4ade80' },
  totalHigh: { color: '#f87171' },

  // ── State sections ──────────────────────────────────────────────────────────
  cleanSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  cleanIcon: {
    fontSize: 36,
    color: '#22c55e',
    marginBottom: 8,
  },
  cleanMsg: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4ade80',
    marginBottom: 4,
  },
  cleanSub: {
    fontSize: 13,
    color: '#475569',
  },
  promptSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  promptText: {
    fontSize: 14,
    color: '#475569',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingBottom: Platform.OS === 'ios' ? 14 : 6,
  },
});
