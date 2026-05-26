import { Pressable, ScrollView, Text, View } from 'react-native';

import { cn } from '@/shared/lib/utils';
import { Icon } from '@/shared/ui/icon';

import type { Account } from '../model/types';

interface Props {
  accounts: Account[];
  value: string | null;
  onChange: (accountId: string) => void;
}

export function AccountSelector({ accounts, value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
    >
      {accounts.map((account) => {
        const selected = value === account.id;
        return (
          <Pressable
            key={account.id}
            onPress={() => onChange(account.id)}
            accessibilityRole="button"
            accessibilityLabel={account.name}
            accessibilityState={{ selected }}
            className={cn(
              'flex-row items-center gap-2 rounded-full px-3 py-2 border',
              selected
                ? 'border-primary bg-primary/10'
                : 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark',
            )}
          >
            <View
              className="h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: `${account.color}1F` }}
            >
              <Icon name={account.icon} size={14} color={account.color} />
            </View>
            <Text
              numberOfLines={1}
              className={cn(
                'text-sm font-medium',
                selected
                  ? 'text-primary'
                  : 'text-text-primary-light dark:text-text-primary-dark',
              )}
            >
              {account.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
