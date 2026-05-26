import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/shared/api/composables/useAuth';
import { useProfile, useUpdateProfile } from '@/shared/api/composables/useProfile';
import { Button } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';

type Props = { visible: boolean; onClose: () => void };

export function FinancialPeriodSheet({ visible, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const { data: profile } = useProfile(user?.id ?? null);
  const update = useUpdateProfile(user?.id ?? null);

  const [day, setDay] = useState<number>(profile?.financial_month_start_day ?? 1);

  // Sync when profile loads
  useEffect(() => {
    if (profile?.financial_month_start_day !== undefined) {
      setDay(profile.financial_month_start_day);
    }
  }, [profile?.financial_month_start_day]);

  const save = async () => {
    await update.mutateAsync({ financial_month_start_day: day });
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
            Начало месяца
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Отмена">
            <Text className="text-base text-primary">Отмена</Text>
          </Pressable>
        </View>

        <Text className="px-4 pb-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Финансовый месяц начнётся {day}-го числа.
        </Text>

        <ScrollView
          contentContainerStyle={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            paddingHorizontal: 16,
          }}
        >
          {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
            <Pressable
              key={n}
              onPress={() => setDay(n)}
              accessibilityRole="button"
              accessibilityLabel={`День ${n}`}
              accessibilityState={{ selected: day === n }}
              className={cn(
                'h-12 w-12 items-center justify-center rounded-full',
                day === n ? 'bg-primary' : 'bg-surface-light dark:bg-surface-dark',
              )}
            >
              <Text
                className={cn(
                  'text-base font-medium',
                  day === n
                    ? 'text-white'
                    : 'text-text-primary-light dark:text-text-primary-dark',
                )}
              >
                {n}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View className="mt-auto px-4 pb-4">
          <Button
            title="Сохранить"
            onPress={save}
            loading={update.isPending}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
