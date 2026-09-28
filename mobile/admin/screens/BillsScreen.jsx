import MaterialIcons
  from '@expo/vector-icons/MaterialIcons';

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

import {
  useRouter,
} from 'expo-router';

import AdminCard
  from '@/admin/components/AdminCard';

import AdminNotice
  from '@/admin/components/AdminNotice';

import AdminScreen
  from '@/admin/components/AdminScreen';

import {
  approveExpense,
  loadExpenses,
} from '@/admin/services/adminApi';

import {
  formatDateTime,
  formatTaka,
} from '@/admin/utils/format';

import AppButton
  from '@/components/common/AppButton';

import LoadingScreen
  from '@/components/common/LoadingScreen';

import {
  Brand,
} from '@/constants/theme';

export default function BillsScreen() {
  const router =
    useRouter();

  const [
    tab,
    setTab,
  ] = useState(
    'event',
  );

  const [
    eventRows,
    setEventRows,
  ] = useState([]);

  const [
    regularRows,
    setRegularRows,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    busyId,
    setBusyId,
  ] = useState('');

  const [
    notice,
    setNotice,
  ] = useState(null);

  const load =
    useCallback(async () => {
      setLoading(true);

      try {
        const base = {
          pendingApproval:
            true,

          approved:
            'false',

          status:
            'active',

          page: 1,

          pageSize:
            100,
        };

        const [
          e,
          r,
        ] =
          await Promise.all([
            loadExpenses({
              ...base,
              costType:
                'event',
            }),

            loadExpenses({
              ...base,
              costType:
                'regular',
            }),
          ]);

        setEventRows(
          e.rows || [],
        );

        setRegularRows(
          r.rows || [],
        );
      } catch (e) {
        setNotice({
          type: 'error',
          message: e.message,
        });
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(
    row,
  ) {
    setBusyId(row.id);

    try {
      await approveExpense(
        row.id,
      );

      setNotice({
        type: 'success',

        message:
          `Expense #${row.id} approved.`,
      });

      await load();
    } catch (e) {
      setNotice({
        type: 'error',
        message: e.message,
      });
    } finally {
      setBusyId('');
    }
  }

  if (
    loading &&
    !eventRows.length &&
    !regularRows.length
  ) {
    return (
      <LoadingScreen message="Loading pending bills..." />
    );
  }

  const rows =
    tab === 'event'
      ? eventRows
      : regularRows;

  return (
    <AdminScreen
      back
      title="Bills"
      subtitle="Pending employee expenses waiting for admin approval."
    >
      <AdminNotice
        type={notice?.type}
        message={notice?.message}
      />

      <View
        style={styles.tabs}
      >
        <Pressable
          style={[
            styles.tab,

            tab ===
              'event' &&
              styles.active,
          ]}
          onPress={() =>
            setTab(
              'event',
            )
          }
        >
          <Text
            style={[
              styles.tabText,

              tab ===
                'event' &&
                styles.activeText,
            ]}
          >
            Event (
            {
              eventRows.length
            }
            )
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tab,

            tab ===
              'regular' &&
              styles.active,
          ]}
          onPress={() =>
            setTab(
              'regular',
            )
          }
        >
          <Text
            style={[
              styles.tabText,

              tab ===
                'regular' &&
                styles.activeText,
            ]}
          >
            Regular (
            {
              regularRows.length
            }
            )
          </Text>
        </Pressable>
      </View>

      <AdminCard
        title={
          tab === 'event'
            ? 'Event Bills'
            : 'Regular Bills'
        }
      >
        {rows.length ? (
          rows.map((r) => (
            <View
              key={r.id}
              style={
                styles.row
              }
            >
              <Pressable
                style={{
                  flex: 1,
                  gap: 2,
                }}
                onPress={() =>
                  router.push(
                    `/admin/accounts/expenses/${r.id}`,
                  )
                }
              >
                <Text
                  style={
                    styles.title
                  }
                >
                  #{r.id} ·{' '}
                  {r.employeeName ||
                    'Company'}{' '}
                  ·{' '}
                  {formatTaka(
                    r.recordedTotalAmount,
                  )}
                </Text>

                <Text
                  style={
                    styles.meta
                  }
                >
                  {r.eventClientName
                    ? `${r.eventClientName} · `
                    : ''}
                  {formatDateTime(
                    r.createdAt,
                  )}
                </Text>

                <Text
                  style={
                    styles.small
                  }
                >
                  Paid now{' '}
                  {formatTaka(
                    r.walletDeductionAmount,
                  )}{' '}
                  · Payable{' '}
                  {formatTaka(
                    r.vendorPayableAmount,
                  )}
                </Text>
              </Pressable>

              <View
                style={
                  styles.rowActions
                }
              >
                <Pressable
                  style={
                    styles.icon
                  }
                  onPress={() =>
                    router.push(
                      `/admin/accounts/expenses/${r.id}`,
                    )
                  }
                >
                  <MaterialIcons
                    name="edit"
                    size={18}
                    color={
                      Brand.purple
                    }
                  />
                </Pressable>

                <AppButton
                  title="Approve"
                  onPress={() =>
                    approve(r)
                  }
                  loading={
                    busyId ===
                    r.id
                  }
                  style={
                    styles.approve
                  }
                />
              </View>
            </View>
          ))
        ) : (
          <Text
            style={
              styles.empty
            }
          >
            No pending {tab}{' '}
            bills.
          </Text>
        )}
      </AdminCard>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    tabs: {
      flexDirection: 'row',
      gap: 8,
    },

    tab: {
      flex: 1,
      alignItems: 'center',
      padding: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        '#e4cedc',
      backgroundColor:
        '#fff',
    },

    active: {
      backgroundColor:
        Brand.purple,
      borderColor:
        Brand.purple,
    },

    tabText: {
      fontSize: 13,
      fontWeight: '800',
      color: Brand.purple,
    },

    activeText: {
      color: '#fff',
    },

    row: {
      paddingVertical: 12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        '#ead7e3',
      gap: 9,
    },

    title: {
      fontSize: 13,
      fontWeight: '900',
      color: Brand.purple,
    },

    meta: {
      fontSize: 10,
      color: Brand.mauve,
    },

    small: {
      fontSize: 10,
      color: Brand.plum,
      fontWeight: '700',
    },

    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },

    icon: {
      width: 40,
      height: 40,
      borderRadius: 11,
      backgroundColor:
        '#fff4f9',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    approve: {
      flex: 1,
    },

    empty: {
      textAlign: 'center',
      color: Brand.mauve,
      paddingVertical: 12,
    },
  });