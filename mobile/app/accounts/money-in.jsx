import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import ScreenContainer from '@/components/common/ScreenContainer';
import { Brand } from '@/constants/theme';
import { useAddMoneyReceived } from '@/hooks/useAccounts';
import { toDateInputString } from '@/utils/dates';
import { formatTaka } from '@/utils/money';
import { moderateScale } from '@/utils/responsive';

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000];

// Mirrors the web Accounts module's MoneyInPage/MoneyReceivedForm — quick
// entry for a repeatable, immutable "Money Received" record.
export default function MoneyInScreen() {
  const router = useRouter();
  const addMoneyReceived = useAddMoneyReceived();

  const [amount, setAmount] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const numericAmount = Number(amount);
  const isAmountValid = Number.isFinite(numericAmount) && numericAmount > 0;

  function handleDateChange(event, selectedDate) {
    setShowDatePicker(false);
    if (selectedDate) setReceivedDate(selectedDate);
  }

  async function handleSubmit() {
    setError('');
    if (!isAmountValid) {
      setError('Enter a valid amount greater than 0.');
      return;
    }
    try {
      await addMoneyReceived.mutateAsync({
        amount: numericAmount,
        receivedDate: toDateInputString(receivedDate),
        note: note.trim(),
      });
      router.back();
    } catch (err) {
      setError(err.message || 'Could not save this entry.');
    }
  }

  return (
    <ScreenContainer scroll avoidKeyboard>
      <Stack.Screen options={{ headerShown: true, title: 'Log Money Received' }} />

      <View style={styles.form}>
        <Text style={styles.label}>How much did you receive?</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currencySign}>৳</Text>
          <AppInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
            style={styles.amountInput}
            autoFocus
          />
        </View>

        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((quick) => (
            <Pressable
              key={quick}
              style={styles.quickChip}
              onPress={() => setAmount(String((Number(amount) || 0) + quick))}>
              <Text style={styles.quickChipText}>+{quick.toLocaleString('en-US')}</Text>
            </Pressable>
          ))}
          {amount ? (
            <Pressable style={styles.clearChip} onPress={() => setAmount('')}>
              <Text style={styles.clearChipText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <View>
          <Text style={styles.label}>Received on</Text>
          <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateButtonText}>{receivedDate.toLocaleDateString()}</Text>
          </Pressable>
          {showDatePicker ? <DateTimePicker value={receivedDate} mode="date" onChange={handleDateChange} /> : null}
        </View>

        <AppInput label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Cash from boss" />

        <Text style={styles.lockNotice}>
          Once added this entry is locked permanently and cannot be edited or deleted.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Adding</Text>
          <Text style={styles.footerAmount}>+{formatTaka(isAmountValid ? numericAmount : 0)}</Text>
        </View>

        <View style={styles.actions}>
          <AppButton title="Cancel" variant="outline" onPress={() => router.back()} style={styles.actionButton} />
          <AppButton
            title={addMoneyReceived.isPending ? 'Saving…' : 'Add to Wallet'}
            onPress={handleSubmit}
            loading={addMoneyReceived.isPending}
            disabled={!isAmountValid}
            style={styles.actionButton}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  label: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: Brand.purple,
    marginBottom: 6,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencySign: {
    fontSize: moderateScale(26),
    fontWeight: '800',
    color: '#059669',
  },
  amountInput: {
    flex: 1,
    fontSize: moderateScale(24),
    fontWeight: '800',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    borderWidth: 1,
    borderColor: Brand.pink,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickChipText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: Brand.purple,
  },
  clearChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearChipText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: '#e11d48',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: Brand.pink,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dateButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: Brand.purple,
  },
  lockNotice: {
    fontSize: moderateScale(11),
    color: Brand.mauve,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 10,
    padding: 10,
  },
  error: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#d32f2f',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: Brand.mauve,
  },
  footerAmount: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#059669',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
});
