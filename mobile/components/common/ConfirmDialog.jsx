import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { MAX_CONTENT_WIDTH, moderateScale } from '@/utils/responsive';

// Mirrors the web app's shared ConfirmDialog (src/components/ConfirmDialog.jsx)
// — same title/message/confirmLabel/cancelLabel contract, used before every
// destructive action (delete call/meeting/item/client).
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isConfirming = false,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isConfirming}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.confirmButton]}
              onPress={onConfirm}
              disabled={isConfirming}>
              <Text style={styles.confirmText}>{isConfirming ? 'Deleting...' : confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: Math.min(MAX_CONTENT_WIDTH * 0.6, 400),
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
  },
  title: {
    fontSize: moderateScale(18),
    fontWeight: '800',
    color: Brand.purple,
  },
  message: {
    fontSize: moderateScale(13),
    color: Brand.mauve,
    marginTop: 8,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  button: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    backgroundColor: '#fff',
  },
  cancelText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: Brand.purple,
  },
  confirmButton: {
    backgroundColor: '#d32f2f',
  },
  confirmText: {
    fontSize: moderateScale(14),
    fontWeight: '700',
    color: '#fff',
  },
});
