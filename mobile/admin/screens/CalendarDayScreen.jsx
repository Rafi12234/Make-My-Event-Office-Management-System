import MaterialIcons
  from '@expo/vector-icons/MaterialIcons';

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

import AdminCard
  from '@/admin/components/AdminCard';

import AdminModal
  from '@/admin/components/AdminModal';

import AdminNotice
  from '@/admin/components/AdminNotice';

import AdminScreen
  from '@/admin/components/AdminScreen';

import AdminSelect
  from '@/admin/components/AdminSelect';

import {
  fetchAdminCalendarMonth,
  fetchAllEmployees,
  updateNextCallSchedule,
  updateNextMeetingSchedule,
} from '@/admin/services/adminApi';

import AppButton
  from '@/components/common/AppButton';

import AppInput
  from '@/components/common/AppInput';

import LoadingScreen
  from '@/components/common/LoadingScreen';

import {
  Brand,
} from '@/constants/theme';

function shiftDate(
  date,
  days,
) {
  const d =
    new Date(
      `${date}T00:00:00`,
    );

  d.setDate(
    d.getDate() + days,
  );

  return `${
    d.getFullYear()
  }-${String(
    d.getMonth() + 1,
  ).padStart(
    2,
    '0',
  )}-${String(
    d.getDate(),
  ).padStart(
    2,
    '0',
  )}`;
}

