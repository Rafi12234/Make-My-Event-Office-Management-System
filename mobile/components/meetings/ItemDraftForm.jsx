import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import AppButton from '@/components/common/AppButton';
import { Brand } from '@/constants/theme';
import { moderateScale } from '@/utils/responsive';

// Shown right after picking a requirement in ItemSelectModal — collects the
// full input the website's item row supports (description, quantity,
// photos). Fully controlled: the parent screen owns `value` so it always
// has the latest in-progress item, even if "Add Item" is never tapped
// (e.g. the overall Save button is used instead) — nothing gets lost.
export default function ItemDraftForm({ selectedItem, value, onChange, onAdd, onCancel }) {
  const [error, setError] = useState('');
  const { description, quantity, images } = value;

  async function handlePickImages() {
    setError('');
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(
          permission.canAskAgain === false
            ? 'Photo access is blocked. Enable it for this app in your phone Settings.'
            : 'Gallery permission is required to attach photos.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (result.canceled) return;
      onChange({ ...value, images: [...images, ...result.assets] });
    } catch (err) {
      // Without this, a thrown/rejected picker call fails completely
      // silently — the button looks like it just does nothing.
      setError(err?.message || 'Failed to open the photo gallery.');
    }
  }

  function handleRemoveImage(uri) {
    onChange({ ...value, images: images.filter((asset) => asset.uri !== uri) });
  }

  function handleConfirmAdd() {
    onAdd();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.itemLabel}>{selectedItem.label}</Text>

      <TextInput
        style={styles.descriptionInput}
        placeholder="Describe this item..."
        value={description}
        onChangeText={(text) => onChange({ ...value, description: text })}
        multiline
        placeholderTextColor={Brand.mauve}
      />

      <View style={styles.quantityRow}>
        <Text style={styles.quantityLabel}>Quantity</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepButton}
            onPress={() => onChange({ ...value, quantity: Math.max(1, quantity - 1) })}>
            <Text style={styles.stepButtonText}>{'\u2212'}</Text>
          </Pressable>
          <Text style={styles.quantityValue}>{quantity}</Text>
          <Pressable style={styles.stepButton} onPress={() => onChange({ ...value, quantity: quantity + 1 })}>
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.uploadButton} onPress={handlePickImages}>
        <Text style={styles.uploadButtonText}>+ Upload Images from Gallery</Text>
      </Pressable>

      {images.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
          {images.map((asset) => (
            <View key={asset.uri} style={styles.thumbWrapper}>
              <Image source={{ uri: asset.uri }} style={styles.thumb} />
              <Pressable style={styles.thumbRemove} onPress={() => handleRemoveImage(asset.uri)}>
                <Text style={styles.thumbRemoveText}>{'\u00d7'}</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <AppButton title="Cancel" variant="outline" onPress={onCancel} style={styles.actionButton} />
        <AppButton title="Add Item" onPress={handleConfirmAdd} style={styles.actionButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    borderWidth: 1,
    borderColor: Brand.pink,
    borderRadius: 10,
    padding: 12,
  },
  itemLabel: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: Brand.purple,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: Brand.pink,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: moderateScale(13),
    color: Brand.purple,
    minHeight: 70,
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
    color: Brand.purple,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  uploadButton: {
    borderWidth: 1,
    borderColor: Brand.pink,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  uploadButtonText: {
    fontSize: moderateScale(13),
    color: Brand.plum,
    fontWeight: '600',
  },
  thumbRow: {
    gap: 8,
  },
  thumbWrapper: {
    position: 'relative',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  thumbRemove: {
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
  thumbRemoveText: {
    color: '#fff',
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  error: {
    color: '#d32f2f',
    fontSize: moderateScale(12),
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
});
