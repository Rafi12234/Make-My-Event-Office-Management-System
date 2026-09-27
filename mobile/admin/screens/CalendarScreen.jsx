import MaterialIcons
  from '@expo/vector-icons/MaterialIcons';

import {
  useCallback,
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

import {
  useRouter,
} from 'expo-router';

import AdminCard
  from '@/admin/components/AdminCard';

import AdminNotice
  from '@/admin/components/AdminNotice';

import AdminScreen
  from '@/admin/components/AdminScreen';

import {
  fetchAdminCalendarMonth,
} from '@/admin/services/adminApi';

import LoadingScreen
  from '@/components/common/LoadingScreen';

import {
  Brand,
} from '@/constants/theme';

export default function CalendarScreen() {
  const router =
    useRouter();

  const now =
    new Date();

  const [
    cursor,
    setCursor,
  ] = useState(
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ),
  );

  const [
    data,
    setData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState('');

  const year =
    cursor.getFullYear();

  const month =
    cursor.getMonth() + 1;

  const load =
    useCallback(async () => {
      setLoading(true);

      setError('');

      try {
        setData(
          await fetchAdminCalendarMonth(
            year,
            month,
          ),
        );
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped =
    useMemo(() => {
      const map =
        new Map();

      for (
        const event
        of data?.events || []
      ) {
        if (
          !map.has(
            event.date,
          )
        ) {
          map.set(
            event.date,
            [],
          );
        }

        map
          .get(event.date)
          .push(event);
      }

      return [
        ...map.entries(),
      ].sort(
        (a, b) =>
          a[0].localeCompare(
            b[0],
          ),
      );
    }, [data]);

  if (
    loading &&
    !data
  ) {
    return (
      <LoadingScreen message="Loading company calendar..." />
    );
  }

  return (
    <AdminScreen
      back
      title="Company-Wide Calendar"
      subtitle="Meetings, calls and follow-up deadlines for every employee."
    >
      <AdminNotice
        type="error"
        message={error}
      />

      <View
        style={
          styles.monthBar
        }
      >
        <Pressable
          style={
            styles.arrow
          }
          onPress={() =>
            setCursor(
              new Date(
                year,
                month - 2,
                1,
              ),
            )
          }
        >
          <MaterialIcons
            name="chevron-left"
            size={24}
            color="#fff"
          />
        </Pressable>

        <View
          style={{
            alignItems:
              'center',
          }}
        >
          <Text
            style={
              styles.month
            }
          >
            {cursor.toLocaleDateString(
              'en-US',
              {
                month:
                  'long',
                year:
                  'numeric',
              },
            )}
          </Text>

          <Pressable
            onPress={() =>
              setCursor(
                new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  1,
                ),
              )
            }
          >
            <Text
              style={
                styles.today
              }
            >
              TODAY
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={
            styles.arrow
          }
          onPress={() =>
            setCursor(
              new Date(
                year,
                month,
                1,
              ),
            )
          }
        >
          <MaterialIcons
            name="chevron-right"
            size={24}
            color="#fff"
          />
        </Pressable>
      </View>

      {loading ? (
        <Text
          style={
            styles.loading
          }
        >
          Refreshing…
        </Text>
      ) : null}

      <AdminCard
        title="Calendar Days"
        subtitle={`${grouped.length} day(s) with activity`}
      >
        {grouped.length ? (
          grouped.map(
            ([
              date,
              events,
            ]) => (
              <Pressable
                key={date}
                style={
                  styles.day
                }
                onPress={() =>
                  router.push(
                    `/admin/calendar/day/${date}`,
                  )
                }
              >
                <View
                  style={
                    styles.dayDate
                  }
                >
                  <Text
                    style={
                      styles.dayNum
                    }
                  >
                    {date.slice(
                      -2,
                    )}
                  </Text>

                  <Text
                    style={
                      styles.dayMonth
                    }
                  >
                    {new Date(
                      `${date}T00:00:00`,
                    ).toLocaleDateString(
                      'en-US',
                      {
                        month:
                          'short',
                      },
                    )}
                  </Text>
                </View>

                <View
                  style={{
                    flex: 1,
                    gap: 2,
                  }}
                >
                  <Text
                    style={
                      styles.dayTitle
                    }
                  >
                    {events.length}{' '}
                    event(s)
                  </Text>

                  <Text
                    style={
                      styles.dayMeta
                    }
                  >
                    {events.filter(
                      (e) =>
                        e.missed,
                    ).length}{' '}
                    missed ·{' '}
                    {events.filter(
                      (e) =>
                        e.done,
                    ).length}{' '}
                    done
                  </Text>

                  <Text
                    numberOfLines={
                      2
                    }
                    style={
                      styles.clients
                    }
                  >
                    {[
                      ...new Set(
                        events
                          .map(
                            (e) =>
                              e.clientName,
                          )
                          .filter(
                            Boolean,
                          ),
                      ),
                    ]
                      .slice(
                        0,
                        4,
                      )
                      .join(
                        ', ',
                      ) ||
                      'No client name'}
                  </Text>
                </View>

                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={
                    Brand.mauve
                  }
                />
              </Pressable>
            ),
          )
        ) : (
          <Text
            style={
              styles.empty
            }
          >
            No company activity
            scheduled for this
            month.
          </Text>
        )}
      </AdminCard>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    monthBar: {
      borderRadius: 18,
      backgroundColor:
        Brand.purple,
      padding: 13,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    arrow: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor:
        'rgba(255,255,255,.12)',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    month: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '900',
    },

    today: {
      color: '#f3ccde',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.2,
      marginTop: 2,
    },

    loading: {
      fontSize: 11,
      color: Brand.mauve,
      textAlign: 'center',
    },

    day: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingVertical: 10,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor: '#ead7e3',
    },

    dayDate: {
      width: 45,
      height: 47,
      borderRadius: 12,
      backgroundColor:
        '#fff4f9',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    dayNum: {
      fontSize: 17,
      fontWeight: '900',
      color: Brand.purple,
    },

    dayMonth: {
      fontSize: 9,
      fontWeight: '800',
      color: Brand.plum,
      textTransform:
        'uppercase',
    },

    dayTitle: {
      fontSize: 13,
      fontWeight: '900',
      color: Brand.purple,
    },

    dayMeta: {
      fontSize: 10,
      color: Brand.mauve,
    },

    clients: {
      fontSize: 10,
      color: Brand.plum,
    },

    empty: {
      textAlign: 'center',
      color: Brand.mauve,
      paddingVertical: 12,
    },
  });