import {
  useState,
} from "react";

import {
  Pressable,
  StyleSheet,
  Text,
} from "react-native";

import MaterialIcons
  from "@expo/vector-icons/MaterialIcons";

import AppButton
  from "@/components/common/AppButton";

import AppInput
  from "@/components/common/AppInput";

import ScreenContainer
  from "@/components/common/ScreenContainer";

import {
  Brand,
} from "@/constants/theme";

import {
  useAuth,
} from "@/hooks/useAuth";

import {
  moderateScale,
} from "@/utils/responsive";

export default function LoginScreen() {
  const { login } = useAuth();

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    isPasswordVisible,
    setIsPasswordVisible,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  async function handleSubmit() {
    if (
      !email.trim() ||
      !password
    ) {
      setError(
        "Email and password are required.",
      );

      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await login({
        email:
          email.trim(),

        password,
      });

      /*
       * Do not navigate here.
       *
       * app/_layout.jsx decides:
       *
       * Admin    -> /admin
       * Employee -> /(tabs)
       */
    } catch (err) {
      setError(
        err?.message ||
          "Login failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScreenContainer
      scroll
      avoidKeyboard
      style={styles.container}
    >
      <Text
        style={styles.title}
      >
        Make My Event
      </Text>


      <Text
        style={styles.subtitle}
      >
        Employee / Admin sign in
      </Text>

      <AppInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!isSubmitting}
      />

      <AppInput
        placeholder="Password"
        secureTextEntry={
          !isPasswordVisible
        }
        value={password}
        onChangeText={
          setPassword
        }
        editable={!isSubmitting}
        rightElement={
          <Pressable
            onPress={() =>
              setIsPasswordVisible(
                (current) =>
                  !current,
              )
            }
            hitSlop={8}
          >
            <MaterialIcons
              name={
                isPasswordVisible
                  ? "visibility-off"
                  : "visibility"
              }
              size={20}
              color={Brand.mauve}
            />
          </Pressable>
        }
      />

      {error ? (
        <Text
          style={styles.error}
        >
          {error}
        </Text>
      ) : null}

      <AppButton
        title="Log In"
        onPress={
          handleSubmit
        }
        loading={
          isSubmitting
        }
        style={
          styles.button
        }
      />
    </ScreenContainer>
  );
}

const styles =
  StyleSheet.create({
    container: {
      justifyContent:
        "center",

      gap: 12,
    },

    title: {
      fontSize:
        moderateScale(28),

      fontWeight:
        "bold",

      textAlign:
        "center",

      color:
        Brand.purple,
    },

    subtitle: {
      fontSize:
        moderateScale(16),

      color:
        Brand.mauve,

      textAlign:
        "center",

      marginBottom: 12,
    },

    error: {
      color:
        "#d32f2f",

      textAlign:
        "center",
    },

    button: {
      marginTop: 8,
    },
  });