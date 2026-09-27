import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useState,
} from "react";

import MaterialIcons
  from "@expo/vector-icons/MaterialIcons";

import {
  Brand,
} from "@/constants/theme";

export default function AdminSelect({
  label,
  value,
  options = [],
  onChange,
  placeholder = "Select",
  disabled = false,
}) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const selected =
    options.find(
      (option) =>
        String(option.value) ===
        String(value),
    );

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text
          style={styles.label}
        >
          {label}
        </Text>
      ) : null}

      <Pressable
        disabled={disabled}
        onPress={() =>
          setOpen(true)
        }
        style={[
          styles.control,
          disabled &&
            styles.disabled,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.controlText,

            !selected &&
              styles.placeholder,
          ]}
        >
          {selected?.label ||
            placeholder}
        </Text>

        <MaterialIcons
          name="expand-more"
          size={20}
          color={Brand.plum}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setOpen(false)
        }
      >
        <Pressable
          style={styles.overlay}
          onPress={() =>
            setOpen(false)
          }
        >
          <Pressable
            style={styles.modal}
            onPress={() => {}}
          >
            <Text
              style={
                styles.modalTitle
              }
            >
              {label ||
                placeholder}
            </Text>

            <ScrollView
              style={styles.list}
              contentContainerStyle={
                styles.listContent
              }
            >
              {options.map(
                (option) => {
                  const active =
                    String(
                      option.value,
                    ) ===
                    String(value);

                  return (
                    <Pressable
                      key={String(
                        option.value,
                      )}
                      onPress={() => {
                        onChange?.(
                          option.value,
                        );

                        setOpen(
                          false,
                        );
                      }}
                      style={[
                        styles.option,

                        active &&
                          styles.optionActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,

                          active &&
                            styles.optionTextActive,
                        ]}
                      >
                        {
                          option.label
                        }
                      </Text>

                      {active ? (
                        <MaterialIcons
                          name="check"
                          size={18}
                          color={
                            Brand.purple
                          }
                        />
                      ) : null}
                    </Pressable>
                  );
                },
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles =
  StyleSheet.create({
    wrap: {
      gap: 6,
    },

    label: {
      fontSize: 13,

      fontWeight: "700",

      color:
        Brand.purple,
    },

    control: {
      minHeight: 46,

      borderWidth: 1,

      borderColor:
        "#d9c4d2",

      borderRadius: 10,

      paddingHorizontal: 13,

      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "space-between",

      backgroundColor:
        "#fff",

      gap: 10,
    },

    controlText: {
      flex: 1,

      fontSize: 15,

      color:
        Brand.purple,
    },

    placeholder: {
      color:
        Brand.mauve,
    },

    disabled: {
      opacity: 0.5,
    },

    overlay: {
      flex: 1,

      backgroundColor:
        "rgba(30,16,35,0.42)",

      justifyContent:
        "center",

      padding: 20,
    },

    modal: {
      maxHeight: "70%",

      backgroundColor:
        "#fff",

      borderRadius: 20,

      padding: 16,

      gap: 10,
    },

    modalTitle: {
      fontSize: 17,

      fontWeight: "900",

      color:
        Brand.purple,
    },

    list: {
      maxHeight: 430,
    },

    listContent: {
      gap: 7,

      paddingBottom: 6,
    },

    option: {
      minHeight: 46,

      borderRadius: 12,

      borderWidth: 1,

      borderColor:
        "#ead7e3",

      paddingHorizontal: 12,

      flexDirection: "row",

      alignItems: "center",

      justifyContent:
        "space-between",

      backgroundColor:
        "#fff",
    },

    optionActive: {
      backgroundColor:
        "#fff4f9",

      borderColor:
        Brand.mauve,
    },

    optionText: {
      flex: 1,

      fontSize: 14,

      color:
        Brand.purple,
    },

    optionTextActive: {
      fontWeight: "800",
    },
  });