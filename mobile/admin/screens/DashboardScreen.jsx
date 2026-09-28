import MaterialIcons
  from "@expo/vector-icons/MaterialIcons";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useRouter,
} from "expo-router";

import {
  fetchAdminDashboard,
} from "@/admin/services/adminApi";

import {
  useAuth,
} from "@/hooks/useAuth";

import {
  Brand,
} from "@/constants/theme";

const MODULES = [
  {
    icon: "people",
    title: "Employee Management",
    description:
      "Employees, accounts, activities and password controls",
    route: "/admin/employees",
  },

  {
    icon: "business",
    title: "Client Management",
    description:
      "Clients, management sheet and client activities",
    route: "/admin/clients",
  },

  {
    icon: "phone-in-talk",
    title: "Meetings & Calls",
    description:
      "Company-wide meeting and call oversight",
    route: "/admin/activity",
  },

  {
    icon: "schedule",
    title: "Attendance",
    description:
      "Sign in/out, work hours and employee locations",
    route: "/admin/attendance",
  },

  {
    icon: "calendar-month",
    title: "Company Calendar",
    description:
      "Meetings, calls and daily company schedules",
    route: "/admin/calendar",
  },

  {
    icon: "account-balance-wallet",
    title: "Financial Accounts",
    description:
      "Wallets, money in, bills and expenses",
    route: "/admin/accounts",
  },

 
  {
    icon: "receipt-long",
    title: "Money Receipt",
    description:
      "Generate, share and view money receipts",
    route: "/admin/money-receipts",
  },
];

