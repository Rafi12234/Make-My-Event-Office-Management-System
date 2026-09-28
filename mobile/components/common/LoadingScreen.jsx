import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { moderateScale } from '@/utils/responsive';

export default function LoadingScreen({ message = 'Loading...' }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Brand.plum} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  message: {
    fontSize: moderateScale(15),
    color: Brand.mauve,
  },
});
