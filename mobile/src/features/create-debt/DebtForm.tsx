import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { z } from 'zod';

import { AccountSelector } from '@/entities/account';
import type { Account } from '@/shared/api/database.types';
import {
  buildDebtName,
  useCreateDebt,
  useUpdateDebt,
  type DebtDirection,
} from '@/entities/debt';
import { CURRENCIES } from '@/entities/currency';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

const schema = z.object({
  direction: z.enum(['given', 'taken']),
  personName: z.string().min(1, 'Введите имя'),
  totalAmount: z
    .string()
    .min(1, 'Сумма')
    .refine((v) => Number(v.replace(',', '.')) > 0, 'Сумма больше 0'),
  currency: z.string().min(1),
  accountId: z.string().min(1, 'Выберите счёт'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export interface DebtFormProps {
  accounts: Account[];
  defaultCurrency: string;
  defaultAccountId?: string;
  editId?: string;
  initialValues?: Partial<FormValues>;
}

export function DebtForm({
  accounts,
  defaultCurrency,
  defaultAccountId,
  editId,
  initialValues,
}: DebtFormProps) {
  const create = useCreateDebt();
  const update = useUpdateDebt();
  const isPending = create.isPending || update.isPending;

  const { control, handleSubmit, formState } = useForm<FormValues>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      direction: initialValues?.direction ?? 'taken',
      personName: initialValues?.personName ?? '',
      totalAmount: initialValues?.totalAmount ?? '',
      currency: initialValues?.currency ?? defaultCurrency,
      accountId: initialValues?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? '',
      description: initialValues?.description ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const total = Number(values.totalAmount.replace(',', '.'));
      const payload = {
        name: buildDebtName(values.direction as DebtDirection, values.personName.trim()),
        person_name: values.personName.trim(),
        total_amount: total,
        remaining_amount: total,
        currency: values.currency,
        debt_type: values.direction as DebtDirection,
        account_id: values.accountId,
        description: values.description?.length ? values.description : null,
        monthly_payment: null,
        next_payment_date: null,
        transaction_id: null,
        source_transaction_id: null,
        is_private: false,
      };
      if (editId) {
        await update.mutateAsync({ id: editId, updates: payload });
      } else {
        await create.mutateAsync(payload);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw err;
    }
  });

  return (
    <ScrollView
      className="flex-1 bg-background-light dark:bg-background-dark"
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      <Controller
        control={control}
        name="direction"
        render={({ field }) => (
          <View className="flex-row rounded-xl bg-surface-light dark:bg-surface-dark p-1">
            <DirectionToggle
              label="Я взял в долг"
              active={field.value === 'taken'}
              onPress={() => field.onChange('taken')}
            />
            <DirectionToggle
              label="Я дал в долг"
              active={field.value === 'given'}
              onPress={() => field.onChange('given')}
            />
          </View>
        )}
      />

      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
          Имя
        </Text>
        <Controller
          control={control}
          name="personName"
          render={({ field }) => (
            <Input
              value={field.value}
              onChangeText={field.onChange}
              placeholder="Например, Алексей"
              autoCapitalize="words"
            />
          )}
        />
      </View>

      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
          Сумма
        </Text>
        <Controller
          control={control}
          name="totalAmount"
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
          Счёт
        </Text>
        <Controller
          control={control}
          name="accountId"
          render={({ field }) => (
            <AccountSelector
              accounts={accounts}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </View>

      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
          Заметка
        </Text>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <Input
              value={field.value ?? ''}
              onChangeText={field.onChange}
              placeholder="Опционально"
              autoCapitalize="sentences"
            />
          )}
        />
      </View>

      <Button
        title={editId ? 'Сохранить' : 'Добавить долг'}
        onPress={() => void onSubmit()}
        disabled={!formState.isValid}
        loading={isPending}
        className="mt-2"
      />
    </ScrollView>
  );
}

function DirectionToggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={cn(
        'flex-1 items-center justify-center rounded-lg py-2',
        active && 'bg-card-light dark:bg-card-dark',
      )}
    >
      <Text
        className={cn(
          'text-xs font-semibold',
          active
            ? 'text-text-primary-light dark:text-text-primary-dark'
            : 'text-text-secondary-light dark:text-text-secondary-dark',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
