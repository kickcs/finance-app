import { Pressable, Text, View } from 'react-native';
import { Icon, Tabs } from '@/shared/ui';
import type { Scale } from './composables/usePeriodNavigation';

type Props = {
  scale: Scale;
  setScale: (s: Scale) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
};

export function PeriodHeader({ scale, setScale, label, onPrev, onNext }: Props) {
  return (
    <View className="gap-2 px-4 py-2">
      <Tabs
        items={[
          { id: 'day', label: 'День' },
          { id: 'week', label: 'Неделя' },
          { id: 'month', label: 'Месяц' },
          { id: 'year', label: 'Год' },
        ]}
        value={scale}
        onChange={setScale}
      />
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onPrev}
          accessibilityRole="button"
          accessibilityLabel="Предыдущий период"
          className="p-2"
        >
          <Icon name="chevron_left" size={20} />
        </Pressable>
        <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
          {label}
        </Text>
        <Pressable
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel="Следующий период"
          className="p-2"
        >
          <Icon name="chevron_right" size={20} />
        </Pressable>
      </View>
    </View>
  );
}
