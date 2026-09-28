import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Brand } from '@/constants/theme';
import { useResponsive } from '@/utils/responsive';

// Enhanced stat card — icon badge, big count, and a decorative progress
// bar (scaled against maxScale, purely visual polish, not a real
// percentage) so the dashboard reads less like a bare number list.
export default function SummaryCard({ label, count, color = Brand.plum, icon, maxScale = 10, onPress }) {
  const { moderateScale } = useResponsive();
  const Container = onPress ? Pressable : View;
  const progress = Math.max(0.06, Math.min(count / maxScale, 1));

  return (
    <Container style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        {icon ? (
          <View style={[styles.iconBadge, { backgroundColor: `${color}1f` }]}>
            <MaterialIcons name={icon} size={16} color={color} />
          </View>
        ) : null}
        <Text style={[styles.count, { color, fontSize: moderateScale(26) }]} numberOfLines={1}>
          {count}
        </Text>
      </View>
      <Text style={[styles.label, { fontSize: moderateScale(12) }]} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { backgroundColor: color, width: `${progress * 100}%` }]} />
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '47%',
    minWidth: 0,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontWeight: '800',
  },
  label: {
    color: Brand.mauve,
    fontWeight: '600',
  },
  barTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    marginTop: 2,
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
});

