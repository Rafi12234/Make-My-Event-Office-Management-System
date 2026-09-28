import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import StatusPill from './StatusPill';
import { Brand } from '@/constants/theme';
import { formatDisplayDate, formatDisplayDateTime } from '@/utils/dates';
import { formatTaka } from '@/utils/money';
import { moderateScale } from '@/utils/responsive';

const TABS = [
  { key: 'expenses', label: 'Expenses' },
  { key: 'vendorPayments', label: 'Vendors' },
  { key: 'received', label: 'Money In' },
];

// Mirrors the web Accounts module's HistoryList — read-only feed of money
// received, submitted costs, and vendor payments. Everything here is
// permanently locked (no edit/delete), matching the backend's immutable
// audit-trail design.
export default function ActivityHistory({ moneyReceived, expenses, vendorPayments = [] }) {
  const [activeTab, setActiveTab] = useState('expenses');

  const counts = useMemo(
    () => ({ expenses: expenses.length, vendorPayments: vendorPayments.length, received: moneyReceived.length }),
    [expenses, vendorPayments, moneyReceived],
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Activity</Text>
      <Text style={styles.subtitle}>Locked records — cannot be edited</Text>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, isActive && styles.tabActive]}>
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label} ({counts[tab.key]})
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.list}>
        {activeTab === 'expenses'
          ? expenses.length === 0
            ? <EmptyRow text="No costs logged yet." />
            : expenses.map((expense) => <ExpenseRow key={expense.id} expense={expense} />)
          : null}
        {activeTab === 'vendorPayments'
          ? vendorPayments.length === 0
            ? <EmptyRow text="No vendor transactions yet." />
            : vendorPayments.map((payment) => <VendorPaymentRow key={payment.id} payment={payment} />)
          : null}
        {activeTab === 'received'
          ? moneyReceived.length === 0
            ? <EmptyRow text="No money received yet." />
            : moneyReceived.map((entry) => <MoneyReceivedRow key={entry.id} entry={entry} />)
          : null}
      </View>
    </View>
  );
}

function EmptyRow({ text }) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function ExpenseRow({ expense }) {
  const [isOpen, setIsOpen] = useState(false);
  const isEvent = expense.costType === 'event';

  return (
    <View style={styles.row}>
      <Pressable style={styles.rowHeader} onPress={() => setIsOpen((value) => !value)}>
        <View style={styles.rowHeaderText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {isEvent ? expense.eventClientName || 'Event based cost' : 'Regular cost'}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {isEvent && expense.eventDate ? `Event ${formatDisplayDate(expense.eventDate)} • ` : ''}
            {expense.items.length} item{expense.items.length === 1 ? '' : 's'} •{' '}
            {formatDisplayDateTime(expense.createdAt)}
          </Text>
        </View>
        <Text style={styles.rowAmount}>−{formatTaka(expense.totalAmount)}</Text>
        <MaterialIcons name={isOpen ? 'expand-less' : 'expand-more'} size={20} color={Brand.mauve} />
      </Pressable>

      {isOpen ? (
        <View style={styles.itemList}>
          {expense.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemRowTop}>
                <Text style={styles.itemPurpose} numberOfLines={1}>
                  {item.purpose}
                </Text>
                <Text
                  style={[
                    styles.itemAmount,
                    item.paymentStatus === 'to_pay' ? styles.owed : item.paymentStatus === 'paid' ? styles.advanced : null,
                  ]}>
                  {item.paymentStatus === 'to_pay' ? '−' : item.paymentStatus === 'paid' ? '+' : ''}
                  {formatTaka(item.totalAmount)}
                </Text>
              </View>
              <View style={styles.itemRowBottom}>
                <Text style={styles.itemMeta}>
                  {formatDisplayDate(item.costDate)} • Qty {item.quantity} × {formatTaka(item.perQtyAmount)}
                  {item.vendorName ? ` • ${item.vendorName}` : ''}
                </Text>
                <StatusPill status={item.paymentStatus} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function VendorPaymentRow({ payment }) {
  const isPending = payment.paymentStatus === 'to_pay';
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.rowHeaderText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {payment.vendorName || 'Vendor'}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {payment.purpose} • {payment.costType === 'event' ? payment.eventClientName || 'Event' : 'Regular'} •{' '}
            {formatDisplayDate(payment.costDate)}
          </Text>
        </View>
        <View style={styles.vendorAmountCol}>
          <Text style={[styles.rowAmount, isPending ? styles.owed : styles.advanced]}>
            {isPending ? '−' : '+'}
            {formatTaka(payment.totalAmount)}
          </Text>
          <StatusPill status={payment.paymentStatus} />
        </View>
      </View>
    </View>
  );
}

function MoneyReceivedRow({ entry }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.rowHeaderText}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {entry.note || 'Money received'}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {formatDisplayDate(entry.receivedDate)} • {formatDisplayDateTime(entry.createdAt)}
          </Text>
        </View>
        <Text style={[styles.rowAmount, styles.advanced]}>+{formatTaka(entry.amount)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 20,
    padding: 16,
    gap: 4,
  },
  title: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: Brand.purple,
  },
  subtitle: {
    fontSize: moderateScale(11),
    color: Brand.mauve,
    marginBottom: 10,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  tabActive: {
    backgroundColor: '#0B0B0F',
  },
  tabText: {
    fontSize: moderateScale(10.5),
    fontWeight: '700',
    color: Brand.mauve,
  },
  tabTextActive: {
    color: '#fff',
  },
  list: {
    gap: 10,
  },
  emptyRow: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: moderateScale(12),
    color: Brand.mauve,
  },
  row: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  rowHeaderText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: Brand.purple,
  },
  rowMeta: {
    fontSize: moderateScale(11),
    color: Brand.mauve,
  },
  rowAmount: {
    fontSize: moderateScale(13),
    fontWeight: '800',
    color: '#e11d48',
  },
  vendorAmountCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  owed: {
    color: '#e11d48',
  },
  advanced: {
    color: '#059669',
  },
  itemList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(0,0,0,0.015)',
    padding: 10,
    gap: 8,
  },
  itemRow: {
    gap: 3,
  },
  itemRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemPurpose: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(12),
    fontWeight: '700',
    color: Brand.purple,
  },
  itemAmount: {
    fontSize: moderateScale(12),
    fontWeight: '800',
    color: Brand.purple,
  },
  itemRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemMeta: {
    flex: 1,
    minWidth: 0,
    fontSize: moderateScale(10.5),
    color: Brand.mauve,
  },
});
