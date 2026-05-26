import { Text, TextInput, View } from 'react-native';

interface Props {
  value: string;
  onChange: (next: string) => void;
  currency: string;
}

/**
 * iOS decimal-pad on ru-RU emits a comma; en-US emits a dot. Normalize both
 * to `.` so `Number(value)` parses correctly. Also strip duplicate dots so
 * `1..5` collapses to `1.5`.
 */
function normalizeAmount(input: string): string {
  const replaced = input.replace(',', '.').replace(/[^\d.]/g, '');
  const firstDot = replaced.indexOf('.');
  if (firstDot === -1) return replaced;
  return replaced.slice(0, firstDot + 1) + replaced.slice(firstDot + 1).replace(/\./g, '');
}

export function HeroAmount({ value, onChange, currency }: Props) {
  return (
    <View className="items-center py-6">
      <View className="flex-row items-baseline gap-2">
        <TextInput
          value={value}
          onChangeText={(t) => onChange(normalizeAmount(t))}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#a1a1aa"
          className="text-6xl font-bold text-text-primary-light dark:text-text-primary-dark min-w-[120px] text-center"
          style={{ fontVariant: ['tabular-nums'] }}
          accessibilityLabel="Сумма"
        />
        <Text className="text-2xl text-text-secondary-light dark:text-text-secondary-dark">
          {currency}
        </Text>
      </View>
    </View>
  );
}
