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

import AdminModal
  from "@/admin/components/AdminModal";

import AdminNotice
  from "@/admin/components/AdminNotice";

import AdminScreen
  from "@/admin/components/AdminScreen";

import AdminSelect
  from "@/admin/components/AdminSelect";

import {
  fetchAllCalls,
  fetchAllEmployees,
  fetchAllMeetings,
  updateNextCallSchedule,
  updateNextMeetingSchedule,
} from "@/admin/services/adminApi";

import {
  formatDateTime,
  normalizeDateTimeLocal,
} from "@/admin/utils/format";

import AppButton
  from "@/components/common/AppButton";

import AppInput
  from "@/components/common/AppInput";

import LoadingScreen
  from "@/components/common/LoadingScreen";

import {
  Brand,
} from "@/constants/theme";

export default function ActivityScreen() {
  const router =
    useRouter();

  const [
    tab,
    setTab,
  ] = useState(
    "meetings",
  );

  const [
    meetings,
    setMeetings,
  ] = useState([]);

  const [
    calls,
    setCalls,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    editing,
    setEditing,
  ] = useState(null);

  const [
    datetime,
    setDatetime,
  ] = useState("");

  const [
    assignedEmployeeId,
    setAssignedEmployeeId,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    notice,
    setNotice,
  ] = useState(null);

  const load =
    useCallback(async () => {
      setLoading(true);

      try {
        const [
          meetingRows,
          callRows,
          staff,
        ] =
          await Promise.all([
            fetchAllMeetings(),
            fetchAllCalls(),
            fetchAllEmployees(),
          ]);

        setMeetings(
          meetingRows,
        );

        setCalls(callRows);

        setEmployees(staff);
      } catch (error) {
        setNotice({
          type: "error",

          message:
            error.message,
        });
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items =
    useMemo(() => {
      const source =
        tab === "meetings"
          ? meetings
          : calls;

      const q =
        query
          .trim()
          .toLowerCase();

      return source.filter(
        (item) =>
          !q ||
          [
            item.clientName,
            item.createdByName,
            item.assignedByEmployeeName,
          ].some((value) =>
            String(
              value || "",
            )
              .toLowerCase()
              .includes(q),
          ),
      );
    }, [
      tab,
      meetings,
      calls,
      query,
    ]);

  function startEdit(item) {
    const next =
      tab === "meetings"
        ? item.nextMeeting
        : item.nextCall;

    setEditing({
      type:
        tab ===
        "meetings"
          ? "meeting"
          : "call",

      item,
    });

    setDatetime(
      normalizeDateTimeLocal(
        tab === "meetings"
          ? next?.nextMeetingDatetime
          : next?.nextCallDatetime,
      ),
    );

    setAssignedEmployeeId(
      String(
        next?.assignedEmployeeId ||
          "",
      ),
    );
  }

  async function saveSchedule() {
    setBusy(true);

    try {
      const payload =
        editing.type ===
        "meeting"
          ? {
              nextMeetingDatetime:
                datetime,

              assignedEmployeeId:
                assignedEmployeeId ||
                null,
            }
          : {
              nextCallDatetime:
                datetime,

              assignedEmployeeId:
                assignedEmployeeId ||
                null,
            };

      if (
        editing.type ===
        "meeting"
      ) {
        await updateNextMeetingSchedule(
          editing.item.id,
          payload,
        );
      } else {
        await updateNextCallSchedule(
          editing.item.id,
          payload,
        );
      }

      setEditing(null);

      setNotice({
        type: "success",

        message:
          "Follow-up schedule updated.",
      });

      await load();
    } catch (error) {
      setNotice({
        type: "error",

        message:
          error.message,
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <LoadingScreen
        message="Loading company activity..."
      />
    );
  }

  const employeeOptions =
    [
      {
        value: "",

        label:
          "Unassigned",
      },

      ...employees.map(
        (employee) => ({
          value: String(
            employee.id,
          ),

          label:
            employee.fullName,
        }),
      ),
    ];

  return (
    <AdminScreen
      back
      title="Meeting & Call Oversight"
      subtitle="Every meeting/call across the company, with admin follow-up scheduling."
    >
      <AdminNotice
        type={
          notice?.type
        }
        message={
          notice?.message
        }
      />

      <View style={styles.tabs}>
        <Pressable
          style={[
            styles.tab,

            tab ===
              "meetings" &&
              styles.tabActive,
          ]}
          onPress={() =>
            setTab(
              "meetings",
            )
          }
        >
          <Text
            style={[
              styles.tabText,

              tab ===
                "meetings" &&
                styles.tabTextActive,
            ]}
          >
            Meetings (
            {
              meetings.length
            }
            )
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tab,

            tab ===
              "calls" &&
              styles.tabActive,
          ]}
          onPress={() =>
            setTab("calls")
          }
        >
          <Text
            style={[
              styles.tabText,

              tab ===
                "calls" &&
                styles.tabTextActive,
            ]}
          >
            Calls (
            {calls.length})
          </Text>
        </Pressable>
      </View>

      <AppInput
        label="Search"
        value={query}
        onChangeText={
          setQuery
        }
        placeholder="Client or employee"
      />

      <AdminCard
        title={
          tab === "meetings"
            ? "Meetings"
            : "Calls"
        }
        subtitle={`${items.length} record(s)`}
      >
        {items.map(
          (item) => {
            const next =
              tab ===
              "meetings"
                ? item.nextMeeting
                : item.nextCall;

            return (
              <View
                key={String(
                  item.id,
                )}
                style={
                  styles.row
                }
              >
                <Pressable
                  style={
                    styles.body
                  }
                  onPress={() =>
                    router.push(
                      `/admin/activity/${tab}/${item.rowKey}`,
                    )
                  }
                >
                  <Text
                    style={
                      styles.title
                    }
                  >
                    {item.clientName ||
                      "Client"}
                  </Text>

                  <Text
                    style={
                      styles.meta
                    }
                  >
                    {formatDateTime(
                      tab ===
                        "meetings"
                        ? item.meetingDatetime
                        : item.callDatetime,
                    )}{" "}
                    ·{" "}
                    {item.createdByName ||
                      "Unknown employee"}
                  </Text>

                  {next ? (
                    <Text
                      style={
                        styles.next
                      }
                    >
                      Next:{" "}
                      {formatDateTime(
                        tab ===
                          "meetings"
                          ? next.nextMeetingDatetime
                          : next.nextCallDatetime,
                      )}{" "}
                      ·{" "}
                      {next.assignedEmployeeName ||
                        "Unassigned"}
                    </Text>
                  ) : (
                    <Text
                      style={
                        styles.none
                      }
                    >
                      No next
                      schedule
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  style={
                    styles.icon
                  }
                  onPress={() =>
                    startEdit(
                      item,
                    )
                  }
                >
                  <MaterialIcons
                    name="edit-calendar"
                    size={19}
                    color={
                      Brand.purple
                    }
                  />
                </Pressable>
              </View>
            );
          },
        )}
      </AdminCard>

      <AdminModal
        visible={Boolean(
          editing,
        )}
        title={`Edit next ${editing?.type || ""}`}
        subtitle="Leave datetime blank and save to clear the follow-up."
        onClose={() =>
          setEditing(null)
        }
      >
        <AppInput
          label="Next date & time"
          placeholder="YYYY-MM-DDTHH:MM"
          value={datetime}
          onChangeText={
            setDatetime
          }
          autoCapitalize="none"
        />

        <AdminSelect
          label="Assigned employee"
          value={
            assignedEmployeeId
          }
          options={
            employeeOptions
          }
          onChange={
            setAssignedEmployeeId
          }
        />

        <AppButton
          title="Save Schedule"
          onPress={
            saveSchedule
          }
          loading={busy}
        />
      </AdminModal>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    tabs: {
      flexDirection: "row",

      gap: 8,
    },

    tab: {
      flex: 1,

      borderRadius: 12,

      borderWidth: 1,

      borderColor:
        "#e0cad8",

      paddingVertical: 11,

      alignItems: "center",

      backgroundColor:
        "#fff",
    },

    tabActive: {
      backgroundColor:
        Brand.purple,

      borderColor:
        Brand.purple,
    },

    tabText: {
      fontSize: 13,

      fontWeight: "800",

      color:
        Brand.purple,
    },

    tabTextActive: {
      color: "#fff",
    },

    row: {
      flexDirection: "row",

      gap: 10,

      alignItems: "center",

      paddingVertical: 11,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        "#ead7e3",
    },

    body: {
      flex: 1,

      gap: 2,
    },

    title: {
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

    next: {
      fontSize: 11,

      color:
        Brand.plum,

      fontWeight: "700",
    },

    none: {
      fontSize: 10,

      color: "#aa9baa",
    },

    icon: {
      width: 38,

      height: 38,

      borderRadius: 11,

      alignItems: "center",

      justifyContent:
        "center",

      borderWidth: 1,

      borderColor:
        "#ead7e3",

      backgroundColor:
        "#fff7fb",
    },
  });