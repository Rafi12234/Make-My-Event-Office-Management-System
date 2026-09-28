import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { formatTaka } from '@/utils/money';
import { moderateScale } from '@/utils/responsive';

// Mirrors the web Accounts module's WalletSummaryCard — current balance
// plus received/spent/pending-to-vendors metrics. No animated count-up or
// SVG gauge here; a static card reads better on a phone-sized screen.
export default function WalletSummaryCard({ currentBalance, totalReceived, totalSpent, totalPending = 0 }) {
  const isNegative = currentBalance < 0;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Current Balance</Text>
      <Text style={[styles.balance, isNegative && styles.balanceNegative]}>{formatTaka(currentBalance)}</Text>
      <Text style={styles.hint}>
        {isNegative ? 'Overspent — settle up with your boss' : 'Cash you are still holding'}
      </Text>

      <View style={styles.metricsRow}>
        <Metric label="Received" value={totalReceived} color="#34d399" />
        <Metric label="Spent" value={totalSpent} color="#fb7185" />
        <Metric label="To Pay" value={totalPending} color="#fbbf24" />
      </View>
    </View>
  );
}

function Metric({ label, value, color }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]} numberOfLines={1}>
        {formatTaka(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0B0B0F',
    borderRadius: 24,
    padding: 20,
    gap: 4,
  },
  label: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  balance: {
    fontSize: moderateScale(38),
    fontWeight: '800',
    color: '#fff',
    marginTop: 4,
  },
  balanceNegative: {
    color: '#fb7185',
  },
  hint: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 10,
    gap: 4,
  },
  metricLabel: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  metricValue: {
    fontSize: moderateScale(14),
    fontWeight: '800',
  },
});
