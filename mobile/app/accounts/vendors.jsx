import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import AppInput from '@/components/common/AppInput';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import LoadingScreen from '@/components/common/LoadingScreen';
import ScreenContainer from '@/components/common/ScreenContainer';
import { Brand } from '@/constants/theme';
import { useVendors } from '@/hooks/useAccounts';
import { formatTaka } from '@/utils/money';
import { moderateScale } from '@/utils/responsive';

// Mirrors the web Accounts module's VendorsPage — every employee can view
// the shared, company-wide vendor ledger (create/deactivate is Admin-only).
export default function VendorsScreen() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useVendors();
  const [search, setSearch] = useState('');

  if (isLoading) {
    return <LoadingScreen message="Loading vendors..." />;
  }

  if (isError) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
  }

  const vendors = data || [];
  const needle = search.trim().toLowerCase();
  const filtered = needle
    ? vendors.filter(
        (vendor) =>
          vendor.name.toLowerCase().includes(needle) || (vendor.category || '').toLowerCase().includes(needle),
      )
    : vendors;

  const owedCount = vendors.filter((vendor) => vendor.currentBalance < 0).length;
  const totalOwed = vendors.reduce(
    (sum, vendor) => (vendor.currentBalance < 0 ? sum + Math.abs(vendor.currentBalance) : sum),
    0,
  );

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: 'Vendor Directory' }} />

      {owedCount > 0 ? (
        <View style={styles.owedCard}>
          <Text style={styles.owedLabel}>Total Outstanding</Text>
          <Text style={styles.owedAmount}>−{formatTaka(totalOwed)}</Text>
          <Text style={styles.owedCount}>
            {owedCount} vendor{owedCount === 1 ? '' : 's'} awaiting payment
          </Text>
        </View>
      ) : null}

      <AppInput placeholder="Search vendors…" value={search} onChangeText={setSearch} style={styles.search} />

      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={(vendor) => vendor.id}
        renderItem={({ item }) => <VendorRow vendor={item} onPress={() => router.push(`/accounts/vendors/${item.id}`)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            title={vendors.length === 0 ? 'No vendors added yet.' : 'No vendors match your search.'}
            message={vendors.length === 0 ? 'Ask an admin to add vendors first.' : 'Try a different search.'}
          />
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContent : styles.listContent}
      />
    </ScreenContainer>
  );
}

function VendorRow({ vendor, onPress }) {
  const owes = vendor.currentBalance < 0;
  const advanced = vendor.currentBalance > 0;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowText}>
        <Text style={styles.vendorName} numberOfLines={1}>
          {vendor.name}
        </Text>
        {vendor.category ? <Text style={styles.vendorCategory}>{vendor.category}</Text> : null}
      </View>
      <View style={styles.rowBalance}>
        <Text style={styles.rowBalanceLabel}>{owes ? 'You owe' : advanced ? 'Advanced' : 'Settled'}</Text>
        <Text style={[styles.rowBalanceAmount, owes ? styles.owed : advanced ? styles.advanced : null]}>
          {owes ? '−' : advanced ? '+' : ''}
          {formatTaka(Math.abs(vendor.currentBalance))}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  owedCard: {
    backgroundColor: '#0B0B0F',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    gap: 2,
  },
  owedLabel: {
    fontSize: moderateScale(10.5),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  owedAmount: {
    fontSize: moderateScale(26),
    fontWeight: '800',
    color: '#fb7185',
  },
  owedCount: {
    fontSize: moderateScale(11),
    color: 'rgba(255,255,255,0.7)',
  },
  search: {
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContent: {
    flexGrow: 1,
  },
  separator: {
    height: 10,
  },
  row: {
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
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  vendorName: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: Brand.purple,
  },
  vendorCategory: {
    fontSize: moderateScale(11),
    color: Brand.mauve,
  },
  rowBalance: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rowBalanceLabel: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    color: Brand.mauve,
    textTransform: 'uppercase',
  },
  rowBalanceAmount: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    color: Brand.purple,
  },
  owed: {
    color: '#e11d48',
  },
  advanced: {
    color: '#059669',
  },
});
