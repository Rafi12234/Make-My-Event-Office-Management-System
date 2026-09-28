import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Brand } from '@/constants/theme';
import { useResponsive } from '@/utils/responsive';

const VARIANT_STYLES = {
  primary: { backgroundColor: Brand.plum, textColor: '#fff' },
  secondary: { backgroundColor: Brand.blush, textColor: Brand.purple },
  danger: { backgroundColor: '#d32f2f', textColor: '#fff' },
  outline: { backgroundColor: 'transparent', textColor: Brand.plum, borderColor: Brand.plum },
};

export default function AppButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}) {
  const { moderateScale } = useResponsive();
  const variantStyle = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        {
          paddingVertical: moderateScale(14, 0.3),
          backgroundColor: variantStyle.backgroundColor,
          borderColor: variantStyle.borderColor || 'transparent',
          borderWidth: variantStyle.borderColor ? 1 : 0,
          opacity: isDisabled ? 0.6 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variantStyle.textColor} />
      ) : (
        <Text style={[styles.text, { fontSize: moderateScale(16, 0.3), color: variantStyle.textColor }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
});
