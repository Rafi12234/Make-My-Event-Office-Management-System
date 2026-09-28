import { StyleSheet, Text, View } from 'react-native';

const isPaid = (status) => status === 'paid';

// Small "Paid" / "To Pay" badge, mirrors the web module's StatusPill.
export default function StatusPill({ status }) {
  if (!status) return null;
  const paid = isPaid(status);
  return (
    <View style={[styles.pill, paid ? styles.paid : styles.pending]}>
      <Text style={[styles.text, paid ? styles.paidText : styles.pendingText]}>{paid ? 'Paid' : 'To Pay'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  paid: {
    backgroundColor: '#d1fae5',
  },
  pending: {
    backgroundColor: '#fef3c7',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  paidText: {
    color: '#047857',
  },
  pendingText: {
    color: '#b45309',
  },
});
