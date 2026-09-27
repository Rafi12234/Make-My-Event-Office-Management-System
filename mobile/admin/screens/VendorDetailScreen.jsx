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
  addDirectVendorCost,
  addDirectVendorPayment,
  loadVendorOutstandingItems,
  loadVendorProfile,
} from '@/admin/services/adminApi';

import {
  shareCsv,
} from '@/admin/services/pdfFile';

import {
  formatDate,
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

const today = () =>
  new Date()
    .toISOString()
    .slice(0, 10);

function DirectEntryForm({
  mode,
  vendorId,
  outstanding,
  onClose,
  onSaved,
  onError,
}) {
  const isPayment =
    mode === 'payment';

  const [
    amount,
    setAmount,
  ] = useState('');

  const [
    costDate,
    setCostDate,
  ] = useState(today());

  const [
    purpose,
    setPurpose,
  ] = useState(
    isPayment
      ? 'Company vendor payment'
      : 'Company vendor cost',
  );

  const [
    paymentStatus,
    setPaymentStatus,
  ] = useState(
    isPayment
      ? 'paid'
      : 'to_pay',
  );

  const [
    settlesItemId,
    setSettlesItemId,
  ] = useState('');

  const [
    busy,
    setBusy,
  ] = useState(false);

  const settlementOptions =
    useMemo(
      () => [
        {
          value: '',

          label:
            'Not linked to a specific outstanding bill',
        },

        ...(outstanding.length
          ? [
              {
                value:
                  'ALL',

                label:
                  `Settle ALL outstanding bills (${formatTaka(
                    outstanding.reduce(
                      (
                        s,
                        x,
                      ) =>
                        s +
                        Number(
                          x.stillOwed ||
                            0,
                        ),
                      0,
                    ),
                  )})`,
              },
            ]
          : []),

        ...outstanding.map(
          (bill) => ({
            value: String(
              bill.id,
            ),

            label:
              `${bill.purpose} · ${formatTaka(
                bill.stillOwed,
              )}${
                bill.eventClientName
                  ? ` · ${bill.eventClientName}`
                  : ''
              }`,
          }),
        ),
      ],
      [outstanding],
    );

  function chooseSettlement(
    value,
  ) {
    setSettlesItemId(
      value,
    );

    if (
      value === 'ALL'
    ) {
      setAmount(
        String(
          outstanding.reduce(
            (
              sum,
              bill,
            ) =>
              sum +
              Number(
                bill.stillOwed ||
                  0,
              ),
            0,
          ),
        ),
      );
    } else if (value) {
      const bill =
        outstanding.find(
          (item) =>
            String(
              item.id,
            ) ===
            String(value),
        );

      if (bill) {
        setAmount(
          String(
            bill.stillOwed,
          ),
        );
      }
    }
  }

  async function submit() {
    const numeric =
      Number(amount);

    if (
      !Number.isFinite(
        numeric,
      ) ||
      numeric <= 0
    ) {
      onError(
        'Enter an amount greater than zero.',
      );

      return;
    }

    setBusy(true);

    try {
      const payload = {
        amount: numeric,
        costDate,
        purpose:
          purpose.trim(),
      };

      if (isPayment) {
        payload.settlesItemId =
          settlesItemId ||
          null;
      } else {
        payload.paymentStatus =
          paymentStatus;
      }

      if (
        !isPayment &&
        paymentStatus ===
          'paid'
      ) {
        payload.settlesItemId =
          settlesItemId ||
          null;
      }

      if (isPayment) {
        await addDirectVendorPayment(
          vendorId,
          payload,
        );
      } else {
        await addDirectVendorCost(
          vendorId,
          payload,
        );
      }

      onSaved(
        isPayment
          ? 'Vendor payment recorded.'
          : 'Vendor cost recorded.',
      );
    } catch (error) {
      onError(
        error.message ||
          'Unable to record vendor transaction.',
      );
    } finally {
      setBusy(false);
    }
  }

  const needsSettlement =
    isPayment ||
    paymentStatus ===
      'paid';

  return (
    <>
      <AppInput
        label="Amount"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={
          setAmount
        }
        placeholder="0.00"
      />

      <AppInput
        label="Date"
        value={costDate}
        onChangeText={
          setCostDate
        }
        placeholder="YYYY-MM-DD"
      />

      <AppInput
        label="Purpose"
        value={purpose}
        onChangeText={
          setPurpose
        }
      />

      {!isPayment ? (
        <AdminSelect
          label="Payment Status"
          value={
            paymentStatus
          }
          onChange={(
            value,
          ) => {
            setPaymentStatus(
              value,
            );

            if (
              value !==
              'paid'
            ) {
              setSettlesItemId(
                '',
              );
            }
          }}
          options={[
            {
              value:
                'to_pay',

              label:
                'To Pay — create liability',
            },

            {
              value: 'paid',

              label:
                'Paid — company paid now',
            },
          ]}
        />
      ) : null}

      {needsSettlement ? (
        <AdminSelect
          label="Which outstanding bill is this settling? (optional)"
          value={
            settlesItemId
          }
          onChange={
            chooseSettlement
          }
          options={
            settlementOptions
          }
        />
      ) : null}

      <View
        style={
          styles.modalActions
        }
      >
        <AppButton
          title="Cancel"
          variant="outline"
          onPress={onClose}
          style={{
            flex: 1,
          }}
        />

        <AppButton
          title={
            isPayment
              ? 'Record Payment'
              : 'Record Cost'
          }
          loading={busy}
          onPress={submit}
          style={{
            flex: 1,
          }}
        />
      </View>
    </>
  );
}

export default function VendorDetailScreen() {
  const { id } =
    useLocalSearchParams();

  const [
    data,
    setData,
  ] = useState(null);

  const [
    outstanding,
    setOutstanding,
  ] = useState([]);

  const [
    filter,
    setFilter,
  ] = useState('all');

  const [
    modal,
    setModal,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    notice,
    setNotice,
  ] = useState(null);

  const load =
    useCallback(async () => {
      setLoading(true);

      try {
        const [
          profile,
          openBills,
        ] =
          await Promise.all([
            loadVendorProfile(
              id,
            ),

            loadVendorOutstandingItems(
              id,
            ),
          ]);

        setData(
          profile,
        );

        setOutstanding(
          openBills,
        );
      } catch (error) {
        setNotice({
          type: 'error',

          message:
            error.message ||
            'Unable to load vendor.',
        });
      } finally {
        setLoading(false);
      }
    }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const transactions =
    useMemo(() => {
      const rows =
        data?.transactions ||
        [];

      if (
        filter === 'all'
      ) {
        return rows;
      }

      if (
        filter ===
        'outstanding'
      ) {
        return rows.filter(
          (row) =>
            row.paymentStatus ===
            'to_pay',
        );
      }

      return rows.filter(
        (row) =>
          row.entryKind ===
          filter,
      );
    }, [data, filter]);

  async function exportRows() {
    try {
      await shareCsv(
        `vendor-${id}-transactions.csv`,
        [
          {
            label: 'Date',
            value: (r) =>
              r.costDate,
          },

          {
            label:
              'Purpose',
            value: (r) =>
              r.purpose,
          },

          {
            label:
              'Entry Kind',
            value: (r) =>
              r.entryKind,
          },

          {
            label:
              'Payment Status',
            value: (r) =>
              r.paymentStatus,
          },

          {
            label:
              'Amount',
            value: (r) =>
              r.amount,
          },

          {
            label:
              'Employee',
            value: (r) =>
              r.employeeName,
          },

          {
            label:
              'Event Client',
            value: (r) =>
              r.eventClientName,
          },

          {
            label:
              'Expense Status',
            value: (r) =>
              r.expenseStatus,
          },
        ],
        transactions,
      );
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error.message,
      });
    }
  }

  function saved(
    message,
  ) {
    setModal(null);

    setNotice({
      type: 'success',
      message,
    });

    load();
  }

  if (
    loading &&
    !data
  ) {
    return (
      <LoadingScreen message="Loading vendor ledger..." />
    );
  }

  const vendor =
    data?.vendor;

  return (
    <AdminScreen
      back
      title={
        vendor?.name ||
        'Vendor'
      }
      subtitle={
        vendor?.category ||
        'Vendor ledger and transaction history'
      }
    >
      <AdminNotice
        type={notice?.type}
        message={notice?.message}
      />

      {data ? (
        <>
          <View
            style={
              styles.stats
            }
          >
            <AdminCard
              style={
                styles.stat
              }
            >
              <Text
                style={
                  styles.statLabel
                }
              >
                Total billed
              </Text>

              <Text
                style={
                  styles.statValue
                }
              >
                {formatTaka(
                  data.totalBilled,
                )}
              </Text>
            </AdminCard>

            <AdminCard
              style={
                styles.stat
              }
            >
              <Text
                style={
                  styles.statLabel
                }
              >
                Total paid entries
              </Text>

              <Text
                style={
                  styles.statValue
                }
              >
                {formatTaka(
                  data.totalPaid,
                )}
              </Text>
            </AdminCard>

            <AdminCard
              style={
                styles.stat
              }
            >
              <Text
                style={
                  styles.statLabel
                }
              >
                Still to pay
              </Text>

              <Text
                style={
                  styles.statValue
                }
              >
                {formatTaka(
                  data.stillToPay,
                )}
              </Text>
            </AdminCard>
          </View>

          <AdminCard title="Vendor Details">
            <AdminKeyValue
              label="Status"
              value={
                vendor?.isActive
                  ? 'Active'
                  : 'Inactive'
              }
            />

            <AdminKeyValue
              label="Category"
              value={
                vendor?.category
              }
            />

            <AdminKeyValue
              label="Contact"
              value={
                vendor?.contactName
              }
            />

            <AdminKeyValue
              label="Phone"
              value={
                vendor?.contactPhone
              }
            />

            <AdminKeyValue
              label="Email"
              value={
                vendor?.contactEmail
              }
            />

            <AdminKeyValue
              label="Notes"
              value={
                vendor?.notes
              }
            />
          </AdminCard>

          <View
            style={
              styles.actions
            }
          >
            <AppButton
              title="Direct Cost"
              onPress={() =>
                setModal(
                  'cost',
                )
              }
              style={{
                flex: 1,
              }}
            />

            <AppButton
              title="Direct Payment"
              variant="secondary"
              onPress={() =>
                setModal(
                  'payment',
                )
              }
              style={{
                flex: 1,
              }}
            />
          </View>

          <AppButton
            title="Export Transactions CSV"
            variant="outline"
            onPress={
              exportRows
            }
          />

          <AdminCard
            title="Transaction Filters"
            subtitle={`${transactions.length} record(s)`}
          >
            <AdminSelect
              label="Type"
              value={filter}
              onChange={
                setFilter
              }
              options={[
                {
                  value: 'all',
                  label:
                    'All transactions',
                },

                {
                  value: 'cost',
                  label:
                    'Costs',
                },

                {
                  value:
                    'payment',

                  label:
                    'Payments',
                },

                {
                  value:
                    'outstanding',

                  label:
                    'Outstanding bills',
                },
              ]}
            />
          </AdminCard>

          <AdminCard title="Transaction History">
            {transactions.length ===
            0 ? (
              <Text
                style={
                  styles.empty
                }
              >
                No transactions
                match this
                filter.
              </Text>
            ) : null}

            {transactions.map(
              (row) => (
                <View
                  key={String(
                    row.id,
                  )}
                  style={
                    styles.txn
                  }
                >
                  <View
                    style={
                      styles.txnTop
                    }
                  >
                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        style={
                          styles.txnTitle
                        }
                      >
                        {
                          row.purpose
                        }
                      </Text>

                      <Text
                        style={
                          styles.txnMeta
                        }
                      >
                        {formatDate(
                          row.costDate,
                        )}{' '}
                        ·{' '}
                        {row.entryKind ===
                        'payment'
                          ? 'Payment'
                          : 'Cost'}{' '}
                        ·{' '}
                        {row.paymentStatus ||
                          '—'}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.txnAmount,

                        row.entryKind ===
                          'payment' &&
                          styles.paid,
                      ]}
                    >
                      {row.entryKind ===
                      'payment'
                        ? '+'
                        : '-'}
                      {formatTaka(
                        row.amount,
                      )}
                    </Text>
                  </View>

                  {row.eventClientName ? (
                    <Text
                      style={
                        styles.txnDetail
                      }
                    >
                      Event:{' '}
                      {
                        row.eventClientName
                      }
                      {row.eventDate
                        ? ` · ${formatDate(
                            row.eventDate,
                          )}`
                        : ''}
                    </Text>
                  ) : null}

                  <Text
                    style={
                      styles.txnDetail
                    }
                  >
                    {row.employeeName
                      ? `Employee: ${row.employeeName}`
                      : row.createdByAdminName
                        ? `Admin: ${row.createdByAdminName}`
                        : 'Company direct'}{' '}
                    · Expense #
                    {
                      row.expenseId
                    }
                  </Text>

                  {row.settlesItemId ? (
                    <Text
                      style={
                        styles.txnDetail
                      }
                    >
                      Settles bill #
                      {
                        row.settlesItemId
                      }
                    </Text>
                  ) : row.settlesAllOwed ? (
                    <Text
                      style={
                        styles.txnDetail
                      }
                    >
                      Settles all
                      outstanding
                      bills
                    </Text>
                  ) : null}

                  <Text
                    style={
                      styles.txnDetail
                    }
                  >
                    Updated{' '}
                    {formatDateTime(
                      row.updatedAt,
                    )}
                  </Text>
                </View>
              ),
            )}
          </AdminCard>
        </>
      ) : null}

      <AdminModal
        visible={Boolean(
          modal,
        )}
        title={
          modal ===
          'payment'
            ? 'Direct Vendor Payment'
            : 'Direct Vendor Cost'
        }
        subtitle={
          vendor?.name
        }
        onClose={() =>
          setModal(null)
        }
      >
        {modal ? (
          <DirectEntryForm
            mode={modal}
            vendorId={id}
            outstanding={
              outstanding
            }
            onClose={() =>
              setModal(null)
            }
            onSaved={
              saved
            }
            onError={(
              message,
            ) =>
              setNotice({
                type: 'error',
                message,
              })
            }
          />
        ) : null}
      </AdminModal>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    stats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    stat: {
      flexGrow: 1,
      flexBasis: 140,
      padding: 12,
    },

    statLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: Brand.mauve,
    },

    statValue: {
      fontSize: 18,
      fontWeight: '900',
      color: Brand.purple,
    },

    actions: {
      flexDirection: 'row',
      gap: 8,
    },

    modalActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },

    empty: {
      textAlign: 'center',
      color: Brand.mauve,
      paddingVertical: 16,
    },

    txn: {
      gap: 4,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        '#ead7e3',
      paddingVertical: 11,
    },

    txnTop: {
      flexDirection: 'row',
      alignItems:
        'flex-start',
      gap: 10,
    },

    txnTitle: {
      fontSize: 13,
      fontWeight: '900',
      color: Brand.purple,
    },

    txnMeta: {
      fontSize: 10.5,
      color: Brand.mauve,
      marginTop: 2,
      textTransform:
        'capitalize',
    },

    txnAmount: {
      fontSize: 13,
      fontWeight: '900',
      color: '#a52929',
    },

    paid: {
      color: '#246b37',
    },

    txnDetail: {
      fontSize: 10.5,
      color: Brand.plum,
    },
  });