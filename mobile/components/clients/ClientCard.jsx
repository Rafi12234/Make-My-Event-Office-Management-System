import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { Brand } from '@/constants/theme';
import { moderateScale } from '@/utils/responsive';

function initialsFor(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export default function ClientCard({ client, onRequestDelete }) {
  const router = useRouter();
  const isNightShift = String(client.shift).toLowerCase() === 'night';

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/clients/${client.rowKey}`)}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsFor(client.name)}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {client.name || 'Unnamed client'}
          </Text>
          {client.venue ? (
            <View style={styles.metaInline}>
              <MaterialIcons name="place" size={12} color={Brand.mauve} />
              <Text style={styles.metaInlineText} numberOfLines={1}>
                {client.venue}
                {client.floor ? ` \u00b7 Floor ${client.floor}` : ''}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onRequestDelete(client.rowKey);
          }}
          style={styles.deleteButton}
          hitSlop={8}>
          <MaterialIcons name="delete-outline" size={17} color="#d32f2f" />
        </Pressable>
      </View>

      <View style={styles.badgeRow}>
        {client.eventDate ? (
          <View style={styles.badge}>
            <MaterialIcons name="event" size={12} color={Brand.plum} />
            <Text style={styles.badgeText}>{client.eventDate}</Text>
          </View>
        ) : null}
        {client.shift ? (
          <View style={[styles.badge, isNightShift && styles.badgeNight]}>
            <MaterialIcons name={isNightShift ? 'nightlight' : 'wb-sunny'} size={12} color={isNightShift ? '#fff' : Brand.plum} />
            <Text style={[styles.badgeText, isNightShift && styles.badgeTextNight]}>{client.shift}</Text>
          </View>
        ) : null}
        {client.guestCount ? (
          <View style={styles.badge}>
            <MaterialIcons name="groups" size={12} color={Brand.plum} />
            <Text style={styles.badgeText}>{client.guestCount} guests</Text>
          </View>
        ) : null}
      </View>

      {client.phone ? (
        <View style={styles.metaInline}>
          <MaterialIcons name="call" size={13} color={Brand.plum} />
          <Text style={styles.phone}>{client.phone}</Text>
        </View>
      ) : null}

      {client.nextMeetingTime ? (
        <View style={styles.nextPill}>
          <MaterialIcons name="schedule" size={13} color="#059669" />
          <Text style={styles.nextText} numberOfLines={1}>
            Next meeting: {client.nextMeetingTime}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: Brand.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: moderateScale(13),
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: moderateScale(15.5),
    fontWeight: '700',
    color: Brand.purple,
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(211,47,47,0.08)',
  },
  metaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaInlineText: {
    fontSize: moderateScale(12),
    color: Brand.mauve,
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(91,55,101,0.07)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeNight: {
    backgroundColor: Brand.plum,
  },
  badgeText: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: Brand.plum,
  },
  badgeTextNight: {
    color: '#fff',
  },
  phone: {
    fontSize: moderateScale(13),
    color: Brand.plum,
    fontWeight: '600',
  },
  nextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(5,150,105,0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  nextText: {
    fontSize: moderateScale(11.5),
    fontWeight: '700',
    color: '#059669',
    flexShrink: 1,
  },
});
