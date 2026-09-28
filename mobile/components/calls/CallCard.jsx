import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import NextCallFields from '@/components/calls/NextCallFields';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { toDateTimeLocalString } from '@/utils/dates';
import { moderateScale } from '@/utils/responsive';

// Mirrors the web ClientCallsPage's CallCard: a call only "counts" once it
// has a discussion note, so a blank one stays unlocked; otherwise Edit must
// be tapped before the discussion/next-call fields become editable again.
export default function CallCard({ call, onSave, onRequestDelete, isSaving }) {
  const { employee } = useAuth();
  const hasContent = Boolean(call.callDiscussion && call.callDiscussion.trim());
  const [isEditing, setIsEditing] = useState(!hasContent);
  const [discussion, setDiscussion] = useState(call.callDiscussion || '');
  const [nextCallDate, setNextCallDate] = useState(
    call.nextCallDatetime ? new Date(call.nextCallDatetime) : new Date(),
  );
  // Defaults to the current employee — an unassigned next call is invisible
  // on every calendar (backend filters by assignedEmployeeId), so it must
  // never be left null unless the employee explicitly clears it.
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(
    call.nextCallAssignedEmployeeId || employee?.id || null,
  );
  const [error, setError] = useState('');

  const fieldsLocked = hasContent && !isEditing;

  function handleEdit() {
    setError('');
    setIsEditing(true);
  }

  function handleCancel() {
    setError('');
    setDiscussion(call.callDiscussion || '');
    setNextCallDate(call.nextCallDatetime ? new Date(call.nextCallDatetime) : new Date());
    setAssignedEmployeeId(call.nextCallAssignedEmployeeId || employee?.id || null);
    setIsEditing(false);
  }

  async function handleSave() {
    if (!discussion.trim()) {
      setError('Add a discussion note before saving.');
      return;
    }
    // Wait for the parent's save + refetch before leaving edit mode —
    // otherwise the card flips to read-only display using the still-stale
    // cached `call` prop for a moment, which looks like the edit was lost.
    await onSave(call.id, {
      callDiscussion: discussion.trim(),
      nextCallDatetime: toDateTimeLocalString(nextCallDate),
      nextCallAssignedEmployeeId: assignedEmployeeId,
    });
    setIsEditing(false);
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconBadge}>
          <MaterialIcons name="call" size={16} color={Brand.plum} />
        </View>
        <Text style={styles.date} numberOfLines={1}>
          {call.callDatetime}
        </Text>
        <View style={styles.headerActions}>
          {hasContent && !isEditing ? (
            <Pressable onPress={handleEdit} style={styles.iconButton} hitSlop={6}>
              <MaterialIcons name="edit" size={16} color={Brand.plum} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => onRequestDelete(call.id)} style={[styles.iconButton, styles.deleteIconButton]} hitSlop={6}>
            <MaterialIcons name="delete-outline" size={16} color="#d32f2f" />
          </Pressable>
        </View>
      </View>

      {fieldsLocked ? (
        call.callDiscussion ? (
          <View style={styles.discussionBox}>
            <Text style={styles.discussion}>{call.callDiscussion}</Text>
          </View>
        ) : null
      ) : (
        <AppInput
          value={discussion}
          onChangeText={setDiscussion}
          placeholder="What was discussed?"
          multiline
          style={styles.discussionInput}
        />
      )}

      {call.createdByName || call.assignedByEmployeeName ? (
        <View style={styles.metaRow}>
          {call.createdByName ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="person" size={12} color={Brand.mauve} />
              <Text style={styles.meta}>Logged by {call.createdByName}</Text>
            </View>
          ) : null}
          {call.assignedByEmployeeName ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="assignment-ind" size={12} color={Brand.mauve} />
              <Text style={styles.meta}>Assigned by {call.assignedByEmployeeName}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {!isEditing && call.nextCallDatetime ? (
        <View style={styles.nextPill}>
          <MaterialIcons name="schedule" size={13} color="#059669" />
          <Text style={styles.next} numberOfLines={1}>
            Next call: {call.nextCallDatetime}
            {call.nextCallAssignedEmployeeName ? ` \u00b7 ${call.nextCallAssignedEmployeeName}` : ''}
          </Text>
        </View>
      ) : null}

      {isEditing ? (
        <View style={styles.form}>
          <Text style={styles.nextCallLabel}>Next Call</Text>
          <NextCallFields
            value={nextCallDate}
            onChange={setNextCallDate}
            employeeId={assignedEmployeeId}
            onEmployeeChange={setAssignedEmployeeId}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.formActions}>
            {hasContent ? (
              <AppButton title="Cancel" variant="outline" onPress={handleCancel} style={styles.formButton} />
            ) : null}
            <AppButton title="Save" onPress={handleSave} loading={isSaving} style={styles.formButton} />
          </View>
        </View>
      ) : null}
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
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91,55,101,0.08)',
  },
  deleteIconButton: {
    backgroundColor: 'rgba(211,47,47,0.08)',
  },
  date: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(13.5),
    fontWeight: '700',
    color: Brand.purple,
  },
  discussionBox: {
    backgroundColor: 'rgba(0,0,0,0.025)',
    borderRadius: 12,
    padding: 12,
  },
  discussion: {
    fontSize: moderateScale(14),
    color: Brand.purple,
    lineHeight: moderateScale(20),
  },
  discussionInput: {
    minHeight: 70,
    textAlignVertical: 'top',
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
  nextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(5,150,105,0.08)',
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
  nextCallLabel: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: Brand.purple,
  },
  form: {
    marginTop: 4,
    gap: 10,
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  formButton: {
    flex: 1,
  },
  error: {
    color: '#d32f2f',
    fontSize: moderateScale(13),
  },
});
