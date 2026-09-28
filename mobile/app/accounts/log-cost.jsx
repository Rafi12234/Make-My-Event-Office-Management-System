import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import AppButton from '@/components/common/AppButton';
import ExpenseItemCard from '@/components/accounts/ExpenseItemCard';
import ScreenContainer from '@/components/common/ScreenContainer';
import { Brand } from '@/constants/theme';
import { useBookedEvents, useSubmitExpense, useVendors } from '@/hooks/useAccounts';
import { formatDisplayDate } from '@/utils/dates';
import { formatTaka } from '@/utils/money';
import { moderateScale } from '@/utils/responsive';

const COST_TYPES = [
  { value: 'event', title: 'Event Based Cost', description: 'Money spent for a specific confirmed client event.' },
  { value: 'regular', title: 'Regular Cost', description: 'Day-to-day office spending, not tied to any event.' },
];

function emptyItem() {
  return {
    purpose: '',
    costDate: new Date().toISOString().slice(0, 10),
    quantity: '1',
    perQtyAmount: '',
    vendorId: '',
    paymentStatus: 'paid',
    receiptAsset: null,
  };
}

// Mirrors the web Accounts module's LogCostPage/ExpenseForm — choose Event
// Based or Regular, fill in item cards, then permanently lock it in with
// Submit Cost (no edit/delete afterwards).
export default function LogCostScreen() {
  const router = useRouter();
  const { data: vendors } = useVendors();
  const [costType, setCostType] = useState('regular');
  const { data: events } = useBookedEvents(costType === 'event');
  const [selectedRowKey, setSelectedRowKey] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [error, setError] = useState('');
  const [invalidIndex, setInvalidIndex] = useState(-1);
  const submitExpense = useSubmitExpense();

  const vendorList = vendors || [];
  const eventList = events || [];
  const selectedEvent = eventList.find((event) => event.rowKey === selectedRowKey);

  const walletDeduction = items.reduce((sum, item) => {
    if (item.vendorId && item.paymentStatus === 'to_pay') return sum;
    return sum + (Number(item.quantity) || 0) * (Number(item.perQtyAmount) || 0);
  }, 0);

  function updateItem(index, next) {
    setItems((current) => current.map((item, i) => (i === index ? next : item)));
    setInvalidIndex(-1);
  }

  function removeItem(index) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  async function handleSubmit() {
    setError('');
    setInvalidIndex(-1);

    if (costType === 'event' && !selectedRowKey) {
      setError('Select which confirmed event this cost belongs to.');
      return;
    }

    const badIndex = items.findIndex((item) => {
      const quantity = Number(item.quantity);
      const perQtyAmount = Number(item.perQtyAmount);
      return (
        !item.purpose.trim() ||
        !item.costDate ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(perQtyAmount) ||
        perQtyAmount < 0
      );
    });
    if (badIndex !== -1) {
      setInvalidIndex(badIndex);
      setError(`Item ${badIndex + 1} is missing a purpose, date, quantity or amount.`);
      return;
    }

    try {
      await submitExpense.mutateAsync({
        costType,
        linkedRowKey: costType === 'event' ? selectedRowKey : null,
        items,
      });
      router.back();
    } catch (err) {
      setError(err.message || 'Could not submit this cost.');
    }
  }

  return (
    <ScreenContainer scroll avoidKeyboard>
      <Stack.Screen options={{ headerShown: true, title: 'Log a New Cost' }} />

      <View style={styles.form}>
        <Text style={styles.label}>What kind of cost is this?</Text>
        <View style={styles.costTypeRow}>
          {COST_TYPES.map((option) => {
            const isActive = costType === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setCostType(option.value);
                  if (option.value === 'regular') setSelectedRowKey('');
                  setError('');
                }}
                style={[styles.costTypeCard, isActive && styles.costTypeCardActive]}>
                <Text style={[styles.costTypeTitle, isActive && styles.costTypeTitleActive]}>{option.title}</Text>
                <Text style={[styles.costTypeDescription, isActive && styles.costTypeDescriptionActive]}>
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {costType === 'event' ? (
          <View>
            <Text style={styles.label}>Which confirmed event?</Text>
            {eventList.length === 0 ? (
              <Text style={styles.emptyHint}>
                No upcoming booked events. An event must be confirmed and finalized with us to log a cost against it.
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {eventList.map((event) => {
                  const isSelected = selectedRowKey === event.rowKey;
                  return (
                    <Pressable
                      key={event.rowKey}
                      onPress={() => setSelectedRowKey(event.rowKey)}
                      style={[styles.eventChip, isSelected && styles.eventChipSelected]}>
                      <Text style={[styles.eventChipText, isSelected && styles.eventChipTextSelected]} numberOfLines={1}>
                        {event.clientName || 'Unnamed client'}
                      </Text>
                      <Text style={[styles.eventChipDate, isSelected && styles.eventChipTextSelected]}>
                        {formatDisplayDate(event.eventDate)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        ) : null}

        <View style={styles.itemsHeader}>
          <Text style={styles.label}>Cost Items ({items.length})</Text>
          <Pressable style={styles.addItemButton} onPress={addItem}>
            <MaterialIcons name="add" size={16} color={Brand.purple} />
            <Text style={styles.addItemButtonText}>Add another item</Text>
          </Pressable>
        </View>

        <View style={styles.itemList}>
          {items.map((item, index) => (
            <ExpenseItemCard
              key={index}
              index={index}
              item={item}
              vendors={vendorList}
              onChange={(next) => updateItem(index, next)}
              onRemove={() => removeItem(index)}
              canRemove={items.length > 1}
              isInvalid={index === invalidIndex}
            />
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.lockNotice}>Once submitted, this cost is locked permanently — it cannot be edited or deleted.</Text>

        <View style={styles.footer}>
          <Text style={styles.footerLabel}>Leaves wallet now</Text>
          <Text style={styles.footerAmount}>−{formatTaka(walletDeduction)}</Text>
        </View>

        <View style={styles.actions}>
          <AppButton title="Cancel" variant="outline" onPress={() => router.back()} style={styles.actionButton} />
          <AppButton
            title={submitExpense.isPending ? 'Submitting…' : 'Submit Cost'}
            onPress={handleSubmit}
            loading={submitExpense.isPending}
            style={styles.actionButton}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  label: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: Brand.purple,
    marginBottom: 8,
  },
  costTypeRow: {
    gap: 10,
  },
  costTypeCard: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 14,
    padding: 14,
    gap: 3,
  },
  costTypeCardActive: {
    borderColor: Brand.plum,
    backgroundColor: 'rgba(91,55,101,0.06)',
  },
  costTypeTitle: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: Brand.purple,
  },
  costTypeTitleActive: {
    color: Brand.plum,
  },
  costTypeDescription: {
    fontSize: moderateScale(11.5),
    color: Brand.mauve,
  },
  costTypeDescriptionActive: {
    color: Brand.purple,
  },
  emptyHint: {
    fontSize: moderateScale(12),
    color: Brand.mauve,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 10,
    padding: 12,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  eventChip: {
    borderWidth: 1,
    borderColor: Brand.pink,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: 180,
    gap: 2,
  },
  eventChipSelected: {
    backgroundColor: Brand.plum,
    borderColor: Brand.plum,
  },
  eventChipText: {
    fontSize: moderateScale(12.5),
    fontWeight: '700',
    color: Brand.purple,
  },
  eventChipDate: {
    fontSize: moderateScale(10.5),
    color: Brand.mauve,
  },
  eventChipTextSelected: {
    color: '#fff',
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -4,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addItemButtonText: {
    fontSize: moderateScale(11.5),
    fontWeight: '700',
    color: Brand.purple,
  },
  itemList: {
    gap: 12,
  },
  error: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#d32f2f',
  },
  lockNotice: {
    fontSize: moderateScale(11),
    color: Brand.mauve,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 10,
    padding: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    color: Brand.mauve,
  },
  footerAmount: {
    fontSize: moderateScale(20),
    fontWeight: '800',
    color: '#e11d48',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
  },
});
