import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Brand,
} from "@/constants/theme";

export default function AdminKeyValue({
  label,
  value,
  valueStyle,
}) {
  const displayValue =
    value === null ||
    value === undefined ||
    value === ""
      ? "—"
      : String(value);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        {label}
      </Text>

      <Text
        selectable
        style={[
          styles.value,
          valueStyle,
        ]}
      >
        {displayValue}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    row: {
      flexDirection: "row",

      alignItems:
        "flex-start",

      gap: 12,

      paddingVertical: 7,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        "#f0e2eb",
    },

    label: {
      width: 110,

      fontSize: 12,

      fontWeight: "700",

      color:
        Brand.mauve,
    },

    value: {
      flex: 1,

      fontSize: 13,

      fontWeight: "600",

      color:
        Brand.purple,
    },
  });