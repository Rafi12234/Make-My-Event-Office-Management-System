import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';

import AppInput from '@/components/common/AppInput';
import ClientCard from '@/components/clients/ClientCard';
import ClientFilterModal from '@/components/clients/ClientFilterModal';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import LoadingScreen from '@/components/common/LoadingScreen';
import ScreenContainer from '@/components/common/ScreenContainer';
import { Brand } from '@/constants/theme';
import { queryKeys } from '@/constants/queryKeys';
import { useAuth } from '@/hooks/useAuth';
import { useClients } from '@/hooks/useClients';
import { getWorkspace, saveWorkspace } from '@/services/api/workspaceApi';
import { applyClientFilters, countActiveClientFilters, filterClients } from '@/utils/clients';
import { moderateScale } from '@/utils/responsive';

const EMPTY_FILTERS = { dateFrom: '', dateTo: '', shifts: new Set(), venues: new Set() };

export default function ClientsScreen() {
  const router = useRouter();
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { clients, isLoading, isError, error, refetch, isRefetching } = useClients();
  const [pendingDeleteRowKey, setPendingDeleteRowKey] = useState(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sortOrder, setSortOrder] = useState('default');

  if (isLoading) {
    return <LoadingScreen message="Loading clients..." />;
  }

  if (isError) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
  }

  const activeFilterCount = countActiveClientFilters(filters);
  const filtered = applyClientFilters(filterClients(clients, search), filters, sortOrder);

  async function handleConfirmDeleteClient() {
    const rowKey = pendingDeleteRowKey;
    setIsDeletingClient(true);
    setDeleteError('');
    try {
      // Same full-sheet-replace contract the create-client flow uses — fetch
      // the latest workspace first, then save it back minus this one row, so
      // no other client's row is ever touched.
      const current = await getWorkspace();
      const nextRows = current.rows.filter((row) => row.id !== rowKey);
      await saveWorkspace({ ...current, rows: nextRows }, employee?.id);
      setPendingDeleteRowKey(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workspace }),
        queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      ]);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete client.');
    } finally {
      setIsDeletingClient(false);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Clients</Text>
          <Text style={styles.subtitle}>
            {filtered.length} client{filtered.length === 1 ? '' : 's'} {search || activeFilterCount > 0 ? 'matching' : 'total'}
          </Text>
        </View>
        <Pressable style={styles.createButton} onPress={() => router.push('/clients/create')} hitSlop={4}>
          <MaterialIcons name="person-add-alt-1" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <MaterialIcons name="search" size={18} color={Brand.mauve} style={styles.searchIcon} />
          <AppInput
            placeholder="Search by name, phone, or venue"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>
        <Pressable style={styles.filterButton} onPress={() => setShowFilterModal(true)}>
          <MaterialIcons name="tune" size={20} color="#fff" />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={(item) => item.rowKey}
        renderItem={({ item }) => <ClientCard client={item} onRequestDelete={setPendingDeleteRowKey} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState
            title="No clients found"
            message={
              search || activeFilterCount > 0
                ? 'Try a different search term or adjust your filters.'
                : 'No clients on the workspace yet.'
            }
          />
        }
        contentContainerStyle={filtered.length === 0 ? styles.emptyContent : styles.listContent}
      />

      {deleteError ? (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={16} color="#d32f2f" />
          <Text style={styles.error}>{deleteError}</Text>
        </View>
      ) : null}

      <ConfirmDialog
        visible={pendingDeleteRowKey !== null}
        title="Delete this row?"
        message="This row will be permanently removed and saved immediately. This action cannot be undone."
        confirmLabel="Yes, delete"
        isConfirming={isDeletingClient}
        onCancel={() => setPendingDeleteRowKey(null)}
        onConfirm={handleConfirmDeleteClient}
      />

      <ClientFilterModal
        visible={showFilterModal}
        filters={filters}
        sortOrder={sortOrder}
        onChangeFilters={setFilters}
        onChangeSortOrder={setSortOrder}
        onClear={() => setFilters(EMPTY_FILTERS)}
        onClose={() => setShowFilterModal(false)}
        activeFilterCount={activeFilterCount}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: moderateScale(22),
    fontWeight: '800',
    color: Brand.purple,
  },
  subtitle: {
    fontSize: moderateScale(12),
    color: Brand.mauve,
  },
  createButton: {
    flexShrink: 0,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Brand.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  searchInputWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    top: 0,
    bottom: 0,
    textAlignVertical: 'center',
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 38,
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Brand.plum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '800',
    color: '#fff',
  },
  list: {
    flex: 1,
  },
  separator: {
    height: 10,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fdecec',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  error: {
    flex: 1,
    color: '#d32f2f',
    fontWeight: '600',
    fontSize: moderateScale(12.5),
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContent: {
    flexGrow: 1,
  },
});
