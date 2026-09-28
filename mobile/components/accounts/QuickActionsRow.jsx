import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { Brand } from '@/constants/theme';
import { moderateScale } from '@/utils/responsive';

const ACTIONS = [
  { to: '/accounts/money-in', icon: 'payments', title: 'Money In', tint: '#10b981' },
  { to: '/accounts/log-cost', icon: 'receipt-long', title: 'Log a Cost', tint: '#7c3aed' },
  { to: '/accounts/vendors', icon: 'storefront', title: 'Vendors', tint: '#f59e0b' },
];

// Mirrors the web Accounts module's QuickActionsPanel — three entry points
// into the standalone Money In / Log a Cost / Vendor Ledger screens.
export default function QuickActionsRow() {
  const router = useRouter();

  return (
    <View style={styles.row}>
      {ACTIONS.map(({ to, icon, title, tint }) => (
        <Pressable key={to} style={styles.action} onPress={() => router.push(to)}>
          <View style={[styles.iconWrap, { backgroundColor: `${tint}1f` }]}>
            <MaterialIcons name={icon} size={20} color={tint} />
          </View>
          <Text style={styles.actionTitle} numberOfLines={1}>
            {title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: Brand.purple,
    textAlign: 'center',
  },
});
