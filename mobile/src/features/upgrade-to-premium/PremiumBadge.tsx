import { Text, View } from 'react-native';

import { cn } from '@/shared/lib/utils';

export interface PremiumBadgeProps {
  className?: string;
}

export function PremiumBadge({ className }: PremiumBadgeProps) {
  return (
    <View
      className={cn(
        'rounded-full bg-warning-light/15 px-2 py-0.5 self-start',
        className,
      )}
    >
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-warning-light">
        Premium
      </Text>
    </View>
  );
}
