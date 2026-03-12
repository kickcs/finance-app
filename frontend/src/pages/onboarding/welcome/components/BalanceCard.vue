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
  <div class="glass-card gradient-border rounded-2xl p-6">
    <div class="mb-1 flex items-center gap-2">
      <div class="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
      <span class="text-[10px] font-medium uppercase tracking-[2px] text-white/40">
        Общий баланс
      </span>
    </div>
    <p class="mb-5 font-['Unbounded'] text-4xl font-bold tracking-tight text-white">
      {{ balance }}
      <span class="text-xl text-indigo-400/80">{{ balanceCents }}</span>
    </p>
    <div
      class="flex gap-2.5 transition-all duration-600"
      :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      :style="{ transitionDelay: '0.4s' }"
    >
      <div class="flex-1 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.07] p-3">
        <p class="mb-0.5 text-[9px] font-medium uppercase tracking-wider text-emerald-400/60">
          Доход
        </p>
        <p class="text-sm font-bold text-emerald-400">{{ income }}</p>
      </div>
      <div class="flex-1 rounded-xl border border-red-500/10 bg-red-500/[0.07] p-3">
        <p class="mb-0.5 text-[9px] font-medium uppercase tracking-wider text-red-400/60">Расход</p>
        <p class="text-sm font-bold text-red-400">{{ expense }}</p>
      </div>
    </div>
  </div>
</template>
