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
        glow: 'rgba(251, 191, 36, 0.4)',
        border: 'border-amber-500/20',
        bg: 'bg-amber-500/[0.08]',
        text: 'text-amber-400',
        bar: 'from-amber-500 to-amber-400',
        avatar: 'from-amber-500 to-amber-600',
        label: 'Вам должны',
      }
    : {
        accent: '#f87171',
        glow: 'rgba(248, 113, 113, 0.4)',
        border: 'border-red-500/20',
        bg: 'bg-red-500/[0.08]',
        text: 'text-red-400',
        bar: 'from-red-500 to-red-400',
        avatar: 'from-red-500 to-red-600',
        label: 'Вы должны',
      },
);
</script>

<template>
  <div class="glass-card gradient-border w-full rounded-3xl p-6 relative overflow-hidden group">
    <!-- Inner soft glow -->
    <div
      class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t rounded-b-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
      :class="theme.bg"
    />

    <div class="mb-4 flex items-center gap-3 relative z-10">
      <div
        class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-lg font-bold text-white transition-transform duration-500 shadow-lg"
        :class="[theme.avatar, isVisible ? 'scale-100' : 'scale-75']"
        :style="{ transitionDelay: '0.4s' }"
      >
        {{ name[0] }}
      </div>
      <div>
        <p class="text-base font-semibold text-white/90">{{ name }}</p>
        <p class="text-[11px] font-bold uppercase tracking-wider mt-0.5" :class="theme.text">
          {{ theme.label }}
        </p>
      </div>
    </div>
    <p class="mb-4 font-['Unbounded'] text-2xl font-bold text-white relative z-10">{{ amount }}</p>

    <div class="mb-2 h-2 overflow-hidden rounded-full bg-white/[0.05] relative z-10">
      <div
        class="h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out"
        :class="theme.bar"
        :style="{
          width: isVisible ? `${progress}%` : '0%',
          boxShadow: `0 0 16px ${theme.glow}`,
          transitionDelay: '0.3s',
        }"
      />
    </div>
    <div class="flex items-center justify-between relative z-10">
      <span class="text-xs text-white/50 font-medium">{{ progressDisplay }}</span>
      <span class="text-xs font-bold" :class="theme.text">{{ paid }} / {{ total }}</span>
    </div>
  </div>
</template>
