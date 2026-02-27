import { computed, watch, type Ref } from 'vue';
import { useTimestamp } from '@vueuse/core';
import type { Profile } from '@/shared/api';

export function useDemoMode(profile: Ref<Profile | null | undefined>) {
  const {
    timestamp: now,
    pause,
    resume,
  } = useTimestamp({
    controls: true,
    interval: 1000,
    immediate: false,
  });

  const isDemo = computed(() => profile.value?.is_demo ?? false);

  const expiresAt = computed(() => {
    if (!profile.value?.demo_expires_at) return null;
    return new Date(profile.value.demo_expires_at).getTime();
  });

  const remainingTime = computed(() => {
    if (!expiresAt.value) return null;
    const remaining = expiresAt.value - now.value;
    return remaining > 0 ? remaining : 0;
  });

  const remainingMinutes = computed(() => {
    if (remainingTime.value === null) return 0;
    return Math.ceil(remainingTime.value / 60000);
  });

  const remainingSeconds = computed(() => {
    if (remainingTime.value === null) return 0;
    return Math.ceil(remainingTime.value / 1000);
  });

  const formattedRemaining = computed(() => {
    if (remainingTime.value === null) return '00:00';
    const totalSeconds = Math.ceil(remainingTime.value / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  const isExpired = computed(() => {
    if (!isDemo.value || remainingTime.value === null) return false;
    return remainingTime.value <= 0;
  });

  // Start/stop timer when demo mode changes
  watch(
    isDemo,
    (isDemoMode) => {
      if (isDemoMode) {
        resume();
      } else {
        pause();
      }
    },
    { immediate: true },
  );

  return {
    isDemo,
    expiresAt,
    remainingTime,
    remainingMinutes,
    remainingSeconds,
    formattedRemaining,
    isExpired,
  };
}
