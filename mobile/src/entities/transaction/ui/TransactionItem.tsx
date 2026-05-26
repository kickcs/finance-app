import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { getCategoryById } from '@/entities/category';
import { TRANSFER_COLOR } from '@/shared/config/colors';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { COMPACT_FORMAT, formatCurrency } from '@/shared/lib/format/currency';
import { formatRelativeDate } from '@/shared/lib/format/date';
import { cn } from '@/shared/lib/utils';
import { Icon } from '@/shared/ui/icon';

import type { Transaction } from '../model/types';

export interface TransactionItemProps {
  transaction: Transaction;
  accountName?: string;
  toAccountName?: string;
  viewingAccountId?: string;
  onPress?: () => void;
}

export function TransactionItem({
  transaction,
  accountName,
  toAccountName,
  viewingAccountId,
  onPress,
}: TransactionItemProps) {
  const category = useMemo(() => getCategoryById(transaction.category_id), [transaction.category_id]);

  const isTransfer = transaction.type === 'transfer';
  const isAdjustment = transaction.type === 'adjustment';
  const isInformational = transaction.is_informational;
  const isIncomingTransfer =
    isTransfer && viewingAccountId !== undefined && transaction.to_account_id === viewingAccountId;

  const currency = transaction.currency || DEFAULT_CURRENCY;

  const displayAmount = useMemo(() => {
    if (transaction.type === 'expense' && transaction.net_amount !== undefined) {
      return transaction.net_amount;
    }
    return transaction.amount;
  }, [transaction]);

  const formattedAmount = useMemo(() => {
    const compact = COMPACT_FORMAT;
    if (isInformational) return formatCurrency(transaction.amount, currency, compact);
    if (isTransfer) {
      if (viewingAccountId) {
        if (isIncomingTransfer) {
          const incomingAmount = transaction.to_amount ?? transaction.amount;
          const incomingCurr = transaction.to_currency || currency;
          return `+${formatCurrency(incomingAmount, incomingCurr, compact)}`;
        }
        return `-${formatCurrency(transaction.amount, currency, compact)}`;
      }
      return formatCurrency(transaction.amount, currency, compact);
    }
    if (isAdjustment) {
      const prefix = transaction.is_debt_related ? '-' : '+';
      return `${prefix}${formatCurrency(transaction.amount, currency, compact)}`;
    }
    const prefix = transaction.type === 'income' ? '+' : '-';
    return `${prefix}${formatCurrency(displayAmount, currency, compact)}`;
  }, [
    transaction,
    currency,
    displayAmount,
    isAdjustment,
    isIncomingTransfer,
    isInformational,
    isTransfer,
    viewingAccountId,
  ]);

  const formattedDate = useMemo(
    () => formatRelativeDate(new Date(transaction.date).getTime()),
    [transaction.date],
  );

  const amountClassName = isInformational
    ? 'italic text-text-tertiary-light dark:text-text-tertiary-dark'
    : isAdjustment
      ? transaction.is_debt_related
        ? 'text-danger'
        : 'text-success'
      : isTransfer
        ? viewingAccountId
          ? isIncomingTransfer
            ? 'text-success'
            : 'text-danger'
          : 'text-primary'
        : transaction.type === 'income'
          ? 'text-success'
          : 'text-text-primary-light dark:text-text-primary-dark';

  const iconBgColor = isTransfer ? `${TRANSFER_COLOR}1F` : `${category?.color ?? '#64748b'}1F`;
  const iconColor = isTransfer ? TRANSFER_COLOR : category?.color ?? '#64748b';
  const iconName = isTransfer ? 'swap_horiz' : category?.icon ?? 'receipt_long';

  const transferLabel = isTransfer
    ? viewingAccountId
      ? isIncomingTransfer
        ? `← ${accountName ?? 'Счёт'}`
        : `→ ${toAccountName ?? 'Счёт'}`
      : `${accountName ?? 'Счёт'} → ${toAccountName ?? 'Счёт'}`
    : null;

  return (
    <Animated.View entering={FadeIn.duration(180)} layout={LinearTransition.duration(180)}>
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cn(
        'flex-row items-center gap-3 rounded-lg p-3 active:opacity-80',
        isInformational && 'opacity-60',
      )}
    >
      <View
        className="h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: iconBgColor }}
      >
        <Icon name={iconName} size={18} color={iconColor} />
      </View>

      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-1">
          <Text
            numberOfLines={1}
            className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
          >
            {isTransfer ? 'Перевод' : category?.name ?? 'Транзакция'}
          </Text>
          {isInformational ? (
            <Text className="text-[10px] font-medium text-warning">Информационно</Text>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          className="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          {isTransfer
            ? transferLabel
            : [accountName, transaction.description ?? formattedDate].filter(Boolean).join(' · ')}
        </Text>
      </View>

      <View className="items-end shrink-0">
        <Text
          className={cn('text-sm font-semibold', amountClassName)}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formattedAmount}
        </Text>
      </View>
    </Pressable>
    </Animated.View>
  );
}
