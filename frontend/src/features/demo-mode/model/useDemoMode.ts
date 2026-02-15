import { ref, computed, onMounted, onUnmounted, watch, type Ref } from 'vue';
import type { Profile } from '@/shared/api';

export function useDemoMode(profile: Ref<Profile | null | undefined>) {
  const now = ref(Date.now());
  let intervalId: ReturnType<typeof setInterval> | null = null;

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

  function startTimer() {
    if (intervalId) return;

    intervalId = setInterval(() => {
      now.value = Date.now();
    }, 1000);
  }

  function stopTimer() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  // Start timer when demo mode is detected
  watch(
    isDemo,
    (isDemoMode) => {
      if (isDemoMode) {
        startTimer();
      } else {
        stopTimer();
      }
    },
    { immediate: true },
  );

  onMounted(() => {
    if (isDemo.value) {
      startTimer();
    }
  });

  onUnmounted(() => {
    stopTimer();
  });

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
