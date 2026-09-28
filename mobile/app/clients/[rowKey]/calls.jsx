import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import CallCard from '@/components/calls/CallCard';
import NextCallFields from '@/components/calls/NextCallFields';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import LoadingScreen from '@/components/common/LoadingScreen';
import ScreenContainer from '@/components/common/ScreenContainer';
import { Brand } from '@/constants/theme';
import { queryKeys } from '@/constants/queryKeys';
import { useAuth } from '@/hooks/useAuth';
import { useCalls } from '@/hooks/useCalls';
import { createCall, deleteCall, updateCall } from '@/services/api/callsApi';
import { todayDateString, toDateTimeLocalString } from '@/utils/dates';
import { moderateScale } from '@/utils/responsive';

export default function CallsScreen() {
  const { rowKey } = useLocalSearchParams();
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useCalls(rowKey);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [discussion, setDiscussion] = useState('');
  const [showNextCall, setShowNextCall] = useState(false);
  const [nextCallDate, setNextCallDate] = useState(new Date());
  const [nextCallEmployeeId, setNextCallEmployeeId] = useState(employee?.id || null);
  const [isLogging, setIsLogging] = useState(false);
  const [savingCallId, setSavingCallId] = useState(null);
  const [pendingDeleteCallId, setPendingDeleteCallId] = useState(null);
  const [isDeletingCall, setIsDeletingCall] = useState(false);
  const [formError, setFormError] = useState('');

  if (isLoading) {
    return <LoadingScreen message="Loading calls..." />;
  }

  if (isError) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
  }

  const calls = data?.calls || [];

  function resetCreateForm() {
    setShowCreateForm(false);
    setDiscussion('');
    setShowNextCall(false);
    setNextCallDate(new Date());
    setNextCallEmployeeId(employee?.id || null);
    setFormError('');
  }

  // A next-call date/time is what actually drives the calendar (see
  // /api/calendar's client_next_call events) — refreshing it here keeps the
  // Dashboard's "Next Up" list and the client's Last/Next Call fields in
  // sync immediately, the same way the web app updates live after a save.
  async function refreshDependentData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.calls(rowKey) }),
      queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace }),
    ]);
  }

  async function handleSaveNewCall() {
    setFormError('');

    if (!discussion.trim()) {
      setFormError('Add a discussion note before saving.');
      return;
    }
    if (showNextCall && toDateTimeLocalString(nextCallDate).slice(0, 10) < todayDateString()) {
      setFormError('Next call date cannot be before today.');
      return;
    }

    setIsLogging(true);
    try {
      // Same two-step sequence the web Call Manager uses under the hood
      // (create, then save discussion + next-call fields together) — just
      // done here as one continuous action instead of two separate screens.
      const created = await createCall(rowKey, { callDiscussion: discussion.trim() });
      if (showNextCall) {
        await updateCall(rowKey, created.id, {
          callDiscussion: discussion.trim(),
          nextCallDatetime: toDateTimeLocalString(nextCallDate),
          nextCallAssignedEmployeeId: nextCallEmployeeId,
        });
      }
      resetCreateForm();
      await refreshDependentData();
    } catch (err) {
      setFormError(err.message || 'Failed to save call.');
    } finally {
      setIsLogging(false);
    }
  }

  async function handleSaveCall(callId, payload) {
    setSavingCallId(callId);
    setFormError('');
    try {
      await updateCall(rowKey, callId, payload);
      await refreshDependentData();
    } catch (err) {
      setFormError(err.message || 'Failed to save call.');
    } finally {
      setSavingCallId(null);
    }
  }

  async function handleConfirmDeleteCall() {
    const callId = pendingDeleteCallId;
    setIsDeletingCall(true);
    setFormError('');
    try {
      await deleteCall(rowKey, callId);
      setPendingDeleteCallId(null);
      await refreshDependentData();
    } catch (err) {
      setFormError(err.message || 'Failed to delete call.');
    } finally {
      setIsDeletingCall(false);
    }
  }

  return (
    <ScreenContainer avoidKeyboard>
      <Stack.Screen options={{ headerShown: true, title: data?.clientName || 'Calls' }} />

      <View style={styles.header}>
        <Text style={styles.pageTitle}>Call History</Text>
        <Text style={styles.pageSubtitle}>
          {calls.length} call{calls.length === 1 ? '' : 's'} logged
        </Text>
      </View>

      {!showCreateForm ? (
        <Pressable style={styles.createButton} onPress={() => setShowCreateForm(true)}>
          <MaterialIcons name="add-call" size={18} color="#fff" />
          <Text style={styles.createButtonText}>Log New Call</Text>
        </Pressable>
      ) : (
        <View style={styles.logSection}>
          <AppInput
            placeholder="What was discussed?"
            value={discussion}
            onChangeText={setDiscussion}
            multiline
          />

          {!showNextCall ? (
            <Pressable style={styles.scheduleLinkRow} onPress={() => setShowNextCall(true)}>
              <MaterialIcons name="add-alarm" size={15} color={Brand.plum} />
              <Text style={styles.scheduleLink}>Schedule next call</Text>
            </Pressable>
          ) : (
            <View style={styles.nextCallSection}>
              <Text style={styles.nextCallTitle}>Next Call</Text>
              <NextCallFields
                value={nextCallDate}
                onChange={setNextCallDate}
                employeeId={nextCallEmployeeId}
                onEmployeeChange={setNextCallEmployeeId}
              />
              <Pressable onPress={() => setShowNextCall(false)}>
                <Text style={styles.removeLink}>Remove next call</Text>
              </Pressable>
            </View>
          )}

          {formError ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={16} color="#d32f2f" />
              <Text style={styles.error}>{formError}</Text>
            </View>
          ) : null}

          <View style={styles.formActions}>
            <AppButton
              title="Cancel"
              variant="outline"
              onPress={resetCreateForm}
              style={styles.formButton}
            />
            <AppButton
              title="Save"
              onPress={handleSaveNewCall}
              loading={isLogging}
              style={styles.formButton}
            />
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Calls</Text>
        {calls.length > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{calls.length}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        style={styles.list}
        data={calls}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <CallCard
            call={item}
            onSave={handleSaveCall}
            onRequestDelete={setPendingDeleteCallId}
            isSaving={savingCallId === item.id}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState title="No calls yet" message="Create the first call above." />}
        contentContainerStyle={calls.length === 0 ? styles.emptyContent : styles.listContent}
      />

      <ConfirmDialog
        visible={pendingDeleteCallId !== null}
        title="Delete this call?"
        message="This cannot be undone."
        confirmLabel="Yes, delete"
        isConfirming={isDeletingCall}
        onCancel={() => setPendingDeleteCallId(null)}
        onConfirm={handleConfirmDeleteCall}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
    gap: 2,
  },
  pageTitle: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: Brand.purple,
  },
  pageSubtitle: {
    fontSize: moderateScale(12),
    color: Brand.mauve,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.plum,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  createButtonText: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: '#fff',
  },
  logSection: {
    gap: 10,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 14,
  },
  scheduleLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  scheduleLink: {
    fontSize: moderateScale(13),
    color: Brand.plum,
    fontWeight: '600',
  },
  nextCallSection: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Brand.blush,
    paddingTop: 10,
  },
  nextCallTitle: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: Brand.purple,
  },
  removeLink: {
    fontSize: moderateScale(12),
    color: '#d32f2f',
    fontWeight: '600',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  formButton: {
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fdecec',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  error: {
    flex: 1,
    color: '#d32f2f',
    fontWeight: '600',
    fontSize: moderateScale(12.5),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: Brand.purple,
  },
  countPill: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: Brand.purple,
  },
  list: {
    flex: 1,
  },
  separator: {
    height: 10,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyContent: {
    flexGrow: 1,
  },
});