function StatCard({
  icon,
  label,
  value,
  note,
}) {
  return (
    <View
      style={styles.statCard}
    >
      <View
        style={styles.statIcon}
      >
        <MaterialIcons
          name={icon}
          size={21}
          color={Brand.purple}
        />
      </View>

      <Text
        style={styles.statValue}
      >
        {value ?? 0}
      </Text>

      <Text
        style={styles.statLabel}
      >
        {label}
      </Text>

      {note ? (
        <Text
          style={styles.statNote}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

export default function DashboardScreen() {
  const router =
    useRouter();

  const {
    employee,
    logout,
  } = useAuth();

  const [
    data,
    setData,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const loadDashboard =
    useCallback(async () => {
      try {
        setError("");

        const result =
          await fetchAdminDashboard();

        setData(result);
      } catch (err) {
        console.error(
          "Admin dashboard error:",
          err,
        );

        setError(
          err?.message ||
            "Could not load dashboard information.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleRefresh() {
    setRefreshing(true);

    await loadDashboard();
  }

  async function handleLogout() {
    await logout();

    router.replace(
      "/(auth)/login",
    );
  }

  const totals =
    data?.totals || {};

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={
        styles.content
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={
            handleRefresh
          }
          tintColor={
            Brand.purple
          }
        />
      }
    >
      <View
        style={styles.topBar}
      >
        <View
          style={styles.brandIcon}
        >
          <MaterialIcons
            name="admin-panel-settings"
            size={25}
            color="#ffffff"
          />
        </View>

        <Pressable
          style={styles.logoutIcon}
          onPress={
            handleLogout
          }
        >
          <MaterialIcons
            name="logout"
            size={21}
            color={Brand.purple}
          />
        </Pressable>
      </View>

      <View
        style={styles.heading}
      >
        <Text
          style={styles.kicker}
        >
          ADMIN PORTAL
        </Text>

        <Text
          style={styles.title}
        >
          Admin Dashboard
        </Text>

        <Text
          style={styles.subtitle}
        >
          Make My Event
        </Text>

        {employee?.fullName ? (
          <Text
            style={
              styles.signedIn
            }
          >
            Signed in as{" "}
            {employee.fullName}
          </Text>
        ) : null}
      </View>

      {error ? (
        <View
          style={styles.errorBox}
        >
          <MaterialIcons
            name="error-outline"
            size={20}
            color="#b42318"
          />

          <Text
            style={styles.errorText}
          >
            {error}
          </Text>
        </View>
      ) : null}

      <View>
        <View
          style={
            styles.sectionHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Company Overview
          </Text>

          {loading ? (
            <Text
              style={
                styles.loadingText
              }
            >
              Loading...
            </Text>
          ) : null}
        </View>

        <View
          style={styles.statsGrid}
        >
          <StatCard
            icon="people"
            label="Employees"
            value={
              totals.employees
            }
            note={`${totals.activeEmployees || 0} active`}
          />

          <StatCard
            icon="business"
            label="Clients"
            value={
              totals.clients
            }
          />

          <StatCard
            icon="event-available"
            label="Meetings Done"
            value={
              totals.meetingsDone
            }
            note="Last 7 days"
          />

          <StatCard
            icon="call"
            label="Calls Done"
            value={
              totals.callsDone
            }
            note="Last 7 days"
          />

          <StatCard
            icon="event"
            label="Upcoming Meetings"
            value={
              totals.upcomingMeetings
            }
            note="Next 7 days"
          />

          <StatCard
            icon="phone-forwarded"
            label="Upcoming Calls"
            value={
              totals.upcomingCalls
            }
            note="Next 7 days"
          />
        </View>
      </View>

      <View
        style={styles.modulesSection}
      >
        <Text
          style={styles.sectionTitle}
        >
          Admin Modules
        </Text>

        <Text
          style={
            styles.sectionSubtitle
          }
        >
          Manage all company operations
          from the mobile Admin Panel.
        </Text>

        <View
          style={styles.moduleGrid}
        >
          {MODULES.map(
            (module) => (
              <Pressable
                key={module.route}
                style={
                  styles.moduleCard
                }
                onPress={() =>
                  router.push(
                    module.route,
                  )
                }
              >
                <View
                  style={
                    styles.moduleIcon
                  }
                >
                  <MaterialIcons
                    name={
                      module.icon
                    }
                    size={26}
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
                      styles.moduleTitle
                    }
                  >
                    {
                      module.title
                    }
                  </Text>

                  <Text
                    style={
                      styles.moduleDescription
                    }
                  >
                    {
                      module.description
                    }
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
            ),
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    page: {
      flex: 1,

      backgroundColor:
        "#fff9fc",
    },

    content: {
      paddingHorizontal: 18,

      paddingTop: 50,

      paddingBottom: 50,

      gap: 24,
    },

    topBar: {
      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "space-between",
    },

    brandIcon: {
      width: 46,

      height: 46,

      borderRadius: 15,

      backgroundColor:
        Brand.purple,

      alignItems: "center",

      justifyContent:
        "center",
    },

    logoutIcon: {
      width: 44,

      height: 44,

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        "#ead7e3",

      backgroundColor:
        "#ffffff",

      alignItems: "center",

      justifyContent:
        "center",
    },

    heading: {
      gap: 3,
    },

    kicker: {
      fontSize: 11,

      fontWeight: "800",

      color:
        Brand.mauve,

      letterSpacing: 1,
    },

    title: {
      fontSize: 30,

      fontWeight: "900",

      color:
        Brand.purple,
    },

    subtitle: {
      fontSize: 17,

      color:
        Brand.mauve,
    },

    signedIn: {
      marginTop: 5,

      fontSize: 12,

      color:
        Brand.plum,
    },

    sectionHeader: {
      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "space-between",

      marginBottom: 12,
    },

    sectionTitle: {
      fontSize: 19,

      fontWeight: "900",

      color:
        Brand.purple,
    },

    sectionSubtitle: {
      fontSize: 12,

      lineHeight: 18,

      color:
        Brand.mauve,

      marginTop: 3,

      marginBottom: 12,
    },

    loadingText: {
      fontSize: 11,

      color:
        Brand.mauve,
    },

    statsGrid: {
      flexDirection: "row",

      flexWrap: "wrap",

      justifyContent:
        "space-between",

      gap: 10,
    },

    statCard: {
      width: "48%",

      minHeight: 145,

      borderWidth: 1,

      borderColor:
        "#ead7e3",

      borderRadius: 18,

      backgroundColor:
        "#ffffff",

      padding: 14,

      gap: 5,
    },

    statIcon: {
      width: 38,

      height: 38,

      borderRadius: 12,

      backgroundColor:
        "#fff0f7",

      alignItems: "center",

      justifyContent:
        "center",

      marginBottom: 5,
    },

    statValue: {
      fontSize: 25,

      fontWeight: "900",

      color:
        Brand.purple,
    },

    statLabel: {
      fontSize: 12,

      fontWeight: "800",

      color:
        Brand.plum,
    },

    statNote: {
      fontSize: 10,

      color:
        Brand.mauve,
    },

    modulesSection: {
      marginTop: 2,
    },

    moduleGrid: {
      gap: 10,
    },

    moduleCard: {
      minHeight: 86,

      flexDirection: "row",

      alignItems: "center",

      gap: 12,

      borderWidth: 1,

      borderColor:
        "#ead7e3",

      borderRadius: 18,

      padding: 13,

      backgroundColor:
        "#ffffff",
    },

    moduleIcon: {
      width: 48,

      height: 48,

      borderRadius: 15,

      backgroundColor:
        "#fff0f7",

      alignItems: "center",

      justifyContent:
        "center",
    },

    moduleTitle: {
      fontSize: 15,

      fontWeight: "900",

      color:
        Brand.purple,
    },

    moduleDescription: {
      marginTop: 3,

      fontSize: 10.5,

      lineHeight: 15,

      color:
        Brand.mauve,
    },

    errorBox: {
      flexDirection: "row",

      alignItems:
        "flex-start",

      gap: 8,

      padding: 12,

      borderRadius: 14,

      backgroundColor:
        "#fff1f0",

      borderWidth: 1,

      borderColor:
        "#fecdca",
    },

    errorText: {
      flex: 1,

      color:
        "#b42318",

      fontSize: 12,
    },
  });