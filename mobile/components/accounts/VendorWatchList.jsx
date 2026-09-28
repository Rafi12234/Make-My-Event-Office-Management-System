import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { formatTaka } from '@/utils/money';
import { moderateScale } from '@/utils/responsive';

// Mirrors the web Accounts module's VendorWatchPanel — top vendor net
// balances (negative = still owed, positive = advanced/paid ahead).
export default function VendorWatchList({ vendorNetBalances }) {
  const top = vendorNetBalances.slice(0, 3);

  if (top.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Vendor Watch</Text>
        <Text style={styles.empty}>All settled — no vendor has a running balance right now.</Text>
      </View>
    );
  }

  const largest = Math.max(...top.map((vendor) => Math.abs(vendor.net)), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Vendor Watch</Text>
      <View style={styles.list}>
        {top.map((vendor) => {
          const isOwed = vendor.net < 0;
          const amount = Math.abs(vendor.net);
          return (
            <View key={vendor.name} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.vendorName} numberOfLines={1}>
                  {vendor.name}
                </Text>
                <Text style={[styles.amount, isOwed ? styles.owed : styles.advanced]}>
                  {isOwed ? '−' : '+'}
                  {formatTaka(amount)}
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.max((amount / largest) * 100, 6)}%` },
                    isOwed ? styles.barOwed : styles.barAdvanced,
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: Brand.purple,
  },
  empty: {
    fontSize: moderateScale(12),
    color: Brand.mauve,
  },
  list: {
    gap: 12,
  },
  row: {
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  vendorName: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: Brand.purple,
  },
  amount: {
    fontSize: moderateScale(12),
    fontWeight: '800',
  },
  owed: {
    color: '#e11d48',
  },
  advanced: {
    color: '#059669',
  },
  barTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  barOwed: {
    backgroundColor: '#f59e0b',
  },
  barAdvanced: {
    backgroundColor: '#10b981',
  },
});
