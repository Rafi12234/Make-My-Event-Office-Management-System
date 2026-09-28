import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';

import AppButton from '@/components/common/AppButton';
import NextCallFields from '@/components/calls/NextCallFields';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import ItemSelectModal from '@/components/meetings/ItemSelectModal';
import ItemDraftForm from '@/components/meetings/ItemDraftForm';
import MeetingCard from '@/components/meetings/MeetingCard';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import LoadingScreen from '@/components/common/LoadingScreen';
import ScreenContainer from '@/components/common/ScreenContainer';
import { Brand } from '@/constants/theme';
import { queryKeys } from '@/constants/queryKeys';
import { useAuth } from '@/hooks/useAuth';
import { useMeetings } from '@/hooks/useMeetings';
import {
  createMeeting,
  createMeetingItem,
  deleteMeeting,
  updateMeeting,
  uploadMeetingItemImages,
} from '@/services/api/meetingsApi';
import { todayDateString, toDateTimeLocalString } from '@/utils/dates';
import { moderateScale } from '@/utils/responsive';

let draftIdCounter = 0;

export default function MeetingsScreen() {
  const { rowKey } = useLocalSearchParams();
  const { employee } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useMeetings(rowKey);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState(null);
  const [showNextMeeting, setShowNextMeeting] = useState(false);
  const [nextMeetingDate, setNextMeetingDate] = useState(new Date());
  const [nextMeetingEmployeeId, setNextMeetingEmployeeId] = useState(employee?.id || null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingDeleteMeetingId, setPendingDeleteMeetingId] = useState(null);
  const [isDeletingMeeting, setIsDeletingMeeting] = useState(false);

  if (isLoading) {
    return <LoadingScreen message="Loading meetings..." />;
  }

  if (isError) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
  }

  const meetings = data?.meetings || [];

  function resetCreateForm() {
    setShowCreateForm(false);
    setDraftItems([]);
    setPendingItem(null);
    setShowNextMeeting(false);
    setNextMeetingDate(new Date());
    setNextMeetingEmployeeId(employee?.id || null);
    setFormError('');
  }

  function handleItemSelected(selection) {
    setPendingItem({ ...selection, description: '', quantity: 1, images: [] });
  }

  function handleConfirmPendingItem() {
    if (!pendingItem) return;
    draftIdCounter += 1;
    setDraftItems((prev) => [...prev, { id: `draft_${draftIdCounter}`, ...pendingItem }]);
    setPendingItem(null);
  }

  function handleRemoveDraftItem(draftId) {
    setDraftItems((prev) => prev.filter((item) => item.id !== draftId));
  }

  // Meeting scheduling changes drive the calendar's client_next_meeting
  // events — refreshing calendar/workspace keeps the Dashboard and client
  // detail screen in sync immediately, same as the calls flow.
  async function refreshDependentData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings(rowKey) }),
      queryClient.invalidateQueries({ queryKey: ['calendar'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace }),
    ]);
  }

  async function handleSaveNewMeeting() {
    setFormError('');

    if (showNextMeeting && toDateTimeLocalString(nextMeetingDate).slice(0, 10) < todayDateString()) {
      setFormError('Next meeting date cannot be before today.');
      return;
    }

    // Whatever item is still mid-entry (even if "Add Item" was never
    // tapped) is included automatically — nothing typed gets silently lost.
    const itemsToSave = pendingItem ? [...draftItems, pendingItem] : draftItems;

    setIsSaving(true);
    try {
      const created = await createMeeting(rowKey);
      for (const item of itemsToSave) {
        const createdItem = await createMeetingItem(rowKey, created.id, {
          itemKey: item.itemKey,
          customLabel: item.customLabel,
          description: item.description,
          quantity: item.quantity,
        });
        if (item.images?.length) {
          await uploadMeetingItemImages(rowKey, created.id, createdItem.id, item.images);
        }
      }
      if (showNextMeeting) {
        await updateMeeting(rowKey, created.id, {
          nextMeetingDatetime: toDateTimeLocalString(nextMeetingDate),
          nextMeetingAssignedEmployeeId: nextMeetingEmployeeId,
        });
      }
      resetCreateForm();
      await refreshDependentData();
    } catch (err) {
      setFormError(err.message || 'Failed to save meeting.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmDeleteMeeting() {
    const meetingId = pendingDeleteMeetingId;
    setIsDeletingMeeting(true);
    setFormError('');
    try {
      await deleteMeeting(rowKey, meetingId);
      setPendingDeleteMeetingId(null);
      await refreshDependentData();
    } catch (err) {
      setFormError(err.message || 'Failed to delete meeting.');
    } finally {
      setIsDeletingMeeting(false);
    }
  }

  return (
    <ScreenContainer avoidKeyboard>
      <Stack.Screen options={{ headerShown: true, title: data?.clientName || 'Meetings' }} />

      <View style={styles.header}>
        <Text style={styles.pageTitle}>Meeting History</Text>
        <Text style={styles.pageSubtitle}>
          {meetings.length} meeting{meetings.length === 1 ? '' : 's'} logged
        </Text>
      </View>

      {!showCreateForm ? (
        <Pressable style={styles.createButton} onPress={() => setShowCreateForm(true)}>
          <MaterialIcons name="event-available" size={18} color="#fff" />
          <Text style={styles.createButtonText}>Log New Meeting</Text>
        </Pressable>
      ) : (
        <View style={styles.logSection}>
          <Text style={styles.formTitle}>Requirements</Text>

          {draftItems.map((item) => (
            <View key={item.id} style={styles.draftRow}>
              <View style={styles.draftIconBadge}>
                <MaterialIcons name="checklist" size={14} color={Brand.plum} />
              </View>
              <View style={styles.draftInfo}>
                <Text style={styles.draftLabel} numberOfLines={1}>{item.label}</Text>
                <Text style={styles.draftMeta}>
                  Qty: {item.quantity}
                  {item.images?.length ? ` \u00b7 ${item.images.length} photo(s)` : ''}
                </Text>
              </View>
              <Pressable onPress={() => handleRemoveDraftItem(item.id)} style={styles.draftRemoveButton} hitSlop={6}>
                <MaterialIcons name="close" size={15} color="#d32f2f" />
              </Pressable>
            </View>
          ))}

          {pendingItem ? (
            <ItemDraftForm
              selectedItem={pendingItem}
              value={pendingItem}
              onChange={setPendingItem}
              onAdd={handleConfirmPendingItem}
              onCancel={() => setPendingItem(null)}
            />
          ) : (
            <Pressable style={styles.selectItemButton} onPress={() => setIsPickerOpen(true)}>
              <MaterialIcons name="add" size={16} color={Brand.plum} />
              <Text style={styles.selectItemButtonText}>Select Requirement</Text>
            </Pressable>
          )}

          {!showNextMeeting ? (
            <Pressable style={styles.scheduleLinkRow} onPress={() => setShowNextMeeting(true)}>
              <MaterialIcons name="add-alarm" size={15} color={Brand.plum} />
              <Text style={styles.scheduleLink}>Schedule next meeting</Text>
            </Pressable>
          ) : (
            <View style={styles.nextMeetingSection}>
              <Text style={styles.nextMeetingTitle}>Next Meeting</Text>
              <NextCallFields
                value={nextMeetingDate}
                onChange={setNextMeetingDate}
                employeeId={nextMeetingEmployeeId}
                onEmployeeChange={setNextMeetingEmployeeId}
              />
              <Pressable onPress={() => setShowNextMeeting(false)}>
                <Text style={styles.removeLink}>Remove next meeting</Text>
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
              onPress={handleSaveNewMeeting}
              loading={isSaving}
              style={styles.formButton}
            />
          </View>

          <ItemSelectModal
            visible={isPickerOpen}
            existingKeys={draftItems.map((item) => item.itemKey)}
            onSelect={handleItemSelected}
            onClose={() => setIsPickerOpen(false)}
          />
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Meetings</Text>
        {meetings.length > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{meetings.length}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        style={styles.list}
        data={meetings}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <MeetingCard
            meeting={item}
            rowKey={rowKey}
            onRequestDeleteMeeting={setPendingDeleteMeetingId}
            onChanged={refreshDependentData}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<EmptyState title="No meetings yet" message="Create the first meeting above." />}
        contentContainerStyle={meetings.length === 0 ? styles.emptyContent : styles.listContent}
      />

      <ConfirmDialog
        visible={pendingDeleteMeetingId !== null}
        title="Delete this meeting?"
        message="This meeting and all its images will be permanently removed. This cannot be undone."
        confirmLabel="Yes, delete"
        isConfirming={isDeletingMeeting}
        onCancel={() => setPendingDeleteMeetingId(null)}
        onConfirm={handleConfirmDeleteMeeting}
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
  formTitle: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    color: Brand.mauve,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 8,
  },
  draftIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(91,55,101,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  draftLabel: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: Brand.purple,
  },
  draftMeta: {
    fontSize: moderateScale(12),
    color: Brand.mauve,
  },
  draftRemoveButton: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(211,47,47,0.08)',
  },
  selectItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Brand.pink,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
  },
  selectItemButtonText: {
    fontSize: moderateScale(13),
    color: Brand.plum,
    fontWeight: '700',
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
  nextMeetingSection: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Brand.blush,
    paddingTop: 10,
  },
  nextMeetingTitle: {
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
