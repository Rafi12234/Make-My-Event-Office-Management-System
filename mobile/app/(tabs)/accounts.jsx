import { useMemo } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import ActivityHistory from '@/components/accounts/ActivityHistory';
import QuickActionsRow from '@/components/accounts/QuickActionsRow';
import VendorWatchList from '@/components/accounts/VendorWatchList';
import WalletSummaryCard from '@/components/accounts/WalletSummaryCard';
import ErrorState from '@/components/common/ErrorState';
import LoadingScreen from '@/components/common/LoadingScreen';
import ScreenContainer from '@/components/common/ScreenContainer';
import { Brand } from '@/constants/theme';
import { useAccountsSummary } from '@/hooks/useAccounts';
import { moderateScale } from '@/utils/responsive';

// Mirrors the web Accounts module's AccountsPage — wallet balance, quick
// actions, vendor watch, and full activity history, adapted to a single
// scrolling column instead of the web's two-column bento layout.
export default function AccountsScreen() {
  const { data: summary, isLoading, isError, error, refetch, isRefetching } = useAccountsSummary();

  const totalReceived = (summary?.moneyReceived || []).reduce((sum, entry) => sum + entry.amount, 0);
  const totalSpent = (summary?.expenses || []).reduce((sum, expense) => sum + expense.totalAmount, 0);

  // Net balance per vendor — "to_pay" items owed minus "paid"/advance
  // items, mirrors the web page's vendorNetBalances memo exactly.
  const vendorNetBalances = useMemo(() => {
    const byVendor = new Map();
    for (const payment of summary?.vendorPayments || []) {
      const name = payment.vendorName || 'Vendor';
      const delta = payment.paymentStatus === 'paid' ? payment.totalAmount : -payment.totalAmount;
      byVendor.set(name, (byVendor.get(name) || 0) + delta);
    }
    return [...byVendor.entries()]
      .map(([name, net]) => ({ name, net }))
      .filter((vendor) => vendor.net !== 0)
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [summary]);

  const totalPending = vendorNetBalances
    .filter((vendor) => vendor.net < 0)
    .reduce((sum, vendor) => sum - vendor.net, 0);

  if (isLoading) {
    return <LoadingScreen message="Loading your wallet..." />;
  }

  if (isError) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
  }

  return (
    <ScreenContainer scroll refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: moderateScale(22) }]}>Wallet &amp; Expenses</Text>
        <Text style={styles.subtitle}>Track what you receive, what you spend, and what you still owe.</Text>
      </View>

      <View style={styles.content}>
        <WalletSummaryCard
          currentBalance={summary.currentBalance}
          totalReceived={totalReceived}
          totalSpent={totalSpent}
          totalPending={totalPending}
        />
        <QuickActionsRow />
        <VendorWatchList vendorNetBalances={vendorNetBalances} />
        <ActivityHistory
          moneyReceived={summary.moneyReceived}
          expenses={summary.expenses}
          vendorPayments={summary.vendorPayments}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
    gap: 4,
  },
  title: {
    fontWeight: '800',
    color: Brand.purple,
  },
  subtitle: {
    fontSize: moderateScale(12),
    color: Brand.mauve,
  },
  content: {
    gap: 14,
  },
});
