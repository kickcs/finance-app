<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCountUp } from '../composables';

const props = defineProps<{
  isVisible: boolean;
}>();

const visibleRef = computed(() => props.isVisible);
const totalTarget = ref(1850);
const total = useCountUp(totalTarget, visibleRef, {
  format: (n) => `$${Math.floor(n).toLocaleString('en-US')}`,
});

const segments = [
  { color: '#10b981', percent: 35, label: 'Продукты', dasharray: '110 204' },
  { color: '#6366f1', percent: 20, label: 'Транспорт', dasharray: '62 252' },
  { color: '#f59e0b', percent: 15, label: 'Развлечения', dasharray: '45 269' },
  { color: '#ef4444', percent: 10, label: 'Рестораны', dasharray: '30 284' },
  { color: 'rgba(255,255,255,0.15)', percent: 20, label: 'Другое', dasharray: '63 251' },
];

const segmentOffsets = computed(() => {
  let offset = 0;
  return segments.map((s) => {
    const current = offset;
    offset += parseFloat(s.dasharray.split(' ')[0]);
    return -current;
  });
});
</script>

<template>
  <div class="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
    <div class="relative h-36 w-36">
      <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          stroke-width="16"
        />
        <circle
          v-for="(seg, i) in segments"
          :key="i"
          cx="60"
          cy="60"
          r="50"
          fill="none"
          :stroke="seg.color"
          stroke-width="16"
          stroke-linecap="round"
          class="transition-all duration-1000 ease-out"
          :style="{
            strokeDasharray: isVisible ? seg.dasharray : '0 314',
            strokeDashoffset: isVisible ? segmentOffsets[i] : 0,
            transitionDelay: `${i * 0.15}s`,
          }"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <p class="text-base font-extrabold text-white">{{ total }}</p>
        <p class="text-[10px] text-white/50">расходы</p>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div
        v-for="(seg, i) in segments"
        :key="i"
        class="flex items-center gap-2 transition-all duration-500"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'"
        :style="{ transitionDelay: `${0.3 + i * 0.1}s` }"
      >
        <span class="h-2.5 w-2.5 rounded-sm" :style="{ backgroundColor: seg.color }" />
        <span class="text-xs text-white">{{ seg.label }}</span>
        <span class="ml-auto text-xs text-white/50">{{ seg.percent }}%</span>
      </div>
    </div>
  </div>
</template>
