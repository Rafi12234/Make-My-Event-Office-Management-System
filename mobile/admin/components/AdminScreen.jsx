import MaterialIcons
  from "@expo/vector-icons/MaterialIcons";

import {
  useRouter,
} from "expo-router";

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import ScreenContainer
  from "@/components/common/ScreenContainer";

import {
  Brand,
} from "@/constants/theme";

import {
  useAuth,
} from "@/hooks/useAuth";

export default function AdminScreen({
  title,
  subtitle,
  children,
  back = false,
  scroll = true,
  refreshControl,
  actions,
}) {
  const router =
    useRouter();

  const {
    employee,
    logout,
  } = useAuth();

  async function handleLogout() {
    await logout();

    router.replace(
      "/(auth)/login",
    );
  }

  return (
    <ScreenContainer
      scroll={scroll}
      refreshControl={
        refreshControl
      }
      style={styles.screen}
    >
      <View
        style={styles.topBar}
      >
        <View
          style={
            styles.leftActions
          }
        >
          {back ? (
            <Pressable
              style={
                styles.iconButton
              }
              onPress={() =>
                router.back()
              }
              hitSlop={8}
            >
              <MaterialIcons
                name="arrow-back"
                size={21}
                color={
                  Brand.purple
                }
              />
            </Pressable>
          ) : null}

          <View
            style={
              styles.brandBadge
            }
          >
            <MaterialIcons
              name="admin-panel-settings"
              size={20}
              color="#fff"
            />
          </View>
        </View>

        <View
          style={
            styles.topActions
          }
        >
          {actions}

          <Pressable
            style={
              styles.iconButton
            }
            onPress={
              handleLogout
            }
            hitSlop={8}
          >
            <MaterialIcons
              name="logout"
              size={20}
              color={
                Brand.purple
              }
            />
          </Pressable>
        </View>
      </View>

      <View
        style={styles.heading}
      >
        <Text
          style={styles.kicker}
        >
          ADMIN PORTAL · MAKE MY
          EVENT
        </Text>

        <Text
          style={styles.title}
        >
          {title}
        </Text>

        {subtitle ? (
          <Text
            style={
              styles.subtitle
            }
          >
            {subtitle}
          </Text>
        ) : null}

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

      {children}
    </ScreenContainer>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      gap: 14,

      paddingBottom: 42,
    },

    topBar: {
      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "space-between",
    },

    leftActions: {
      flexDirection: "row",

      alignItems: "center",

      gap: 8,
    },

    topActions: {
      flexDirection: "row",

      alignItems: "center",

      gap: 8,
    },

    iconButton: {
      width: 40,

      height: 40,

      borderRadius: 12,

      borderWidth: 1,

      borderColor:
        "#ead7e3",

      backgroundColor:
        "#fff",

      alignItems: "center",

      justifyContent:
        "center",
    },

    brandBadge: {
      width: 40,

      height: 40,

      borderRadius: 13,

      backgroundColor:
        Brand.purple,

      alignItems: "center",

      justifyContent:
        "center",
    },

    heading: {
      gap: 4,
    },

    kicker: {
      fontSize: 10,

      fontWeight: "900",

      letterSpacing: 1.2,

      color:
        Brand.plum,
    },

    title: {
      fontSize: 26,

      fontWeight: "900",

      color:
        Brand.purple,
    },

    subtitle: {
      fontSize: 13,

      lineHeight: 19,

      color:
        Brand.mauve,
    },

    signedIn: {
      fontSize: 11,

      color:
        Brand.mauve,

      marginTop: 2,
    },
  });