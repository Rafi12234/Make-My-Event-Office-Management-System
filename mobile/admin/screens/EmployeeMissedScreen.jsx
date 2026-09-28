import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AdminCard from '@/admin/components/AdminCard';
import AdminScreen from '@/admin/components/AdminScreen';
import AdminNotice from '@/admin/components/AdminNotice';

import {
  fetchAllCalls,
  fetchAllEmployees,
  fetchAllMeetings,
} from '@/admin/services/adminApi';

import {
  buildEmployeeActivity,
  missedItems,
} from '@/admin/utils/activity';

import { formatDateTime } from '@/admin/utils/format';
import LoadingScreen from '@/components/common/LoadingScreen';
import { Brand } from '@/constants/theme';

export default function EmployeeMissedScreen() {
  const { id } = useLocalSearchParams();

  const [state, setState] = useState({
    employees: [],
    meetings: [],
    calls: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [employees, meetings, calls] =
          await Promise.all([
            fetchAllEmployees(),
            fetchAllMeetings(),
            fetchAllCalls(),
          ]);

        setState({
          employees,
          meetings,
          calls,
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const bucket = useMemo(
    () =>
      buildEmployeeActivity(
        state.employees,
        state.meetings,
        state.calls,
      ).find(
        (b) =>
          String(b.employee.id) === String(id),
      ),
    [state, id],
  );

  if (loading) {
    return (
      <LoadingScreen message="Loading missed activities..." />
    );
  }

  const missed = bucket
    ? missedItems(bucket)
    : [];

  return (
    <AdminScreen
      back
      title={`${
        bucket?.employee?.fullName || 'Employee'
      } · Missed`}
      subtitle="Overdue follow-up meetings and calls."
    >
      <AdminNotice
        type="error"
        message={error}
      />

      <AdminCard
        title="Missed / overdue activity"
        subtitle={`${missed.length} record(s)`}
      >
        {missed.length ? (
          missed.map((item) => (
            <View
              key={`${item.type}-${item.id}`}
              style={styles.row}
            >
              <Text style={styles.title}>
                {item.type === 'meeting'
                  ? 'Meeting'
                  : 'Call'}{' '}
                · {item.clientName || 'Client'}
              </Text>

              <Text style={styles.meta}>
                Due {formatDateTime(item.datetime)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>
            No missed follow-ups.
          </Text>
        )}
      </AdminCard>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#ead7e3',
  },

  title: {
    fontSize: 13,
    fontWeight: '800',
    color: Brand.purple,
  },

  meta: {
    marginTop: 2,
    fontSize: 11,
    color: '#b23b3b',
  },

  empty: {
    color: Brand.mauve,
    textAlign: 'center',
    paddingVertical: 10,
  },
});