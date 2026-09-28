import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { moderateScale } from '@/utils/responsive';

export default function EmptyState({ title = 'Nothing here yet', message }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  title: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: Brand.purple,
  },
  message: {
    fontSize: moderateScale(14),
    color: Brand.mauve,
    textAlign: 'center',
  },
});
