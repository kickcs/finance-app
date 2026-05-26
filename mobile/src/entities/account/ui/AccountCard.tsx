import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/shared/ui/icon';
import { cn } from '@/shared/lib/utils';
import { COMPACT_FORMAT, formatCurrency } from '@/shared/lib/format/currency';
import { getCurrencyByCode } from '@/entities/currency';

import { getAccountTypeLabel } from '../model/account-types';
import type { AccountWithBalances } from '../model/types';

export interface AccountCardProps {
  account: AccountWithBalances;
  compact?: boolean;
  hidden?: boolean;
  showBalance?: boolean;
  onPress?: () => void;
  className?: string;
}

function formatPrimaryBalance(account: AccountWithBalances): string {
  const b = account.balances?.[0];
  if (!b) return '0';
  return formatCurrency(b.balance, b.currency, COMPACT_FORMAT);
}

export function AccountCard({
  account,
  compact,
  hidden,
  showBalance = true,
  onPress,
  className,
}: AccountCardProps) {
  const balances = account.balances ?? [];
  const multiCurrency = balances.length > 1;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={cn(
        'flex-row items-center gap-3 rounded-xl active:opacity-80',
        'bg-card-light dark:bg-card-dark',
        'border border-border-light dark:border-border-dark',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <View
        className="h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${account.color}1F` }}
      >
        <Icon name={account.icon} size={22} color={account.color} />
      </View>

      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-1.5">
          <Text
            numberOfLines={1}
            className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
          >
            {account.name}
          </Text>
          {multiCurrency ? (
            <View className="rounded bg-surface-light dark:bg-surface-dark px-1.5 py-0.5">
              <Text className="text-[10px] font-medium text-text-secondary-light dark:text-text-secondary-dark">
                {balances.length}
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          {getAccountTypeLabel(account.type)}
        </Text>
      </View>

      {showBalance ? (
        <View className="items-end max-w-[45%]">
          {hidden ? (
            <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              ••••
            </Text>
          ) : multiCurrency ? (
            <View className="gap-0.5">
              {balances.slice(0, 2).map((b) => {
                const flag = getCurrencyByCode(b.currency)?.flag ?? b.currency;
                return (
                  <Text
                    key={b.currency}
                    numberOfLines={1}
                    className="text-xs font-medium text-text-primary-light dark:text-text-primary-dark"
                    style={{ fontVariant: ['tabular-nums'] }}
                  >
                    {flag} {formatCurrency(b.balance, b.currency, COMPACT_FORMAT)}
                  </Text>
                );
              })}
              {balances.length > 2 ? (
                <Text className="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                  +{balances.length - 2} ещё
                </Text>
              ) : null}
            </View>
          ) : (
            <Text
              numberOfLines={1}
              className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {formatPrimaryBalance(account)}
            </Text>
          )}
        </View>
      ) : null}

      <Icon name="chevron_right" size={16} color="#a1a1aa" />
    </Pressable>
  );
}
