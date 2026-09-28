import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Brand } from '@/constants/theme';
import { useEmployees } from '@/hooks/useEmployees';
import { moderateScale } from '@/utils/responsive';

export default function EmployeePicker({ selectedId, onSelect }) {
  const { data, isLoading } = useEmployees();
  const employees = data || [];

  if (isLoading || !employees.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {employees.map((employee) => {
        const isSelected = String(selectedId) === String(employee.id);
        return (
          <Pressable
            key={employee.id}
            onPress={() => onSelect(isSelected ? null : employee.id)}
            style={[styles.chip, isSelected && styles.chipSelected]}>
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{employee.fullName}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    borderWidth: 1,
    borderColor: Brand.pink,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: Brand.plum,
    borderColor: Brand.plum,
  },
  chipText: {
    fontSize: moderateScale(13),
    color: Brand.purple,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },
});
