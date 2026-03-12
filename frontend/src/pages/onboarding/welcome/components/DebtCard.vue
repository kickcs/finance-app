<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCountUp } from '../composables';

const props = defineProps<{
  name: string;
  type: 'given' | 'received';
  amount: string;
  progress: number;
  paid: string;
  total: string;
  isVisible: boolean;
}>();

const visibleRef = computed(() => props.isVisible);
const progressTarget = ref(props.progress);
const progressDisplay = useCountUp(progressTarget, visibleRef, {
  duration: 1000,
  format: (n) => `${Math.round(n)}%`,
});

const theme = computed(() =>
  props.type === 'given'
    ? {
        accent: '#fbbf24',
        glow: 'rgba(251, 191, 36, 0.15)',
        border: 'border-amber-500/15',
        bg: 'bg-amber-500/[0.06]',
        text: 'text-amber-400',
        bar: 'from-amber-500 to-amber-400',
        avatar: 'from-amber-500/80 to-amber-600/80',
        label: 'Дал в долг',
      }
    : {
        accent: '#f87171',
        glow: 'rgba(248, 113, 113, 0.15)',
        border: 'border-red-500/15',
        bg: 'bg-red-500/[0.06]',
        text: 'text-red-400',
        bar: 'from-red-500 to-red-400',
        avatar: 'from-red-500/80 to-red-600/80',
        label: 'Взял в долг',
      },
);
</script>

<template>
  <div class="glass-card gradient-border w-48 rounded-2xl p-4 sm:w-52">
    <div class="mb-3 flex items-center gap-2.5">
      <div
        class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white transition-transform duration-500"
        :class="[theme.avatar, isVisible ? 'scale-100' : 'scale-75']"
        :style="{ transitionDelay: '0.4s' }"
      >
        {{ name[0] }}
      </div>
      <div>
        <p class="text-sm font-semibold text-white">{{ name }}</p>
        <p class="text-[10px] font-medium" :class="theme.text">{{ theme.label }}</p>
      </div>
    </div>
    <p class="mb-3 font-['Unbounded'] text-lg font-bold text-white">{{ amount }}</p>
    <div class="mb-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        class="h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out"
        :class="theme.bar"
        :style="{
          width: isVisible ? `${progress}%` : '0%',
          boxShadow: `0 0 12px ${theme.glow}`,
          transitionDelay: '0.3s',
        }"
      />
    </div>
    <div class="flex items-center justify-between">
      <span class="text-[10px] text-white/35">{{ progressDisplay }}</span>
      <span class="text-[10px] font-medium" :class="theme.text">{{ paid }} / {{ total }}</span>
    </div>
  </div>
</template>
