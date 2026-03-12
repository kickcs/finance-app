<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCountUp } from '../composables';

const props = defineProps<{
  isVisible: boolean;
}>();

const visibleRef = computed(() => props.isVisible);
const balanceTarget = ref(12450);
const incomeTarget = ref(3200);
const expenseTarget = ref(1850);

const balance = useCountUp(balanceTarget, visibleRef, {
  format: (n) => `$${Math.floor(n).toLocaleString('en-US')}`,
});
const balanceCents = '.00';

const income = useCountUp(incomeTarget, visibleRef, {
  format: (n) => `+$${Math.floor(n).toLocaleString('en-US')}`,
  duration: 1200,
});

const expense = useCountUp(expenseTarget, visibleRef, {
  format: (n) => `-$${Math.floor(n).toLocaleString('en-US')}`,
  duration: 1200,
});
</script>

<template>
  <div class="glass-card gradient-border relative rounded-3xl p-8 overflow-hidden">
    <!-- Inner ambient glow -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 opacity-50 pointer-events-none"
    />

    <div class="relative z-10 flex items-center justify-between mb-8">
      <div class="flex items-center gap-2.5">
        <div
          class="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse"
        />
        <span class="text-xs font-bold uppercase tracking-[3px] text-white/50">Ваш баланс</span>
      </div>
      <div class="h-6 w-10 flex gap-1">
        <div class="h-full w-full rounded bg-white/10" />
        <div class="h-full w-full rounded bg-white/20" />
      </div>
    </div>

    <p
      class="mb-8 font-['Unbounded'] text-5xl font-black tracking-tighter text-white relative z-10 flex items-baseline filter drop-shadow-md"
    >
      {{ balance }}
      <span class="text-2xl text-indigo-300/80 ml-1">{{ balanceCents }}</span>
    </p>

    <div
      v-motion
      class="flex gap-3 relative z-10"
      :initial="{ opacity: 0, y: 15 }"
      :enter="{
        opacity: 1,
        y: 0,
        transition: { delay: 400, type: 'spring', stiffness: 250, damping: 25 },
      }"
    >
      <div
        class="flex-1 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 relative overflow-hidden"
      >
        <div
          class="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent pointer-events-none"
        />
        <div class="flex items-center gap-2 mb-1">
          <svg
            class="w-3 h-3 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
          <p class="text-[10px] font-bold uppercase tracking-[2px] text-emerald-400/80">Доход</p>
        </div>
        <p class="text-base font-bold text-emerald-300 font-['Unbounded']">{{ income }}</p>
      </div>

      <div
        class="flex-1 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 relative overflow-hidden"
      >
        <div
          class="absolute inset-0 bg-gradient-to-t from-rose-500/5 to-transparent pointer-events-none"
        />
        <div class="flex items-center gap-2 mb-1">
          <svg class="w-3 h-3 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
          <p class="text-[10px] font-bold uppercase tracking-[2px] text-rose-400/80">Расход</p>
        </div>
        <p class="text-base font-bold text-rose-300 font-['Unbounded']">{{ expense }}</p>
      </div>
    </div>
  </div>
</template>
