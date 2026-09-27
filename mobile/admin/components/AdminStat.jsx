import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Brand,
} from "@/constants/theme";

export default function AdminStat({
  label,
  value,
  note,
}) {
  return (
    <View style={styles.box}>
      <Text
        style={styles.value}
      >
        {value ?? 0}
      </Text>

      <Text
        style={styles.label}
      >
        {label}
      </Text>

      {note ? (
        <Text
          style={styles.note}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles =
  StyleSheet.create({
    box: {
      flexGrow: 1,

      flexBasis: 145,

      borderRadius: 16,

      backgroundColor:
        "#fff4f9",

      borderWidth: 1,

      borderColor:
        "#edd9e5",

      padding: 12,

      gap: 2,
    },

    value: {
      fontSize: 22,

      fontWeight: "900",

      color:
        Brand.purple,
    },

    label: {
      fontSize: 12,

      fontWeight: "700",

      color:
        Brand.plum,
    },

    note: {
      fontSize: 10,

      color:
        Brand.mauve,
    },
  });