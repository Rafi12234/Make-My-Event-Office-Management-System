import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";

import {
  Stack,
  useRouter,
  useSegments,
} from "expo-router";

import {
  StatusBar,
} from "expo-status-bar";

import {
  useEffect,
} from "react";

import "react-native-reanimated";

import {
  useColorScheme,
} from "@/hooks/use-color-scheme";

import QueryProvider
  from "@/providers/QueryProvider";

import {
  AuthProvider,
} from "@/context/AuthContext";

import {
  useAuth,
} from "@/hooks/useAuth";

export const unstable_settings = {
  anchor: "(tabs)",
};

function AuthGate({
  children,
}) {
  const {
    employee,
    isAuthenticated,
    isBootstrapping,
  } = useAuth();

  const segments =
    useSegments();

  const router =
    useRouter();

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    const root =
      segments[0];

    const inAuthGroup =
      root === "(auth)";

    const inAdmin =
      root === "admin";

    const isAdmin =
      String(
        employee?.role || "",
      )
        .trim()
        .toLowerCase() ===
      "admin";

    if (!isAuthenticated) {
      if (!inAuthGroup) {
        router.replace(
          "/(auth)/login",
        );
      }

      return;
    }

    if (isAdmin) {
      if (!inAdmin) {
        router.replace(
          "/admin",
        );
      }

      return;
    }

    if (
      inAdmin ||
      inAuthGroup
    ) {
      router.replace(
        "/(tabs)",
      );
    }
  }, [
    employee?.role,
    isAuthenticated,
    isBootstrapping,
    segments,
    router,
  ]);

  return children;
}

export default function RootLayout() {
  const colorScheme =
    useColorScheme();

  return (
    <QueryProvider>
      <AuthProvider>
        <ThemeProvider
          value={
            colorScheme ===
            "dark"
              ? DarkTheme
              : DefaultTheme
          }
        >
          <AuthGate>
            <Stack>
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown:
                    false,
                }}
              />

              <Stack.Screen
                name="(auth)"
                options={{
                  headerShown:
                    false,
                }}
              />

              <Stack.Screen
                name="admin"
                options={{
                  headerShown:
                    false,
                }}
              />

              <Stack.Screen
                name="modal"
                options={{
                  presentation:
                    "modal",

                  title:
                    "Modal",
                }}
              />
            </Stack>
          </AuthGate>

          <StatusBar
            style="auto"
          />
        </ThemeProvider>
      </AuthProvider>
    </QueryProvider>
  );
}