import MaterialIcons
  from '@expo/vector-icons/MaterialIcons';

import {
  useRouter,
} from 'expo-router';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  Pressable,
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
  archiveMoneyReceipt,
  downloadMoneyReceiptResponse,
  getMoneyReceipt,
  listMoneyReceipts,
} from '@/admin/services/adminApi';

import {
  saveAndSharePdfResponse,
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

const EMPTY = {
  search: '',
  paymentStatus: '',
  status: '',
  dateFrom: '',
  dateTo: '',
};

export default function MoneyReceiptHistoryScreen() {
  const router =
    useRouter();

  const [
    filters,
    setFilters,
  ] = useState(
    EMPTY,
  );

  const [
    receipts,
    setReceipts,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    busyId,
    setBusyId,
  ] = useState(null);

  const [
    notice,
    setNotice,
  ] = useState(null);

  const [
    detail,
    setDetail,
  ] = useState(null);

  const load =
    useCallback(async () => {
      setLoading(true);

      setNotice(null);

      try {
        setReceipts(
          await listMoneyReceipts(
            filters,
          ),
        );
      } catch (error) {
        setNotice({
          type: 'error',

          message:
            error.message ||
            'Could not load money receipts.',
        });
      } finally {
        setLoading(false);
      }
    }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function openPdf(
    receipt,
  ) {
    setBusyId(
      String(receipt.id),
    );

    try {
      const response =
        await downloadMoneyReceiptResponse(
          receipt.id,
        );

      await saveAndSharePdfResponse(
        response,
        `${String(
          receipt.receiptNo ||
            `receipt-${receipt.id}`,
        ).replace(
          /[^a-zA-Z0-9._-]+/g,
          '-',
        )}.pdf`,
      );
    } catch (error) {
      setNotice({
        type: 'error',

        message:
          error.message ||
          'Unable to open this receipt.',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function viewDetail(
    receipt,
  ) {
    setBusyId(
      String(receipt.id),
    );

    try {
      setDetail(
        await getMoneyReceipt(
          receipt.id,
        ),
      );
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error.message,
      });
    } finally {
      setBusyId(null);
    }
  }

  async function archive(
    receipt,
  ) {
    setBusyId(
      String(receipt.id),
    );

    try {
      const updated =
        await archiveMoneyReceipt(
          receipt.id,
        );

      setReceipts(
        (current) =>
          current.map(
            (item) =>
              String(
                item.id,
              ) ===
              String(
                receipt.id,
              )
                ? updated
                : item,
          ),
      );

      setNotice({
        type: 'success',

        message:
          `${receipt.receiptNo || 'Receipt'} archived.`,
      });
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error.message,
      });
    } finally {
      setBusyId(null);
    }
  }

  async function exportRows() {
    try {
      await shareCsv(
        'mme-money-receipt-history.csv',
        [
          {
            label:
              'Receipt No',

            value: (r) =>
              r.receiptNo,
          },

          {
            label:
              'Receipt Date',

            value: (r) =>
              r.receiptDate,
          },

          {
            label: 'Client',

            value: (r) =>
              r.clientName,
          },

          {
            label: 'Phone',

            value: (r) =>
              r.clientPhone,
          },

          {
            label: 'Total',

            value: (r) =>
              r.totalPayment,
          },

          {
            label:
              'Advance',

            value: (r) =>
              r.advancePayment,
          },

          {
            label: 'Due',

            value: (r) =>
              r.duePayment,
          },

          {
            label:
              'Payment Status',

            value: (r) =>
              r.paymentStatus,
          },

          {
            label:
              'Record Status',

            value: (r) =>
              r.status,
          },

          {
            label:
              'Generated At',

            value: (r) =>
              r.generatedAt,
          },
        ],
        receipts,
      );
    } catch (error) {
      setNotice({
        type: 'error',
        message:
          error.message,
      });
    }
  }

  if (
    loading &&
    receipts.length ===
      0
  ) {
    return (
      <LoadingScreen message="Loading receipt history..." />
    );
  }

  return (
    <AdminScreen
      back
      title="Receipt History"
      subtitle="Every money receipt generated, newest first."
    >
      <AdminNotice
        type={notice?.type}
        message={notice?.message}
      />

      <View
        style={styles.actions}
      >
        <AppButton
          title="New Receipt"
          onPress={() =>
            router.push(
              '/admin/money-receipts',
            )
          }
          style={{
            flex: 1,
          }}
        />

        <AppButton
          title="Export CSV"
          variant="outline"
          onPress={
            exportRows
          }
          style={{
            flex: 1,
          }}
        />
      </View>

      <AdminCard title="Filters">
        <AppInput
          label="Search"
          placeholder="Receipt no / client / phone"
          value={
            filters.search
          }
          onChangeText={(v) =>
            setFilters(
              (f) => ({
                ...f,
                search: v,
              }),
            )
          }
        />

        <AdminSelect
          label="Payment Status"
          value={
            filters.paymentStatus
          }
          onChange={(v) =>
            setFilters(
              (f) => ({
                ...f,

                paymentStatus:
                  v,
              }),
            )
          }
          options={[
            {
              value: '',

              label:
                'All Payment Status',
            },

            {
              value: 'paid',

              label: 'Paid',
            },

            {
              value:
                'partially_paid',

              label:
                'Partially Paid',
            },

            {
              value: 'unpaid',

              label:
                'Unpaid',
            },
          ]}
        />

        <AdminSelect
          label="Record Status"
          value={
            filters.status
          }
          onChange={(v) =>
            setFilters(
              (f) => ({
                ...f,
                status: v,
              }),
            )
          }
          options={[
            {
              value: '',

              label:
                'All Statuses',
            },

            {
              value:
                'generated',

              label:
                'Generated',
            },

            {
              value:
                'archived',

              label:
                'Archived',
            },
          ]}
        />

        <View
          style={styles.actions}
        >
          <View
            style={{
              flex: 1,
            }}
          >
            <AppInput
              label="From"
              value={
                filters.dateFrom
              }
              onChangeText={(v) =>
                setFilters(
                  (f) => ({
                    ...f,

                    dateFrom:
                      v,
                  }),
                )
              }
              placeholder="YYYY-MM-DD"
            />
          </View>

          <View
            style={{
              flex: 1,
            }}
          >
            <AppInput
              label="To"
              value={
                filters.dateTo
              }
              onChangeText={(v) =>
                setFilters(
                  (f) => ({
                    ...f,

                    dateTo:
                      v,
                  }),
                )
              }
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>

        <AppButton
          title="Clear Filters"
          variant="outline"
          onPress={() =>
            setFilters(
              EMPTY,
            )
          }
        />
      </AdminCard>

      <AdminCard
        title="Receipts"
        subtitle={`${receipts.length} record(s)`}
      >
        {receipts.length ===
        0 ? (
          <Text
            style={
              styles.empty
            }
          >
            No receipts match
            the current
            filters.
          </Text>
        ) : null}

        {receipts.map(
          (receipt) => (
            <View
              key={String(
                receipt.id,
              )}
              style={
                styles.row
              }
            >
              <View
                style={
                  styles.rowTop
                }
              >
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <Text
                    style={
                      styles.number
                    }
                  >
                    {receipt.receiptNo ||
                      `Receipt #${receipt.id}`}
                  </Text>

                  <Text
                    style={
                      styles.meta
                    }
                  >
                    {formatDate(
                      receipt.receiptDate,
                    )}{' '}
                    ·{' '}
                    {
                      receipt.clientName
                    }{' '}
                    ·{' '}
                    {
                      receipt.clientPhone
                    }
                  </Text>

                  <Text
                    style={
                      styles.money
                    }
                  >
                    Total{' '}
                    {formatTaka(
                      receipt.totalPayment,
                    )}{' '}
                    · Advance{' '}
                    {formatTaka(
                      receipt.advancePayment,
                    )}{' '}
                    · Due{' '}
                    {formatTaka(
                      receipt.duePayment,
                    )}
                  </Text>

                  <Text
                    style={
                      styles.meta
                    }
                  >
                    {String(
                      receipt.paymentStatus ||
                        '',
                    ).replaceAll(
                      '_',
                      ' ',
                    )}{' '}
                    ·{' '}
                    {
                      receipt.status
                    }{' '}
                    ·{' '}
                    {receipt.paymentMethodLabel ||
                      receipt.paymentMethod ||
                      '—'}
                  </Text>
                </View>

                <MaterialIcons
                  name="receipt-long"
                  size={22}
                  color={
                    Brand.plum
                  }
                />
              </View>

              <View
                style={
                  styles.rowButtons
                }
              >
                <Pressable
                  style={
                    styles.mini
                  }
                  disabled={
                    busyId ===
                    String(
                      receipt.id,
                    )
                  }
                  onPress={() =>
                    viewDetail(
                      receipt,
                    )
                  }
                >
                  <MaterialIcons
                    name="visibility"
                    size={15}
                    color={
                      Brand.purple
                    }
                  />

                  <Text
                    style={
                      styles.miniText
                    }
                  >
                    Details
                  </Text>
                </Pressable>

                <Pressable
                  style={
                    styles.mini
                  }
                  disabled={
                    busyId ===
                    String(
                      receipt.id,
                    )
                  }
                  onPress={() =>
                    openPdf(
                      receipt,
                    )
                  }
                >
                  <MaterialIcons
                    name="picture-as-pdf"
                    size={15}
                    color={
                      Brand.purple
                    }
                  />

                  <Text
                    style={
                      styles.miniText
                    }
                  >
                    Open / Share PDF
                  </Text>
                </Pressable>

                {receipt.status !==
                'archived' ? (
                  <Pressable
                    style={
                      styles.mini
                    }
                    disabled={
                      busyId ===
                      String(
                        receipt.id,
                      )
                    }
                    onPress={() =>
                      archive(
                        receipt,
                      )
                    }
                  >
                    <MaterialIcons
                      name="archive"
                      size={15}
                      color="#a52929"
                    />

                    <Text
                      style={
                        styles.miniText
                      }
                    >
                      Archive
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ),
        )}
      </AdminCard>

      <AdminModal
        visible={Boolean(
          detail,
        )}
        title={
          detail?.receiptNo ||
          'Receipt Details'
        }
        onClose={() =>
          setDetail(null)
        }
      >
        {detail ? (
          <>
            <AdminKeyValue
              label="Receipt Date"
              value={formatDate(
                detail.receiptDate,
              )}
            />

            <AdminKeyValue
              label="Client"
              value={
                detail.clientName
              }
            />

            <AdminKeyValue
              label="Phone"
              value={
                detail.clientPhone
              }
            />

            <AdminKeyValue
              label="Email"
              value={
                detail.clientEmail
              }
            />

            <AdminKeyValue
              label="Address"
              value={
                detail.clientAddress
              }
            />

            <AdminKeyValue
              label="Billed To"
              value={
                detail.billedTo
              }
            />

            <AdminKeyValue
              label="Event"
              value={
                detail.eventName
              }
            />

            <AdminKeyValue
              label="Event Date"
              value={formatDate(
                detail.eventDate,
              )}
            />

            <AdminKeyValue
              label="Venue"
              value={
                detail.eventVenue
              }
            />

            <AdminKeyValue
              label="Booking Ref"
              value={
                detail.bookingReference
              }
            />

            <AdminKeyValue
              label="Booking Status"
              value={String(
                detail.bookingStatus ||
                  '',
              ).replaceAll(
                '_',
                ' ',
              )}
            />

            <AdminKeyValue
              label="Total"
              value={formatTaka(
                detail.totalPayment,
              )}
            />

            <AdminKeyValue
              label="Advance"
              value={formatTaka(
                detail.advancePayment,
              )}
            />

            <AdminKeyValue
              label="Due"
              value={formatTaka(
                detail.duePayment,
              )}
            />

            <AdminKeyValue
              label="Payment Status"
              value={String(
                detail.paymentStatus ||
                  '',
              ).replaceAll(
                '_',
                ' ',
              )}
            />

            <AdminKeyValue
              label="Payment Method"
              value={
                detail.paymentMethodOther ||
                detail.paymentMethod
              }
            />

            <AdminKeyValue
              label="Transaction Ref"
              value={
                detail.transactionReference
              }
            />

            <AdminKeyValue
              label="Remarks"
              value={
                detail.remarks
              }
            />

            <AdminKeyValue
              label="Created By"
              value={
                detail.createdByName
              }
            />

            <AdminKeyValue
              label="Generated"
              value={formatDateTime(
                detail.generatedAt,
              )}
            />

            <AdminKeyValue
              label="Status"
              value={
                detail.status
              }
            />

            <AppButton
              title="Open / Share PDF"
              onPress={() =>
                openPdf(
                  detail,
                )
              }
            />
          </>
        ) : null}
      </AdminModal>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    actions: {
      flexDirection: 'row',
      gap: 8,
    },

    empty: {
      textAlign: 'center',
      paddingVertical: 18,
      color: Brand.mauve,
    },

    row: {
      gap: 8,
      paddingVertical: 11,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        '#ead7e3',
    },

    rowTop: {
      flexDirection: 'row',
      alignItems:
        'flex-start',
      gap: 10,
    },

    number: {
      fontSize: 13.5,
      fontWeight: '900',
      color: Brand.purple,
    },

    meta: {
      fontSize: 10.5,
      color: Brand.mauve,
      marginTop: 2,
      textTransform:
        'capitalize',
    },

    money: {
      fontSize: 11,
      fontWeight: '800',
      color: Brand.plum,
      marginTop: 3,
    },

    rowButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },

    mini: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor:
        '#ead7e3',
      borderRadius: 9,
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor:
        '#fff',
    },

    miniText: {
      fontSize: 10.5,
      fontWeight: '800',
      color: Brand.purple,
    },
  });