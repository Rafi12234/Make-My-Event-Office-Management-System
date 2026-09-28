import MaterialIcons
  from "@expo/vector-icons/MaterialIcons";

import {
  useCallback,
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

import {
  useRouter,
} from "expo-router";

import AdminCard
  from "@/admin/components/AdminCard";

import AdminNotice
  from "@/admin/components/AdminNotice";

import AdminScreen
  from "@/admin/components/AdminScreen";

import {
  buildEmployeeActivity,
} from "@/admin/utils/activity";

import {
  fetchAllCalls,
  fetchAllEmployees,
  fetchAllMeetings,
} from "@/admin/services/adminApi";

import AppInput
  from "@/components/common/AppInput";

import LoadingScreen
  from "@/components/common/LoadingScreen";

import {
  Brand,
} from "@/constants/theme";

export default function EmployeeManagementScreen() {
  const router =
    useRouter();

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    meetings,
    setMeetings,
  ] = useState([]);

  const [
    calls,
    setCalls,
  ] = useState([]);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const load =
    useCallback(async () => {
      setLoading(true);

      setError("");

      try {
        const [
          e,
          m,
          c,
        ] =
          await Promise.all([
            fetchAllEmployees(),
            fetchAllMeetings(),
            fetchAllCalls(),
          ]);

        setEmployees(e);

        setMeetings(m);

        setCalls(c);
      } catch (err) {
        setError(
          err.message,
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buckets =
    useMemo(
      () =>
        buildEmployeeActivity(
          employees,
          meetings,
          calls,
        ),
      [
        employees,
        meetings,
        calls,
      ],
    );

  const filtered =
    useMemo(() => {
      const q =
        query
          .trim()
          .toLowerCase();

      return buckets.filter(
        (bucket) =>
          !q ||
          bucket.employee.fullName
            ?.toLowerCase()
            .includes(q),
      );
    }, [buckets, query]);

  if (loading) {
    return (
      <LoadingScreen
        message="Loading employee activity..."
      />
    );
  }

  return (
    <AdminScreen
      back
      title="Employee Management"
      subtitle="Completed and upcoming meeting/call activity, plus account controls."
    >
      <AdminNotice
        type="error"
        message={error}
      />

      <Pressable
        style={
          styles.manageButton
        }
        onPress={() =>
          router.push(
            "/admin/employees/accounts",
          )
        }
      >
        <MaterialIcons
          name="manage-accounts"
          size={22}
          color={Brand.purple}
        />

        <View
          style={{ flex: 1 }}
        >
          <Text
            style={
              styles.manageTitle
            }
          >
            Manage Employee
            Accounts
          </Text>

          <Text
            style={
              styles.manageMeta
            }
          >
            Add employee/admin,
            activate/deactivate,
            reset password
          </Text>
        </View>

        <MaterialIcons
          name="chevron-right"
          size={20}
          color={Brand.mauve}
        />
      </Pressable>

      <AppInput
        label="Employee Name"
        value={query}
        onChangeText={
          setQuery
        }
        placeholder="Search by name"
      />

      <AdminCard
        title="Employee Activity Overview"
        subtitle={`${filtered.length} of ${employees.length} employees`}
      >
        {filtered.map(
          (bucket) => {
            const prevMeetings =
              bucket.previous.filter(
                (item) =>
                  item.type ===
                    "meeting" &&
                  !item.isFollowUp,
              ).length;

            const prevCalls =
              bucket.previous.filter(
                (item) =>
                  item.type ===
                    "call" &&
                  !item.isFollowUp,
              ).length;

            const upMeetings =
              bucket.upcoming.filter(
                (item) =>
                  item.type ===
                  "meeting",
              ).length;

            const upCalls =
              bucket.upcoming.filter(
                (item) =>
                  item.type ===
                  "call",
              ).length;

            return (
              <Pressable
                key={String(
                  bucket.employee
                    .id,
                )}
                style={
                  styles.row
                }
                onPress={() =>
                  router.push(
                    `/admin/employees/${bucket.employee.id}`,
                  )
                }
              >
                <View
                  style={
                    styles.avatar
                  }
                >
                  <Text
                    style={
                      styles.avatarText
                    }
                  >
                    {bucket.employee.fullName
                      ?.slice(
                        0,
                        1,
                      )
                      ?.toUpperCase() ||
                      "E"}
                  </Text>
                </View>

                <View
                  style={
                    styles.body
                  }
                >
                  <Text
                    style={
                      styles.name
                    }
                  >
                    {
                      bucket
                        .employee
                        .fullName
                    }
                  </Text>

                  <Text
                    style={
                      styles.meta
                    }
                  >
                    {bucket
                      .employee
                      .isActive
                      ? "Active"
                      : "Inactive"}{" "}
                    ·{" "}
                    {
                      bucket
                        .employee
                        .role
                    }
                  </Text>

                  <Text
                    style={
                      styles.stats
                    }
                  >
                    {
                      prevMeetings
                    }{" "}
                    meetings ·{" "}
                    {prevCalls} calls ·{" "}
                    {
                      upMeetings
                    }{" "}
                    next meetings ·{" "}
                    {upCalls} next
                    calls
                  </Text>
                </View>

                <MaterialIcons
                  name="visibility"
                  size={19}
                  color={
                    Brand.plum
                  }
                />
              </Pressable>
            );
          },
        )}
      </AdminCard>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    manageButton: {
      flexDirection: "row",

      alignItems: "center",

      gap: 11,

      padding: 14,

      borderRadius: 17,

      backgroundColor:
        "#fff",

      borderWidth: 1,

      borderColor:
        "#e7cfdf",
    },

    manageTitle: {
      fontSize: 15,

      fontWeight: "900",

      color:
        Brand.purple,
    },

    manageMeta: {
      fontSize: 11,

      color:
        Brand.mauve,

      marginTop: 2,
    },

    row: {
      flexDirection: "row",

      alignItems: "center",

      gap: 10,

      paddingVertical: 11,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        "#ead7e3",
    },

    avatar: {
      width: 38,

      height: 38,

      borderRadius: 13,

      alignItems: "center",

      justifyContent:
        "center",

      backgroundColor:
        "#f3ccde",
    },

    avatarText: {
      fontWeight: "900",

      color:
        Brand.purple,
    },

    body: {
      flex: 1,

      gap: 2,
    },

    name: {
      fontSize: 14,

      fontWeight: "900",

      color:
        Brand.purple,
    },

    meta: {
      fontSize: 11,

      color:
        Brand.mauve,
    },

    stats: {
      fontSize: 11,

      color:
        Brand.plum,

      fontWeight: "700",
    },
  });