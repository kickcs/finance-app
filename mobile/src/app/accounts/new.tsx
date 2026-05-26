import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { z } from 'zod';

import { useCreateAccount } from '@/entities/account/api';
import { ACCOUNT_ICONS } from '@/entities/account/model/types';
import { VISIBLE_ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS } from '@/entities/account/model/account-types';
import { CURRENCIES } from '@/entities/currency';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Icon } from '@/shared/ui/icon';
import { Input } from '@/shared/ui/input';

const schema = z.object({
  name: z.string().min(1, 'Введите название'),
  icon: z.string().min(1),
  color: z.string().min(1),
  type: z.enum(['basic', 'savings', 'credit_card', 'cash', 'loan', 'deposit']),
  balance: z.string().refine((v) => Number.isFinite(Number(v.replace(',', '.'))), 'Неверная сумма'),
  currency: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export default function NewAccountScreen() {
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  const create = useCreateAccount();

  const { control, handleSubmit, formState } = useForm<FormValues>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      icon: ACCOUNT_ICONS[0],
      color: ENTITY_COLORS[0] ?? '#3b82f6',
      type: 'basic',
      balance: '0',
      currency: profile?.currency ?? 'USD',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await create.mutateAsync({
        name: values.name,
        icon: values.icon,
        color: values.color,
        type: values.type,
        balance: Number(values.balance.replace(',', '.')),
        currency: values.currency,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw err;
    }
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Новый счёт' }} />
      <ScrollView
        className="flex-1 bg-background-light dark:bg-background-dark"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
            Название
          </Text>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Input
                value={field.value}
                onChangeText={field.onChange}
                placeholder="Например, Дебетовая карта"
                autoCapitalize="sentences"
              />
            )}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
            Иконка
          </Text>
          <Controller
            control={control}
            name="icon"
            render={({ field }) => (
              <View className="flex-row flex-wrap gap-2">
                {ACCOUNT_ICONS.map((icon) => {
                  const active = field.value === icon;
                  return (
                    <Pressable
                      key={icon}
                      onPress={() => field.onChange(icon)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={cn(
                        'h-12 w-12 items-center justify-center rounded-xl',
                        active
                          ? 'bg-primary'
                          : 'bg-surface-light dark:bg-surface-dark',
                      )}
                    >
                      <Icon name={icon} size={22} color={active ? '#ffffff' : '#71717a'} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
            Цвет
          </Text>
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <View className="flex-row flex-wrap gap-2">
                {ENTITY_COLORS.map((color) => {
                  const active = field.value === color;
                  return (
                    <Pressable
                      key={color}
                      onPress={() => field.onChange(color)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={cn(
                        'h-10 w-10 rounded-full items-center justify-center',
                        active && 'border-2 border-text-primary-light dark:border-text-primary-dark',
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {active ? <Icon name="check" size={16} color="#ffffff" /> : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
            Тип
          </Text>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <View className="flex-row flex-wrap gap-2">
                {VISIBLE_ACCOUNT_TYPES.map((type) => {
                  const active = field.value === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => field.onChange(type)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={cn(
                        'rounded-full px-3 py-2 border',
                        active
                          ? 'border-primary bg-primary/10'
                          : 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark',
                      )}
                    >
                      <Text
                        className={cn(
                          'text-sm font-medium',
                          active
                            ? 'text-primary'
                            : 'text-text-primary-light dark:text-text-primary-dark',
                        )}
                      >
                        {ACCOUNT_TYPE_LABELS[type]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
            Валюта
          </Text>
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <View className="flex-row flex-wrap gap-2">
                {CURRENCIES.map((c) => {
                  const active = field.value === c.code;
                  return (
                    <Pressable
                      key={c.code}
                      onPress={() => field.onChange(c.code)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={cn(
                        'rounded-full px-3 py-2 border',
                        active
                          ? 'border-primary bg-primary/10'
                          : 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark',
                      )}
                    >
                      <Text
                        className={cn(
                          'text-sm font-medium',
                          active
                            ? 'text-primary'
                            : 'text-text-primary-light dark:text-text-primary-dark',
                        )}
                      >
                        {c.flag} {c.code}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
            Начальный баланс
          </Text>
          <Controller
            control={control}
            name="balance"
            render={({ field }) => (
              <Input
                value={field.value}
                onChangeText={field.onChange}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            )}
          />
        </View>

        <Button
          title="Создать"
          onPress={() => void onSubmit()}
          disabled={!formState.isValid}
          loading={create.isPending}
          className="mt-2"
        />
      </ScrollView>
    </>
  );
}
