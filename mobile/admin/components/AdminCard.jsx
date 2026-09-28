import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Brand,
} from "@/constants/theme";

export default function AdminCard({
  title,
  subtitle,
  right,
  children,
  style,
}) {
  return (
    <View
      style={[
        styles.card,
        style,
      ]}
    >
      {title ||
      subtitle ||
      right ? (
        <View
          style={styles.header}
        >
          <View
            style={
              styles.headerText
            }
          >
            {title ? (
              <Text
                style={
                  styles.title
                }
              >
                {title}
              </Text>
            ) : null}

            {subtitle ? (
              <Text
                style={
                  styles.subtitle
                }
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          {right ? (
            <View>
              {right}
            </View>
          ) : null}
        </View>
      ) : null}

      {children}
    </View>
  );
}

const styles =
  StyleSheet.create({
    card: {
      borderWidth: 1,

      borderColor:
        "#ead7e3",

      borderRadius: 18,

      backgroundColor:
        "#fff",

      padding: 14,

      gap: 12,

      shadowColor:
        "#5b3765",

      shadowOpacity:
        0.05,

      shadowRadius: 10,

      shadowOffset: {
        width: 0,
        height: 4,
      },

      elevation: 1,
    },

    header: {
      flexDirection: "row",

      alignItems:
        "flex-start",

      gap: 12,
    },

    headerText: {
      flex: 1,

      gap: 2,
    },

    title: {
      fontSize: 16,

      fontWeight: "800",

      color:
        Brand.purple,
    },

    subtitle: {
      fontSize: 12,

      color:
        Brand.mauve,

      lineHeight: 17,
    },
  });