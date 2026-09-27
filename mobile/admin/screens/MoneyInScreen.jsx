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
  loadEmployeeWallets,
  loadMoneyIn,
  updateMoneyIn,
} from '@/admin/services/adminApi';

import {
  shareCsv,
} from '@/admin/services/pdfFile';

import {
  formatDate,
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

export default function MoneyInScreen() {
  const [
    rows,
    setRows,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    employeeId,
    setEmployeeId,
  ] = useState('');

  const [
    source,
    setSource,
  ] = useState('');

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    dateFrom,
    setDateFrom,
  ] = useState('');

  const [
    dateTo,
    setDateTo,
  ] = useState('');

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    notice,
    setNotice,
  ] = useState(null);

  const [
    editing,
    setEditing,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState({});

  const [
    busy,
    setBusy,
  ] = useState(false);

  const load =
    useCallback(async () => {
      setLoading(true);

      try {
        const [
          data,
          e,
        ] =
          await Promise.all([
            loadMoneyIn({
              employeeId,
              source,
              search,
              dateFrom,
              dateTo,
              page: 1,
              pageSize: 100,
            }),

            loadEmployeeWallets(),
          ]);

        setRows(
          data.rows ||
            data,
        );

        setEmployees(e);
      } catch (err) {
        setNotice({
          type: 'error',
          message:
            err.message,
        });
      } finally {
        setLoading(false);
      }
    }, [
      employeeId,
      source,
      search,
      dateFrom,
      dateTo,
    ]);

  useEffect(() => {
    load();
  }, []);

  const opts =
    useMemo(
      () => [
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
      ],
      [employees],
    );

  function edit(row) {
    setEditing(row);

    setForm({
      amount: String(
        row.amount,
      ),

      receivedDate:
        row.receivedDate,

      note:
        row.note || '',

      reason: '',
    });
  }

  async function save() {
    setBusy(true);

    try {
      await updateMoneyIn(
        editing.id,
        form,
      );

      setEditing(null);

      setNotice({
        type: 'success',
        message:
          'Money In record corrected.',
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
    loading &&
    !rows.length
  ) {
    return (
      <LoadingScreen message="Loading Money In..." />
    );
  }

  return (
    <AdminScreen
      back
      title="All Money In"
      subtitle="Every wallet top-up across the company; admins can correct records."
    >
      <AdminNotice
        type={notice?.type}
        message={notice?.message}
      />

      <AdminCard title="Filters">
        <AdminSelect
          label="Employee"
          value={employeeId}
          options={opts}
          onChange={
            setEmployeeId
          }
        />

        <AdminSelect
          label="Source"
          value={source}
          options={[
            {
              value: '',
              label:
                'All sources',
            },

            {
              value:
                'employee',
              label:
                'Employee',
            },

            {
              value: 'admin',
              label:
                'Admin',
            },
          ]}
          onChange={
            setSource
          }
        />

        <AppInput
          label="Search note"
          value={search}
          onChangeText={
            setSearch
          }
        />

        <View
          style={
            styles.filters
          }
        >
          <AppInput
            label="From"
            value={dateFrom}
            onChangeText={
              setDateFrom
            }
            placeholder="YYYY-MM-DD"
            style={{
              minWidth: 0,
            }}
          />

          <AppInput
            label="To"
            value={dateTo}
            onChangeText={
              setDateTo
            }
            placeholder="YYYY-MM-DD"
            style={{
              minWidth: 0,
            }}
          />
        </View>

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
                'money-in.csv',
                [
                  {
                    label:
                      'Employee',

                    value: (r) =>
                      r.employeeName,
                  },

                  {
                    label:
                      'Amount',

                    value: (r) =>
                      r.amount,
                  },

                  {
                    label:
                      'Date',

                    value: (r) =>
                      r.receivedDate,
                  },

                  {
                    label:
                      'Source',

                    value: (r) =>
                      r.source,
                  },

                  {
                    label:
                      'Note',

                    value: (r) =>
                      r.note,
                  },
                ],
                rows,
              )
            }
          />
        </View>
      </AdminCard>

      <AdminCard
        title="Money In records"
        subtitle={`${rows.length} row(s)`}
      >
        {rows.map((r) => (
          <View
            key={r.id}
            style={styles.row}
          >
            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.title
                }
              >
                {r.employeeName ||
                  'Employee'}{' '}
                ·{' '}
                {formatTaka(
                  r.amount,
                )}
              </Text>

              <Text
                style={
                  styles.meta
                }
              >
                {formatDate(
                  r.receivedDate,
                )}{' '}
                · {r.source} ·{' '}
                {r.note ||
                  'No note'}
                {r.wasEdited
                  ? ' · Edited'
                  : ''}
              </Text>
            </View>

            <Pressable
              style={
                styles.icon
              }
              onPress={() =>
                edit(r)
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
          </View>
        ))}
      </AdminCard>

      <AdminModal
        visible={Boolean(
          editing,
        )}
        title="Correct Money In record"
        onClose={() =>
          setEditing(null)
        }
      >
        <AppInput
          label="Amount"
          value={
            form.amount || ''
          }
          onChangeText={(v) =>
            setForm(
              (f) => ({
                ...f,
                amount: v,
              }),
            )
          }
          keyboardType="decimal-pad"
        />

        <AppInput
          label="Received date"
          value={
            form.receivedDate ||
            ''
          }
          onChangeText={(v) =>
            setForm(
              (f) => ({
                ...f,
                receivedDate:
                  v,
              }),
            )
          }
        />

        <AppInput
          label="Note"
          value={
            form.note || ''
          }
          onChangeText={(v) =>
            setForm(
              (f) => ({
                ...f,
                note: v,
              }),
            )
          }
        />

        <AppInput
          label="Reason for correction"
          value={
            form.reason || ''
          }
          onChangeText={(v) =>
            setForm(
              (f) => ({
                ...f,
                reason: v,
              }),
            )
          }
        />

        <AppButton
          title="Save Correction"
          onPress={save}
          loading={busy}
        />
      </AdminModal>
    </AdminScreen>
  );
}

const styles =
  StyleSheet.create({
    filters: {
      gap: 10,
    },

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

    title: {
      fontSize: 13,
      fontWeight: '900',
      color: Brand.purple,
    },

    meta: {
      fontSize: 10,
      color: Brand.mauve,
      marginTop: 2,
    },

    icon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        '#fff4f9',
    },
  });