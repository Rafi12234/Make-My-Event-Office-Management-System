import MaterialIcons
  from "@expo/vector-icons/MaterialIcons";

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

import AdminScreen
  from "@/admin/components/AdminScreen";

import {
  Brand,
} from "@/constants/theme";

const ITEMS = [
  [
    "people-alt",
    "Employee Wallets",
    "Every employee wallet and account summary",
    "/admin/accounts/employees",
  ],

  [
    "payments",
    "Money In",
    "All wallet top-ups; add and correct records",
    "/admin/accounts/money-in",
  ],

  [
    "fact-check",
    "Bills",
    "Pending expense approvals",
    "/admin/accounts/bills",
  ],

  [
    "receipt-long",
    "Expenses",
    "Approved company expenses and financial corrections",
    "/admin/accounts/expenses",
  ],

  [
    "storefront",
    "Vendors",
    "Vendor ledger, direct cost and payment",
    "/admin/accounts/vendors",
  ],
];

export default function FinancialAccountsHomeScreen() {
  const router =
    useRouter();

  return (
    <AdminScreen
      back
      title="Financial Accounts"
      subtitle="Company-wide money in, expenses, employee wallets, bills and vendors."
    >
      <AdminCard
        title="Accounts Modules"
      >
        {ITEMS.map(
          ([
            icon,
            title,
            subtitle,
            path,
          ]) => (
            <Pressable
              key={path}
              style={
                styles.row
              }
              onPress={() =>
                router.push(
                  path,
                )
              }
            >
              <View
                style={
                  styles.icon
                }
              >
                <MaterialIcons
                  name={icon}
                  size={21}
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
                    styles.title
                  }
                >
                  {title}
                </Text>

                <Text
                  style={
                    styles.subtitle
                  }
                >
                  {subtitle}
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
        )}
      </AdminCard>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    row: {
      flexDirection: "row",

      alignItems: "center",

      gap: 11,

      paddingVertical: 11,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        "#ead7e3",
    },

    icon: {
      width: 40,

      height: 40,

      borderRadius: 12,

      backgroundColor:
        "#f3ccde",

      alignItems: "center",

      justifyContent:
        "center",
    },

    title: {
      fontSize: 14,

      fontWeight: "900",

      color:
        Brand.purple,
    },

    subtitle: {
      fontSize: 11,

      color:
        Brand.mauve,

      marginTop: 2,
    },
  });