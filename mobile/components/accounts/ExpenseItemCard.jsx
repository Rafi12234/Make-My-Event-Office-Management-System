import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Brand } from '@/constants/theme';
import { formatDisplayDate, toDateInputString } from '@/utils/dates';
import { formatTaka } from '@/utils/money';
import { moderateScale } from '@/utils/responsive';

// One card per cost line item — mirrors the web Accounts module's
// ExpenseItemsTable row, adapted to a stacked card instead of a wide,
// resizable-column table (which doesn't translate to a phone screen).
// Vendor is optional; picking one requires a payment status: only "Paid"
// reduces the wallet, "To Pay" only records a vendor liability.
export default function ExpenseItemCard({ index, item, vendors, onChange, onRemove, canRemove, isInvalid }) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerError, setPickerError] = useState('');

  const quantity = Number(item.quantity) || 0;
  const perQtyAmount = Number(item.perQtyAmount) || 0;
  const total = quantity * perQtyAmount;
  const isPending = Boolean(item.vendorId) && item.paymentStatus === 'to_pay';
  const selectedVendor = vendors.find((vendor) => String(vendor.id) === String(item.vendorId));

  const impactNote = !item.vendorId
    ? 'No vendor — comes straight out of your wallet.'
    : isPending
      ? 'Order placed only. Recorded as money owed to this vendor.'
      : 'Paying this vendor now — deducted from your wallet.';

  function patch(fields) {
    onChange({ ...item, ...fields });
  }

  function handleDateChange(event, selectedDate) {
    setShowDatePicker(false);
    if (selectedDate) patch({ costDate: toDateInputString(selectedDate) });
  }

  function stepQuantity(delta) {
    patch({ quantity: String(Math.max(0, quantity + delta)) });
  }

  async function handlePickReceipt() {
    setPickerError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPickerError(
          permission.canAskAgain === false
            ? 'Photo access is blocked. Enable it for this app in your phone Settings.'
            : 'Gallery permission is required to attach a receipt.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled) return;
      patch({ receiptAsset: result.assets[0] });
    } catch (err) {
      setPickerError(err?.message || 'Failed to open the photo gallery.');
    }
  }

  return (
    <View style={[styles.card, isInvalid && styles.cardInvalid]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>Item {index + 1}</Text>
        {canRemove ? (
          <Pressable onPress={onRemove} style={styles.removeButton}>
            <MaterialIcons name="delete-outline" size={18} color="#e11d48" />
          </Pressable>
        ) : null}
      </View>

      <TextInput
        style={styles.input}
        value={item.purpose}
        onChangeText={(text) => patch({ purpose: text })}
        placeholder="What was this for? e.g. Stage decoration flowers"
        placeholderTextColor={Brand.mauve}
      />

      <View style={styles.row}>
        <Pressable style={[styles.input, styles.dateField]} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateFieldText}>{item.costDate ? formatDisplayDate(item.costDate) : 'Pick date'}</Text>
        </Pressable>
        {showDatePicker ? (
          <DateTimePicker value={item.costDate ? new Date(item.costDate) : new Date()} mode="date" onChange={handleDateChange} />
        ) : null}
      </View>

      <View style={styles.row}>
        <View style={styles.quantityGroup}>
          <Text style={styles.smallLabel}>Quantity</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepButton} onPress={() => stepQuantity(-1)}>
              <Text style={styles.stepButtonText}>{'\u2212'}</Text>
            </Pressable>
            <TextInput
              style={styles.quantityInput}
              value={String(item.quantity)}
              onChangeText={(text) => patch({ quantity: text })}
              keyboardType="decimal-pad"
            />
            <Pressable style={styles.stepButton} onPress={() => stepQuantity(1)}>
              <Text style={styles.stepButtonText}>+</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.amountGroup}>
          <Text style={styles.smallLabel}>Amount / qty</Text>
          <View style={styles.amountInputWrap}>
            <Text style={styles.currencySign}>৳</Text>
            <TextInput
              style={styles.amountInput}
              value={String(item.perQtyAmount)}
              onChangeText={(text) => patch({ perQtyAmount: text })}
              placeholder="0.00"
              placeholderTextColor={Brand.mauve}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.smallLabel}>Item total</Text>
        <Text style={[styles.totalValue, isPending && styles.pendingText]}>{formatTaka(total)}</Text>
      </View>

      <Text style={styles.smallLabel}>Vendor</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Pressable
          onPress={() => patch({ vendorId: '', paymentStatus: 'paid' })}
          style={[styles.chip, !item.vendorId && styles.chipSelected]}>
          <Text style={[styles.chipText, !item.vendorId && styles.chipTextSelected]}>No vendor</Text>
        </Pressable>
        {vendors.map((vendor) => {
          const isSelected = String(item.vendorId) === String(vendor.id);
          return (
            <Pressable
              key={vendor.id}
              onPress={() => patch({ vendorId: vendor.id, paymentStatus: item.paymentStatus || 'paid' })}
              style={[styles.chip, isSelected && styles.chipSelected]}>
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]} numberOfLines={1}>
                {vendor.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.statusRow}>
        {['paid', 'to_pay'].map((status) => {
          const isActive = item.paymentStatus === status;
          return (
            <Pressable
              key={status}
              disabled={!item.vendorId}
              onPress={() => patch({ paymentStatus: status })}
              style={[
                styles.statusButton,
                !item.vendorId && styles.statusButtonDisabled,
                isActive && (status === 'paid' ? styles.statusButtonPaid : styles.statusButtonPending),
              ]}>
              <Text style={[styles.statusButtonText, isActive && styles.statusButtonTextActive]}>
                {status === 'paid' ? 'Paid' : 'To Pay'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.impactNote}>{impactNote}</Text>

      <Text style={styles.smallLabel}>Receipt (optional)</Text>
      {item.receiptAsset ? (
        <View style={styles.receiptRow}>
          <Image source={{ uri: item.receiptAsset.uri }} style={styles.receiptThumb} />
          <Pressable style={styles.receiptRemove} onPress={() => patch({ receiptAsset: null })}>
            <MaterialIcons name="close" size={14} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.attachButton} onPress={handlePickReceipt}>
          <MaterialIcons name="add-a-photo" size={16} color={Brand.plum} />
          <Text style={styles.attachButtonText}>Attach receipt</Text>
        </Pressable>
      )}
      {pickerError ? <Text style={styles.pickerError}>{pickerError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cardInvalid: {
    borderColor: '#fca5a5',
    backgroundColor: '#fff1f2',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIndex: {
    fontSize: moderateScale(11),
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Brand.mauve,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: moderateScale(13),
    color: Brand.purple,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    flex: 1,
    justifyContent: 'center',
  },
  dateFieldText: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: Brand.purple,
  },
  smallLabel: {
    fontSize: moderateScale(10.5),
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: Brand.mauve,
    marginTop: 2,
  },
  quantityGroup: {
    flex: 1,
    gap: 4,
  },
  amountGroup: {
    flex: 1,
    gap: 4,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepButton: {
    width: 32,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    fontSize: moderateScale(16),
    fontWeight: '800',
    color: Brand.purple,
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: Brand.purple,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  currencySign: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: Brand.mauve,
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: Brand.purple,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  totalValue: {
    fontSize: moderateScale(14),
    fontWeight: '800',
    color: Brand.purple,
  },
  pendingText: {
    color: '#b45309',
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1,
    borderColor: Brand.pink,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 160,
  },
  chipSelected: {
    backgroundColor: Brand.plum,
    borderColor: Brand.plum,
  },
  chipText: {
    fontSize: moderateScale(12),
    color: Brand.purple,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  statusButtonDisabled: {
    opacity: 0.4,
  },
  statusButtonPaid: {
    backgroundColor: '#059669',
  },
  statusButtonPending: {
    backgroundColor: '#f59e0b',
  },
  statusButtonText: {
    fontSize: moderateScale(11.5),
    fontWeight: '700',
    color: Brand.mauve,
  },
  statusButtonTextActive: {
    color: '#fff',
  },
  impactNote: {
    fontSize: moderateScale(10.5),
    color: Brand.mauve,
  },
  attachButton: {
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
  attachButtonText: {
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: Brand.plum,
  },
  receiptRow: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  receiptThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  receiptRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#d32f2f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerError: {
    fontSize: moderateScale(11),
    color: '#d32f2f',
  },
});
