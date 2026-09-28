import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Brand } from '@/constants/theme';
import { MAX_CONTENT_WIDTH } from '@/utils/responsive';

/**
 * Standard screen wrapper — safe-area spacing, background, and padding so
 * feature screens never re-implement this boilerplate.
 *
 * On tablets/large screens the content is capped at MAX_CONTENT_WIDTH and
 * centered instead of stretching edge-to-edge, so inputs/buttons/text stay a
 * comfortable, phone-like size no matter how wide the device is.
 */
export default function ScreenContainer({ children, scroll = false, avoidKeyboard = false, style, refreshControl }) {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= MAX_CONTENT_WIDTH;

  // Form screens (Login, Create/Edit Client, etc.) pass avoidKeyboard so the
  // virtual keyboard never covers the active input/submit button on
  // shorter phones — centralized here so screens don't each reimplement it.
  function withKeyboardAvoidance(node) {
    if (!avoidKeyboard) return node;
    return (
      <KeyboardAvoidingView style={styles.grow} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {node}
      </KeyboardAvoidingView>
    );
  }

  if (scroll) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {withKeyboardAvoidance(
          <ScrollView
            contentContainerStyle={[styles.grow, isWideScreen && styles.centerOuter]}
            keyboardShouldPersistTaps="handled"
            refreshControl={refreshControl}>
            <View style={[styles.inner, styles.grow, style]}>{children}</View>
          </ScrollView>,
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {withKeyboardAvoidance(
        <View style={[styles.grow, isWideScreen && styles.centerOuter]}>
          <View style={[styles.inner, styles.grow, style]}>{children}</View>
        </View>,
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  grow: {
    flexGrow: 1,
  },
  centerOuter: {
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    padding: 16,
  },
});
