import { Text, View } from 'react-native';
import { cn } from '@/shared/lib/utils';

export type InitialAvatarProps = {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE_BOX = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' };
const SIZE_TEXT = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

export function InitialAvatar({ name, color = '#6B7280', size = 'md' }: InitialAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      className={cn('items-center justify-center rounded-full', SIZE_BOX[size])}
      style={{ backgroundColor: color }}
      accessibilityRole="image"
      accessibilityLabel={`Avatar for ${name}`}
    >
      <Text className={cn('font-semibold text-white', SIZE_TEXT[size])}>{initial}</Text>
    </View>
  );
}
