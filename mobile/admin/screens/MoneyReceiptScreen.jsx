import MaterialIcons
  from "@expo/vector-icons/MaterialIcons";

import {
  useRouter,
} from "expo-router";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AdminCard
  from "@/admin/components/AdminCard";

import AdminNotice
  from "@/admin/components/AdminNotice";

import AdminScreen
  from "@/admin/components/AdminScreen";

import AdminSelect
  from "@/admin/components/AdminSelect";

import {
  createMoneyReceipt,
  listConfirmedClients,
  previewMoneyReceiptResponse,
} from "@/admin/services/adminApi";

import {
  saveAndSharePdfResponse,
} from "@/admin/services/pdfFile";

import {
  BOOKING_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  blankMoneyReceiptForm,
  computePaymentSummary,
  toMoneyReceiptPayload,
  validateMoneyReceiptForm,
} from "@/admin/utils/moneyReceipt";

import {
  formatTaka,
} from "@/admin/utils/format";

import AppButton
  from "@/components/common/AppButton";

import AppInput
  from "@/components/common/AppInput";

import {
  Brand,
} from "@/constants/theme";

export default function MoneyReceiptScreen() {
  const router =
    useRouter();

  const [
    form,
    setForm,
  ] = useState(
    blankMoneyReceiptForm,
  );

  const [
    confirmedClients,
    setConfirmedClients,
  ] = useState([]);

  const [
    showSuggestions,
    setShowSuggestions,
  ] = useState(false);

  const [
    busy,
    setBusy,
  ] = useState("");

  const [
    notice,
    setNotice,
  ] = useState(null);

  useEffect(() => {
    listConfirmedClients()
      .then((rows) =>
        setConfirmedClients(
          Array.isArray(rows)
            ? rows
            : [],
        ),
      )
      .catch(() => {});
  }, []);

  const suggestions =
    useMemo(() => {
      const term =
        form.clientName
          .trim()
          .toLowerCase();

      return confirmedClients
        .filter(
          (client) =>
            !term ||
            String(
              client.clientName ||
                "",
            )
              .toLowerCase()
              .includes(term),
        )
        .slice(0, 8);
    }, [
      confirmedClients,
      form.clientName,
    ]);

  const summary =
    computePaymentSummary(
      form,
    );

  const update = (
    key,
    value,
  ) =>
    setForm(
      (current) => ({
        ...current,

        [key]: value,
      }),
    );

  function chooseClient(
    client,
  ) {
    setForm(
      (current) => ({
        ...current,

        clientName:
          client.clientName ||
          current.clientName,

        clientPhone:
          client.clientPhone ||
          current.clientPhone,

        eventDate:
          client.eventDate ||
          current.eventDate,

        eventVenue:
          client.eventVenue ||
          current.eventVenue,
      }),
    );

    setShowSuggestions(
      false,
    );
  }

  async function preview() {
    const validation =
      validateMoneyReceiptForm(
        form,
      );

    if (validation) {
      setNotice({
        type: "error",

        message:
          validation,
      });

      return;
    }

    setBusy("preview");

    setNotice(null);

    try {
      const response =
        await previewMoneyReceiptResponse(
          toMoneyReceiptPayload(
            form,
          ),
        );

      await saveAndSharePdfResponse(
        response,
        "money-receipt-preview.pdf",
      );
    } catch (error) {
      setNotice({
        type: "error",

        message:
          error.message ||
          "Unable to preview receipt.",
      });
    } finally {
      setBusy("");
    }
  }

  async function generate() {
    const validation =
      validateMoneyReceiptForm(
        form,
      );

    if (validation) {
      setNotice({
        type: "error",

        message:
          validation,
      });

      return;
    }

    setBusy("generate");

    setNotice(null);

    try {
      const created =
        await createMoneyReceipt(
          toMoneyReceiptPayload(
            form,
          ),
        );

      setNotice({
        type: "success",

        message:
          `Money receipt ${created.receiptNo || ""} generated successfully.`.trim(),
      });

      setForm(
        blankMoneyReceiptForm(),
      );

      router.push(
        "/admin/money-receipts/history",
      );
    } catch (error) {
      setNotice({
        type: "error",

        message:
          error.message ||
          "Unable to generate money receipt.",
      });
    } finally {
      setBusy("");
    }
  }

  return (
    <AdminScreen
      back
      title="Money Receipt Generator"
      subtitle="Create an official payment receipt for a client."
    >
      <AdminNotice
        type={
          notice?.type
        }
        message={
          notice?.message
        }
      />

      <AppButton
        title="Receipt History"
        variant="outline"
        onPress={() =>
          router.push(
            "/admin/money-receipts/history",
          )
        }
      />

      <AdminCard
        title="Receipt Information"
      >
        <AppInput
          label="Receipt Date"
          value={
            form.receiptDate
          }
          onChangeText={(
            value,
          ) =>
            update(
              "receiptDate",
              value,
            )
          }
          placeholder="YYYY-MM-DD"
        />

        <AppInput
          label="Receipt No."
          value="Generated automatically"
          editable={false}
        />
      </AdminCard>

      <AdminCard
        title="Client Information"
        subtitle="Confirmed clients from the Management Sheet are suggested automatically."
      >
        <AppInput
          label="Client Name"
          value={
            form.clientName
          }
          onChangeText={(
            value,
          ) => {
            update(
              "clientName",
              value,
            );

            setShowSuggestions(
              true,
            );
          }}
          onFocus={() =>
            setShowSuggestions(
              true,
            )
          }
          placeholder="e.g. John Doe"
        />

        {showSuggestions &&
        suggestions.length ? (
          <View
            style={
              styles.suggestions
            }
          >
            {suggestions.map(
              (client) => (
                <Pressable
                  key={
                    client.rowKey
                  }
                  style={
                    styles.suggestion
                  }
                  onPress={() =>
                    chooseClient(
                      client,
                    )
                  }
                >
                  <MaterialIcons
                    name="person"
                    size={17}
                    color={
                      Brand.plum
                    }
                  />

                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.suggestionName
                      }
                    >
                      {
                        client.clientName
                      }
                    </Text>

                    <Text
                      style={
                        styles.suggestionMeta
                      }
                    >
                      {[
                        client.clientPhone,

                        client.eventVenue,
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(
                          " · ",
                        )}
                    </Text>
                  </View>
                </Pressable>
              ),
            )}
          </View>
        ) : null}

        <AppInput
          label="Phone Number"
          keyboardType="phone-pad"
          value={
            form.clientPhone
          }
          onChangeText={(
            value,
          ) =>
            update(
              "clientPhone",
              value,
            )
          }
        />

        <AppInput
          label="Email (optional)"
          autoCapitalize="none"
          keyboardType="email-address"
          value={
            form.clientEmail
          }
          onChangeText={(
            value,
          ) =>
            update(
              "clientEmail",
              value,
            )
          }
        />

        <AppInput
          label="Address (optional)"
          value={
            form.clientAddress
          }
          onChangeText={(
            value,
          ) =>
            update(
              "clientAddress",
              value,
            )
          }
        />

        <AppInput
          label="Billed To (optional)"
          value={
            form.billedTo
          }
          onChangeText={(
            value,
          ) =>
            update(
              "billedTo",
              value,
            )
          }
        />
      </AdminCard>

      <AdminCard
        title="Event Information"
        subtitle="Optional"
      >
        <AppInput
          label="Event Name"
          value={
            form.eventName
          }
          onChangeText={(
            value,
          ) =>
            update(
              "eventName",
              value,
            )
          }
        />

        <AppInput
          label="Event Date"
          value={
            form.eventDate
          }
          onChangeText={(
            value,
          ) =>
            update(
              "eventDate",
              value,
            )
          }
          placeholder="YYYY-MM-DD"
        />

        <AppInput
          label="Venue"
          value={
            form.eventVenue
          }
          onChangeText={(
            value,
          ) =>
            update(
              "eventVenue",
              value,
            )
          }
        />

        <AppInput
          label="Booking / Reference ID"
          value={
            form.bookingReference
          }
          onChangeText={(
            value,
          ) =>
            update(
              "bookingReference",
              value,
            )
          }
        />

        <AdminSelect
          label="Booking Status"
          value={
            form.bookingStatus
          }
          options={
            BOOKING_STATUS_OPTIONS
          }
          onChange={(
            value,
          ) =>
            update(
              "bookingStatus",
              value,
            )
          }
        />
      </AdminCard>

      <AdminCard
        title="Payment Information"
      >
        <AppInput
          label="Total Payment (৳)"
          keyboardType="decimal-pad"
          value={
            form.totalPayment
          }
          onChangeText={(
            value,
          ) =>
            update(
              "totalPayment",
              value,
            )
          }
        />

        <AppInput
          label="Advance Payment (৳)"
          keyboardType="decimal-pad"
          value={
            form.advancePayment
          }
          onChangeText={(
            value,
          ) =>
            update(
              "advancePayment",
              value,
            )
          }
        />

        <AdminSelect
          label="Payment Method"
          value={
            form.paymentMethod
          }
          options={
            PAYMENT_METHOD_OPTIONS
          }
          onChange={(
            value,
          ) =>
            update(
              "paymentMethod",
              value,
            )
          }
        />

        {form.paymentMethod ===
        "other" ? (
          <AppInput
            label="Specify Method"
            value={
              form.paymentMethodOther
            }
            onChangeText={(
              value,
            ) =>
              update(
                "paymentMethodOther",
                value,
              )
            }
          />
        ) : null}

        <AppInput
          label="Transaction / Reference No. / Account No. (optional)"
          value={
            form.transactionReference
          }
          onChangeText={(
            value,
          ) =>
            update(
              "transactionReference",
              value,
            )
          }
        />

        <AppInput
          label="Remarks (optional)"
          multiline
          numberOfLines={4}
          value={
            form.remarks
          }
          onChangeText={(
            value,
          ) =>
            update(
              "remarks",
              value,
            )
          }
          style={{
            minHeight: 90,

            textAlignVertical:
              "top",
          }}
        />

        <View
          style={
            styles.summary
          }
        >
          <View
            style={
              styles.summaryCell
            }
          >
            <Text
              style={
                styles.summaryLabel
              }
            >
              Total
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              {formatTaka(
                Number(
                  form.totalPayment,
                ) || 0,
              )}
            </Text>
          </View>

          <View
            style={
              styles.summaryCell
            }
          >
            <Text
              style={
                styles.summaryLabel
              }
            >
              Advance
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              {formatTaka(
                Number(
                  form.advancePayment,
                ) || 0,
              )}
            </Text>
          </View>

          <View
            style={
              styles.summaryCell
            }
          >
            <Text
              style={
                styles.summaryLabel
              }
            >
              Due
            </Text>

            <Text
              style={
                styles.summaryValue
              }
            >
              {summary.duePayment ==
              null
                ? "—"
                : formatTaka(
                    summary.duePayment,
                  )}
            </Text>
          </View>
        </View>
      </AdminCard>

      <View
        style={
          styles.actions
        }
      >
        <AppButton
          title="Preview Receipt"
          variant="outline"
          onPress={preview}
          loading={
            busy ===
            "preview"
          }
          style={{
            flex: 1,
          }}
        />

        <AppButton
          title="Generate Money Receipt"
          onPress={
            generate
          }
          loading={
            busy ===
            "generate"
          }
          style={{
            flex: 1,
          }}
        />
      </View>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    suggestions: {
      borderWidth: 1,

      borderColor:
        "#ead7e3",

      borderRadius: 14,

      overflow:
        "hidden",

      backgroundColor:
        "#fff",
    },

    suggestion: {
      flexDirection: "row",

      alignItems: "center",

      gap: 8,

      padding: 10,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderColor:
        "#ead7e3",
    },

    suggestionName: {
      fontSize: 13,

      fontWeight: "900",

      color:
        Brand.purple,
    },

    suggestionMeta: {
      fontSize: 10.5,

      color:
        Brand.mauve,
    },

    summary: {
      flexDirection: "row",

      flexWrap: "wrap",

      gap: 8,

      marginTop: 3,
    },

    summaryCell: {
      flexGrow: 1,

      flexBasis: 120,

      borderRadius: 12,

      backgroundColor:
        "#fff4f9",

      borderWidth: 1,

      borderColor:
        "#ead7e3",

      padding: 10,

      gap: 2,
    },

    summaryLabel: {
      fontSize: 10,

      textTransform:
        "uppercase",

      fontWeight: "800",

      color:
        Brand.mauve,
    },

    summaryValue: {
      fontSize: 14,

      fontWeight: "900",

      color:
        Brand.purple,

      textTransform:
        "capitalize",
    },

    actions: {
      flexDirection: "row",

      gap: 8,
    },
  });