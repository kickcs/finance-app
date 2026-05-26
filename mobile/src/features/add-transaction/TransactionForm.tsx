import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { z } from 'zod';

import { trigger } from '@/shared/lib/haptics';
import { AccountSelector } from '@/entities/account';
import {
  useCreateTransaction,
  useUpdateTransaction,
} from '@/entities/transaction/api';
import type { Account } from '@/shared/api/database.types';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

import { CategoryPicker } from './CategoryPicker';
import { HeroAmount } from './HeroAmount';

const schema = z.object({
  amount: z
    .string()
    .min(1, 'Введите сумму')
    .refine((v) => Number(v) > 0, 'Сумма должна быть больше 0'),
  type: z.enum(['income', 'expense']),
  categoryId: z.string().min(1, 'Выберите категорию'),
  accountId: z.string().min(1, 'Выберите счёт'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export interface TransactionFormProps {
  accounts: Account[];
  defaultAccountId: string;
  defaultCurrency: string;
  /** When set, form acts as edit. Otherwise create. */
  editId?: string;
  initialValues?: Partial<FormValues>;
  /**
   * ISO date of the transaction being edited. Preserved on save instead of
   * overwriting with "now" — otherwise editing an old transaction silently
   * moves it to today and corrupts month grouping / cursor pagination.
   */
  initialDate?: string;
  onDone?: () => void;
}

export function TransactionForm({
  accounts,
  defaultAccountId,
  defaultCurrency,
  editId,
  initialValues,
  initialDate,
  onDone,
}: TransactionFormProps) {
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const isPending = create.isPending || update.isPending;

  const { control, handleSubmit, watch, formState } = useForm<FormValues>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      amount: initialValues?.amount ?? '',
      type: initialValues?.type ?? 'expense',
      categoryId: initialValues?.categoryId ?? '',
      accountId: initialValues?.accountId ?? defaultAccountId,
      description: initialValues?.description ?? '',
    },
  });

  const txType = watch('type');

  const onSubmit = handleSubmit(async (values) => {
    await trigger('medium');
    try {
      const account = accounts.find((a) => a.id === values.accountId);
      const currency = account?.currency ?? defaultCurrency;
      const payload = {
        amount: Number(values.amount),
        currency,
        type: values.type,
        category_id: values.categoryId,
        account_id: values.accountId,
        description: values.description?.length ? values.description : null,
        // Preserve original date on edit; stamp current time only on create.
        date: editId && initialDate ? initialDate : new Date().toISOString(),
      };
      if (editId) {
        await update.mutateAsync({ id: editId, updates: payload });
      } else {
        await create.mutateAsync(payload);
      }
      await trigger('success');
      if (onDone) onDone();
      else router.back();
    } catch (err) {
      await trigger('error');
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
        name="type"
        render={({ field }) => (
          <View className="flex-row rounded-xl bg-surface-light dark:bg-surface-dark p-1">
            <TypeToggleButton
              label="Расход"
              active={field.value === 'expense'}
              onPress={() => field.onChange('expense')}
            />
            <TypeToggleButton
              label="Доход"
              active={field.value === 'income'}
              onPress={() => field.onChange('income')}
            />
          </View>
        )}
      />

      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <HeroAmount value={field.value} onChange={field.onChange} currency={defaultCurrency} />
        )}
      />

      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
          Категория
        </Text>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <CategoryPicker type={txType} value={field.value} onChange={field.onChange} />
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
              placeholder="Опционально"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              autoCapitalize="sentences"
            />
          )}
        />
      </View>

      <Button
        title={editId ? 'Сохранить' : 'Добавить'}
        onPress={() => void onSubmit()}
        disabled={!formState.isValid}
        loading={isPending}
        className="mt-2"
      />
    </ScrollView>
  );
}

interface ToggleProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function TypeToggleButton({ label, active, onPress }: ToggleProps) {
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
          'text-sm font-semibold',
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
