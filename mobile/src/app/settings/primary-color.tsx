import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import { Icon } from '@/shared/ui/icon';
import {
  PRIMARY_COLOR_OPTIONS,
  usePrimaryColor,
} from '@/shared/lib/composables/usePrimaryColor';

export default function PrimaryColorScreen() {
  const { color, setColor } = usePrimaryColor();
  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <Stack.Screen options={{ title: 'Основной цвет' }} />
      <ScrollView contentContainerClassName="flex-row flex-wrap gap-3 p-4">
        {PRIMARY_COLOR_OPTIONS.map((c) => {
          const active = c === color;
          return (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className="h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: c }}
            >
              {active ? <Icon name="check" size={28} color="#fff" /> : null}
            </Pressable>
          );
        })}
        <Text className="w-full pt-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Изменения вступят в силу после перезапуска приложения.
        </Text>
      </ScrollView>
    </View>
  );
}
