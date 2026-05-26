import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccounts } from '@/entities/account/api/useAccounts';
import { useCategories } from '@/entities/category/api/useCategories';
import { CURRENCIES } from '@/entities/currency/model/constants';
import type {
  RecurringSubscription,
  RecurringSubscriptionInsert,
  SubscriptionFrequency,
} from '@/entities/recurring-subscription/model/types';
import { useAuthStore } from '@/shared/api/composables/useAuth';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

const FREQUENCIES: { id: SubscriptionFrequency; label: string }[] = [
  { id: 'weekly', label: 'Еженедельно' },
  { id: 'monthly', label: 'Ежемесячно' },
  { id: 'quarterly', label: 'Раз в квартал' },
  { id: 'yearly', label: 'Ежегодно' },
];

export type SubscriptionFormData = Omit<RecurringSubscriptionInsert, 'icon' | 'color'>;

type Props = {
  initial?: RecurringSubscription;
  onSubmit: (data: RecurringSubscriptionInsert) => Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
};

export function SubscriptionForm({ initial, onSubmit, onClose, isSubmitting = false }: Props) {
  const user = useAuthStore((s) => s.user);
  const { data: accounts = [] } = useAccounts(user?.id ?? null);
  const { data: categories = [] } = useCategories(user?.id ?? null);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'USD');
  const [accountId, setAccountId] = useState<string | undefined>(initial?.account_id ?? undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(
    initial?.category_id ?? undefined,
  );
  const [frequency, setFrequency] = useState<SubscriptionFrequency>(
    initial?.frequency ?? 'monthly',
  );
  const [billingDate, setBillingDate] = useState(initial?.billing_date ?? '');
  const [color, setColor] = useState(initial?.color ?? (ENTITY_COLORS[0] as string));

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setAmount(String(initial.amount));
      setCurrency(initial.currency);
      setAccountId(initial.account_id ?? undefined);
      setCategoryId(initial.category_id ?? undefined);
      setFrequency(initial.frequency);
      setBillingDate(initial.billing_date);
      setColor(initial.color);
    }
  }, [initial]);

  const canSubmit =
    name.trim().length > 0 &&
    parseFloat(amount) > 0 &&
    billingDate.trim().length > 0 &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return;

    await onSubmit({
      name: name.trim(),
      amount: parsed,
      currency,
      account_id: accountId,
      category_id: categoryId,
      frequency,
      billing_date: billingDate.trim(),
      icon: 'subscriptions',
      color,
    });
  };

  return (
    <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top']} className="flex-1 bg-background-light dark:bg-background-dark">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            {initial ? 'Изменить подписку' : 'Новая подписка'}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть">
            <Text className="text-base text-primary">Отмена</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-8">
          {/* Name */}
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Название (Netflix, Spotify…)"
            accessibilityLabel="Название подписки"
            className="rounded-2xl bg-surface-light px-4 py-3 text-base text-text-primary-light dark:bg-surface-dark dark:text-text-primary-dark"
            autoFocus
            returnKeyType="next"
          />

          {/* Amount */}
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Сумма"
            accessibilityLabel="Сумма подписки"
            keyboardType="decimal-pad"
            className="rounded-2xl bg-surface-light px-4 py-3 text-base text-text-primary-light dark:bg-surface-dark dark:text-text-primary-dark"
          />

          {/* Currency */}
          <View>
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
              Валюта
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {CURRENCIES.map((c) => {
                const active = c.code === currency;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => setCurrency(c.code)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={cn(
                      'rounded-full border px-3 py-1.5',
                      active
                        ? 'border-primary bg-primary'
                        : 'border-border-light dark:border-border-dark',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-sm font-medium',
                        active
                          ? 'text-white'
                          : 'text-text-primary-light dark:text-text-primary-dark',
                      )}
                    >
                      {c.flag} {c.code}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Billing date */}
          <TextInput
            value={billingDate}
            onChangeText={setBillingDate}
            placeholder="Дата списания (YYYY-MM-DD)"
            accessibilityLabel="Дата следующего списания"
            className="rounded-2xl bg-surface-light px-4 py-3 text-base text-text-primary-light dark:bg-surface-dark dark:text-text-primary-dark"
          />

          {/* Frequency */}
          <View>
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
              Периодичность
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {FREQUENCIES.map((f) => {
                const active = f.id === frequency;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFrequency(f.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={cn(
                      'rounded-full border px-3 py-1.5',
                      active
                        ? 'border-primary bg-primary'
                        : 'border-border-light dark:border-border-dark',
                    )}
                  >
                    <Text
                      className={cn(
                        'text-sm font-medium',
                        active
                          ? 'text-white'
                          : 'text-text-primary-light dark:text-text-primary-dark',
                      )}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Account picker */}
          {accounts.length > 0 && (
            <View>
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                Счёт (необязательно)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {accounts.map((acc) => {
                  const active = acc.id === accountId;
                  return (
                    <Pressable
                      key={acc.id}
                      onPress={() => setAccountId(active ? undefined : acc.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={cn(
                        'rounded-full border px-3 py-1.5',
                        active
                          ? 'border-primary bg-primary'
                          : 'border-border-light dark:border-border-dark',
                      )}
                    >
                      <Text
                        className={cn(
                          'text-sm font-medium',
                          active
                            ? 'text-white'
                            : 'text-text-primary-light dark:text-text-primary-dark',
                        )}
                      >
                        {acc.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Category picker */}
          {expenseCategories.length > 0 && (
            <View>
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
                Категория (необязательно)
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {expenseCategories.map((cat) => {
                  const active = cat.id === categoryId;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setCategoryId(active ? undefined : cat.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={cn(
                        'rounded-full border px-3 py-1.5',
                        active
                          ? 'border-primary bg-primary'
                          : 'border-border-light dark:border-border-dark',
                      )}
                    >
                      <Text
                        className={cn(
                          'text-sm font-medium',
                          active
                            ? 'text-white'
                            : 'text-text-primary-light dark:text-text-primary-dark',
                        )}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Color */}
          <View>
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
              Цвет
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ENTITY_COLORS.map((c) => {
                const active = c === color;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Цвет ${c}`}
                    accessibilityState={{ selected: active }}
                    className={cn('h-10 w-10 rounded-full', active && 'border-2 border-primary')}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View className="px-4 pb-4">
          <Button
            title={initial ? 'Сохранить' : 'Создать'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
