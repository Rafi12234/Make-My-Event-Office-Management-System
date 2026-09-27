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
  fetchAdminWorkspace,
  fetchAllEmployees,
  updateAdminWorkspaceCell,
} from "@/admin/services/adminApi";

import AppButton
  from "@/components/common/AppButton";

import AppInput
  from "@/components/common/AppInput";

import LoadingScreen
  from "@/components/common/LoadingScreen";

import {
  Brand,
} from "@/constants/theme";

function displayName(
  workspace,
  row,
) {
  const nameColumn =
    workspace.columns.find(
      (column) =>
        column.name
          ?.toLowerCase() ===
        "client name",
    );

  return (
    (nameColumn
      ? row.values?.[
          nameColumn.id
        ]
      : "") ||
    "Unnamed client"
  );
}

export default function ClientsManagementScreen() {
  const router =
    useRouter();

  const [
    workspace,
    setWorkspace,
  ] = useState(null);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    editingRow,
    setEditingRow,
  ] = useState(null);

  const [
    drafts,
    setDrafts,
  ] = useState({});

  const [
    savingKey,
    setSavingKey,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    notice,
    setNotice,
  ] = useState(null);

  const load =
    useCallback(async () => {
      setLoading(true);

      try {
        const [
          sheet,
          staff,
        ] =
          await Promise.all([
            fetchAdminWorkspace(),
            fetchAllEmployees(),
          ]);

        setWorkspace(
          sheet,
        );

        setEmployees(
          staff,
        );
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

  const rows =
    useMemo(() => {
      if (!workspace) {
        return [];
      }

      const q =
        query
          .trim()
          .toLowerCase();

      return workspace.rows.filter(
        (row) => {
          if (!q) {
            return true;
          }

          return Object.values(
            row.values || {},
          ).some((value) =>
            String(
              value ?? "",
            )
              .toLowerCase()
              .includes(q),
          );
        },
      );
    }, [workspace, query]);

  function openEdit(row) {
    setEditingRow(row);

    setDrafts({
      ...(row.values ||
        {}),
    });
  }

  async function saveCell(
    column,
  ) {
    setSavingKey(
      column.id,
    );

    try {
      const result =
        await updateAdminWorkspaceCell(
          editingRow.id,
          column.id,
          drafts[
            column.id
          ] ?? "",
        );

      setWorkspace(
        (current) => ({
          ...current,

          rows:
            current.rows.map(
              (row) =>
                row.id ===
                editingRow.id
                  ? {
                      ...row,

                      values: {
                        ...row.values,

                        [column.id]:
                          result.value,
                      },
                    }
                  : row,
            ),
        }),
      );

      setDrafts(
        (current) => ({
          ...current,

          [column.id]:
            result.value,
        }),
      );

      setNotice({
        type: "success",

        message:
          `${column.name} updated.`,
      });
    } catch (error) {
      setNotice({
        type: "error",

        message:
          error.message,
      });
    } finally {
      setSavingKey("");
    }
  }

  if (
    loading ||
    !workspace
  ) {
    return (
      <LoadingScreen
        message="Loading client management..."
      />
    );
  }

  return (
    <AdminScreen
      back
      title="Client Informations & Management"
      subtitle="The same live management sheet, with admin cell editing and meeting/call history."
    >
      <AdminNotice
        type={
          notice?.type
        }
        message={
          notice?.message
        }
      />

      <AppInput
        label="Search clients"
        value={query}
        onChangeText={
          setQuery
        }
        placeholder="Name, venue, phone, date..."
      />

      <AdminCard
        title={
          workspace.name ||
          "Client Management"
        }
        subtitle={`${rows.length} visible row(s)`}
      >
        {rows.map(
          (row) => (
            <View
              key={row.id}
              style={
                styles.row
              }
            >
              <Pressable
                style={
                  styles.rowMain
                }
                onPress={() =>
                  router.push(
                    `/admin/clients/${row.id}`,
                  )
                }
              >
                <Text
                  style={
                    styles.name
                  }
                >
                  {displayName(
                    workspace,
                    row,
                  )}
                </Text>

                <Text
                  style={
                    styles.meta
                  }
                >
                  Row #
                  {
                    row.rowNumber
                  }{" "}
                  ·{" "}
                  {Object.values(
                    row.values ||
                      {},
                  )
                    .filter(
                      Boolean,
                    )
                    .slice(
                      1,
                      4,
                    )
                    .join(
                      " · ",
                    ) ||
                    "Open details"}
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.icon
                }
                onPress={() =>
                  openEdit(row)
                }
              >
                <MaterialIcons
                  name="edit"
                  size={18}
                  color={
                    Brand.purple
                  }
                />
              </Pressable>

              <Pressable
                style={
                  styles.icon
                }
                onPress={() =>
                  router.push(
                    `/admin/activity/meetings/${row.id}`,
                  )
                }
              >
                <MaterialIcons
                  name="event"
                  size={18}
                  color={
                    Brand.purple
                  }
                />
              </Pressable>

              <Pressable
                style={
                  styles.icon
                }
                onPress={() =>
                  router.push(
                    `/admin/activity/calls/${row.id}`,
                  )
                }
              >
                <MaterialIcons
                  name="call"
                  size={18}
                  color={
                    Brand.purple
                  }
                />
              </Pressable>
            </View>
          ),
        )}
      </AdminCard>

      <AdminModal
        visible={Boolean(
          editingRow,
        )}
        title={
          editingRow
            ? displayName(
                workspace,
                editingRow,
              )
            : "Edit client"
        }
        subtitle="Each save updates exactly one sheet cell."
        onClose={() =>
          setEditingRow(
            null,
          )
        }
      >
        {workspace.columns.map(
          (column) => {
            const employeeOptions =
              [
                {
                  value: "",

                  label:
                    "None / blank",
                },

                ...employees.map(
                  (employee) => ({
                    value:
                      employee.fullName,

                    label:
                      employee.fullName,
                  }),
                ),
              ];

            if (
              column.type ===
              "employee"
            ) {
              return (
                <View
                  key={
                    column.id
                  }
                  style={
                    styles.editor
                  }
                >
                  <AdminSelect
                    label={
                      column.name
                    }
                    value={
                      drafts[
                        column.id
                      ] ?? ""
                    }
                    options={
                      employeeOptions
                    }
                    onChange={(
                      value,
                    ) =>
                      setDrafts(
                        (
                          current,
                        ) => ({
                          ...current,

                          [column.id]:
                            value,
                        }),
                      )
                    }
                  />

                  <AppButton
                    title="Save"
                    variant="outline"
                    loading={
                      savingKey ===
                      column.id
                    }
                    onPress={() =>
                      saveCell(
                        column,
                      )
                    }
                  />
                </View>
              );
            }

            if (
              column.type ===
              "boolean"
            ) {
              return (
                <View
                  key={
                    column.id
                  }
                  style={
                    styles.editor
                  }
                >
                  <AdminSelect
                    label={
                      column.name
                    }
                    value={
                      drafts[
                        column.id
                      ] === true
                        ? "true"
                        : drafts[
                              column.id
                            ] ===
                            false
                          ? "false"
                          : ""
                    }
                    options={[
                      {
                        value:
                          "",

                        label:
                          "Blank",
                      },

                      {
                        value:
                          "true",

                        label:
                          "Yes",
                      },

                      {
                        value:
                          "false",

                        label:
                          "No",
                      },
                    ]}
                    onChange={(
                      value,
                    ) =>
                      setDrafts(
                        (
                          current,
                        ) => ({
                          ...current,

                          [column.id]:
                            value ===
                            ""
                              ? ""
                              : value ===
                                "true",
                        }),
                      )
                    }
                  />

                  <AppButton
                    title="Save"
                    variant="outline"
                    loading={
                      savingKey ===
                      column.id
                    }
                    onPress={() =>
                      saveCell(
                        column,
                      )
                    }
                  />
                </View>
              );
            }

            return (
              <View
                key={
                  column.id
                }
                style={
                  styles.editor
                }
              >
                <AppInput
                  label={
                    column.name
                  }
                  value={String(
                    drafts[
                      column.id
                    ] ?? "",
                  )}
                  onChangeText={(
                    value,
                  ) =>
                    setDrafts(
                      (
                        current,
                      ) => ({
                        ...current,

                        [column.id]:
                          value,
                      }),
                    )
                  }
                  multiline={
                    column.type ===
                    "long_text"
                  }
                  keyboardType={
                    [
                      "number",
                      "integer",
                      "currency",
                      "decimal",
                    ].includes(
                      column.type,
                    )
                      ? "decimal-pad"
                      : "default"
                  }
                />

                <AppButton
                  title="Save"
                  variant="outline"
                  loading={
                    savingKey ===
                    column.id
                  }
                  onPress={() =>
                    saveCell(
                      column,
                    )
                  }
                />
              </View>
            );
          },
        )}
      </AdminModal>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    row: {
      flexDirection: "row",

      alignItems: "center",

      gap: 6,

      paddingVertical: 10,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        "#ead7e3",
    },

    rowMain: {
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
      fontSize: 10,

      color:
        Brand.mauve,
    },

    icon: {
      width: 36,

      height: 36,

      borderRadius: 10,

      borderWidth: 1,

      borderColor:
        "#ead7e3",

      alignItems: "center",

      justifyContent:
        "center",

      backgroundColor:
        "#fff8fb",
    },

    editor: {
      gap: 7,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        "#ead7e3",

      paddingBottom: 12,
    },
  });