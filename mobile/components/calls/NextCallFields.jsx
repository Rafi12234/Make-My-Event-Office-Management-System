import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import EmployeePicker from './EmployeePicker';
import { Brand } from '@/constants/theme';
import { moderateScale } from '@/utils/responsive';

/**
 * Shared date/time + assignee picker for "next call" scheduling — used both
 * when logging a brand-new call and when rescheduling an existing one, so
 * both flows behave identically (mirrors the website's single unified form).
 */
export default function NextCallFields({ value, onChange, employeeId, onEmployeeChange }) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  function handleDateChange(event, selectedDate) {
    setShowDatePicker(false);
    if (!selectedDate) return;
    const next = new Date(value);
    next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    onChange(next);
  }

  function handleTimeChange(event, selectedTime) {
    setShowTimePicker(false);
    if (!selectedTime) return;
    const next = new Date(value);
    next.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    onChange(next);
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.pickerButton} onPress={() => setShowDatePicker(true)}>
        <Text style={styles.pickerButtonText}>Date: {value.toLocaleDateString()}</Text>
      </Pressable>
      <Pressable style={styles.pickerButton} onPress={() => setShowTimePicker(true)}>
        <Text style={styles.pickerButtonText}>
          Time: {value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </Pressable>

      {showDatePicker ? <DateTimePicker value={value} mode="date" onChange={handleDateChange} /> : null}
      {showTimePicker ? <DateTimePicker value={value} mode="time" onChange={handleTimeChange} /> : null}

      <Text style={styles.assignLabel}>Assign to</Text>
      <EmployeePicker selectedId={employeeId} onSelect={onEmployeeChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: Brand.pink,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pickerButtonText: {
    color: Brand.purple,
    fontWeight: '600',
    fontSize: moderateScale(14),
  },
  assignLabel: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: Brand.mauve,
  },
});
