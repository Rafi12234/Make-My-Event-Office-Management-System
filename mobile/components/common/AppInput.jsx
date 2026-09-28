import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { useResponsive } from '@/utils/responsive';

export default function AppInput({ label, error, style, rightElement, ...textInputProps }) {
  const { moderateScale } = useResponsive();

  return (
    <View style={styles.container}>
      {label ? <Text style={[styles.label, { fontSize: moderateScale(14, 0.3) }]}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              paddingVertical: moderateScale(12, 0.3),
              fontSize: moderateScale(16, 0.3),
            },
            rightElement ? styles.inputWithRightElement : null,
            error ? styles.inputError : null,
            style,
          ]}
          placeholderTextColor={Brand.mauve}
          {...textInputProps}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontWeight: '600',
    color: Brand.purple,
  },
  inputRow: {
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  inputWithRightElement: {
    paddingRight: 44,
  },
  rightElement: {
    position: 'absolute',
    right: 10,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputError: {
    borderColor: '#d32f2f',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 13,
  },
});
