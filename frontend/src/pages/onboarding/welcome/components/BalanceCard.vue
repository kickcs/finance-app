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
  <div class="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md">
    <p class="mb-1 text-xs text-white/50">Общий баланс</p>
    <p class="mb-4 text-3xl font-extrabold text-white">
      {{ balance }}
      <span class="text-lg text-indigo-400">{{ balanceCents }}</span>
    </p>
    <div
      class="flex gap-2 transition-all duration-500"
      :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
      :style="{ transitionDelay: '0.3s' }"
    >
      <div class="flex-1 rounded-lg bg-emerald-500/15 p-2">
        <p class="text-[10px] text-emerald-300">↑ Доход</p>
        <p class="text-sm font-bold text-emerald-500">{{ income }}</p>
      </div>
      <div class="flex-1 rounded-lg bg-red-500/15 p-2">
        <p class="text-[10px] text-red-300">↓ Расход</p>
        <p class="text-sm font-bold text-red-500">{{ expense }}</p>
      </div>
    </div>
  </div>
</template>
