import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import ErrorState from '@/components/common/ErrorState';
import LoadingScreen from '@/components/common/LoadingScreen';
import ScreenContainer from '@/components/common/ScreenContainer';
import { Brand } from '@/constants/theme';
import { useClient } from '@/hooks/useClient';
import { moderateScale } from '@/utils/responsive';

function initialsFor(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

function FactTile({ icon, label, value }) {
  return (
    <View style={styles.factTile}>
      <View style={styles.factIconRow}>
        <MaterialIcons name={icon} size={13} color="rgba(255,255,255,0.7)" />
        <Text style={styles.factLabel}>{label}</Text>
      </View>
      <Text style={styles.factValue} numberOfLines={1}>
        {value || '—'}
      </Text>
    </View>
  );
}

function TimelineRow({ icon, label, value, tint }) {
  return (
    <View style={styles.timelineRow}>
      <View style={[styles.timelineIconBadge, { backgroundColor: `${tint}1a` }]}>
        <MaterialIcons name={icon} size={17} color={tint} />
      </View>
      <View style={styles.timelineText}>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineValue} numberOfLines={1}>
          {value || 'Not scheduled yet'}
        </Text>
      </View>
    </View>
  );
}

export default function ClientDetailScreen() {
  const { rowKey } = useLocalSearchParams();
  const router = useRouter();
  const { client, isLoading, isError, error, refetch } = useClient(rowKey);

  if (isLoading) {
    return <LoadingScreen message="Loading client..." />;
  }

  if (isError || !client) {
    return <ErrorState message={error?.message || 'Client not found.'} onRetry={refetch} />;
  }

  function handleCall() {
    if (!client.phone) return;
    Linking.openURL(`tel:${client.phone}`);
  }

  const isNightShift = String(client.shift).toLowerCase() === 'night';

  return (
    <ScreenContainer scroll>
      <Stack.Screen options={{ headerShown: true, title: client.name || 'Client' }} />

      <View style={styles.hero}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsFor(client.name)}</Text>
          </View>
          <View style={styles.heroHeaderText}>
            <Text style={styles.name} numberOfLines={1}>
              {client.name || 'Unnamed client'}
            </Text>
            {client.venue ? (
              <View style={styles.venueRow}>
                <MaterialIcons name="place" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.venueText} numberOfLines={1}>
                  {client.venue}
                  {client.floor ? ` \u00b7 Floor ${client.floor}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.factsGrid}>
          <FactTile icon="event" label="Event Date" value={client.eventDate} />
          <FactTile icon={isNightShift ? 'nightlight' : 'wb-sunny'} label="Shift" value={client.shift} />
          <FactTile icon="groups" label="Guests" value={client.guestCount} />
        </View>
      </View>

      {client.phone ? (
        <Pressable style={styles.callButton} onPress={handleCall}>
          <MaterialIcons name="call" size={18} color="#fff" />
          <Text style={styles.callButtonText}>Call {client.phone}</Text>
        </Pressable>
      ) : null}

      <Text style={styles.sectionTitle}>Activity Timeline</Text>
      <View style={styles.timelineCard}>
        <TimelineRow icon="history" label="Last Meeting" value={client.lastMeetingTime} tint={Brand.mauve} />
        <View style={styles.timelineDivider} />
        <TimelineRow icon="schedule" label="Next Meeting" value={client.nextMeetingTime} tint="#059669" />
        <View style={styles.timelineDivider} />
        <TimelineRow icon="call-missed" label="Last Call" value={client.lastCallDatetime} tint={Brand.mauve} />
        <View style={styles.timelineDivider} />
        <TimelineRow icon="phone-forwarded" label="Next Call" value={client.nextCallDatetime} tint="#059669" />
      </View>

      <Text style={styles.sectionTitle}>History</Text>
      <View style={styles.historyLinks}>
        <Pressable style={styles.historyLink} onPress={() => router.push(`/clients/${rowKey}/calls`)}>
          <View style={[styles.historyLinkIcon, { backgroundColor: `${Brand.plum}1f` }]}>
            <MaterialIcons name="call" size={18} color={Brand.plum} />
          </View>
          <Text style={styles.historyLinkText}>Call History</Text>
          <MaterialIcons name="chevron-right" size={20} color={Brand.mauve} />
        </Pressable>
        <Pressable style={styles.historyLink} onPress={() => router.push(`/clients/${rowKey}/meetings`)}>
          <View style={[styles.historyLinkIcon, { backgroundColor: `${Brand.mauve}1f` }]}>
            <MaterialIcons name="groups" size={18} color={Brand.mauve} />
          </View>
          <Text style={styles.historyLinkText}>Meeting History</Text>
          <MaterialIcons name="chevron-right" size={20} color={Brand.mauve} />
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: '#0B0B0F',
    borderRadius: 24,
    padding: 20,
    gap: 4,
    marginBottom: 16,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: moderateScale(16),
  },
  heroHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontSize: moderateScale(19),
    fontWeight: '800',
    color: '#fff',
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  venueText: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.7)',
    flexShrink: 1,
  },
  factsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  factTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 10,
    gap: 6,
  },
  factIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  factLabel: {
    fontSize: moderateScale(9.5),
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  factValue: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: '#fff',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.plum,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 22,
  },
  callButtonText: {
    fontSize: moderateScale(14.5),
    fontWeight: '800',
    color: '#fff',
  },
  sectionTitle: {
    fontSize: moderateScale(15),
    fontWeight: '800',
    color: Brand.purple,
    marginBottom: 10,
  },
  timelineCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 18,
    padding: 6,
    marginBottom: 22,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  timelineDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: 10,
  },
  timelineIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  timelineLabel: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: Brand.mauve,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timelineValue: {
    fontSize: moderateScale(13.5),
    fontWeight: '700',
    color: Brand.purple,
  },
  historyLinks: {
    gap: 10,
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    borderRadius: 16,
    padding: 12,
  },
  historyLinkIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLinkText: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: Brand.purple,
  },
});