export default function CalendarDayScreen() {
  const { date } =
    useLocalSearchParams();

  const router =
    useRouter();

  const parsed =
    new Date(
      `${date}T00:00:00`,
    );

  const [
    data,
    setData,
  ] = useState(null);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    error,
    setError,
  ] = useState('');

  const [
    editing,
    setEditing,
  ] = useState(null);

  const [
    datetime,
    setDatetime,
  ] = useState('');

  const [
    assigned,
    setAssigned,
  ] = useState('');

  const [
    busy,
    setBusy,
  ] = useState(false);

  async function load() {
    try {
      const [
        monthData,
        staff,
      ] =
        await Promise.all([
          fetchAdminCalendarMonth(
            parsed.getFullYear(),
            parsed.getMonth() +
              1,
          ),

          fetchAllEmployees(),
        ]);

      setData(
        monthData,
      );

      setEmployees(
        staff,
      );
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [date]);

  const events =
    useMemo(
      () =>
        (
          data?.events ||
          []
        ).filter(
          (e) =>
            e.date ===
            date,
        ),
      [data, date],
    );

  if (!data && !error) {
    return (
      <LoadingScreen message="Loading calendar day..." />
    );
  }

  function startEdit(ev) {
    const kind =
      ev.meetingId
        ? 'meeting'
        : ev.callId
          ? 'call'
          : null;

    if (!kind) {
      return;
    }

    setEditing({
      kind,
      event: ev,
    });

    setDatetime(
      `${date}T${
        ev.time || '09:00'
      }`,
    );

    setAssigned(
      String(
        ev.assignedEmployeeIdRaw ||
          '',
      ),
    );
  }

  async function save() {
    setBusy(true);

    try {
      if (
        editing.kind ===
        'meeting'
      ) {
        await updateNextMeetingSchedule(
          editing.event
            .meetingId,
          {
            nextMeetingDatetime:
              datetime,

            assignedEmployeeId:
              assigned ||
              null,
          },
        );
      } else {
        await updateNextCallSchedule(
          editing.event.callId,
          {
            nextCallDatetime:
              datetime,

            assignedEmployeeId:
              assigned ||
              null,
          },
        );
      }

      setEditing(null);

      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const options = [
    {
      value: '',
      label: 'Unassigned',
    },

    ...employees.map(
      (e) => ({
        value: String(
          e.id,
        ),

        label:
          e.fullName,
      }),
    ),
  ];

  return (
    <AdminScreen
      back
      title={parsed.toLocaleDateString(
        'en-US',
        {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        },
      )}
      subtitle="Due and completed company activity for this day."
    >
      <AdminNotice
        type="error"
        message={error}
      />

      <View
        style={styles.nav}
      >
        <Pressable
          style={
            styles.navButton
          }
          onPress={() =>
            router.replace(
              `/admin/calendar/day/${shiftDate(
                date,
                -1,
              )}`,
            )
          }
        >
          <MaterialIcons
            name="chevron-left"
            size={21}
            color={
              Brand.purple
            }
          />

          <Text
            style={
              styles.navText
            }
          >
            Previous
          </Text>
        </Pressable>

        <Pressable
          style={
            styles.navButton
          }
          onPress={() =>
            router.replace(
              `/admin/calendar/day/${shiftDate(
                date,
                1,
              )}`,
            )
          }
        >
          <Text
            style={
              styles.navText
            }
          >
            Next
          </Text>

          <MaterialIcons
            name="chevron-right"
            size={21}
            color={
              Brand.purple
            }
          />
        </Pressable>
      </View>

      <AdminCard
        title="Events"
        subtitle={`${events.length} record(s)`}
      >
        {events.map(
          (ev) => (
            <View
              key={ev.id}
              style={[
                styles.event,

                ev.missed &&
                  styles.missed,
              ]}
            >
              <View
                style={{
                  flex: 1,
                  gap: 2,
                }}
              >
                <Text
                  style={
                    styles.eventTitle
                  }
                >
                  {ev.time ||
                    '—'}{' '}
                  ·{' '}
                  {ev.clientName ||
                    'Client'}
                </Text>

                <Text
                  style={
                    styles.eventMeta
                  }
                >
                  {String(
                    ev.source ||
                      '',
                  ).replaceAll(
                    '_',
                    ' ',
                  )}{' '}
                  ·{' '}
                  {ev.employeeName ||
                    ev.assignedEmployeeName ||
                    'Unassigned'}
                </Text>

                <Text
                  style={[
                    styles.tag,

                    ev.missed
                      ? styles.missedText
                      : ev.done
                        ? styles.doneText
                        : null,
                  ]}
                >
                  {ev.missed
                    ? 'MISSED'
                    : ev.done
                      ? 'COMPLETED'
                      : 'DUE'}
                </Text>
              </View>

              {ev.meetingId ||
              ev.callId ? (
                <Pressable
                  style={
                    styles.edit
                  }
                  onPress={() =>
                    startEdit(
                      ev,
                    )
                  }
                >
                  <MaterialIcons
                    name="edit-calendar"
                    size={18}
                    color={
                      Brand.purple
                    }
                  />
                </Pressable>
              ) : null}
            </View>
          ),
        )}
      </AdminCard>

      <AdminModal
        visible={Boolean(
          editing,
        )}
        title="Edit Follow-up Schedule"
        onClose={() =>
          setEditing(null)
        }
      >
        <AppInput
          label="Date & time"
          value={datetime}
          onChangeText={
            setDatetime
          }
          placeholder="YYYY-MM-DDTHH:MM"
        />

        <AdminSelect
          label="Assigned employee"
          value={assigned}
          options={options}
          onChange={
            setAssigned
          }
        />

        <AppButton
          title="Save"
          onPress={save}
          loading={busy}
        />
      </AdminModal>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    nav: {
      flexDirection: 'row',
      justifyContent:
        'space-between',
      gap: 8,
    },

    navButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'center',
      gap: 4,
      borderWidth: 1,
      borderColor:
        '#ead7e3',
      backgroundColor:
        '#fff',
      borderRadius: 12,
      padding: 10,
    },

    navText: {
      fontSize: 12,
      fontWeight: '800',
      color: Brand.purple,
    },

    event: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
      paddingVertical: 11,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        '#ead7e3',
    },

    missed: {
      backgroundColor:
        '#fff8f8',
      marginHorizontal:
        -7,
      paddingHorizontal:
        7,
      borderRadius: 10,
    },

    eventTitle: {
      fontSize: 13,
      fontWeight: '900',
      color: Brand.purple,
    },

    eventMeta: {
      fontSize: 10,
      color: Brand.mauve,
      textTransform:
        'capitalize',
    },

    tag: {
      fontSize: 9,
      fontWeight: '900',
      color: Brand.plum,
    },

    missedText: {
      color: '#b23b3b',
    },

    doneText: {
      color: '#2f7d42',
    },

    edit: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        '#fff4f9',
    },
  });