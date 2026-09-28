import { StyleSheet, Text, View } from 'react-native';

import AppButton from './AppButton';
import { Brand } from '@/constants/theme';
import { moderateScale } from '@/utils/responsive';

export default function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unable to load</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <AppButton title="Try Again" onPress={onRetry} variant="outline" style={styles.retryButton} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    color: Brand.purple,
  },
  message: {
    fontSize: moderateScale(14),
    color: Brand.mauve,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 24,
  },
});
