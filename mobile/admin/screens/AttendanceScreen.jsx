import MaterialIcons
  from "@expo/vector-icons/MaterialIcons";

import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AdminCard
  from "@/admin/components/AdminCard";

import AdminNotice
  from "@/admin/components/AdminNotice";

import AdminScreen
  from "@/admin/components/AdminScreen";

import AdminSelect
  from "@/admin/components/AdminSelect";

import {
  fetchAdminAttendance,
  fetchAllEmployees,
} from "@/admin/services/adminApi";

import {
  formatDate,
  formatDateTime,
  formatDuration,
  truthyLabel,
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

export default function AttendanceScreen() {
  const [
    rows,
    setRows,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    employeeId,
    setEmployeeId,
  ] = useState("");

  const [
    date,
    setDate,
  ] = useState("");

  const [
    from,
    setFrom,
  ] = useState("");

  const [
    to,
    setTo,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    notice,
    setNotice,
  ] = useState(null);

  const [
    location,
    setLocation,
  ] = useState(null);

  const load =
    useCallback(async () => {
      setLoading(true);
      setNotice(null);

      try {
        const [
          attendance,
          staff,
        ] =
          await Promise.all([
            fetchAdminAttendance({
              employeeId,

              date,

              from:
                date
                  ? ""
                  : from,

              to:
                date
                  ? ""
                  : to,
            }),

            fetchAllEmployees(),
          ]);

        setRows(
          Array.isArray(attendance)
            ? attendance
            : [],
        );

        setEmployees(
          Array.isArray(staff)
            ? staff
            : [],
        );
      } catch (error) {
        setNotice({
          type: "error",

          message:
            error?.message ||
            "Unable to load attendance records.",
        });
      } finally {
        setLoading(false);
      }
    }, [
      employeeId,
      date,
      from,
      to,
    ]);

  useEffect(() => {
    load();
  }, []);

  const employeeOptions =
    useMemo(
      () => [
        {
          value: "",

          label:
            "All employees",
        },

        ...employees.map(
          (employee) => ({
            value: String(
              employee.id,
            ),

            label:
              employee.fullName ||
              employee.email ||
              "Employee",
          }),
        ),
      ],
      [employees],
    );

  function showLocation(
    row,
    type,
  ) {
    const isIn =
      type === "in";

    setLocation({
      title:
        `${
          isIn
            ? "Sign In"
            : "Sign Out"
        } · ${
          row.employeeName ||
          "Employee"
        }`,

      latitude:
        isIn
          ? row.signInLatitude
          : row.signOutLatitude,

      longitude:
        isIn
          ? row.signInLongitude
          : row.signOutLongitude,

      accuracy:
        isIn
          ? row.signInAccuracy
          : row.signOutAccuracy,

      distance:
        isIn
          ? row.signInDistanceFromOffice
          : row.signOutDistanceFromOffice,

      inside:
        isIn
          ? row.signInInsideOffice
          : row.signOutInsideOffice,

      type:
        isIn
          ? "Sign In"
          : "Sign Out",

      time:
        isIn
          ? row.signInAt
          : row.signOutAt,
    });
  }

  function closeLocation() {
    setLocation(null);
  }

  async function openMap() {
    if (
      location?.latitude ==
        null ||
      location?.longitude ==
        null
    ) {
      return;
    }

    const coordinates =
      `${location.latitude},${location.longitude}`;

    const url =
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        coordinates,
      )}`;

    try {
      const supported =
        await Linking.canOpenURL(
          url,
        );

      if (supported) {
        await Linking.openURL(
          url,
        );
      } else {
        setNotice({
          type: "error",

          message:
            "Unable to open Maps on this device.",
        });
      }
    } catch (error) {
      setNotice({
        type: "error",

        message:
          "Unable to open the location in Maps.",
      });
    }
  }

  async function clearFilters() {
    setEmployeeId("");
    setDate("");
    setFrom("");
    setTo("");

    setLoading(true);
    setNotice(null);

    try {
      const [
        attendance,
        staff,
      ] =
        await Promise.all([
          fetchAdminAttendance({
            employeeId: "",
            date: "",
            from: "",
            to: "",
          }),

          fetchAllEmployees(),
        ]);

      setRows(
        Array.isArray(attendance)
          ? attendance
          : [],
      );

      setEmployees(
        Array.isArray(staff)
          ? staff
          : [],
      );
    } catch (error) {
      setNotice({
        type: "error",

        message:
          error?.message ||
          "Unable to clear attendance filters.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (
    loading &&
    !rows.length
  ) {
    return (
      <LoadingScreen
        message="Loading attendance..."
      />
    );
  }

  return (
    <>
      <AdminScreen
        back
        title="Attendance Management"
        subtitle="Employee sign in, sign out, work duration, GPS and office-radius status."
      >
        <AdminNotice
          type={
            notice?.type
          }
          message={
            notice?.message
          }
        />

        <AdminCard
          title="Filter Records"
        >
          <AdminSelect
            label="Employee"
            value={
              employeeId
            }
            options={
              employeeOptions
            }
            onChange={
              setEmployeeId
            }
          />

          <AppInput
            label="Exact date"
            value={date}
            onChangeText={
              setDate
            }
            placeholder="YYYY-MM-DD"
          />

          {!date ? (
            <>
              <AppInput
                label="From"
                value={from}
                onChangeText={
                  setFrom
                }
                placeholder="YYYY-MM-DD"
              />

              <AppInput
                label="To"
                value={to}
                onChangeText={
                  setTo
                }
                placeholder="YYYY-MM-DD"
              />
            </>
          ) : null}

          <View
            style={
              styles.actions
            }
          >
            <AppButton
              title="Apply"
              onPress={load}
              loading={loading}
              style={{
                flex: 1,
              }}
            />

            <AppButton
              title="Clear"
              variant="outline"
              onPress={
                clearFilters
              }
              style={{
                flex: 1,
              }}
            />
          </View>
        </AdminCard>

        <AdminCard
          title="Attendance Records"
          subtitle={`${rows.length} row(s)`}
        >
          {!rows.length ? (
            <Text
              style={
                styles.empty
              }
            >
              No attendance records
              found.
            </Text>
          ) : (
            rows.map(
              (row) => (
                <View
                  key={String(
                    row.id,
                  )}
                  style={
                    styles.record
                  }
                >
                  <Text
                    style={
                      styles.name
                    }
                  >
                    {row.employeeName ||
                      "Employee"}
                  </Text>

                  <Text
                    style={
                      styles.date
                    }
                  >
                    {formatDate(
                      row.attendanceDate,
                    )}{" "}
                    ·{" "}
                    {row.status ||
                      "—"}
                  </Text>

                  <View
                    style={
                      styles.tableHeader
                    }
                  >
                    <Text
                      style={
                        styles.colHead
                      }
                    >
                      Signing in
                    </Text>

                    <Text
                      style={
                        styles.colHead
                      }
                    >
                      Signing out
                    </Text>

                    <Text
                      style={
                        styles.colHead
                      }
                    >
                      Work
                    </Text>
                  </View>

                  <View
                    style={
                      styles.tableRow
                    }
                  >
                    <View
                      style={
                        styles.col
                      }
                    >
                      <Text
                        style={
                          styles.value
                        }
                      >
                        {formatDateTime(
                          row.signInAt,
                        )}
                      </Text>

                      <Pressable
                        disabled={
                          row.signInLatitude ==
                          null
                        }
                        onPress={() =>
                          showLocation(
                            row,
                            "in",
                          )
                        }
                        style={[
                          styles.eye,

                          row.signInLatitude ==
                            null &&
                            styles.eyeDisabled,
                        ]}
                      >
                        <MaterialIcons
                          name="visibility"
                          size={18}
                          color={
                            row.signInLatitude ==
                            null
                              ? "#cbbec7"
                              : Brand.purple
                          }
                        />
                      </Pressable>
                    </View>

                    <View
                      style={
                        styles.col
                      }
                    >
                      <Text
                        style={
                          styles.value
                        }
                      >
                        {formatDateTime(
                          row.signOutAt,
                        )}
                      </Text>

                      <Pressable
                        disabled={
                          row.signOutLatitude ==
                          null
                        }
                        onPress={() =>
                          showLocation(
                            row,
                            "out",
                          )
                        }
                        style={[
                          styles.eye,

                          row.signOutLatitude ==
                            null &&
                            styles.eyeDisabled,
                        ]}
                      >
                        <MaterialIcons
                          name="visibility"
                          size={18}
                          color={
                            row.signOutLatitude ==
                            null
                              ? "#cbbec7"
                              : Brand.purple
                          }
                        />
                      </Pressable>
                    </View>

                    <View
                      style={
                        styles.col
                      }
                    >
                      <Text
                        style={
                          styles.work
                        }
                      >
                        {formatDuration(
                          row.durationMinutes,
                        )}
                      </Text>
                    </View>
                  </View>
                </View>
              ),
            )
          )}
        </AdminCard>
      </AdminScreen>

      {/* Attendance location popup */}
      <Modal
        visible={
          Boolean(location)
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={
          closeLocation
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <Pressable
            style={
              styles.modalBackdrop
            }
            onPress={
              closeLocation
            }
          />

          <View
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <View
                style={
                  styles.modalHeaderIcon
                }
              >
                <MaterialIcons
                  name="location-on"
                  size={24}
                  color="#ffffff"
                />
              </View>

              <View
                style={
                  styles.modalHeaderText
                }
              >
                <Text
                  style={
                    styles.modalTitle
                  }
                >
                  {location?.title ||
                    "Attendance Location"}
                </Text>

                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  GPS information
                  captured during{" "}
                  {location?.type ||
                    "attendance"}.
                </Text>
              </View>

              <Pressable
                style={
                  styles.closeButton
                }
                onPress={
                  closeLocation
                }
                hitSlop={8}
              >
                <MaterialIcons
                  name="close"
                  size={22}
                  color={
                    Brand.purple
                  }
                />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.modalBody
              }
            >
              <LocationRow
                icon="schedule"
                label="Time"
                value={
                  formatDateTime(
                    location?.time,
                  )
                }
              />

              <LocationRow
                icon="my-location"
                label="Latitude"
                value={
                  location?.latitude
                }
              />

              <LocationRow
                icon="my-location"
                label="Longitude"
                value={
                  location?.longitude
                }
              />

              <LocationRow
                icon="gps-fixed"
                label="Accuracy"
                value={
                  location?.accuracy ==
                  null
                    ? "—"
                    : `${location.accuracy} m`
                }
              />

              <LocationRow
                icon="straighten"
                label="Distance from office"
                value={
                  location?.distance ==
                  null
                    ? "—"
                    : `${location.distance} m`
                }
              />

              <View
                style={
                  styles.statusSection
                }
              >
                <Text
                  style={
                    styles.statusLabel
                  }
                >
                  Office Status
                </Text>

                <View
                  style={[
                    styles.statusBadge,

                    location?.inside
                      ? styles.insideBadge
                      : styles.outsideBadge,
                  ]}
                >
                  <MaterialIcons
                    name={
                      location?.inside
                        ? "check-circle"
                        : "location-off"
                    }
                    size={18}
                    color={
                      location?.inside
                        ? "#207a3c"
                        : "#b42318"
                    }
                  />

                  <Text
                    style={[
                      styles.statusText,

                      location?.inside
                        ? styles.insideText
                        : styles.outsideText,
                    ]}
                  >
                    {truthyLabel(
                      location?.inside,
                    )}
                  </Text>
                </View>
              </View>

              <Pressable
                disabled={
                  location?.latitude ==
                    null ||
                  location?.longitude ==
                    null
                }
                onPress={
                  openMap
                }
                style={({
                  pressed,
                }) => [
                  styles.mapButton,

                  (location?.latitude ==
                    null ||
                    location?.longitude ==
                      null) &&
                    styles.mapButtonDisabled,

                  pressed &&
                    styles.mapButtonPressed,
                ]}
              >
                <MaterialIcons
                  name="map"
                  size={20}
                  color="#ffffff"
                />

                <Text
                  style={
                    styles.mapButtonText
                  }
                >
                  Open Location in Maps
                </Text>
              </Pressable>

              <Pressable
                onPress={
                  closeLocation
                }
                style={
                  styles.cancelButton
                }
              >
                <Text
                  style={
                    styles.cancelButtonText
                  }
                >
                  Close
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function LocationRow({
  icon,
  label,
  value,
}) {
  const displayValue =
    value === null ||
    value === undefined ||
    value === ""
      ? "—"
      : String(value);

  return (
    <View
      style={
        styles.locationRow
      }
    >
      <View
        style={
          styles.locationIcon
        }
      >
        <MaterialIcons
          name={icon}
          size={18}
          color={
            Brand.purple
          }
        />
      </View>

      <View
        style={
          styles.locationContent
        }
      >
        <Text
          style={
            styles.locationLabel
          }
        >
          {label}
        </Text>

        <Text
          selectable
          style={
            styles.locationValue
          }
        >
          {displayValue}
        </Text>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    actions: {
      flexDirection:
        "row",

      gap: 8,
    },

    empty: {
      textAlign:
        "center",

      paddingVertical: 25,

      fontSize: 12,

      color:
        Brand.mauve,
    },

    record: {
      gap: 4,

      paddingVertical: 12,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        "#ead7e3",
    },

    name: {
      fontSize: 14,

      fontWeight:
        "900",

      color:
        Brand.purple,
    },

    date: {
      fontSize: 11,

      color:
        Brand.mauve,

      textTransform:
        "capitalize",
    },

    tableHeader: {
      flexDirection:
        "row",

      marginTop: 5,

      gap: 5,
    },

    tableRow: {
      flexDirection:
        "row",

      gap: 5,
    },

    colHead: {
      flex: 1,

      fontSize: 10,

      fontWeight:
        "900",

      color:
        Brand.plum,
    },

    col: {
      flex: 1,

      borderRadius: 10,

      backgroundColor:
        "#fff7fb",

      padding: 7,

      minHeight: 60,

      justifyContent:
        "space-between",
    },

    value: {
      fontSize: 10,

      lineHeight: 14,

      color:
        Brand.purple,
    },

    work: {
      fontSize: 13,

      fontWeight:
        "900",

      color:
        Brand.purple,
    },

    eye: {
      width: 30,

      height: 30,

      borderRadius: 9,

      alignSelf:
        "flex-end",

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#f6eaf2",
    },

    eyeDisabled: {
      backgroundColor:
        "#f5f1f4",
    },

    /*
     * Location modal
     */

    modalOverlay: {
      flex: 1,

      backgroundColor:
        "rgba(31, 18, 35, 0.58)",

      justifyContent:
        "center",

      paddingHorizontal: 18,

      paddingVertical: 35,
    },

    modalBackdrop: {
      ...StyleSheet.absoluteFillObject,
    },

    modalCard: {
      maxHeight: "85%",

      borderRadius: 24,

      overflow: "hidden",

      backgroundColor:
        "#fff9fc",

      borderWidth: 1,

      borderColor:
        "#ead7e3",

      shadowColor:
        "#000000",

      shadowOpacity:
        0.18,

      shadowRadius: 18,

      shadowOffset: {
        width: 0,
        height: 8,
      },

      elevation: 12,
    },

    modalHeader: {
      flexDirection:
        "row",

      alignItems:
        "flex-start",

      gap: 11,

      paddingHorizontal: 17,

      paddingVertical: 16,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        "#ead7e3",

      backgroundColor:
        "#ffffff",
    },

    modalHeaderIcon: {
      width: 44,

      height: 44,

      borderRadius: 14,

      backgroundColor:
        Brand.purple,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    modalHeaderText: {
      flex: 1,

      paddingTop: 1,
    },

    modalTitle: {
      fontSize: 17,

      lineHeight: 22,

      fontWeight:
        "900",

      color:
        Brand.purple,
    },

    modalSubtitle: {
      marginTop: 3,

      fontSize: 11,

      lineHeight: 16,

      color:
        Brand.mauve,
    },

    closeButton: {
      width: 36,

      height: 36,

      borderRadius: 11,

      alignItems:
        "center",

      justifyContent:
        "center",

      borderWidth: 1,

      borderColor:
        "#ead7e3",

      backgroundColor:
        "#fff8fb",
    },

    modalBody: {
      paddingHorizontal: 17,

      paddingVertical: 14,
    },

    locationRow: {
      minHeight: 62,

      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 12,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        "#ead7e3",
    },

    locationIcon: {
      width: 38,

      height: 38,

      borderRadius: 12,

      backgroundColor:
        "#fff0f7",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    locationContent: {
      flex: 1,

      paddingVertical: 8,
    },

    locationLabel: {
      fontSize: 10,

      fontWeight:
        "800",

      textTransform:
        "uppercase",

      letterSpacing: 0.4,

      color:
        Brand.mauve,
    },

    locationValue: {
      marginTop: 3,

      fontSize: 13,

      lineHeight: 18,

      fontWeight:
        "700",

      color:
        Brand.purple,
    },

    statusSection: {
      paddingVertical: 14,

      gap: 8,
    },

    statusLabel: {
      fontSize: 10,

      fontWeight:
        "800",

      textTransform:
        "uppercase",

      letterSpacing: 0.4,

      color:
        Brand.mauve,
    },

    statusBadge: {
      minHeight: 44,

      borderRadius: 13,

      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 8,

      paddingHorizontal: 12,

      borderWidth: 1,
    },

    insideBadge: {
      backgroundColor:
        "#effaf2",

      borderColor:
        "#b9e1c4",
    },

    outsideBadge: {
      backgroundColor:
        "#fff1f0",

      borderColor:
        "#f4c7c3",
    },

    statusText: {
      fontSize: 13,

      fontWeight:
        "800",
    },

    insideText: {
      color:
        "#207a3c",
    },

    outsideText: {
      color:
        "#b42318",
    },

    mapButton: {
      minHeight: 50,

      marginTop: 4,

      borderRadius: 14,

      backgroundColor:
        Brand.purple,

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "center",

      gap: 8,

      paddingHorizontal: 14,
    },

    mapButtonPressed: {
      opacity: 0.8,
    },

    mapButtonDisabled: {
      opacity: 0.4,
    },

    mapButtonText: {
      color:
        "#ffffff",

      fontSize: 14,

      fontWeight:
        "800",
    },

    cancelButton: {
      minHeight: 46,

      marginTop: 10,

      borderRadius: 14,

      alignItems:
        "center",

      justifyContent:
        "center",

      borderWidth: 1,

      borderColor:
        "#dfcad7",

      backgroundColor:
        "#ffffff",
    },

    cancelButtonText: {
      fontSize: 13,

      fontWeight:
        "800",

      color:
        Brand.purple,
    },
  });