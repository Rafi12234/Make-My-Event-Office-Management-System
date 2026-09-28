import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { API_ORIGIN } from '@/constants/config';
import { Brand } from '@/constants/theme';
import { CLIENT_REQUIREMENT_OPTIONS } from '@/constants/meetingItems';
import { moderateScale } from '@/utils/responsive';

const LABELS = Object.fromEntries(CLIENT_REQUIREMENT_OPTIONS.map((option) => [option.key, option.label]));

// Read-only — the requirement, its quantity, description, and photos, the
// way the meeting was actually saved. No add/remove controls here; items
// are only chosen while creating the meeting (see ItemSelectModal).
export default function MeetingItemDisplay({ item }) {
  const label = item.itemKey === 'other' ? item.customLabel || 'Other' : LABELS[item.itemKey] || item.itemKey;

  return (
    <View style={styles.row}>
      <View style={styles.headerRow}>
        <View style={styles.iconBadge}>
          <MaterialIcons name="checklist" size={14} color={Brand.plum} />
        </View>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.quantityPill}>
          <Text style={styles.quantity}>x{item.quantity}</Text>
        </View>
      </View>
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
      {item.images?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
          {item.images.map((image) => (
            <Image key={image.id} source={{ uri: `${API_ORIGIN}${image.url}` }} style={styles.image} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: 'rgba(91,55,101,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: Brand.purple,
  },
  quantityPill: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  quantity: {
    fontSize: moderateScale(11.5),
    color: Brand.mauve,
    fontWeight: '700',
  },
  description: {
    fontSize: moderateScale(13),
    color: Brand.purple,
    paddingLeft: 34,
  },
  imageRow: {
    gap: 8,
    marginTop: 2,
    paddingLeft: 34,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
});

