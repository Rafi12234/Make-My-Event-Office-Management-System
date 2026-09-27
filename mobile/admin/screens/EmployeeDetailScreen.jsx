import MaterialIcons
  from "@expo/vector-icons/MaterialIcons";

import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AdminCard
  from "@/admin/components/AdminCard";

import AdminKeyValue
  from "@/admin/components/AdminKeyValue";

import AdminNotice
  from "@/admin/components/AdminNotice";

import AdminScreen
  from "@/admin/components/AdminScreen";

import {
  fetchAllCalls,
  fetchAllEmployees,
  fetchAllMeetings,
} from "@/admin/services/adminApi";

import {
  buildEmployeeActivity,
  missedItems,
} from "@/admin/utils/activity";

import {
  formatDateTime,
} from "@/admin/utils/format";

import LoadingScreen
  from "@/components/common/LoadingScreen";

import {
  Brand,
} from "@/constants/theme";

export default function EmployeeDetailScreen() {
  const {
    id,
  } = useLocalSearchParams();

  const router =
    useRouter();

  const [
    state,
    setState,
  ] = useState({
    employees: [],
    meetings: [],
    calls: [],
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setError("");

        const [
          employees,
          meetings,
          calls,
        ] =
          await Promise.all([
            fetchAllEmployees({
              includeAdmins: true,
            }),

            fetchAllMeetings(),

            fetchAllCalls(),
          ]);

        if (!mounted) {
          return;
        }

        setState({
          employees:
            Array.isArray(
              employees,
            )
              ? employees
              : [],

          meetings:
            Array.isArray(
              meetings,
            )
              ? meetings
              : [],

          calls:
            Array.isArray(
              calls,
            )
              ? calls
              : [],
        });
      } catch (err) {
        if (mounted) {
          setError(
            err?.message ||
              "Could not load employee information.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const bucket =
    useMemo(() => {
      const buckets =
        buildEmployeeActivity(
          state.employees,
          state.meetings,
          state.calls,
        );

      return buckets.find(
        (item) =>
          String(
            item?.employee
              ?.id,
          ) ===
          String(id),
      );
    }, [
      state.employees,
      state.meetings,
      state.calls,
      id,
    ]);

  if (loading) {
    return (
      <LoadingScreen
        message="Loading employee record..."
      />
    );
  }

  if (!bucket) {
    return (
      <AdminScreen
        back
        title="Employee Details"
      >
        <AdminNotice
          type="error"
          message={
            error ||
            "Employee not found."
          }
        />
      </AdminScreen>
    );
  }

  const employee =
    bucket.employee || {};

  const upcoming =
    Array.isArray(
      bucket.upcoming,
    )
      ? bucket.upcoming
      : [];

  const previous =
    Array.isArray(
      bucket.previous,
    )
      ? bucket.previous
      : [];

  const missed =
    missedItems(bucket) ||
    [];

  return (
    <AdminScreen
      back
      title={
        employee.fullName ||
        "Employee"
      }
      subtitle="Complete employee activity record."
    >
      <AdminNotice
        type="error"
        message={error}
      />

      <AdminCard
        title="Employee Information"
      >
        <AdminKeyValue
          label="Name"
          value={
            employee.fullName
          }
        />

        <AdminKeyValue
          label="Email"
          value={
            employee.email
          }
        />

        <AdminKeyValue
          label="Role"
          value={
            typeof employee.role ===
            "object"
              ? employee.role
                  ?.name
              : employee.role
          }
        />

        <AdminKeyValue
          label="Status"
          value={
            employee.isActive
              ? "Active"
              : "Inactive"
          }
        />

        <AdminKeyValue
          label="Created by"
          value={
            employee.createdByName
          }
        />
      </AdminCard>

      <Pressable
        style={
          styles.missedCard
        }
        onPress={() =>
          router.push(
            `/admin/employees/${id}/missed`,
          )
        }
      >
        <View
          style={
            styles.missedIcon
          }
        >
          <MaterialIcons
            name="error-outline"
            size={22}
            color="#b23b3b"
          />
        </View>

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={
              styles.missedTitle
            }
          >
            Missed / Overdue
          </Text>

          <Text
            style={
              styles.missedMeta
            }
          >
            {missed.length}{" "}
            activity record(s)
          </Text>
        </View>

        <MaterialIcons
          name="chevron-right"
          size={22}
          color={
            Brand.mauve
          }
        />
      </Pressable>

      <AdminCard
        title="Upcoming Activities"
        subtitle={`${upcoming.length} scheduled`}
      >
        {upcoming.length ? (
          upcoming.map(
            (item, index) => (
              <ActivityItem
                key={`${item?.type || "activity"}-${item?.id || index}`}
                item={item}
              />
            ),
          )
        ) : (
          <Text
            style={
              styles.empty
            }
          >
            No upcoming activity.
          </Text>
        )}
      </AdminCard>

      <AdminCard
        title="Previous Activities"
        subtitle={`${previous.length} record(s)`}
      >
        {previous.length ? (
          previous
            .slice(0, 100)
            .map(
              (
                item,
                index,
              ) => (
                <ActivityItem
                  key={`${item?.type || "activity"}-${item?.id || index}`}
                  item={item}
                />
              ),
            )
        ) : (
          <Text
            style={
              styles.empty
            }
          >
            No previous activity.
          </Text>
        )}
      </AdminCard>
    </AdminScreen>
  );
}

function ActivityItem({
  item,
}) {
  if (!item) {
    return null;
  }

  const type =
    item.type ===
    "meeting"
      ? "Meeting"
      : item.type ===
          "call"
        ? "Call"
        : "Activity";

  return (
    <View
      style={
        styles.activity
      }
    >
      <View
        style={
          styles.activityTop
        }
      >
        <View
          style={
            styles.activityIcon
          }
        >
          <MaterialIcons
            name={
              item.type ===
              "meeting"
                ? "groups"
                : "call"
            }
            size={18}
            color={
              Brand.purple
            }
          />
        </View>

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={
              styles.activityTitle
            }
          >
            {type}
            {" · "}
            {item.clientName ||
              "Client"}
          </Text>

          <Text
            style={
              styles.activityMeta
            }
          >
            {formatDateTime(
              item.datetime,
            )}
          </Text>

          {item.isFollowUp ? (
            <Text
              style={
                styles.followUp
              }
            >
              Follow-up schedule
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    missedCard: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 10,

      borderRadius: 16,

      borderWidth: 1,

      borderColor:
        "#f0c7c7",

      backgroundColor:
        "#fff5f5",

      padding: 14,
    },

    missedIcon: {
      width: 42,

      height: 42,

      borderRadius: 13,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#ffe8e8",
    },

    missedTitle: {
      fontSize: 14,

      fontWeight:
        "900",

      color:
        "#8e2f2f",
    },

    missedMeta: {
      marginTop: 2,

      fontSize: 11,

      color:
        "#a76161",
    },

    activity: {
      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        "#ead7e3",

      paddingVertical: 11,
    },

    activityTop: {
      flexDirection:
        "row",

      alignItems:
        "flex-start",

      gap: 10,
    },

    activityIcon: {
      width: 36,

      height: 36,

      borderRadius: 11,

      backgroundColor:
        "#fff4f9",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    activityTitle: {
      fontSize: 13,

      fontWeight:
        "800",

      color:
        Brand.purple,
    },

    activityMeta: {
      marginTop: 3,

      fontSize: 11,

      color:
        Brand.mauve,
    },

    followUp: {
      marginTop: 3,

      fontSize: 10,

      fontWeight:
        "700",

      color:
        Brand.plum,
    },

    empty: {
      textAlign:
        "center",

      color:
        Brand.mauve,

      paddingVertical: 14,
    },
  });