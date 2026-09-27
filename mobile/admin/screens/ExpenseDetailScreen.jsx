import {
  useLocalSearchParams,
} from 'expo-router';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AdminCard
  from '@/admin/components/AdminCard';

import AdminKeyValue
  from '@/admin/components/AdminKeyValue';

import AdminModal
  from '@/admin/components/AdminModal';

import AdminNotice
  from '@/admin/components/AdminNotice';

import AdminScreen
  from '@/admin/components/AdminScreen';

import AdminSelect
  from '@/admin/components/AdminSelect';

import {
  loadExpense,
  loadVendorOutstandingItems,
  loadVendors,
  previewExpenseUpdate,
  updateExpense,
  voidExpense,
} from '@/admin/services/adminApi';

import {
  formatDateTime,
  formatTaka,
} from '@/admin/utils/format';

import AppButton
  from '@/components/common/AppButton';

import AppInput
  from '@/components/common/AppInput';

import LoadingScreen
  from '@/components/common/LoadingScreen';

import {
  Brand,
} from '@/constants/theme';

export default function ExpenseDetailScreen() {
  const { id } =
    useLocalSearchParams();

  const [
    expense,
    setExpense,
  ] = useState(null);

  const [
    vendors,
    setVendors,
  ] = useState([]);

  const [
    draft,
    setDraft,
  ] = useState([]);

  const [
    preview,
    setPreview,
  ] = useState(null);

  const [
    reason,
    setReason,
  ] = useState('');

  const [
    voidOpen,
    setVoidOpen,
  ] = useState(false);

  const [
    voidReason,
    setVoidReason,
  ] = useState('');

  const [
    notice,
    setNotice,
  ] = useState(null);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    outstanding,
    setOutstanding,
  ] = useState({});

  const load =
    useCallback(async () => {
      try {
        const [
          e,
          v,
        ] =
          await Promise.all([
            loadExpense(id),

            loadVendors({
              includeInactive:
                true,
            }),
          ]);

        setExpense(e);

        setDraft(
          (e.items || []).map(
            (x) => ({
              ...x,

              quantity:
                String(
                  x.quantity,
                ),

              perQtyAmount:
                String(
                  x.perQtyAmount,
                ),

              vendorId:
                x.vendorId ||
                '',

              paymentStatus:
                x.paymentStatus ||
                '',

              settlesItemId:
                x.settlesAllOwed
                  ? 'ALL'
                  : x.settlesItemId ||
                    '',
            }),
          ),
        );

        setVendors(v);
      } catch (err) {
        setNotice({
          type: 'error',
          message:
            err.message,
        });
      }
    }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    for (
      const item
      of draft
    ) {
      if (
        item.vendorId &&
        item.paymentStatus ===
          'paid' &&
        !outstanding[
          item.vendorId
        ]
      ) {
        loadVendorOutstandingItems(
          item.vendorId,
        )
          .then((list) =>
            setOutstanding(
              (o) => ({
                ...o,

                [item.vendorId]:
                  list,
              }),
            ),
          )
          .catch(() => {});
      }
    }
  }, [draft]);

  const total =
    useMemo(
      () =>
        draft.reduce(
          (s, x) =>
            s +
            (Number(
              x.quantity,
            ) ||
              0) *
              (Number(
                x.perQtyAmount,
              ) ||
                0),
          0,
        ),
      [draft],
    );

  function updateItem(
    i,
    key,
    value,
  ) {
    setDraft((d) =>
      d.map(
        (x, idx) =>
          idx === i
            ? {
                ...x,

                [key]:
                  value,

                ...(key ===
                  'vendorId' &&
                !value
                  ? {
                      paymentStatus:
                        '',

                      settlesItemId:
                        '',
                    }
                  : {}),

                ...(key ===
                  'paymentStatus' &&
                value !==
                  'paid'
                  ? {
                      settlesItemId:
                        '',
                    }
                  : {}),
              }
            : x,
      ),
    );
  }

  function payload() {
    return draft.map(
      (x) => ({
        id: x.id,

        purpose:
          x.purpose,

        costDate:
          x.costDate,

        quantity:
          Number(
            x.quantity,
          ),

        perQtyAmount:
          Number(
            x.perQtyAmount,
          ),

        vendorId:
          x.vendorId ||
          null,

        paymentStatus:
          x.vendorId
            ? x.paymentStatus ||
              null
            : null,

        settlesItemId:
          x.vendorId &&
          x.paymentStatus ===
            'paid'
            ? x.settlesItemId ||
              null
            : null,
      }),
    );
  }

  async function doPreview() {
    setBusy(true);

    try {
      setPreview(
        await previewExpenseUpdate(
          id,
          payload(),
        ),
      );

      setReason('');
    } catch (e) {
      setNotice({
        type: 'error',
        message: e.message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);

    try {
      await updateExpense(
        id,
        {
          items:
            payload(),

          reason,
        },
      );

      setPreview(null);

      setNotice({
        type: 'success',

        message:
          'Expense corrected and balances adjusted.',
      });

      await load();
    } catch (e) {
      setNotice({
        type: 'error',
        message: e.message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function doVoid() {
    setBusy(true);

    try {
      const result =
        await voidExpense(
          id,
          voidReason,
        );

      setVoidOpen(false);

      setNotice({
        type: 'success',

        message:
          `Expense voided. Wallet adjusted by ${formatTaka(
            result.walletChange ||
              0,
          )}.`,
      });

      await load();
    } catch (e) {
      setNotice({
        type: 'error',
        message: e.message,
      });
    } finally {
      setBusy(false);
    }
  }

  if (
    !expense &&
    !notice
  ) {
    return (
      <LoadingScreen message="Loading expense..." />
    );
  }

  const readOnly =
    expense?.status ===
    'void';

  const vOpts = [
    {
      value: '',
      label:
        'No vendor',
    },

    ...vendors.map(
      (v) => ({
        value: String(
          v.id,
        ),

        label:
          v.name,
      }),
    ),
  ];

  return (
    <AdminScreen
      back
      title={`Expense #${id}`}
      subtitle={
        expense?.employeeName ||
        'Company / Admin direct'
      }
    >
      <AdminNotice
        type={notice?.type}
        message={notice?.message}
      />

      {expense ? (
        <>
          <AdminCard title="Financial Summary">
            <AdminKeyValue
              label="Recorded cost"
              value={formatTaka(
                expense.recordedTotalAmount,
              )}
            />

            <AdminKeyValue
              label="Actually paid"
              value={formatTaka(
                expense.walletDeductionAmount,
              )}
            />

            <AdminKeyValue
              label="Still to pay"
              value={formatTaka(
                expense.vendorPayableAmount,
              )}
            />

            <AdminKeyValue
              label="Draft total"
              value={formatTaka(
                total,
              )}
            />

            <AdminKeyValue
              label="Status"
              value={
                expense.status
              }
            />

            <AdminKeyValue
              label="Approval"
              value={
                expense.approved
                  ? 'Approved'
                  : 'Pending approval'
              }
            />

            <AdminKeyValue
              label="Submitted"
              value={formatDateTime(
                expense.createdAt,
              )}
            />

            {expense.voidReason ? (
              <AdminKeyValue
                label="Void reason"
                value={
                  expense.voidReason
                }
              />
            ) : null}
          </AdminCard>

          <AdminCard
            title="Expense items"
            subtitle="Editing changes the wallet/vendor impact only after preview + confirmation."
          >
            {draft.map(
              (
                item,
                i,
              ) => (
                <View
                  key={item.id}
                  style={
                    styles.item
                  }
                >
                  <AppInput
                    label="Purpose"
                    editable={
                      !readOnly
                    }
                    value={
                      item.purpose ||
                      ''
                    }
                    onChangeText={(
                      v,
                    ) =>
                      updateItem(
                        i,
                        'purpose',
                        v,
                      )
                    }
                  />

                  <AppInput
                    label="Cost date"
                    editable={
                      !readOnly
                    }
                    value={
                      item.costDate ||
                      ''
                    }
                    onChangeText={(
                      v,
                    ) =>
                      updateItem(
                        i,
                        'costDate',
                        v,
                      )
                    }
                  />

                  <View
                    style={
                      styles.two
                    }
                  >
                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <AppInput
                        label="Quantity"
                        editable={
                          !readOnly
                        }
                        keyboardType="decimal-pad"
                        value={
                          item.quantity
                        }
                        onChangeText={(
                          v,
                        ) =>
                          updateItem(
                            i,
                            'quantity',
                            v,
                          )
                        }
                      />
                    </View>

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <AppInput
                        label="Per qty amount"
                        editable={
                          !readOnly
                        }
                        keyboardType="decimal-pad"
                        value={
                          item.perQtyAmount
                        }
                        onChangeText={(
                          v,
                        ) =>
                          updateItem(
                            i,
                            'perQtyAmount',
                            v,
                          )
                        }
                      />
                    </View>
                  </View>

                  <AdminSelect
                    label="Vendor"
                    disabled={
                      readOnly
                    }
                    value={
                      item.vendorId
                    }
                    options={
                      vOpts
                    }
                    onChange={(v) =>
                      updateItem(
                        i,
                        'vendorId',
                        v,
                      )
                    }
                  />

                  {item.vendorId ? (
                    <AdminSelect
                      label="Payment status"
                      disabled={
                        readOnly
                      }
                      value={
                        item.paymentStatus
                      }
                      options={[
                        {
                          value:
                            'to_pay',

                          label:
                            'To Pay',
                        },

                        {
                          value:
                            'paid',

                          label:
                            'Paid',
                        },
                      ]}
                      onChange={(v) =>
                        updateItem(
                          i,
                          'paymentStatus',
                          v,
                        )
                      }
                    />
                  ) : null}

                  {item.vendorId &&
                  item.paymentStatus ===
                    'paid' ? (
                    <AdminSelect
                      label="Which bill is this settling?"
                      disabled={
                        readOnly
                      }
                      value={
                        item.settlesItemId
                      }
                      options={[
                        {
                          value:
                            '',

                          label:
                            'Standalone payment',
                        },

                        {
                          value:
                            'ALL',

                          label:
                            'Settle all outstanding',
                        },

                        ...(
                          outstanding[
                            item
                              .vendorId
                          ] || []
                        ).map(
                          (b) => ({
                            value:
                              String(
                                b.id,
                              ),

                            label:
                              `#${b.id} ${b.purpose} · ${formatTaka(
                                b.stillOwed,
                              )}`,
                          }),
                        ),
                      ]}
                      onChange={(v) =>
                        updateItem(
                          i,
                          'settlesItemId',
                          v,
                        )
                      }
                    />
                  ) : null}

                  <Text
                    style={
                      styles.lineTotal
                    }
                  >
                    Line total{' '}
                    {formatTaka(
                      (Number(
                        item.quantity,
                      ) ||
                        0) *
                        (Number(
                          item.perQtyAmount,
                        ) ||
                          0),
                    )}
                  </Text>
                </View>
              ),
            )}
          </AdminCard>

          {!readOnly ? (
            <View
              style={
                styles.actions
              }
            >
              <AppButton
                title="Preview Changes"
                onPress={
                  doPreview
                }
                loading={busy}
                style={{
                  flex: 1,
                }}
              />

              <AppButton
                title="Void Expense"
                variant="danger"
                onPress={() =>
                  setVoidOpen(
                    true,
                  )
                }
                style={{
                  flex: 1,
                }}
              />
            </View>
          ) : null}
        </>
      ) : null}

      <AdminModal
        visible={Boolean(
          preview,
        )}
        title="Confirm financial correction"
        onClose={() =>
          setPreview(null)
        }
      >
        {preview ? (
          <>
            <AdminKeyValue
              label="Old Expense"
              value={formatTaka(
                preview.oldTotal,
              )}
            />

            <AdminKeyValue
              label="New Expense"
              value={formatTaka(
                preview.newTotal,
              )}
            />

            <AdminKeyValue
              label="Wallet change"
              value={formatTaka(
                preview.walletChange,
              )}
            />

            {(preview.vendorImpact ||
              []).map((v) => (
              <AdminKeyValue
                key={v.vendorId}
                label={
                  v.vendorName ||
                  `Vendor ${v.vendorId}`
                }
                value={formatTaka(
                  v.delta,
                )}
              />
            ))}

            <AppInput
              label="Reason for correction"
              value={reason}
              onChangeText={
                setReason
              }
            />

            <AppButton
              title="Save Changes"
              onPress={save}
              loading={busy}
            />
          </>
        ) : null}
      </AdminModal>

      <AdminModal
        visible={voidOpen}
        title="Void this expense?"
        subtitle="The financial effect is reversed but the audit record remains."
        onClose={() =>
          setVoidOpen(false)
        }
      >
        <AppInput
          label="Reason"
          value={voidReason}
          onChangeText={
            setVoidReason
          }
        />

        <AppButton
          title="Void Expense"
          variant="danger"
          onPress={
            doVoid
          }
          loading={busy}
        />
      </AdminModal>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    item: {
      gap: 9,
      paddingVertical: 12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        '#ead7e3',
    },

    two: {
      flexDirection: 'row',
      gap: 8,
    },

    lineTotal: {
      fontSize: 12,
      fontWeight: '900',
      color: Brand.plum,
    },

    actions: {
      flexDirection: 'row',
      gap: 8,
    },
  });