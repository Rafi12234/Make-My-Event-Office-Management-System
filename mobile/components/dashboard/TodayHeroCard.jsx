import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { moderateScale } from '@/utils/responsive';

// Dark hero summary card — mirrors the visual language of the Accounts
// tab's WalletSummaryCard, giving the dashboard a single bold focal point
// (today's combined workload) above the smaller stat grid.
export default function TodayHeroCard({ todayCalls, todayMeetings, onPress }) {
  const total = todayCalls + todayMeetings;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.label}>Today&apos;s Schedule</Text>
      <View style={styles.countRow}>
        <Text style={styles.count}>{total}</Text>
        <Text style={styles.countSuffix}>{total === 1 ? 'activity' : 'activities'}</Text>
      </View>

      <View style={styles.breakdownRow}>
        <View style={styles.breakdownItem}>
          <MaterialIcons name="call" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.breakdownText}>{todayCalls} calls</Text>
        </View>
        <View style={styles.breakdownItem}>
          <MaterialIcons name="groups" size={14} color="rgba(255,255,255,0.8)" />
          <Text style={styles.breakdownText}>{todayMeetings} meetings</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {total === 0 ? 'Nothing scheduled for today — enjoy the breather.' : 'Tap to view today\u2019s list'}
        </Text>
        {total > 0 ? <MaterialIcons name="arrow-forward" size={16} color="#fff" /> : null}
      </View>
    </Pressable>
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
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 4,
  },
  count: {
    fontSize: moderateScale(40),
    fontWeight: '800',
    color: '#fff',
  },
  countSuffix: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 12,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  breakdownText: {
    fontSize: moderateScale(11.5),
    fontWeight: '700',
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  footerText: {
    fontSize: moderateScale(11.5),
    color: 'rgba(255,255,255,0.75)',
    flexShrink: 1,
  },
});
