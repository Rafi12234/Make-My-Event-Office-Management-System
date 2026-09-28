import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import ActivityCard from '@/components/dashboard/ActivityCard';
import SummaryCard from '@/components/dashboard/SummaryCard';
import TodayHeroCard from '@/components/dashboard/TodayHeroCard';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import LoadingScreen from '@/components/common/LoadingScreen';
import ScreenContainer from '@/components/common/ScreenContainer';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import { useResponsive } from '@/utils/responsive';

function initialsFor(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export default function DashboardScreen() {
  const { employee, logout } = useAuth();
  const { summary, isLoading, isError, error, refetch, isRefetching } = useDashboard();
  const { moderateScale } = useResponsive();
  const router = useRouter();

  if (isLoading) {
    return <LoadingScreen message="Loading your dashboard..." />;
  }

  if (isError) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
  }

  const { todayCalls, todayMeetings, overdueCalls, overdueMeetings } = summary.counts;

  function handleHeroPress() {
    if (todayCalls > 0) router.push('/dashboard-list/todayCalls');
    else if (todayMeetings > 0) router.push('/dashboard-list/todayMeetings');
  }

  return (
    <ScreenContainer
      scroll
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsFor(employee?.fullName)}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerHint}>Welcome back</Text>
          <Text
            style={[styles.greeting, { fontSize: moderateScale(20) }]}
            numberOfLines={1}>
            {employee?.fullName?.split(' ')[0] || 'there'}
          </Text>
        </View>
        <Pressable onPress={logout} style={styles.logoutButton} hitSlop={8}>
          <MaterialIcons name="logout" size={18} color={Brand.plum} />
        </Pressable>
      </View>

      <TodayHeroCard todayCalls={todayCalls} todayMeetings={todayMeetings} onPress={handleHeroPress} />

      <View style={styles.summaryRow}>
        <SummaryCard
          label="Today's Calls"
          count={todayCalls}
          color={Brand.plum}
          icon="call"
          onPress={() => router.push('/dashboard-list/todayCalls')}
        />
        <SummaryCard
          label="Today's Meetings"
          count={todayMeetings}
          color={Brand.mauve}
          icon="groups"
          onPress={() => router.push('/dashboard-list/todayMeetings')}
        />
      </View>
      <View style={styles.summaryRow}>
        <SummaryCard
          label="Overdue Calls"
          count={overdueCalls}
          color="#d32f2f"
          icon="error-outline"
          onPress={() => router.push('/dashboard-list/overdueCalls')}
        />
        <SummaryCard
          label="Overdue Meetings"
          count={overdueMeetings}
          color="#d32f2f"
          icon="error-outline"
          onPress={() => router.push('/dashboard-list/overdueMeetings')}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { fontSize: moderateScale(17) }]}>Upcoming Calls</Text>
        {summary.upcomingCallActivities.length > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{summary.upcomingCallActivities.length}</Text>
          </View>
        ) : null}
      </View>
      {summary.upcomingCallActivities.length === 0 ? (
        <EmptyState title="No upcoming calls" message="Nothing scheduled this month." />
      ) : (
        <View style={styles.list}>
          {summary.upcomingCallActivities.map((event) => (
            <ActivityCard key={event.id} event={event} />
          ))}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { fontSize: moderateScale(17) }]}>Upcoming Meetings</Text>
        {summary.upcomingMeetingActivities.length > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{summary.upcomingMeetingActivities.length}</Text>
          </View>
        ) : null}
      </View>
      {summary.upcomingMeetingActivities.length === 0 ? (
        <EmptyState title="No upcoming meetings" message="Nothing scheduled this month." />
      ) : (
        <View style={styles.list}>
          {summary.upcomingMeetingActivities.map((event) => (
            <ActivityCard key={event.id} event={event} />
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Brand.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  headerHint: {
    fontSize: 11,
    fontWeight: '600',
    color: Brand.mauve,
  },
  greeting: {
    fontWeight: '800',
    color: Brand.purple,
  },
  logoutButton: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '800',
    color: Brand.purple,
  },
  countPill: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.purple,
  },
  list: {
    gap: 10,
  },
});
