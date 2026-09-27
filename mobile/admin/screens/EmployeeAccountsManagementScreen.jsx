import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import MaterialIcons
  from "@expo/vector-icons/MaterialIcons";

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
  createEmployee,
  fetchAllEmployees,
  resetEmployeePassword,
  toggleEmployeeActive,
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

const BLANK = {
  fullName: "",
  email: "",
  role: "Employee",
  password: "",
};

export default function EmployeeAccountsManagementScreen() {
  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    notice,
    setNotice,
  ] = useState(null);

  const [
    createOpen,
    setCreateOpen,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState(BLANK);

  const [
    resetTarget,
    setResetTarget,
  ] = useState(null);

  const [
    resetPassword,
    setResetPassword,
  ] = useState("");

  const [
    busy,
    setBusy,
  ] = useState(false);

  const load =
    useCallback(async () => {
      setLoading(true);

      try {
        setEmployees(
          await fetchAllEmployees({
            includeAdmins:
              true,
          }),
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

  async function submitCreate() {
    setBusy(true);

    setNotice(null);

    try {
      await createEmployee(
        form,
      );

      setCreateOpen(false);

      setForm(BLANK);

      setNotice({
        type: "success",

        message:
          "Account created successfully.",
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

  async function toggle(
    employee,
  ) {
    try {
      await toggleEmployeeActive(
        employee.id,
        !employee.isActive,
      );

      setNotice({
        type: "success",

        message:
          `${employee.fullName} ${
            employee.isActive
              ? "deactivated"
              : "activated"
          }.`,
      });

      await load();
    } catch (error) {
      setNotice({
        type: "error",

        message:
          error.message,
      });
    }
  }

  async function reset() {
    setBusy(true);

    try {
      await resetEmployeePassword(
        resetTarget.id,
        resetPassword,
      );

      setResetTarget(null);

      setResetPassword("");

      setNotice({
        type: "success",

        message:
          "Password reset. The user must change it on next login.",
      });
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
        message="Loading accounts..."
      />
    );
  }

  return (
    <AdminScreen
      back
      title="Manage Employee Accounts"
      subtitle="Create accounts, activate/deactivate access, and reset passwords."
    >
      <AdminNotice
        type={
          notice?.type
        }
        message={
          notice?.message
        }
      />

      <AppButton
        title="Add New Employee / Admin"
        onPress={() =>
          setCreateOpen(
            true,
          )
        }
      />

      <AdminCard
        title="Accounts"
        subtitle={`${employees.length} total`}
      >
        {employees.map(
          (employee) => (
            <View
              key={String(
                employee.id,
              )}
              style={
                styles.row
              }
            >
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
                    employee.fullName
                  }
                </Text>

                <Text
                  style={
                    styles.meta
                  }
                >
                  {employee.email} ·{" "}
                  {employee.role} ·{" "}
                  {employee.isActive
                    ? "Active"
                    : "Inactive"}
                </Text>

                {employee.createdByName ? (
                  <Text
                    style={
                      styles.small
                    }
                  >
                    Created by{" "}
                    {
                      employee.createdByName
                    }
                  </Text>
                ) : null}
              </View>

              <View
                style={
                  styles.actions
                }
              >
                <Pressable
                  style={
                    styles.icon
                  }
                  onPress={() => {
                    setResetTarget(
                      employee,
                    );

                    setResetPassword(
                      "",
                    );
                  }}
                >
                  <MaterialIcons
                    name="password"
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
                    toggle(
                      employee,
                    )
                  }
                >
                  <MaterialIcons
                    name={
                      employee.isActive
                        ? "person-off"
                        : "person"
                    }
                    size={18}
                    color={
                      employee.isActive
                        ? "#b23b3b"
                        : "#2e7d32"
                    }
                  />
                </Pressable>
              </View>
            </View>
          ),
        )}
      </AdminCard>

      <AdminModal
        visible={
          createOpen
        }
        title="Create Account"
        onClose={() =>
          setCreateOpen(
            false,
          )
        }
      >
        <AppInput
          label="Full name"
          value={
            form.fullName
          }
          onChangeText={(
            value,
          ) =>
            setForm(
              (current) => ({
                ...current,

                fullName:
                  value,
              }),
            )
          }
        />

        <AppInput
          label="Email"
          value={
            form.email
          }
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(
            value,
          ) =>
            setForm(
              (current) => ({
                ...current,

                email:
                  value,
              }),
            )
          }
        />

        <AdminSelect
          label="Role"
          value={
            form.role
          }
          onChange={(
            value,
          ) =>
            setForm(
              (current) => ({
                ...current,

                role:
                  value,
              }),
            )
          }
          options={[
            {
              value:
                "Employee",

              label:
                "Employee",
            },

            {
              value:
                "Admin",

              label:
                "Admin",
            },
          ]}
        />

        <AppInput
          label="Initial password"
          secureTextEntry
          value={
            form.password
          }
          onChangeText={(
            value,
          ) =>
            setForm(
              (current) => ({
                ...current,

                password:
                  value,
              }),
            )
          }
        />

        <AppButton
          title="Create Account"
          onPress={
            submitCreate
          }
          loading={busy}
        />
      </AdminModal>

      <AdminModal
        visible={Boolean(
          resetTarget,
        )}
        title="Reset Password"
        subtitle={
          resetTarget?.fullName
        }
        onClose={() =>
          setResetTarget(
            null,
          )
        }
      >
        <AppInput
          label="New password"
          secureTextEntry
          value={
            resetPassword
          }
          onChangeText={
            setResetPassword
          }
        />

        <AppButton
          title="Reset Password"
          onPress={reset}
          loading={busy}
        />
      </AdminModal>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
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

    small: {
      fontSize: 10,

      color:
        Brand.plum,
    },

    actions: {
      flexDirection: "row",

      gap: 7,
    },

    icon: {
      width: 38,

      height: 38,

      borderRadius: 11,

      backgroundColor:
        "#fff6fa",

      alignItems: "center",

      justifyContent:
        "center",

      borderWidth: 1,

      borderColor:
        "#ead7e3",
    },
  });