<script setup lang="ts">
import { ref } from 'vue';
import { useCountUp } from '../composables';

// ~314.16

const props = defineProps<{
  isVisible: boolean;
}>();
const CIRCUMFERENCE = 2 * Math.PI * 50;
const totalTarget = ref(1850);
const total = useCountUp(totalTarget, () => props.isVisible, {
  format: (n) => `$${Math.floor(n).toLocaleString('en-US')}`,
});

const segments = [
  { color: '#34d399', percent: 35, label: 'Продукты' },
  { color: '#818cf8', percent: 20, label: 'Транспорт' },
  { color: '#fbbf24', percent: 15, label: 'Развлечения' },
  { color: '#fb7185', percent: 10, label: 'Рестораны' },
  { color: 'rgba(255,255,255,0.1)', percent: 20, label: 'Другое' },
];

const { dasharrays: segmentDasharrays, offsets: segmentOffsets } = (() => {
  const dasharrays: string[] = [];
  const offsets: number[] = [];
  let offset = 0;
  for (const s of segments) {
    const arc = (s.percent / 100) * CIRCUMFERENCE;
    dasharrays.push(`${arc.toFixed(1)} ${(CIRCUMFERENCE - arc).toFixed(1)}`);
    offsets.push(-offset);
    offset += arc;
  }
  return { dasharrays, offsets };
})();
</script>

<template>
  <div class="flex flex-col items-center gap-8 sm:flex-row sm:justify-center sm:gap-12">
    <div class="relative h-44 w-44 sm:h-48 sm:w-48">
      <!-- Ambient glow behind chart -->
      <div
        class="absolute inset-[-20%] rounded-full bg-emerald-500/[0.06] blur-3xl transition-opacity duration-1000"
        :class="isVisible ? 'opacity-100' : 'opacity-0'"
      />
      <svg viewBox="0 0 120 120" class="relative h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="rgba(255,255,255,0.03)"
          stroke-width="14"
        />
        <circle
          v-for="(seg, i) in segments"
          :key="i"
          cx="60"
          cy="60"
          r="50"
          fill="none"
          :stroke="seg.color"
          stroke-width="14"
          stroke-linecap="round"
          class="transition-all duration-1000 ease-out"
          :style="{
            strokeDasharray: isVisible ? segmentDasharrays[i] : '0 314',
            strokeDashoffset: isVisible ? segmentOffsets[i] : 0,
            transitionDelay: `${0.2 + i * 0.12}s`,
          }"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <p class="font-['Unbounded'] text-xl font-bold text-white">{{ total }}</p>
        <p class="text-[10px] font-medium uppercase tracking-wider text-white/30">расходы</p>
      </div>
    </div>

    <div class="flex flex-col gap-2.5">
      <div
        v-for="(seg, i) in segments"
        :key="i"
        class="flex items-center gap-3 transition-all duration-500"
        :class="isVisible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'"
        :style="{ transitionDelay: `${0.4 + i * 0.08}s` }"
      >
        <span
          class="h-2.5 w-2.5 rounded-[3px] shadow-[0_0_6px_var(--glow)]"
          :style="{ backgroundColor: seg.color, '--glow': seg.color + '40' }"
        />
        <span class="w-24 text-left text-xs text-white/70">{{ seg.label }}</span>
        <span class="text-xs font-semibold tabular-nums text-white/40">{{ seg.percent }}%</span>
      </div>
    </div>
  </div>
</template>
