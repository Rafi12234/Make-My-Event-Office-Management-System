import MaterialIcons
  from '@expo/vector-icons/MaterialIcons';

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

import AdminCard
  from '@/admin/components/AdminCard';

import AdminModal
  from '@/admin/components/AdminModal';

import AdminNotice
  from '@/admin/components/AdminNotice';

import AdminScreen
  from '@/admin/components/AdminScreen';

import {
  createVendor,
  loadVendors,
  setVendorStatus,
  updateVendor,
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

const BLANK = {
  name: '',
  category: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  notes: '',
};

function vendorToForm(
  vendor,
) {
  return {
    name:
      vendor?.name || '',

    category:
      vendor?.category ||
      '',

    contactName:
      vendor?.contactName ||
      '',

    contactPhone:
      vendor?.contactPhone ||
      '',

    contactEmail:
      vendor?.contactEmail ||
      '',

    notes:
      vendor?.notes || '',
  };
}

function VendorForm({
  vendor,
  onClose,
  onSaved,
  onError,
}) {
  const [
    form,
    setForm,
  ] = useState(() =>
    vendor
      ? vendorToForm(
          vendor,
        )
      : BLANK,
  );

  const [
    busy,
    setBusy,
  ] = useState(false);

  function update(
    key,
    value,
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]: value,
      }),
    );
  }

  async function submit() {
    if (
      !form.name.trim()
    ) {
      onError(
        'Vendor name is required.',
      );

      return;
    }

    setBusy(true);

    try {
      const payload =
        Object.fromEntries(
          Object.entries(
            form,
          ).map(
            ([
              key,
              value,
            ]) => [
              key,

              String(
                value || '',
              ).trim(),
            ],
          ),
        );

      if (vendor) {
        await updateVendor(
          vendor.id,
          payload,
        );
      } else {
        await createVendor(
          payload,
        );
      }

      onSaved(
        vendor
          ? 'Vendor updated.'
          : 'Vendor created.',
      );
    } catch (error) {
      onError(
        error.message ||
          'Unable to save vendor.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AppInput
        label="Vendor Name"
        value={form.name}
        onChangeText={(v) =>
          update(
            'name',
            v,
          )
        }
      />

      <AppInput
        label="Category"
        value={form.category}
        onChangeText={(v) =>
          update(
            'category',
            v,
          )
        }
      />

      <AppInput
        label="Contact Name"
        value={
          form.contactName
        }
        onChangeText={(v) =>
          update(
            'contactName',
            v,
          )
        }
      />

      <AppInput
        label="Contact Phone"
        keyboardType="phone-pad"
        value={
          form.contactPhone
        }
        onChangeText={(v) =>
          update(
            'contactPhone',
            v,
          )
        }
      />

      <AppInput
        label="Contact Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={
          form.contactEmail
        }
        onChangeText={(v) =>
          update(
            'contactEmail',
            v,
          )
        }
      />

      <AppInput
        label="Notes"
        multiline
        numberOfLines={4}
        value={form.notes}
        onChangeText={(v) =>
          update(
            'notes',
            v,
          )
        }
        style={{
          minHeight: 92,
          textAlignVertical:
            'top',
        }}
      />

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
            vendor
              ? 'Save Changes'
              : 'Create Vendor'
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

export default function VendorsScreen() {
  const router =
    useRouter();

  const [
    vendors,
    setVendors,
  ] = useState([]);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    showInactive,
    setShowInactive,
  ] = useState(true);

  const [
    editing,
    setEditing,
  ] = useState(null);

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    notice,
    setNotice,
  ] = useState(null);

  const [
    busyId,
    setBusyId,
  ] = useState(null);

  const load =
    useCallback(async () => {
      setLoading(true);

      try {
        setVendors(
          await loadVendors({
            includeInactive:
              true,
          }),
        );
      } catch (error) {
        setNotice({
          type: 'error',

          message:
            error.message ||
            'Unable to load vendors.',
        });
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered =
    useMemo(() => {
      const q =
        search
          .trim()
          .toLowerCase();

      return vendors.filter(
        (vendor) => {
          if (
            !showInactive &&
            !vendor.isActive
          ) {
            return false;
          }

          if (!q) {
            return true;
          }

          return [
            vendor.name,
            vendor.category,
            vendor.contactName,
            vendor.contactPhone,
            vendor.contactEmail,
          ].some((value) =>
            String(
              value || '',
            )
              .toLowerCase()
              .includes(q),
          );
        },
      );
    }, [
      vendors,
      search,
      showInactive,
    ]);

  async function toggleStatus(
    vendor,
  ) {
    setBusyId(
      String(vendor.id),
    );

    setNotice(null);

    try {
      await setVendorStatus(
        vendor.id,
        !vendor.isActive,
      );

      setNotice({
        type: 'success',

        message:
          `${vendor.name} ${
            vendor.isActive
              ? 'deactivated'
              : 'reactivated'
          }.`,
      });

      await load();
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
        'mme-admin-vendors.csv',
        [
          {
            label: 'Vendor',
            value: (r) =>
              r.name,
          },

          {
            label:
              'Category',
            value: (r) =>
              r.category,
          },

          {
            label:
              'Contact',
            value: (r) =>
              r.contactName,
          },

          {
            label: 'Phone',
            value: (r) =>
              r.contactPhone,
          },

          {
            label: 'Email',
            value: (r) =>
              r.contactEmail,
          },

          {
            label:
              'Amount Payable',
            value: (r) =>
              r.amountPayable,
          },

          {
            label: 'Status',
            value: (r) =>
              r.isActive
                ? 'Active'
                : 'Inactive',
          },

          {
            label:
              'Last Transaction',
            value: (r) =>
              r.lastTransactionDate,
          },
        ],
        filtered,
      );
    } catch (error) {
      setNotice({
        type: 'error',

        message:
          error.message ||
          'Unable to export vendors.',
      });
    }
  }

  function saved(
    message,
  ) {
    setCreating(false);
    setEditing(null);

    setNotice({
      type: 'success',
      message,
    });

    load();
  }

  if (
    loading &&
    vendors.length === 0
  ) {
    return (
      <LoadingScreen message="Loading vendors..." />
    );
  }

  return (
    <AdminScreen
      back
      title="Vendors"
      subtitle="Company-wide payee ledger, status control, direct costs and direct payments."
    >
      <AdminNotice
        type={notice?.type}
        message={notice?.message}
      />

      <View
        style={
          styles.topActions
        }
      >
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

        <AppButton
          title="New Vendor"
          onPress={() =>
            setCreating(
              true,
            )
          }
          style={{
            flex: 1,
          }}
        />
      </View>

      <AdminCard
        title="All Vendors"
        subtitle={`${filtered.length} visible · ${vendors.length} total`}
      >
        <AppInput
          label="Search"
          placeholder="Name / category / phone / email"
          value={search}
          onChangeText={
            setSearch
          }
        />

        <Pressable
          style={
            styles.toggle
          }
          onPress={() =>
            setShowInactive(
              (value) =>
                !value,
            )
          }
        >
          <MaterialIcons
            name={
              showInactive
                ? 'check-box'
                : 'check-box-outline-blank'
            }
            size={20}
            color={
              Brand.plum
            }
          />

          <Text
            style={
              styles.toggleText
            }
          >
            Show inactive
            vendors
          </Text>
        </Pressable>

        {filtered.length ===
        0 ? (
          <Text
            style={
              styles.empty
            }
          >
            No vendors match
            the current
            filters.
          </Text>
        ) : null}

        {filtered.map(
          (vendor) => (
            <View
              key={String(
                vendor.id,
              )}
              style={
                styles.vendorRow
              }
            >
              <Pressable
                style={
                  styles.vendorMain
                }
                onPress={() =>
                  router.push(
                    `/admin/accounts/vendors/${vendor.id}`,
                  )
                }
              >
                <View
                  style={[
                    styles.icon,

                    !vendor.isActive && {
                      opacity:
                        0.45,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="storefront"
                    size={20}
                    color={
                      Brand.purple
                    }
                  />
                </View>

                <View
                  style={
                    styles.vendorText
                  }
                >
                  <Text
                    style={
                      styles.name
                    }
                  >
                    {vendor.name}
                  </Text>

                  <Text
                    style={
                      styles.meta
                    }
                  >
                    {vendor.category ||
                      'Uncategorized'}{' '}
                    ·{' '}
                    {vendor.isActive
                      ? 'Active'
                      : 'Inactive'}
                  </Text>

                  <Text
                    style={
                      styles.amount
                    }
                  >
                    Payable{' '}
                    {formatTaka(
                      vendor.amountPayable,
                    )}{' '}
                    · Last{' '}
                    {formatDate(
                      vendor.lastTransactionDate,
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

              <View
                style={
                  styles.rowActions
                }
              >
                <Pressable
                  style={
                    styles.smallButton
                  }
                  onPress={() =>
                    setEditing(
                      vendor,
                    )
                  }
                >
                  <MaterialIcons
                    name="edit"
                    size={16}
                    color={
                      Brand.purple
                    }
                  />

                  <Text
                    style={
                      styles.smallText
                    }
                  >
                    Edit
                  </Text>
                </Pressable>

                <Pressable
                  disabled={
                    busyId ===
                    String(
                      vendor.id,
                    )
                  }
                  style={
                    styles.smallButton
                  }
                  onPress={() =>
                    toggleStatus(
                      vendor,
                    )
                  }
                >
                  <MaterialIcons
                    name={
                      vendor.isActive
                        ? 'block'
                        : 'check-circle'
                    }
                    size={16}
                    color={
                      vendor.isActive
                        ? '#a52929'
                        : '#246b37'
                    }
                  />

                  <Text
                    style={
                      styles.smallText
                    }
                  >
                    {vendor.isActive
                      ? 'Deactivate'
                      : 'Reactivate'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ),
        )}
      </AdminCard>

      <AdminModal
        visible={creating}
        title="New Vendor"
        subtitle="Create a vendor available to company and employee expense flows."
        onClose={() =>
          setCreating(false)
        }
      >
        {creating ? (
          <VendorForm
            onClose={() =>
              setCreating(
                false,
              )
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

      <AdminModal
        visible={Boolean(
          editing,
        )}
        title="Edit Vendor"
        subtitle={
          editing?.name
        }
        onClose={() =>
          setEditing(null)
        }
      >
        {editing ? (
          <VendorForm
            vendor={editing}
            onClose={() =>
              setEditing(null)
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
    topActions: {
      flexDirection: 'row',
      gap: 8,
    },

    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingVertical: 4,
    },

    toggleText: {
      fontSize: 13,
      fontWeight: '700',
      color: Brand.purple,
    },

    empty: {
      textAlign: 'center',
      color: Brand.mauve,
      paddingVertical: 18,
    },

    vendorRow: {
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        '#ead7e3',
      paddingVertical: 10,
      gap: 8,
    },

    vendorMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },

    icon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor:
        '#f3ccde',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    vendorText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },

    name: {
      fontSize: 14,
      fontWeight: '900',
      color: Brand.purple,
    },

    meta: {
      fontSize: 11,
      color: Brand.mauve,
    },

    amount: {
      fontSize: 11,
      fontWeight: '800',
      color: Brand.plum,
    },

    rowActions: {
      flexDirection: 'row',
      gap: 8,
      marginLeft: 50,
    },

    smallButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderColor:
        '#ead7e3',
      borderRadius: 9,
      paddingHorizontal: 9,
      paddingVertical: 6,
      backgroundColor:
        '#fff',
    },

    smallText: {
      fontSize: 11,
      fontWeight: '800',
      color: Brand.purple,
    },

    modalActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
  });