import { TextInput, View } from 'react-native';

import { Icon } from '@/shared/ui';

export function SearchInput({
  value,
  onChange,
  placeholder = 'Поиск',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View className="mx-4 my-2 flex-row items-center gap-2 rounded-2xl bg-surface-light px-4 py-2 dark:bg-surface-dark">
      <Icon name="search" size={18} color="#71717a" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#a1a1aa"
        className="flex-1 text-base text-text-primary-light dark:text-text-primary-dark"
        accessibilityLabel={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}
