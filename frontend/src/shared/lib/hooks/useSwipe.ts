import { ref, onUnmounted } from 'vue';
import { useHaptics } from '@/shared/lib/haptics';

export interface SwipeConfig {
  /** Threshold to reveal action (default: 80px) */
  threshold?: number;
  /** Maximum swipe distance (default: 100px) */
  maxSwipe?: number;
  /** Enable left swipe action */
  leftEnabled?: boolean;
  /** Enable right swipe action */
  rightEnabled?: boolean;
  /** Distance threshold for full-swipe auto-fire */
  fullSwipeThreshold?: number;
  /** Callback when full-swipe left is triggered */
  onFullSwipeLeft?: () => void;
  /** Callback when full-swipe right is triggered */
  onFullSwipeRight?: () => void;
}

export type SwipeState = 'idle' | 'swiping' | 'left' | 'right';

export function useSwipe(config?: SwipeConfig) {
  const { trigger } = useHaptics();
  const {
    threshold = 80,
    maxSwipe = 100,
    leftEnabled = true,
    rightEnabled = true,
    fullSwipeThreshold,
    onFullSwipeLeft,
    onFullSwipeRight,
  } = config || {};

  const translateX = ref(0);
  const isDragging = ref(false);
  const swipeState = ref<SwipeState>('idle');

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isHorizontalSwipe: boolean | null = null;
  let hasTriggeredHaptic = false;
  let animationFrameId: number | null = null;

  function onTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isHorizontalSwipe = null;
    hasTriggeredHaptic = false;
    isDragging.value = true;
  }

  function onTouchMove(e: TouchEvent) {
    if (!isDragging.value) return;

    currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX;
    const diffY = currentY - startY;

    // Determine swipe direction in first 10px of movement
    if (isHorizontalSwipe === null && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
      isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY);
    }

    // If vertical swipe, cancel and let scroll happen
    if (isHorizontalSwipe === false) {
      isDragging.value = false;
      translateX.value = 0;
      swipeState.value = 'idle';
      return;
    }

    // If horizontal swipe, handle it
    if (isHorizontalSwipe === true) {
      e.preventDefault();

      let newTranslateX = diffX;

      // When full-swipe is enabled, allow longer swipe distance
      const effectiveMaxSwipe = fullSwipeThreshold
        ? Math.max(maxSwipe, fullSwipeThreshold + 20)
        : maxSwipe;

      // Apply resistance and limits
      if (newTranslateX > 0) {
        // Swiping right (edit action)
        if (!rightEnabled) {
          newTranslateX = 0;
        } else {
          newTranslateX = Math.min(newTranslateX, effectiveMaxSwipe);
        }
      } else {
        // Swiping left (delete action)
        if (!leftEnabled) {
          newTranslateX = 0;
        } else {
          newTranslateX = Math.max(newTranslateX, -effectiveMaxSwipe);
        }
      }

      translateX.value = newTranslateX;
      swipeState.value = 'swiping';

      // Trigger haptic when crossing threshold
      const crossed = Math.abs(newTranslateX) >= threshold;
      if (crossed && !hasTriggeredHaptic) {
        trigger('selection');
        hasTriggeredHaptic = true;
      } else if (!crossed && hasTriggeredHaptic) {
        // Reset if user swipes back below threshold
        hasTriggeredHaptic = false;
      }
    }
  }

  function onTouchEnd() {
    if (!isDragging.value) return;

    isDragging.value = false;

    const absTranslate = Math.abs(translateX.value);

    // Full-swipe auto-fire
    if (fullSwipeThreshold && absTranslate >= fullSwipeThreshold) {
      if (translateX.value < 0 && leftEnabled && onFullSwipeLeft) {
        onFullSwipeLeft();
        animateToZero();
        return;
      }
      if (translateX.value > 0 && rightEnabled && onFullSwipeRight) {
        onFullSwipeRight();
        animateToZero();
        return;
      }
    }

    if (absTranslate >= threshold) {
      // Snap to revealed state
      if (translateX.value > 0 && rightEnabled) {
        translateX.value = maxSwipe;
        swipeState.value = 'right';
      } else if (translateX.value < 0 && leftEnabled) {
        translateX.value = -maxSwipe;
        swipeState.value = 'left';
      } else {
        animateToZero();
      }
    } else {
      // Snap back to closed
      animateToZero();
    }
  }

  function animateToZero() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    const startValue = translateX.value;
    const startTime = performance.now();
    const duration = 200;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      translateX.value = startValue * (1 - eased);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        translateX.value = 0;
        swipeState.value = 'idle';
        animationFrameId = null;
      }
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  function resetSwipe() {
    animateToZero();
  }

  // Cleanup
  onUnmounted(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    isDragging.value = false;
    translateX.value = 0;
    swipeState.value = 'idle';
  });

  return {
    translateX,
    isDragging,
    swipeState,
    resetSwipe,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
