import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/shared/lib/utils';

export interface SkeletonProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pulsing block used as a loading placeholder. Animation runs on the UI
 * thread via Reanimated to stay smooth even while the JS thread is
 * hydrating a list.
 */
export function Skeleton({ className, style }: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      className={cn('rounded-md bg-surface-light dark:bg-surface-dark', className)}
      style={[animatedStyle, style]}
    />
  );
}

export interface SkeletonListItemProps {
  className?: string;
}

export function SkeletonListItem({ className }: SkeletonListItemProps) {
  return (
    <Animated.View className={cn('flex-row items-center gap-3 py-3', className)}>
      <Skeleton className="h-10 w-10 rounded-full" />
      <Animated.View className="flex-1 gap-2">
        <Skeleton className="h-3.5 w-2/3 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </Animated.View>
      <Skeleton className="h-4 w-16 rounded" />
    </Animated.View>
  );
}
