import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import MaterialIcons
  from '@expo/vector-icons/MaterialIcons';

import AdminCard
  from '@/admin/components/AdminCard';

import AdminKeyValue
  from '@/admin/components/AdminKeyValue';

import AdminNotice
  from '@/admin/components/AdminNotice';

import AdminScreen
  from '@/admin/components/AdminScreen';

import {
  fetchAdminClientDetail,
} from '@/admin/services/adminApi';

import {
  formatDateTime,
} from '@/admin/utils/format';

import LoadingScreen
  from '@/components/common/LoadingScreen';

import {
  Brand,
} from '@/constants/theme';

export default function ClientDetailScreen() {
  const { rowKey } =
    useLocalSearchParams();

  const router =
    useRouter();

  const [
    data,
    setData,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState('');

  useEffect(() => {
    fetchAdminClientDetail(
      rowKey,
    )
      .then(setData)
      .catch((e) =>
        setError(e.message),
      );
  }, [rowKey]);

  const clientName =
    useMemo(
      () =>
        data?.columns?.find(
          (c) =>
            c.name?.toLowerCase() ===
            'client name',
        )?.value || 'Client',
      [data],
    );

  if (!data && !error) {
    return (
      <LoadingScreen message="Loading client profile..." />
    );
  }

  return (
    <AdminScreen
      back
      title={clientName}
      subtitle="Complete worksheet information and activity history."
    >
      <AdminNotice
        type="error"
        message={error}
      />

      {data ? (
        <>
          <AdminCard
            title="Client Information"
            subtitle={`${
              data.columns?.length || 0
            } worksheet fields`}
          >
            {(data.columns || []).map(
              (col) => (
                <AdminKeyValue
                  key={col.name}
                  label={col.name}
                  value={col.value}
                />
              ),
            )}
          </AdminCard>

          <View style={styles.summary}>
            <Pressable
              style={styles.summaryBox}
              onPress={() =>
                router.push(
                  `/admin/activity/meetings/${rowKey}`,
                )
              }
            >
              <MaterialIcons
                name="event"
                size={20}
                color={
                  Brand.purple
                }
              />

              <Text
                style={
                  styles.summaryValue
                }
              >
                {data.totals
                  ?.meetingsCount ||
                  0}
              </Text>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                Meetings
              </Text>
            </Pressable>

            <Pressable
              style={styles.summaryBox}
              onPress={() =>
                router.push(
                  `/admin/activity/calls/${rowKey}`,
                )
              }
            >
              <MaterialIcons
                name="call"
                size={20}
                color={
                  Brand.purple
                }
              />

              <Text
                style={
                  styles.summaryValue
                }
              >
                {data.totals
                  ?.callsCount ||
                  0}
              </Text>

              <Text
                style={
                  styles.summaryLabel
                }
              >
                Calls
              </Text>
            </Pressable>
          </View>

          {data.finalization ? (
            <AdminCard title="Finalization">
              <AdminKeyValue
                label="Finalized at"
                value={formatDateTime(
                  data.finalization
                    .finalizedAt,
                )}
              />

              <AdminKeyValue
                label="Finalized by"
                value={
                  data.finalization
                    .finalizedByName
                }
              />
            </AdminCard>
          ) : null}

          <AdminCard title="Meeting History">
            {(data.meetings || [])
              .slice(0, 40)
              .map((m) => (
                <View
                  key={String(m.id)}
                  style={
                    styles.history
                  }
                >
                  <Text
                    style={
                      styles.historyTitle
                    }
                  >
                    {formatDateTime(
                      m.meetingDatetime,
                    )}
                  </Text>

                  <Text
                    style={
                      styles.historyMeta
                    }
                  >
                    Done by{' '}
                    {m.createdByName ||
                      '—'}
                  </Text>

                  {m.discussionNotes ? (
                    <Text
                      style={
                        styles.historyText
                      }
                    >
                      {
                        m.discussionNotes
                      }
                    </Text>
                  ) : null}

                  {m.nextMeeting
                    ?.nextMeetingDatetime ? (
                    <Text
                      style={
                        styles.follow
                      }
                    >
                      Next:{' '}
                      {formatDateTime(
                        m.nextMeeting
                          .nextMeetingDatetime,
                      )}{' '}
                      ·{' '}
                      {m.nextMeeting
                        .assignedEmployeeName ||
                        'Unassigned'}
                    </Text>
                  ) : null}
                </View>
              ))}
          </AdminCard>

          <AdminCard title="Call History">
            {(data.calls || [])
              .slice(0, 40)
              .map((c) => (
                <View
                  key={String(c.id)}
                  style={
                    styles.history
                  }
                >
                  <Text
                    style={
                      styles.historyTitle
                    }
                  >
                    {formatDateTime(
                      c.callDatetime,
                    )}
                  </Text>

                  <Text
                    style={
                      styles.historyMeta
                    }
                  >
                    Done by{' '}
                    {c.createdByName ||
                      '—'}
                  </Text>

                  {c.callDiscussion ? (
                    <Text
                      style={
                        styles.historyText
                      }
                    >
                      {
                        c.callDiscussion
                      }
                    </Text>
                  ) : null}

                  {c.nextCall
                    ?.nextCallDatetime ? (
                    <Text
                      style={
                        styles.follow
                      }
                    >
                      Next:{' '}
                      {formatDateTime(
                        c.nextCall
                          .nextCallDatetime,
                      )}{' '}
                      ·{' '}
                      {c.nextCall
                        .assignedEmployeeName ||
                        'Unassigned'}
                    </Text>
                  ) : null}
                </View>
              ))}
          </AdminCard>
        </>
      ) : null}
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    summary: {
      flexDirection: 'row',
      gap: 10,
    },

    summaryBox: {
      flex: 1,
      alignItems: 'center',
      gap: 3,
      borderRadius: 16,
      padding: 13,
      borderWidth: 1,
      borderColor: '#ead7e3',
      backgroundColor: '#fff',
    },

    summaryValue: {
      fontSize: 20,
      fontWeight: '900',
      color: Brand.purple,
    },

    summaryLabel: {
      fontSize: 11,
      color: Brand.mauve,
      fontWeight: '700',
    },

    history: {
      paddingVertical: 10,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor: '#ead7e3',
      gap: 2,
    },

    historyTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: Brand.purple,
    },

    historyMeta: {
      fontSize: 10,
      color: Brand.mauve,
    },

    historyText: {
      fontSize: 12,
      color: Brand.purple,
      marginTop: 3,
    },

    follow: {
      fontSize: 11,
      fontWeight: '700',
      color: Brand.plum,
      marginTop: 3,
    },
  });