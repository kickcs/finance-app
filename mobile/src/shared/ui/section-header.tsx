import { Pressable, Text, View } from 'react-native';

export type SectionHeaderProps = {
  title: string;
  action?: { label: string; onPress: () => void };
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
      <Text className="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">{title}</Text>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label}>
          <Text className="text-sm font-medium text-primary">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
