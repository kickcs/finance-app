import { router, Stack } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { trigger } from '@/shared/lib/haptics';
import { CURRENCIES, type Currency } from '@/entities/currency';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile, useSetCurrency } from '@/shared/api/composables/useProfile';
import { cn } from '@/shared/lib/utils';
import { Icon } from '@/shared/ui/icon';
import { Spinner } from '@/shared/ui/spinner';

export default function CurrencySettingsScreen() {
  const user = useUser();
  const { data: profile, isLoading } = useProfile(user?.id ?? null);
  const { setCurrency, isPending } = useSetCurrency(user?.id ?? null);

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
