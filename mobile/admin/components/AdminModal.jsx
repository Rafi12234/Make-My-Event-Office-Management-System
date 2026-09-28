import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import MaterialIcons
  from "@expo/vector-icons/MaterialIcons";

import {
  Brand,
} from "@/constants/theme";

export default function AdminModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={
        onClose
      }
    >
      <View
        style={styles.overlay}
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
          style={
            styles.keyboard
          }
        >
          <View
            style={styles.sheet}
          >
            <View
              style={
                styles.header
              }
            >
              <View
                style={
                  styles.headerText
                }
              >
                <Text
                  style={
                    styles.title
                  }
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
              </View>

              <Pressable
                style={
                  styles.close
                }
                onPress={
                  onClose
                }
              >
                <MaterialIcons
                  name="close"
                  size={20}
                  color={
                    Brand.purple
                  }
                />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.body
              }
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles =
  StyleSheet.create({
    overlay: {
      flex: 1,

      backgroundColor:
        "rgba(30,16,35,0.42)",

      justifyContent:
        "flex-end",
    },

    keyboard: {
      width: "100%",

      maxHeight: "92%",
    },

    sheet: {
      maxHeight: "92%",

      backgroundColor:
        Brand.background,

      borderTopLeftRadius: 24,

      borderTopRightRadius: 24,
    },

    header: {
      flexDirection: "row",

      alignItems:
        "flex-start",

      padding: 16,

      gap: 12,

      borderBottomWidth: 1,

      borderColor:
        "#ead7e3",
    },

    headerText: {
      flex: 1,

      gap: 2,
    },

    title: {
      fontSize: 19,

      fontWeight: "900",

      color:
        Brand.purple,
    },

    subtitle: {
      fontSize: 12,

      color:
        Brand.mauve,
    },

    close: {
      width: 38,

      height: 38,

      borderRadius: 11,

      backgroundColor:
        "#fff",

      alignItems: "center",

      justifyContent:
        "center",
    },

    body: {
      padding: 16,

      gap: 12,

      paddingBottom: 34,
    },
  });