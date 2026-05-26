import { Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { useNavbarStyle } from '@/features/select-navbar-style/composables/useNavbarStyle';
import { cn } from '@/shared/lib/utils';

export default function NavbarStyleScreen() {
  const { style, setStyle } = useNavbarStyle();
  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <Stack.Screen options={{ title: 'Стиль навигации' }} />
      <View className="gap-3 p-4">
        {(['full', 'compact'] as const).map((s) => (
          <Pressable
            key={s}
            onPress={() => setStyle(s)}
            accessibilityRole="button"
            accessibilityState={{ selected: style === s }}
            className={cn(
              'rounded-2xl border p-4',
              style === s
                ? 'border-primary'
                : 'border-border-light dark:border-border-dark',
            )}
          >
            <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
              {s === 'full' ? 'Полная' : 'Компактная'}
            </Text>
            <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              {s === 'full' ? 'Иконка и подпись' : 'Только иконки'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
