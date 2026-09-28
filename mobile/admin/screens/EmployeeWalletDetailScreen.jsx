import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import {
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

import AdminNotice
  from '@/admin/components/AdminNotice';

import AdminScreen
  from '@/admin/components/AdminScreen';

import {
  loadEmployeeProfile,
} from '@/admin/services/adminApi';

import {
  formatDate,
  formatDateTime,
  formatTaka,
} from '@/admin/utils/format';

import LoadingScreen
  from '@/components/common/LoadingScreen';

import {
  Brand,
} from '@/constants/theme';

export default function EmployeeWalletDetailScreen() {
  const { id } =
    useLocalSearchParams();

  const router =
    useRouter();

  const [
    data,
    setData,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState('');

  useEffect(() => {
    loadEmployeeProfile(
      id,
    )
      .then(setData)
      .catch((e) =>
        setError(e.message),
      );
  }, [id]);

  if (!data && !error) {
    return (
      <LoadingScreen message="Loading employee account..." />
    );
  }

  return (
    <AdminScreen
      back
      title={
        data?.employee
          ?.fullName ||
        'Employee Accounts'
      }
      subtitle={
        data?.employee
          ?.email ||
        'Wallet and financial activity'
      }
    >
      <AdminNotice
        type="error"
        message={error}
      />

      {data ? (
        <>
          <AdminCard title="Summary">
            <AdminKeyValue
              label="Status"
              value={
                data.employee
                  ?.isActive
                  ? 'Active'
                  : 'Inactive'
              }
            />

            <AdminKeyValue
              label="Balance"
              value={formatTaka(
                data.currentBalance,
              )}
            />

            <AdminKeyValue
              label="Money In"
              value={formatTaka(
                data.totalMoneyIn,
              )}
            />

            <AdminKeyValue
              label="Still Payable"
              value={formatTaka(
                data.totalStillPayable,
              )}
            />

            <AdminKeyValue
              label="Expenses"
              value={formatTaka(
                data.totalExpenses,
              )}
            />

            <AdminKeyValue
              label="Event Cost"
              value={formatTaka(
                data.eventCostTotal,
              )}
            />

            <AdminKeyValue
              label="Regular Cost"
              value={formatTaka(
                data.regularCostTotal,
              )}
            />
          </AdminCard>

          <AdminCard title="Money In history">
            {(data.moneyInHistory ||
              []).map((x) => (
              <View
                key={x.id}
                style={styles.row}
              >
                <Text
                  style={
                    styles.title
                  }
                >
                  {formatTaka(
                    x.amount,
                  )}{' '}
                  ·{' '}
                  {formatDate(
                    x.receivedDate,
                  )}
                </Text>

                <Text
                  style={
                    styles.meta
                  }
                >
                  {x.source} ·{' '}
                  {x.note ||
                    'No note'}
                </Text>
              </View>
            ))}
          </AdminCard>

          <AdminCard title="Expense history">
            {(data.expenseHistory ||
              []).map((x) => (
              <Pressable
                key={x.id}
                style={styles.row}
                onPress={() =>
                  router.push(
                    `/admin/accounts/expenses/${x.id}`,
                  )
                }
              >
                <Text
                  style={
                    styles.title
                  }
                >
                  #{x.id} ·{' '}
                  {formatTaka(
                    x.recordedTotalAmount,
                  )}{' '}
                  · {x.costType}
                </Text>

                <Text
                  style={
                    styles.meta
                  }
                >
                  {x.status} ·{' '}
                  {x.approved
                    ? 'Approved'
                    : 'Pending'}{' '}
                  ·{' '}
                  {formatDateTime(
                    x.createdAt,
                  )}
                </Text>
              </Pressable>
            ))}
          </AdminCard>

          <AdminCard title="Vendor activity">
            {(data.vendorItems ||
              []).map(
              (x, i) => (
                <View
                  key={`${
                    x.id || i
                  }`}
                  style={
                    styles.row
                  }
                >
                  <Text
                    style={
                      styles.title
                    }
                  >
                    {x.vendorName ||
                      'Vendor'}{' '}
                    ·{' '}
                    {formatTaka(
                      x.totalAmount ||
                        x.amount,
                    )}
                  </Text>

                  <Text
                    style={
                      styles.meta
                    }
                  >
                    {x.paymentStatus ||
                      '—'}{' '}
                    ·{' '}
                    {x.purpose ||
                      ''}
                  </Text>
                </View>
              ),
            )}
          </AdminCard>
        </>
      ) : null}
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    row: {
      paddingVertical: 10,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        '#ead7e3',
      gap: 2,
    },

    title: {
      fontSize: 13,
      fontWeight: '800',
      color: Brand.purple,
    },

    meta: {
      fontSize: 10,
      color: Brand.mauve,
    },
  });