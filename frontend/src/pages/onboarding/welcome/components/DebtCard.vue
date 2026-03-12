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

const colorMap = {
  given: {
    gradient: 'from-amber-500 to-amber-600',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    bar: 'bg-gradient-to-r from-amber-500 to-amber-400',
    label: 'Дал в долг',
  },
  received: {
    gradient: 'from-red-500 to-red-600',
    border: 'border-red-500/20',
    text: 'text-red-400',
    bar: 'bg-gradient-to-r from-red-500 to-red-400',
    label: 'Взял в долг',
  },
};

const colors = computed(() => colorMap[props.type]);
</script>

<template>
  <div class="w-44 rounded-xl border bg-white/[0.06] p-4" :class="colors.border">
    <div class="mb-2.5 flex items-center gap-1.5">
      <div
        class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white"
        :class="colors.gradient"
      >
        {{ name[0] }}
      </div>
      <div>
        <p class="text-xs font-semibold text-white">{{ name }}</p>
        <p class="text-[10px]" :class="colors.text">{{ colors.label }}</p>
      </div>
    </div>
    <p class="mb-2 text-lg font-extrabold text-white">{{ amount }}</p>
    <div class="mb-1 h-1.5 rounded-full bg-white/10">
      <div
        class="h-1.5 rounded-full transition-all duration-1000 ease-out"
        :class="colors.bar"
        :style="{ width: isVisible ? `${progress}%` : '0%' }"
      />
    </div>
    <div class="flex justify-between">
      <span class="text-[10px] text-white/50">Возвращено {{ progressDisplay }}</span>
      <span class="text-[10px]" :class="colors.text">{{ paid }} / {{ total }}</span>
    </div>
  </div>
</template>
