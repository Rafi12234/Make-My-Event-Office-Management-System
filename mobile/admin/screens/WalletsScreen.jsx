import {
  useCallback,
  useEffect,
  useMemo,
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

import MaterialIcons
  from '@expo/vector-icons/MaterialIcons';

import AdminCard
  from '@/admin/components/AdminCard';

import AdminModal
  from '@/admin/components/AdminModal';

import AdminNotice
  from '@/admin/components/AdminNotice';

import AdminScreen
  from '@/admin/components/AdminScreen';

import AdminSelect
  from '@/admin/components/AdminSelect';

import {
  addMoneyToEmployee,
  loadEmployeeWallets,
} from '@/admin/services/adminApi';

import {
  shareCsv,
} from '@/admin/services/pdfFile';

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
  todayDateString,
} from '@/utils/dates';

import {
  Brand,
} from '@/constants/theme';

export default function WalletsScreen() {
  const router =
    useRouter();

  const [
    rows,
    setRows,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    notice,
    setNotice,
  ] = useState(null);

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    employeeId,
    setEmployeeId,
  ] = useState('');

  const [
    amount,
    setAmount,
  ] = useState('');

  const [
    receivedDate,
    setReceivedDate,
  ] = useState(
    todayDateString(),
  );

  const [
    note,
    setNote,
  ] = useState('');

  const [
    busy,
    setBusy,
  ] = useState(false);

  const load =
    useCallback(async () => {
      setLoading(true);

      try {
        setRows(
          await loadEmployeeWallets(),
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

  const options =
    useMemo(
      () => [
        {
          value: '',
          label:
            'Select employee',
        },

        ...rows.map(
          (r) => ({
            value: String(
              r.employeeId,
            ),

            label:
              r.fullName,
          }),
        ),
      ],
      [rows],
    );

  async function addMoney() {
    setBusy(true);

    try {
      await addMoneyToEmployee({
        employeeId,
        amount,
        receivedDate,
        note,
      });

      setOpen(false);

      setAmount('');
      setNote('');

      setNotice({
        type: 'success',
        message:
          'Money added to employee wallet.',
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

  if (loading) {
    return (
      <LoadingScreen message="Loading employee wallets..." />
    );
  }

  return (
    <AdminScreen
      back
      title="Employee Wallets"
      subtitle="Every employee, including employees with no activity yet."
    >
      <AdminNotice
        type={notice?.type}
        message={notice?.message}
      />

      <View
        style={styles.actions}
      >
        <AppButton
          title="Add Money"
          onPress={() =>
            setOpen(true)
          }
          style={{
            flex: 1,
          }}
        />

        <AppButton
          title="Export CSV"
          variant="outline"
          onPress={() =>
            shareCsv(
              'employee-wallets.csv',
              [
                {
                  label:
                    'Employee',

                  value: (r) =>
                    r.fullName,
                },

                {
                  label:
                    'Email',

                  value: (r) =>
                    r.email,
                },

                {
                  label:
                    'Balance',

                  value: (r) =>
                    r.currentBalance,
                },

                {
                  label:
                    'Money In',

                  value: (r) =>
                    r.totalMoneyIn,
                },

                {
                  label:
                    'Still Payable',

                  value: (r) =>
                    r.totalStillPayable,
                },
              ],
              rows,
            )
          }
          style={{
            flex: 1,
          }}
        />
      </View>

      <AdminCard
        title="All employees"
        subtitle={`${rows.length} employee(s)`}
      >
        {rows.map((r) => (
          <Pressable
            key={String(
              r.employeeId,
            )}
            style={styles.row}
            onPress={() =>
              router.push(
                `/admin/accounts/employees/${r.employeeId}`,
              )
            }
          >
            <View
              style={{
                flex: 1,
                gap: 2,
              }}
            >
              <Text
                style={
                  styles.name
                }
              >
                {r.fullName}
              </Text>

              <Text
                style={
                  styles.meta
                }
              >
                {r.email} ·{' '}
                {r.isActive
                  ? 'Active'
                  : 'Inactive'}
              </Text>

              <Text
                style={
                  styles.balance
                }
              >
                {formatTaka(
                  r.currentBalance,
                )}{' '}
                balance
              </Text>

              <Text
                style={
                  styles.small
                }
              >
                In{' '}
                {formatTaka(
                  r.totalMoneyIn,
                )}{' '}
                · Expenses{' '}
                {formatTaka(
                  r.totalExpenses,
                )}{' '}
                · Vendor owed{' '}
                {formatTaka(
                  r.totalStillPayable,
                )}
              </Text>

              <Text
                style={
                  styles.small
                }
              >
                Last activity:{' '}
                {formatDateTime(
                  r.lastActivityAt,
                )}
              </Text>
            </View>

            <MaterialIcons
              name="chevron-right"
              size={20}
              color={
                Brand.mauve
              }
            />
          </Pressable>
        ))}
      </AdminCard>

      <AdminModal
        visible={open}
        title="Add money to employee wallet"
        onClose={() =>
          setOpen(false)
        }
      >
        <AdminSelect
          label="Employee"
          value={employeeId}
          options={options}
          onChange={
            setEmployeeId
          }
        />

        <AppInput
          label="Amount"
          value={amount}
          onChangeText={
            setAmount
          }
          keyboardType="decimal-pad"
        />

        <AppInput
          label="Received date"
          value={
            receivedDate
          }
          onChangeText={
            setReceivedDate
          }
          placeholder="YYYY-MM-DD"
        />

        <AppInput
          label="Note"
          value={note}
          onChangeText={
            setNote
          }
        />

        <AppButton
          title="Add Money"
          onPress={addMoney}
          loading={busy}
        />
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

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 11,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        '#ead7e3',
    },

    name: {
      fontSize: 14,
      fontWeight: '900',
      color: Brand.purple,
    },

    meta: {
      fontSize: 10,
      color: Brand.mauve,
    },

    balance: {
      fontSize: 14,
      fontWeight: '900',
      color: Brand.plum,
    },

    small: {
      fontSize: 10,
      color: Brand.mauve,
    },
  });