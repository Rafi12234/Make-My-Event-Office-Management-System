import {
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function AdminNotice({
  type = "info",
  message,
}) {
  if (!message) {
    return null;
  }

  return (
    <View
      style={[
        styles.base,

        type === "error"
          ? styles.error
          : type ===
              "success"
            ? styles.success
            : styles.info,
      ]}
    >
      <Text
        style={[
          styles.text,

          type === "error"
            ? styles.errorText
            : type ===
                "success"
              ? styles.successText
              : styles.infoText,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    base: {
      borderRadius: 12,

      borderWidth: 1,

      padding: 11,
    },

    info: {
      backgroundColor:
        "#f7f1fa",

      borderColor:
        "#dfcdea",
    },

    success: {
      backgroundColor:
        "#eefaf1",

      borderColor:
        "#bfe0c7",
    },

    error: {
      backgroundColor:
        "#fff0f0",

      borderColor:
        "#f2c0c0",
    },

    text: {
      fontSize: 13,

      fontWeight: "600",

      lineHeight: 18,
    },

    infoText: {
      color: "#5b3765",
    },

    successText: {
      color: "#246b37",
    },

    errorText: {
      color: "#a52929",
    },
  });