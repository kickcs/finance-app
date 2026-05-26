import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBudget, useSetDefaultBudget } from '@/entities/budget/api/useBudget';
import { CURRENCIES } from '@/entities/currency/model/constants';
import { useAuthStore } from '@/shared/api/composables/useAuth';
import { Button } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';

type Props = { visible: boolean; onClose: () => void };

export function SetBudgetSheet({ visible, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const { data: budgetResponse } = useBudget(user?.id ?? null);
  const setDefault = useSetDefaultBudget();

  const existingAmount = budgetResponse?.budget?.amount ?? 0;

  const [amount, setAmount] = useState<string>(existingAmount > 0 ? String(existingAmount) : '');

  // Sync if response loads after mount
  useEffect(() => {
    if (existingAmount > 0) {
      setAmount(String(existingAmount));
    }
  }, [existingAmount]);

  const canSave = Number(amount) > 0;

  const save = async () => {
    if (!canSave) return;
    // useSetDefaultBudget.mutationFn: (amount: number) — takes plain number only
    await setDefault.mutateAsync(Number(amount));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={['top']}
        className="flex-1 bg-background-light dark:bg-background-dark"
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            Бюджет
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Отмена">
            <Text className="text-base text-primary">Отмена</Text>
          </Pressable>
        </View>

        <View className="gap-4 px-4">
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Сумма"
            keyboardType="decimal-pad"
            accessibilityLabel="Сумма бюджета"
            autoFocus
            className="rounded-2xl bg-surface-light px-4 py-3 text-base text-text-primary-light dark:bg-surface-dark dark:text-text-primary-dark"
          />

          <Text className="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
            Валюта бюджета задаётся на сервере
          </Text>

          <View className="flex-row flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <View
                key={c.code}
                className="rounded-full border border-border-light px-4 py-2 dark:border-border-dark"
              >
                <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {c.flag} {c.code}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className="mt-auto px-4 pb-4">
          <Button
            title="Сохранить"
            onPress={save}
            disabled={!canSave}
            loading={setDefault.isPending}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
