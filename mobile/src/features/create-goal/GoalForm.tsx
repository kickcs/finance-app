import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { z } from 'zod';

import { useCreateGoal, useUpdateGoal } from '@/entities/goal';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Icon } from '@/shared/ui/icon';
import { Input } from '@/shared/ui/input';

const GOAL_ICONS = ['savings', 'diamond', 'account_balance', 'home', 'credit_card'];

const schema = z.object({
  name: z.string().min(1, 'Название'),
  targetAmount: z
    .string()
    .min(1, 'Сумма')
    .refine((v) => Number(v.replace(',', '.')) > 0, '> 0'),
  currentAmount: z.string().optional(),
  icon: z.string().min(1),
  color: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export interface GoalFormProps {
  editId?: string;
  initialValues?: Partial<FormValues>;
}

export function GoalForm({ editId, initialValues }: GoalFormProps) {
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const isPending = create.isPending || update.isPending;

  const { control, handleSubmit, formState } = useForm<FormValues>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialValues?.name ?? '',
      targetAmount: initialValues?.targetAmount ?? '',
      currentAmount: initialValues?.currentAmount ?? '0',
      icon: initialValues?.icon ?? GOAL_ICONS[0]!,
      color: initialValues?.color ?? ENTITY_COLORS[0] ?? '#3b82f6',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const payload = {
        name: values.name.trim(),
        target_amount: Number(values.targetAmount.replace(',', '.')),
        current_amount: Number((values.currentAmount ?? '0').replace(',', '.')),
        icon: values.icon,
        color: values.color,
        deadline: null,
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
              placeholder="Например, Отпуск"
              autoCapitalize="sentences"
            />
          )}
        />
      </View>

      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
          Целевая сумма
        </Text>
        <Controller
          control={control}
          name="targetAmount"
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
          Уже накоплено
        </Text>
        <Controller
          control={control}
          name="currentAmount"
          render={({ field }) => (
            <Input
              value={field.value ?? '0'}
              onChangeText={field.onChange}
              keyboardType="decimal-pad"
              placeholder="0"
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
              {GOAL_ICONS.map((icon) => {
                const active = field.value === icon;
                return (
                  <Pressable
                    key={icon}
                    onPress={() => field.onChange(icon)}
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

      <Button
        title={editId ? 'Сохранить' : 'Создать цель'}
        onPress={() => void onSubmit()}
        disabled={!formState.isValid}
        loading={isPending}
        className="mt-2"
      />
    </ScrollView>
  );
}
