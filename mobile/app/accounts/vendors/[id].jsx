import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import LoadingScreen from '@/components/common/LoadingScreen';
import ScreenContainer from '@/components/common/ScreenContainer';
import StatusPill from '@/components/accounts/StatusPill';
import { Brand } from '@/constants/theme';
import { usePayVendor, useVendorProfile } from '@/hooks/useAccounts';
import { formatDisplayDate, toDateInputString } from '@/utils/dates';
import { formatTaka } from '@/utils/money';
import { moderateScale } from '@/utils/responsive';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'to_pay', label: 'To Pay' },
  { key: 'paid', label: 'Paid' },
];

// Mirrors the web Accounts module's VendorProfilePage — shared running
// balance + full transaction history across every employee, with a "Record
// a Payment" form shown only while this vendor still owes money.
export default function VendorProfileScreen() {
  const { id } = useLocalSearchParams();
  const { data, isLoading, isError, error, refetch } = useVendorProfile(id);
  const payVendor = usePayVendor(id);

  const [statusFilter, setStatusFilter] = useState('all');
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [payNote, setPayNote] = useState('');
  const [payError, setPayError] = useState('');

  if (isLoading) {
    return <LoadingScreen message="Loading vendor..." />;
  }

  if (isError) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
  }

  const transactions = data?.transactions || [];
  const balance = data?.vendor.currentBalance || 0;
  const owes = balance < 0;
  const advanced = balance > 0;
  const paidTotal = transactions.filter((tx) => tx.paymentStatus === 'paid').reduce((sum, tx) => sum + tx.totalAmount, 0);
  const pendingTotal = transactions
    .filter((tx) => tx.paymentStatus === 'to_pay')
    .reduce((sum, tx) => sum + tx.totalAmount, 0);
  const visible = statusFilter === 'all' ? transactions : transactions.filter((tx) => tx.paymentStatus === statusFilter);

  function handleDateChange(event, selectedDate) {
    setShowDatePicker(false);
    if (selectedDate) setPayDate(selectedDate);
  }

  async function handlePaySubmit() {
    const numericAmount = Number(payAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setPayError('Enter a valid amount greater than 0.');
      return;
    }
    setPayError('');
    try {
      await payVendor.mutateAsync({
        amount: numericAmount,
        paidOn: toDateInputString(payDate),
        note: payNote.trim(),
      });
      setPayAmount('');
      setPayNote('');
      setShowPayForm(false);
    } catch (err) {
      setPayError(err.message || 'Could not record this payment.');
    }
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: data.vendor.name }} />

      <FlatList
        data={visible}
        keyExtractor={(tx) => tx.id}
        ListHeaderComponent={
          <View style={styles.headerCard}>
            <Text style={styles.vendorName}>{data.vendor.name}</Text>
            {data.vendor.category ? <Text style={styles.vendorCategory}>{data.vendor.category}</Text> : null}

            <Text style={styles.balanceLabel}>
              {owes ? 'You Owe This Vendor' : advanced ? 'Advanced / Overpaid' : 'Fully Settled'}
            </Text>
            <Text style={[styles.balanceAmount, owes ? styles.owed : advanced ? styles.advanced : null]}>
              {owes ? '−' : advanced ? '+' : ''}
              {formatTaka(Math.abs(balance))}
            </Text>

            <View style={styles.statsRow}>
              <Stat label="Entries" value={String(transactions.length)} />
              <Stat label="Paid" value={`+${formatTaka(paidTotal)}`} tone={styles.advanced} />
              <Stat label="To Pay" value={`−${formatTaka(pendingTotal)}`} tone={styles.owed} />
            </View>

            {owes ? (
              showPayForm ? (
                <View style={styles.payForm}>
                  <AppInput
                    label="Amount paid"
                    value={payAmount}
                    onChangeText={setPayAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                  <View>
                    <Text style={styles.payLabel}>Paid on</Text>
                    <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                      <Text style={styles.dateButtonText}>{payDate.toLocaleDateString()}</Text>
                    </Pressable>
                    {showDatePicker ? <DateTimePicker value={payDate} mode="date" onChange={handleDateChange} /> : null}
                  </View>
                  <AppInput
                    label="Note (optional)"
                    value={payNote}
                    onChangeText={setPayNote}
                    placeholder={`e.g. Paid ${data.vendor.name} in cash`}
                  />
                  {payError ? <Text style={styles.payError}>{payError}</Text> : null}
                  <View style={styles.payActions}>
                    <AppButton
                      title="Cancel"
                      variant="outline"
                      onPress={() => {
                        setShowPayForm(false);
                        setPayError('');
                      }}
                      style={styles.payActionButton}
                    />
                    <AppButton
                      title={payVendor.isPending ? 'Recording…' : 'Confirm Payment'}
                      onPress={handlePaySubmit}
                      loading={payVendor.isPending}
                      style={styles.payActionButton}
                    />
                  </View>
                </View>
              ) : (
                <AppButton title="Record a Payment to This Vendor" onPress={() => setShowPayForm(true)} style={styles.payButton} />
              )
            ) : null}

            <Text style={styles.sectionTitle}>Transaction History</Text>
            <View style={styles.filterRow}>
              {FILTERS.map((filter) => {
                const isActive = statusFilter === filter.key;
                return (
                  <Pressable
                    key={filter.key}
                    onPress={() => setStatusFilter(filter.key)}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}>
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => <TransactionRow tx={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            title={transactions.length === 0 ? 'No transactions with this vendor yet.' : 'Nothing in this filter.'}
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </ScreenContainer>
  );
}

function Stat({ label, value, tone }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone]}>{value}</Text>
    </View>
  );
}

function TransactionRow({ tx }) {
  const isPending = tx.paymentStatus === 'to_pay';
  return (
    <View style={[styles.txRow, isPending ? styles.txRowPending : null]}>
      <View style={styles.txText}>
        <Text style={styles.txPurpose} numberOfLines={1}>
          {tx.purpose}
        </Text>
        <Text style={styles.txMeta} numberOfLines={1}>
          {tx.employeeName} • {formatDisplayDate(tx.costDate)} •{' '}
          {tx.costType === 'event' ? tx.eventClientName || 'Event' : 'Regular'}
        </Text>
      </View>
      <View style={styles.txAmountCol}>
        <Text style={[styles.txAmount, isPending ? styles.owed : styles.advanced]}>
          {isPending ? '−' : '+'}
          {formatTaka(tx.totalAmount)}
        </Text>
        <StatusPill status={tx.paymentStatus} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    gap: 4,
    marginBottom: 6,
  },
  vendorName: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: Brand.purple,
  },
  vendorCategory: {
    fontSize: moderateScale(12),
    color: Brand.mauve,
    marginBottom: 10,
  },
  balanceLabel: {
    fontSize: moderateScale(10.5),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.mauve,
    marginTop: 10,
  },
  balanceAmount: {
    fontSize: moderateScale(32),
    fontWeight: '800',
    color: Brand.purple,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    marginBottom: 14,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    padding: 10,
    gap: 3,
  },
  statLabel: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    textTransform: 'uppercase',
    color: Brand.mauve,
  },
  statValue: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: Brand.purple,
  },
  payButton: {
    marginBottom: 16,
  },
  payForm: {
    gap: 12,
    borderWidth: 1,
    borderColor: Brand.pink,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  payLabel: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: Brand.purple,
    marginBottom: 6,
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
  payError: {
    fontSize: moderateScale(12),
    fontWeight: '600',
    color: '#d32f2f',
  },
  payActions: {
    flexDirection: 'row',
    gap: 10,
  },
  payActionButton: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: Brand.purple,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  filterChip: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  filterChipActive: {
    backgroundColor: '#0B0B0F',
  },
  filterChipText: {
    fontSize: moderateScale(11.5),
    fontWeight: '700',
    color: Brand.mauve,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  separator: {
    height: 10,
  },
  listContent: {
    paddingBottom: 24,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 14,
    padding: 14,
  },
  txRowPending: {
    borderColor: '#fde68a',
  },
  txText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  txPurpose: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: Brand.purple,
  },
  txMeta: {
    fontSize: moderateScale(11),
    color: Brand.mauve,
  },
  txAmountCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txAmount: {
    fontSize: moderateScale(13),
    fontWeight: '800',
  },
  owed: {
    color: '#e11d48',
  },
  advanced: {
    color: '#059669',
  },
});
