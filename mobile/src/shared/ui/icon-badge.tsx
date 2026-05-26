import { View } from 'react-native';
import { cn } from '@/shared/lib/utils';
import { Icon } from './icon';

export type IconBadgeProps = { icon: string; color?: string; size?: 'sm' | 'md' | 'lg' };

const SIZE = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };
const ICON_SIZE = { sm: 16, md: 20, lg: 24 };

export function IconBadge({ icon, color = '#6B7280', size = 'md' }: IconBadgeProps) {
  return (
    <View
      className={cn('items-center justify-center rounded-full', SIZE[size])}
      style={{ backgroundColor: `${color}22` }}
    >
      <Icon name={icon} size={ICON_SIZE[size]} color={color} />
    </View>
  );
}
