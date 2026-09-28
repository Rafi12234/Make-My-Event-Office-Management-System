import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import ActivityCard from '@/components/dashboard/ActivityCard';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import LoadingScreen from '@/components/common/LoadingScreen';
import ScreenContainer from '@/components/common/ScreenContainer';
import { Brand } from '@/constants/theme';
import { useDashboard } from '@/hooks/useDashboard';
import { moderateScale } from '@/utils/responsive';

const TITLES = {
  todayCalls: "Today's Calls",
  todayMeetings: "Today's Meetings",
  overdueCalls: 'Overdue Calls',
  overdueMeetings: 'Overdue Meetings',
};

// Calls navigate to a client's Calls tab, meetings to its Meetings tab.
const DETAIL_SEGMENT = {
  todayCalls: 'calls',
  todayMeetings: 'meetings',
  overdueCalls: 'calls',
  overdueMeetings: 'meetings',
};

export default function DashboardListScreen() {
  const { type } = useLocalSearchParams();
  const router = useRouter();
  const { summary, isLoading, isError, error, refetch } = useDashboard();

  const title = TITLES[type] || 'List';

  if (isLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (isError) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
  }

  const items = summary[type] || [];
  const detailSegment = DETAIL_SEGMENT[type] || 'calls';

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title }} />
      <Text style={styles.title}>{title}</Text>
      <FlatList
        style={styles.list}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ActivityCard event={item} onPress={() => router.push(`/clients/${item.rowKey}/${detailSegment}`)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState title="Nothing here" message="No items to show right now." />}
        contentContainerStyle={items.length === 0 ? styles.emptyContent : styles.listContent}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: Brand.purple,
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  separator: {
    height: 10,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContent: {
    flexGrow: 1,
  },
});
