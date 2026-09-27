import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AdminCard
  from '@/admin/components/AdminCard';

import AdminNotice
  from '@/admin/components/AdminNotice';

import AdminScreen
  from '@/admin/components/AdminScreen';

import {
  fetchClientMeetingsForAdmin,
} from '@/admin/services/adminApi';

import {
  formatDateTime,
} from '@/admin/utils/format';

import LoadingScreen
  from '@/components/common/LoadingScreen';

import {
  API_ORIGIN,
} from '@/constants/config';

import {
  Brand,
} from '@/constants/theme';

export default function ClientMeetingsScreen() {
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
    fetchClientMeetingsForAdmin(
      rowKey,
    )
      .then(setData)
      .catch((e) =>
        setError(e.message),
      );
  }, [rowKey]);

  if (!data && !error) {
    return (
      <LoadingScreen message="Loading meeting history..." />
    );
  }

  return (
    <AdminScreen
      back
      title={`${
        data?.clientName || 'Client'
      } · Meetings`}
      subtitle="Full meeting history, notes, items, images and follow-up information."
    >
      <AdminNotice
        type="error"
        message={error}
      />

      {(data?.meetings || []).map(
        (m) => (
          <AdminCard
            key={String(m.id)}
            title={formatDateTime(
              m.meetingDatetime,
            )}
            subtitle={`Done by ${
              m.createdByName || '—'
            }`}
          >
            {m.discussionNotes ? (
              <Text
                style={styles.text}
              >
                {m.discussionNotes}
              </Text>
            ) : null}

            {m.nextMeetingDatetime ? (
              <Text
                style={styles.next}
              >
                Next meeting:{' '}
                {formatDateTime(
                  m.nextMeetingDatetime,
                )}{' '}
                ·{' '}
                {m.nextMeetingAssignedEmployeeName ||
                  'Unassigned'}
              </Text>
            ) : null}

            {(m.items || []).map(
              (item) => (
                <View
                  key={String(
                    item.id,
                  )}
                  style={
                    styles.item
                  }
                >
                  <Text
                    style={
                      styles.itemTitle
                    }
                  >
                    {item.customLabel ||
                      item.itemKey ||
                      'Item'}{' '}
                    ×{' '}
                    {item.quantity ??
                      1}
                  </Text>

                  {item.description ? (
                    <Text
                      style={
                        styles.meta
                      }
                    >
                      {
                        item.description
                      }
                    </Text>
                  ) : null}

                  {(item.images || []).map(
                    (img) =>
                      img.fileUrl ? (
                        <Image
                          key={String(
                            img.id,
                          )}
                          source={{
                            uri: `${API_ORIGIN}${img.fileUrl}`,
                          }}
                          style={
                            styles.image
                          }
                        />
                      ) : null,
                  )}
                </View>
              ),
            )}

            {(m.images || [])
              .filter(
                (img) =>
                  !img.itemId,
              )
              .map((img) =>
                img.fileUrl ? (
                  <Image
                    key={String(
                      img.id,
                    )}
                    source={{
                      uri: `${API_ORIGIN}${img.fileUrl}`,
                    }}
                    style={
                      styles.image
                    }
                  />
                ) : null,
              )}
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

    item: {
      paddingTop: 8,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor: '#ead7e3',
      gap: 4,
    },

    itemTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: Brand.purple,
    },

    meta: {
      fontSize: 11,
      color: Brand.mauve,
    },

    image: {
      width: '100%',
      height: 180,
      borderRadius: 12,
      resizeMode: 'cover',
      marginTop: 5,
    },
  });