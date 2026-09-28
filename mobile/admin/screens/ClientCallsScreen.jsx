import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import AdminCard
  from '@/admin/components/AdminCard';

import AdminNotice
  from '@/admin/components/AdminNotice';

import AdminScreen
  from '@/admin/components/AdminScreen';

import {
  fetchClientCallsForAdmin,
} from '@/admin/services/adminApi';

import {
  formatDateTime,
} from '@/admin/utils/format';

import LoadingScreen
  from '@/components/common/LoadingScreen';

import {
  Brand,
} from '@/constants/theme';

export default function ClientCallsScreen() {
  const { rowKey } =
    useLocalSearchParams();

  const [
    data,
    setData,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState('');

  useEffect(() => {
    fetchClientCallsForAdmin(
      rowKey,
    )
      .then(setData)
      .catch((e) =>
        setError(e.message),
      );
  }, [rowKey]);

  if (!data && !error) {
    return (
      <LoadingScreen message="Loading call history..." />
    );
  }

  return (
    <AdminScreen
      back
      title={`${
        data?.clientName || 'Client'
      } · Calls`}
      subtitle="Full call history and follow-up information."
    >
      <AdminNotice
        type="error"
        message={error}
      />

      {(data?.calls || []).map(
        (c) => (
          <AdminCard
            key={String(c.id)}
            title={formatDateTime(
              c.callDatetime,
            )}
            subtitle={`Done by ${
              c.createdByName || '—'
            }`}
          >
            {c.callDiscussion ||
            c.discussion ? (
              <Text
                style={styles.text}
              >
                {c.callDiscussion ||
                  c.discussion}
              </Text>
            ) : null}

            {c.nextCallDatetime ? (
              <Text
                style={styles.next}
              >
                Next call:{' '}
                {formatDateTime(
                  c.nextCallDatetime,
                )}{' '}
                ·{' '}
                {c.nextCallAssignedEmployeeName ||
                  'Unassigned'}
              </Text>
            ) : null}
          </AdminCard>
        ),
      )}
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    text: {
      fontSize: 13,
      lineHeight: 19,
      color: Brand.purple,
    },

    next: {
      fontSize: 12,
      fontWeight: '700',
      color: Brand.plum,
    },
  });