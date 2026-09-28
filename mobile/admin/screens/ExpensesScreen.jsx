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

import AdminNotice
  from '@/admin/components/AdminNotice';

import AdminScreen
  from '@/admin/components/AdminScreen';

import AdminSelect
  from '@/admin/components/AdminSelect';

import {
  loadEmployeeWallets,
  loadExpenses,
  loadVendors,
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
  Brand,
} from '@/constants/theme';

export default function ExpensesScreen() {
  const router =
    useRouter();

  const [
    rows,
    setRows,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    vendors,
    setVendors,
  ] = useState([]);

  const [
    filters,
    setFilters,
  ] = useState({
    employeeId: '',
    costType: '',
    vendorId: '',
    paymentStatus: '',
    approved: 'true',
    dateFrom: '',
    dateTo: '',
    sort: 'newest',
  });

  const [
    view,
    setView,
  ] = useState(
    'expenses',
  );

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
          data,
          e,
          v,
        ] =
          await Promise.all([
            loadExpenses({
              ...filters,
              status:
                'active',
              page: 1,
              pageSize:
                100,
            }),

            loadEmployeeWallets(),

            loadVendors({
              includeInactive:
                true,
            }),
          ]);

        setRows(
          data.rows || [],
        );

        setEmployees(e);

        setVendors(v);
      } catch (e) {
        setNotice({
          type: 'error',
          message: e.message,
        });
      } finally {
        setLoading(false);
      }
    }, [filters]);

  useEffect(() => {
    load();
  }, []);

  const visible =
    useMemo(
      () =>
        view ===
        'payable'
          ? rows.filter(
              (r) =>
                Number(
                  r.vendorPayableAmount,
                ) > 0,
            )
          : rows,
      [rows, view],
    );

  const eOpts = [
    {
      value: '',
      label:
        'All employees',
    },

    ...employees.map(
      (e) => ({
        value: String(
          e.employeeId,
        ),

        label:
          e.fullName,
      }),
    ),
  ];

  const vOpts = [
    {
      value: '',
      label:
        'All vendors',
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

  if (
    loading &&
    !rows.length
  ) {
    return (
      <LoadingScreen message="Loading company expenses..." />
    );
  }

  return (
    <AdminScreen
      back
      title="All Company Expenses"
      subtitle="Approved expenses with employee, vendor, payment and date filters."
    >
      <AdminNotice
        type={notice?.type}
        message={notice?.message}
      />

      <AdminCard title="Filters">
        <AdminSelect
          label="Employee"
          value={
            filters.employeeId
          }
          options={eOpts}
          onChange={(v) =>
            setFilters(
              (f) => ({
                ...f,
                employeeId:
                  v,
              }),
            )
          }
        />

        <AdminSelect
          label="Cost type"
          value={
            filters.costType
          }
          options={[
            {
              value: '',
              label:
                'All types',
            },

            {
              value: 'event',
              label:
                'Event',
            },

            {
              value:
                'regular',
              label:
                'Regular',
            },
          ]}
          onChange={(v) =>
            setFilters(
              (f) => ({
                ...f,
                costType:
                  v,
              }),
            )
          }
        />

        <AdminSelect
          label="Vendor"
          value={
            filters.vendorId
          }
          options={vOpts}
          onChange={(v) =>
            setFilters(
              (f) => ({
                ...f,
                vendorId:
                  v,
              }),
            )
          }
        />

        <AdminSelect
          label="Vendor payment"
          value={
            filters.paymentStatus
          }
          options={[
            {
              value: '',
              label: 'All',
            },

            {
              value: 'paid',
              label:
                'Paid',
            },

            {
              value:
                'to_pay',
              label:
                'To Pay',
            },
          ]}
          onChange={(v) =>
            setFilters(
              (f) => ({
                ...f,
                paymentStatus:
                  v,
              }),
            )
          }
        />

        <AdminSelect
          label="Approval"
          value={
            filters.approved
          }
          options={[
            {
              value: '',
              label: 'All',
            },

            {
              value: 'true',
              label:
                'Approved',
            },

            {
              value: 'false',
              label:
                'Pending',
            },
          ]}
          onChange={(v) =>
            setFilters(
              (f) => ({
                ...f,
                approved:
                  v,
              }),
            )
          }
        />

        <AppInput
          label="From date"
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

        <AppInput
          label="To date"
          value={
            filters.dateTo
          }
          onChangeText={(v) =>
            setFilters(
              (f) => ({
                ...f,
                dateTo: v,
              }),
            )
          }
          placeholder="YYYY-MM-DD"
        />

        <View
          style={
            styles.actions
          }
        >
          <AppButton
            title="Apply"
            onPress={load}
            style={{
              flex: 1,
            }}
          />

          <AppButton
            title="Export CSV"
            variant="outline"
            style={{
              flex: 1,
            }}
            onPress={() =>
              shareCsv(
                'company-expenses.csv',
                [
                  {
                    label: 'ID',
                    value: (r) =>
                      r.id,
                  },

                  {
                    label:
                      'Employee',
                    value: (r) =>
                      r.employeeName,
                  },

                  {
                    label:
                      'Type',
                    value: (r) =>
                      r.costType,
                  },

                  {
                    label:
                      'Recorded',
                    value: (r) =>
                      r.recordedTotalAmount,
                  },

                  {
                    label:
                      'Paid',
                    value: (r) =>
                      r.walletDeductionAmount,
                  },

                  {
                    label:
                      'Payable',
                    value: (r) =>
                      r.vendorPayableAmount,
                  },

                  {
                    label:
                      'Created',
                    value: (r) =>
                      r.createdAt,
                  },
                ],
                visible,
              )
            }
          />
        </View>
      </AdminCard>

      <View
        style={styles.tabs}
      >
        <Pressable
          style={[
            styles.tab,

            view ===
              'expenses' &&
              styles.active,
          ]}
          onPress={() =>
            setView(
              'expenses',
            )
          }
        >
          <Text
            style={[
              styles.tabText,

              view ===
                'expenses' &&
                styles.activeText,
            ]}
          >
            Expenses
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.tab,

            view ===
              'payable' &&
              styles.active,
          ]}
          onPress={() =>
            setView(
              'payable',
            )
          }
        >
          <Text
            style={[
              styles.tabText,

              view ===
                'payable' &&
                styles.activeText,
            ]}
          >
            Payable Amounts
          </Text>
        </Pressable>
      </View>

      <AdminCard
        title={
          view === 'expenses'
            ? 'Expense records'
            : 'Payable Amounts'
        }
        subtitle={`${visible.length} record(s)`}
      >
        {visible.map(
          (r) => (
            <Pressable
              key={r.id}
              style={
                styles.row
              }
              onPress={() =>
                router.push(
                  `/admin/accounts/expenses/${r.id}`,
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
                    styles.title
                  }
                >
                  #{r.id} ·{' '}
                  {r.employeeName ||
                    'Company direct'}{' '}
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
                  {r.costType} ·{' '}
                  {r.approved
                    ? 'Approved'
                    : 'Pending'}{' '}
                  ·{' '}
                  {formatDateTime(
                    r.createdAt,
                  )}
                </Text>

                {Number(
                  r.vendorPayableAmount,
                ) > 0 ? (
                  <Text
                    style={
                      styles.payable
                    }
                  >
                    Still payable{' '}
                    {formatTaka(
                      r.vendorPayableAmount,
                    )}
                  </Text>
                ) : null}
              </View>

              <MaterialIcons
                name="chevron-right"
                size={20}
                color={
                  Brand.mauve
                }
              />
            </Pressable>
          ),
        )}
      </AdminCard>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    actions: {
      flexDirection: 'row',
      gap: 8,
    },

    tabs: {
      flexDirection: 'row',
      gap: 8,
    },

    tab: {
      flex: 1,
      padding: 10,
      alignItems: 'center',
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
    },

    tabText: {
      fontWeight: '800',
      color: Brand.purple,
    },

    activeText: {
      color: '#fff',
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

    title: {
      fontSize: 13,
      fontWeight: '900',
      color: Brand.purple,
    },

    meta: {
      fontSize: 10,
      color: Brand.mauve,
      textTransform:
        'capitalize',
    },

    payable: {
      fontSize: 11,
      fontWeight: '800',
      color: '#a35d00',
    },
  });