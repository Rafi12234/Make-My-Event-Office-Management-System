import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Brand } from '@/constants/theme';
import { useResponsive } from '@/utils/responsive';

const TYPE_LABEL = {
  client_next_call: 'Call',
  client_next_meeting: 'Meeting',
};

const TYPE_ICON = {
  client_next_call: 'call',
  client_next_meeting: 'groups',
};

const TYPE_COLOR = {
  client_next_call: Brand.plum,
  client_next_meeting: Brand.mauve,
};

export default function ActivityCard({ event, onPress }) {
  const { moderateScale } = useResponsive();
  const label = TYPE_LABEL[event.source] || 'Activity';
  const icon = TYPE_ICON[event.source] || 'event-note';
  const color = TYPE_COLOR[event.source] || Brand.mauve;
  const Container = onPress ? Pressable : View;

  return (
    <Container style={styles.card} onPress={onPress}>
      <View style={[styles.iconBadge, { backgroundColor: `${color}1f` }]}>
        <MaterialIcons name={icon} size={18} color={color} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.clientName, { fontSize: moderateScale(15) }]} numberOfLines={1}>
          {event.clientName || 'Unknown client'}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.badgeText, { color, fontSize: moderateScale(11) }]}>{label}</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={[styles.time, { fontSize: moderateScale(12) }]} numberOfLines={1}>
            {event.date}{event.time ? ` \u00b7 ${event.time}` : ''}
          </Text>
        </View>
      </View>
      {onPress ? <MaterialIcons name="chevron-right" size={20} color={Brand.mauve} /> : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  iconBadge: {
    flexShrink: 0,
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  clientName: {
    fontWeight: '700',
    color: Brand.purple,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeText: {
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dot: {
    color: Brand.mauve,
    fontSize: 11,
  },
  time: {
    color: Brand.mauve,
    fontWeight: '500',
  },
});
