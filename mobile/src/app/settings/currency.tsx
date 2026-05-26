import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import { trigger } from '@/shared/lib/haptics';
import { CURRENCIES, type Currency } from '@/entities/currency';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile, useSetCurrency } from '@/shared/api/composables/useProfile';
import { cn } from '@/shared/lib/utils';
import { Icon } from '@/shared/ui/icon';
import { Spinner } from '@/shared/ui/spinner';

const ACCOUNT_CURRENCIES_KEY = 'account-currencies';

export default function CurrencySettingsScreen() {
  const user = useUser();
  const { data: profile, isLoading } = useProfile(user?.id ?? null);
  const { setCurrency, isPending } = useSetCurrency(user?.id ?? null);

  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(ACCOUNT_CURRENCIES_KEY)
      .then((v) => {
        setEnabledCurrencies(v ? (JSON.parse(v) as string[]) : CURRENCIES.map((c) => c.code));
      })
      .catch(() => {
        setEnabledCurrencies(CURRENCIES.map((c) => c.code));
      });
  }, []);

  const toggleAccountCurrency = (code: string) => {
    const next = enabledCurrencies.includes(code)
      ? enabledCurrencies.filter((x) => x !== code)
      : [...enabledCurrencies, code];
    setEnabledCurrencies(next);
    void AsyncStorage.setItem(ACCOUNT_CURRENCIES_KEY, JSON.stringify(next));
    void trigger('selection');
  };

  const onSelect = async (currency: Currency) => {
    if (currency.code === profile?.currency || isPending) return;
    await trigger('selection');
    try {
      await setCurrency(currency.code);
      await trigger('success');
      router.back();
    } catch (err) {
      await trigger('error');
      throw err;
    }
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Валюта' }} />
        <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
          <Spinner />
        </View>
      </>
    );
  }

  const accountCurrenciesSection = (
    <View className="mt-6 px-4 pb-8">
      <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
        Валюты счетов
      </Text>
      <Text className="mb-3 text-sm text-text-tertiary-light dark:text-text-tertiary-dark">
        Выберите валюты, которые будут отображаться при создании и фильтрации счетов.
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {CURRENCIES.map((c) => {
          const active = enabledCurrencies.includes(c.code);
          return (
            <Pressable
              key={c.code}
              onPress={() => toggleAccountCurrency(c.code)}
              accessibilityRole="button"
              accessibilityLabel={`${active ? 'Убрать' : 'Добавить'} валюту ${c.code}`}
              accessibilityState={{ selected: active }}
              className={cn(
                'flex-row items-center gap-1.5 rounded-full border px-3 py-2',
                active
                  ? 'border-primary bg-primary/10'
                  : 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark',
              )}
            >
              <Text className="text-sm">{c.flag}</Text>
              <Text
                className={cn(
                  'text-sm font-medium',
                  active
                    ? 'text-primary'
                    : 'text-text-primary-light dark:text-text-primary-dark',
                )}
              >
                {c.code}
              </Text>
              {active ? <Icon name="check" size={14} color="#4f46e5" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Валюта' }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        className="bg-background-light dark:bg-background-dark"
        data={CURRENCIES}
        keyExtractor={(c) => c.code}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => (
          <View className="h-px bg-border-light dark:bg-border-dark" />
        )}
        ListFooterComponent={accountCurrenciesSection}
        renderItem={({ item }) => {
          const selected = profile?.currency === item.code;
          return (
            <Pressable
              onPress={() => void onSelect(item)}
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel={`Выбрать валюту ${item.name}`}
              accessibilityState={{ selected, disabled: isPending }}
              className={cn(
                'flex-row items-center gap-3 rounded-xl px-4 py-3',
                selected && 'bg-primary/10',
              )}
            >
              <Text className="text-xl">{item.flag}</Text>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
                  {item.code} · {item.symbol}
                </Text>
                <Text className="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                  {item.name}
                </Text>
              </View>
              {selected ? <Icon name="check" size={20} color="#4f46e5" /> : null}
            </Pressable>
          );
        }}
      />
    </>
  );
}
