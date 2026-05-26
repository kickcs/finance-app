import { View, type ViewProps } from 'react-native';

import { cn } from '@/shared/lib/utils';

export interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ className, style, ...props }: CardProps) {
  return (
    <View
      className={cn('bg-card-light dark:bg-card-dark rounded-2xl p-4', className)}
      style={[{ borderCurve: 'continuous' }, style]}
      {...props}
    />
  );
}
