import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import NextCallFields from '@/components/calls/NextCallFields';
import ItemDraftForm from '@/components/meetings/ItemDraftForm';
import ItemSelectModal from '@/components/meetings/ItemSelectModal';
import MeetingItemDisplay from '@/components/meetings/MeetingItemDisplay';
import { Brand } from '@/constants/theme';
import { CLIENT_REQUIREMENT_OPTIONS } from '@/constants/meetingItems';
import { useAuth } from '@/hooks/useAuth';
import {
  createMeetingItem,
  deleteMeetingItem,
  updateMeeting,
  updateMeetingItem,
  uploadMeetingItemImages,
} from '@/services/api/meetingsApi';
import { toDateTimeLocalString } from '@/utils/dates';
import { moderateScale } from '@/utils/responsive';

const LABELS = Object.fromEntries(CLIENT_REQUIREMENT_OPTIONS.map((option) => [option.key, option.label]));

function itemLabel(item) {
  return item.itemKey === 'other' ? item.customLabel || 'Other' : LABELS[item.itemKey] || item.itemKey;
}

// Fully controlled — no own state/API calls. Edits are held in the parent's
// `itemEdits` map and only persisted when the card's single Save button is
// pressed, so there's exactly one save action for the whole card.
function MeetingItemEditRow({ item, value, onChange, onRequestDelete }) {
  return (
    <View style={styles.itemEditRow}>
      <View style={styles.itemEditHeader}>
        <Text style={styles.itemEditLabel} numberOfLines={1}>{itemLabel(item)}</Text>
        <Pressable onPress={() => onRequestDelete(item)} style={styles.itemDeleteButton} hitSlop={6}>
          <MaterialIcons name="delete-outline" size={15} color="#d32f2f" />
        </Pressable>
      </View>

      <AppInput
        value={value.description}
        onChangeText={(text) => onChange({ ...value, description: text })}
        placeholder="Description"
        multiline
        style={styles.itemDescriptionInput}
      />

      <View style={styles.quantityRow}>
        <Text style={styles.quantityLabel}>Quantity</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepButton}
            onPress={() => onChange({ ...value, quantity: Math.max(1, value.quantity - 1) })}>
            <Text style={styles.stepButtonText}>{'\u2212'}</Text>
          </Pressable>
          <Text style={styles.quantityValue}>{value.quantity}</Text>
          <Pressable
            style={styles.stepButton}
            onPress={() => onChange({ ...value, quantity: value.quantity + 1 })}>
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function MeetingCard({
  meeting,
  rowKey,
  onRequestDeleteMeeting,
  onChanged,
}) {
  const { employee } = useAuth();
  const hasContent = meeting.items.length > 0;
  const [isEditing, setIsEditing] = useState(!hasContent);
  const [nextMeetingDate, setNextMeetingDate] = useState(
    meeting.nextMeetingDatetime ? new Date(meeting.nextMeetingDatetime) : new Date(),
  );
  // Defaults to the current employee — an unassigned next meeting is
  // invisible on every calendar (backend filters by assignedEmployeeId), so
  // it must never be left null unless explicitly cleared.
  const [nextMeetingEmployeeId, setNextMeetingEmployeeId] = useState(
    meeting.nextMeetingAssignedEmployeeId || employee?.id || null,
  );
  const [itemEdits, setItemEdits] = useState({});
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  function getItemValue(item) {
    return itemEdits[item.id] || { description: item.description || '', quantity: item.quantity };
  }

  function setItemValue(item, value) {
    setItemEdits((prev) => ({ ...prev, [item.id]: value }));
  }

  function handleEdit() {
    setError('');
    setItemEdits({});
    setNextMeetingDate(meeting.nextMeetingDatetime ? new Date(meeting.nextMeetingDatetime) : new Date());
    setNextMeetingEmployeeId(meeting.nextMeetingAssignedEmployeeId || employee?.id || null);
    setIsEditing(true);
  }

  function handleItemSelected(selection) {
    setPendingItem({ ...selection, description: '', quantity: 1, images: [] });
  }

  async function handleConfirmAddItem() {
    if (!pendingItem) return;
    setIsAddingItem(true);
    setError('');
    try {
      const created = await createMeetingItem(rowKey, meeting.id, {
        itemKey: pendingItem.itemKey,
        customLabel: pendingItem.customLabel,
        description: pendingItem.description,
        quantity: pendingItem.quantity,
      });
      if (pendingItem.images?.length) {
        await uploadMeetingItemImages(rowKey, meeting.id, created.id, pendingItem.images);
      }
      await onChanged();
      setPendingItem(null);
    } catch (err) {
      setError(err.message || 'Failed to add item.');
    } finally {
      setIsAddingItem(false);
    }
  }

  async function handleConfirmDeleteItem() {
    if (!pendingDeleteItem) return;
    setIsDeletingItem(true);
    setError('');
    try {
      await deleteMeetingItem(rowKey, meeting.id, pendingDeleteItem.id);
      await onChanged();
      setPendingDeleteItem(null);
    } catch (err) {
      setError(err.message || 'Failed to delete item.');
    } finally {
      setIsDeletingItem(false);
    }
  }

  // The one Save button for the whole card — persists every edited item's
  // description/quantity plus the next-meeting fields together in one go.
  async function handleSaveAll() {
    setIsSaving(true);
    setError('');
    try {
      const nextMeetingChanged =
        toDateTimeLocalString(nextMeetingDate) !==
          (meeting.nextMeetingDatetime ? toDateTimeLocalString(new Date(meeting.nextMeetingDatetime)) : '') ||
        String(nextMeetingEmployeeId || '') !== String(meeting.nextMeetingAssignedEmployeeId || employee?.id || '');

      if (nextMeetingChanged) {
        await updateMeeting(rowKey, meeting.id, {
          nextMeetingDatetime: toDateTimeLocalString(nextMeetingDate),
          nextMeetingAssignedEmployeeId: nextMeetingEmployeeId,
        });
      }

      // Whatever new item is still mid-entry (drafted via "+ Add Item" but
      // never confirmed with its own "Add Item" button) is included here
      // too — otherwise tapping the card's single Save button silently
      // discards it, since handleConfirmAddItem is the only other place
      // that would have persisted it. Mirrors the same safety net in
      // meetings.jsx's handleSaveNewMeeting for the create-meeting flow.
      if (pendingItem) {
        const created = await createMeetingItem(rowKey, meeting.id, {
          itemKey: pendingItem.itemKey,
          customLabel: pendingItem.customLabel,
          description: pendingItem.description,
          quantity: pendingItem.quantity,
        });
        if (pendingItem.images?.length) {
          await uploadMeetingItemImages(rowKey, meeting.id, created.id, pendingItem.images);
        }
      }

      await Promise.all(
        Object.entries(itemEdits).map(([itemId, value]) =>
          updateMeetingItem(rowKey, meeting.id, itemId, {
            description: value.description,
            quantity: value.quantity,
          }),
        ),
      );

      // Wait for the parent's refetch to land BEFORE leaving edit mode —
      // otherwise the card flips to read-only display using the still-stale
      // cached `meeting` prop for a moment, which looks exactly like the
      // edit was lost/reverted (it wasn't — it just hadn't arrived yet).
      await onChanged();
      setItemEdits({});
      setPendingItem(null);
      setIsEditing(false);
    } catch (err) {
      setError(err.message || 'Failed to save meeting.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBadge}>
          <MaterialIcons name="groups" size={16} color={Brand.plum} />
        </View>
        <Text style={styles.date} numberOfLines={1}>{meeting.meetingDatetime}</Text>
      </View>

      {meeting.createdByName || meeting.assignedByEmployeeName ? (
        <View style={styles.metaRow}>
          {meeting.createdByName ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="person" size={12} color={Brand.mauve} />
              <Text style={styles.meta}>Logged by {meeting.createdByName}</Text>
            </View>
          ) : null}
          {meeting.assignedByEmployeeName ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="assignment-ind" size={12} color={Brand.mauve} />
              <Text style={styles.meta}>Assigned by {meeting.assignedByEmployeeName}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <MaterialIcons name="checklist" size={13} color={Brand.mauve} />
        <Text style={styles.sectionLabel}>Requirements</Text>
        {meeting.items.length > 0 ? (
          <View style={styles.sectionCountPill}>
            <Text style={styles.sectionCountText}>{meeting.items.length}</Text>
          </View>
        ) : null}
      </View>

      {meeting.items.length === 0 && !isEditing ? (
        <View style={styles.emptyItemsBox}>
          <Text style={styles.emptyItems}>No requirements added.</Text>
        </View>
      ) : null}

      {isEditing
        ? meeting.items.map((item) => (
            <MeetingItemEditRow
              key={item.id}
              item={item}
              value={getItemValue(item)}
              onChange={(value) => setItemValue(item, value)}
              onRequestDelete={setPendingDeleteItem}
            />
          ))
        : meeting.items.map((item) => <MeetingItemDisplay key={item.id} item={item} />)}

      {isEditing ? (
        pendingItem ? (
          <ItemDraftForm
            selectedItem={pendingItem}
            value={pendingItem}
            onChange={setPendingItem}
            onAdd={handleConfirmAddItem}
            onCancel={() => setPendingItem(null)}
          />
        ) : (
          <Pressable style={styles.selectItemButton} onPress={() => setIsPickerOpen(true)}>
            <MaterialIcons name="add" size={16} color={Brand.plum} />
            <Text style={styles.selectItemButtonText}>{isAddingItem ? 'Adding...' : 'Add Item'}</Text>
          </Pressable>
        )
      ) : null}

      <View style={styles.nextPill}>
        <MaterialIcons name="schedule" size={13} color={meeting.nextMeetingDatetime ? '#059669' : Brand.mauve} />
        <Text style={[styles.next, !meeting.nextMeetingDatetime && styles.nextEmpty]} numberOfLines={1}>
          Next meeting:{' '}
          {meeting.nextMeetingDatetime
            ? `${meeting.nextMeetingDatetime}${
                meeting.nextMeetingAssignedEmployeeName ? ` \u00b7 ${meeting.nextMeetingAssignedEmployeeName}` : ''
              }`
            : 'Not scheduled'}
        </Text>
      </View>

      {isEditing ? (
        <View style={styles.form}>
          <Text style={styles.nextMeetingLabel}>Next Meeting</Text>
          <NextCallFields
            value={nextMeetingDate}
            onChange={setNextMeetingDate}
            employeeId={nextMeetingEmployeeId}
            onEmployeeChange={setNextMeetingEmployeeId}
          />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.footerActions}>
        {isEditing ? (
          <AppButton title="Save" onPress={handleSaveAll} loading={isSaving} style={styles.footerButton} />
        ) : (
          <AppButton title="Edit" variant="outline" onPress={handleEdit} style={styles.footerButton} />
        )}
        <AppButton
          title="Delete"
          variant="danger"
          onPress={() => onRequestDeleteMeeting(meeting.id)}
          style={styles.footerButton}
        />
      </View>

      <ItemSelectModal
        visible={isPickerOpen}
        existingKeys={meeting.items.map((item) => item.itemKey)}
        onSelect={handleItemSelected}
        onClose={() => setIsPickerOpen(false)}
      />

      <ConfirmDialog
        visible={pendingDeleteItem !== null}
        title="Delete this item?"
        message={
          pendingDeleteItem
            ? `Remove "${itemLabel(pendingDeleteItem)}" and its images? This cannot be undone.`
            : ''
        }
        confirmLabel="Yes, delete"
        isConfirming={isDeletingItem}
        onCancel={() => setPendingDeleteItem(null)}
        onConfirm={handleConfirmDeleteItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: 'rgba(91,55,101,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(13.5),
    fontWeight: '700',
    color: Brand.purple,
  },
  metaRow: {
    gap: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  meta: {
    fontSize: moderateScale(11.5),
    color: Brand.mauve,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemDeleteButton: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(211,47,47,0.08)',
  },
  sectionLabel: {
    fontSize: moderateScale(11.5),
    fontWeight: '800',
    color: Brand.mauve,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionCountPill: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  sectionCountText: {
    fontSize: moderateScale(10.5),
    fontWeight: '800',
    color: Brand.purple,
  },
  emptyItemsBox: {
    backgroundColor: 'rgba(0,0,0,0.025)',
    borderRadius: 10,
    padding: 10,
  },
  emptyItems: {
    fontSize: moderateScale(13),
    color: Brand.mauve,
    fontStyle: 'italic',
  },
  itemEditRow: {
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  itemEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemEditLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: Brand.purple,
  },
  itemDescriptionInput: {
    minHeight: 50,
    textAlignVertical: 'top',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityLabel: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: Brand.mauve,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Brand.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    fontSize: moderateScale(16),
    color: Brand.plum,
    fontWeight: '700',
  },
  quantityValue: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: Brand.purple,
    minWidth: 20,
    textAlign: 'center',
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
    marginTop: 4,
  },
  selectItemButtonText: {
    fontSize: moderateScale(13),
    color: Brand.plum,
    fontWeight: '700',
  },
  error: {
    color: '#d32f2f',
    fontSize: moderateScale(13),
  },
  nextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  next: {
    fontSize: moderateScale(11.5),
    color: '#059669',
    fontWeight: '700',
    flexShrink: 1,
  },
  nextEmpty: {
    color: Brand.mauve,
    fontWeight: '600',
  },
  nextMeetingLabel: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: Brand.purple,
  },
  form: {
    marginTop: 6,
    gap: 10,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  footerButton: {
    flex: 1,
  },
});
