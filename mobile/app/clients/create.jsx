import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import ScreenContainer from '@/components/common/ScreenContainer';
import { Brand } from '@/constants/theme';
import { queryKeys } from '@/constants/queryKeys';
import { SHIFT_OPTIONS, VENUE_OPTIONS } from '@/constants/options';
import { useAuth } from '@/hooks/useAuth';
import { getWorkspace, saveWorkspace } from '@/services/api/workspaceApi';
import { buildNewClientRow } from '@/utils/clients';
import { toDateInputString } from '@/utils/dates';
import { moderateScale } from '@/utils/responsive';

export default function CreateClientScreen() {
  const router = useRouter();
  const { employee } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [phone, setPhone] = useState('');
  const [venue, setVenue] = useState('');
  const [shift, setShift] = useState('Day');
  const [floor, setFloor] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function handleDateChange(event, selectedDate) {
    setShowDatePicker(false);
    if (selectedDate) setEventDate(selectedDate);
  }

  async function handleSave() {
    setFormError('');
    if (!name.trim()) {
      setFormError('Client name is required.');
      return;
    }

    setIsSaving(true);
    try {
      // The workspace PUT is a full-sheet replace (same contract the web
      // Management sheet uses) — fetch the latest copy first so this save
      // only appends one row instead of wiping out every other client.
      const current = await getWorkspace();
      const newRow = buildNewClientRow(
        current.columns,
        {
          name: name.trim(),
          eventDate: toDateInputString(eventDate),
          phone: phone.trim(),
          venue,
          shift,
          floor: floor.trim(),
          guestCount: guestCount.trim(),
        },
        current.rows.length + 1
      );

      await saveWorkspace({ ...current, rows: [...current.rows, newRow] }, employee?.id);

      // Refresh both caches so the new client shows up immediately in the
      // mobile list and its event date reflects on the calendar, same as
      // the calls/meetings save flows.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workspace }),
        queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      ]);
      router.back();
    } catch (err) {
      setFormError(err.message || 'Failed to create client.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ScreenContainer scroll avoidKeyboard>
      <Stack.Screen options={{ headerShown: true, title: 'Create New Client' }} />

      <View style={styles.form}>
        <AppInput label="Client Name" value={name} onChangeText={setName} placeholder="e.g. Rahim Khan" />

        <View>
          <Text style={styles.label}>Event Date</Text>
          <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateButtonText}>{eventDate.toLocaleDateString()}</Text>
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker value={eventDate} mode="date" onChange={handleDateChange} />
          ) : null}
        </View>

        <AppInput
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 017XXXXXXXX"
          keyboardType="phone-pad"
        />

        <View>
          <Text style={styles.label}>Venue</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.venueRow}>
            {VENUE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setVenue(option)}
                style={[styles.venueChip, venue === option && styles.venueChipSelected]}>
                <Text style={[styles.venueChipText, venue === option && styles.venueChipTextSelected]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View>
          <Text style={styles.label}>Shift</Text>
          <View style={styles.shiftRow}>
            {SHIFT_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setShift(option)}
                style={[styles.shiftChip, shift === option && styles.shiftChipSelected]}>
                <Text style={[styles.shiftChipText, shift === option && styles.shiftChipTextSelected]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <AppInput label="Floor" value={floor} onChangeText={setFloor} placeholder="e.g. 3rd Floor" />

        <AppInput
          label="Guest Count"
          value={guestCount}
          onChangeText={setGuestCount}
          placeholder="e.g. 250"
          keyboardType="numeric"
        />

        {formError ? <Text style={styles.error}>{formError}</Text> : null}

        <AppButton title="Save Client" onPress={handleSave} loading={isSaving} style={styles.saveButton} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  label: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: Brand.purple,
    marginBottom: 6,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateButtonText: {
    fontSize: moderateScale(16),
    color: Brand.purple,
  },
  venueRow: {
    gap: 8,
    paddingVertical: 2,
  },
  venueChip: {
    borderWidth: 1,
    borderColor: Brand.pink,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  venueChipSelected: {
    backgroundColor: Brand.plum,
    borderColor: Brand.plum,
  },
  venueChipText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: Brand.purple,
  },
  venueChipTextSelected: {
    color: '#fff',
  },
  shiftRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shiftChip: {
    borderWidth: 1,
    borderColor: Brand.pink,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  shiftChipSelected: {
    backgroundColor: Brand.plum,
    borderColor: Brand.plum,
  },
  shiftChipText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: Brand.purple,
  },
  shiftChipTextSelected: {
    color: '#fff',
  },
  error: {
    color: '#d32f2f',
    fontSize: moderateScale(13),
  },
  saveButton: {
    marginTop: 4,
  },
});
