import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CURRENCIES } from '@/entities/currency/model/constants';
import { useAuthStore } from '@/shared/api/composables/useAuth';
import { useProfile, useUpdateProfile } from '@/shared/api/composables/useProfile';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

type Props = { visible: boolean; onClose: () => void };

export function EditProfileSheet({ visible, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const { data: profile } = useProfile(user?.id ?? null);
  const update = useUpdateProfile(user?.id ?? null);

  // Profile uses `name` field (not full_name) per database.types.ts Row definition
  const [name, setName] = useState(profile?.name ?? '');
  const [currency, setCurrency] = useState(profile?.currency ?? 'USD');

  useEffect(() => {
    if (profile?.name !== undefined) setName(profile.name ?? '');
    if (profile?.currency) setCurrency(profile.currency);
  }, [profile?.name, profile?.currency]);

  const save = async () => {
    await update.mutateAsync({ name: name.trim() || null, currency });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top']} className="flex-1 bg-background-light dark:bg-background-dark">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            Профиль
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть">
            <Text className="text-base text-primary">Отмена</Text>
          </Pressable>
        </View>

        {/* Fields */}
        <View className="gap-4 px-4">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Имя"
            accessibilityLabel="Имя"
            className="rounded-2xl bg-surface-light px-4 py-3 text-base text-text-primary-light dark:bg-surface-dark dark:text-text-primary-dark"
          />

          <Text className="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
            Валюта по умолчанию
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {CURRENCIES.map((c) => {
              const active = currency === c.code;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => setCurrency(c.code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={cn(
                    'rounded-full border px-4 py-2',
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

        <View className="mt-auto px-4 pb-4">
          <Button title="Сохранить" onPress={save} loading={update.isPending} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
