import { type ReactNode, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { trigger } from '@/shared/lib/haptics';

const ACTION_WIDTH = 80;

export interface SwipeableRowProps {
  children: ReactNode;
  /** Right-swipe destructive action. Closes the row on press. */
  onDelete?: () => void;
  /** Defaults to "Удалить". */
  deleteLabel?: string;
}

function RightDeleteAction({
  progress,
  onPress,
  label,
}: {
  progress: SharedValue<number>;
  onPress: () => void;
  label: string;
}) {
  // Slide the button in from the right edge as the row opens. When fully
  // closed (progress=0), translateX=ACTION_WIDTH (off-screen to the right).
  // When fully open (progress=1), translateX=0 (flush with the row).
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * ACTION_WIDTH }],
  }));

  return (
    <Animated.View style={[{ width: ACTION_WIDTH }, animatedStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        className="h-full w-full items-center justify-center bg-danger"
      >
        <Text className="text-sm font-semibold text-white">{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function SwipeableRow({
  children,
  onDelete,
  deleteLabel = 'Удалить',
}: SwipeableRowProps) {
  const ref = useRef<SwipeableMethods>(null);

  if (!onDelete) return <View>{children}</View>;

  const handleDelete = async () => {
    await trigger('medium');
    ref.current?.close();
    onDelete();
  };

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      renderRightActions={(progress) => (
        <RightDeleteAction
          progress={progress}
          onPress={handleDelete}
          label={deleteLabel}
        />
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
