import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';

import { Brand } from '@/constants/theme';
import { SHIFT_OPTIONS, VENUE_OPTIONS } from '@/constants/options';
import { formatDisplayDate, toDateInputString } from '@/utils/dates';
import { MAX_CONTENT_WIDTH, moderateScale } from '@/utils/responsive';

const SORT_OPTIONS = [
  { value: 'default', label: 'Default order' },
  { value: 'newest', label: 'Newest upload first' },
  { value: 'oldest', label: 'Oldest upload first' },
];

function CheckboxRow({ label, checked, onPress }) {
  return (
    <Pressable style={styles.checkboxRow} onPress={onPress}>
      <MaterialIcons
        name={checked ? 'check-box' : 'check-box-outline-blank'}
        size={22}
        color={checked ? Brand.plum : Brand.mauve}
      />
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

function RadioRow({ label, selected, onPress }) {
  return (
    <Pressable style={styles.checkboxRow} onPress={onPress}>
      <MaterialIcons
        name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
        size={22}
        color={selected ? Brand.plum : Brand.mauve}
      />
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

// Mirrors ManagementPage.jsx's "Filters" dropdown (web) — Date Range (on
// last meeting time), Shift, Venue (both multi-select), and Sort By upload
// time — as a full-screen mobile modal instead of a hover dropdown.
export default function ClientFilterModal({
  visible,
  filters,
  sortOrder,
  onChangeFilters,
  onChangeSortOrder,
  onClear,
  onClose,
  activeFilterCount,
}) {
  const [datePickerField, setDatePickerField] = useState(null); // 'dateFrom' | 'dateTo' | null

  function toggleSet(key, value) {
    const next = new Set(filters[key]);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChangeFilters({ ...filters, [key]: next });
  }

  function handleDateChange(event, selectedDate) {
    const field = datePickerField;
    setDatePickerField(null);
    if (selectedDate && field) {
      onChangeFilters({ ...filters, [field]: toDateInputString(selectedDate) });
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <MaterialIcons name="close" size={24} color={Brand.purple} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.sectionTitle}>Date Range (Last Meeting)</Text>
            <View style={styles.dateRow}>
              <Pressable style={styles.dateButton} onPress={() => setDatePickerField('dateFrom')}>
                <Text style={styles.dateButtonLabel}>From</Text>
                <Text style={styles.dateButtonValue}>
                  {filters.dateFrom ? formatDisplayDate(filters.dateFrom) : 'Any'}
                </Text>
              </Pressable>
              <Pressable style={styles.dateButton} onPress={() => setDatePickerField('dateTo')}>
                <Text style={styles.dateButtonLabel}>To</Text>
                <Text style={styles.dateButtonValue}>
                  {filters.dateTo ? formatDisplayDate(filters.dateTo) : 'Any'}
                </Text>
              </Pressable>
            </View>
            {datePickerField ? (
              <DateTimePicker
                value={
                  (filters[datePickerField] && new Date(filters[datePickerField])) || new Date()
                }
                mode="date"
                onChange={handleDateChange}
              />
            ) : null}

            <Text style={styles.sectionTitle}>Shift</Text>
            {SHIFT_OPTIONS.map((opt) => (
              <CheckboxRow
                key={opt}
                label={opt}
                checked={filters.shifts.has(opt)}
                onPress={() => toggleSet('shifts', opt)}
              />
            ))}

            <Text style={styles.sectionTitle}>Venue</Text>
            {VENUE_OPTIONS.map((opt) => (
              <CheckboxRow
                key={opt}
                label={opt}
                checked={filters.venues.has(opt)}
                onPress={() => toggleSet('venues', opt)}
              />
            ))}

            <Text style={styles.sectionTitle}>Sort By Upload Time</Text>
            {SORT_OPTIONS.map((opt) => (
              <RadioRow
                key={opt.value}
                label={opt.label}
                selected={sortOrder === opt.value}
                onPress={() => onChangeSortOrder(opt.value)}
              />
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.clearButton} onPress={onClear} disabled={activeFilterCount === 0}>
              <Text style={[styles.clearText, activeFilterCount === 0 && styles.clearTextDisabled]}>
                Clear all {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
              </Text>
            </Pressable>
            <Pressable style={styles.applyButton} onPress={onClose}>
              <Text style={styles.applyText}>Show Results</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: Brand.purple,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: Brand.plum,
    marginTop: 18,
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Brand.blush,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dateButtonLabel: {
    fontSize: moderateScale(11),
    color: Brand.mauve,
    fontWeight: '600',
  },
  dateButtonValue: {
    fontSize: moderateScale(14),
    color: Brand.purple,
    fontWeight: '700',
    marginTop: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  checkboxLabel: {
    fontSize: moderateScale(14),
    color: Brand.purple,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0e6ee',
  },
  clearButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#d32f2f',
  },
  clearTextDisabled: {
    color: '#d32f2f88',
  },
  applyButton: {
    flex: 1.4,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.plum,
  },
  applyText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#fff',
  },
});
