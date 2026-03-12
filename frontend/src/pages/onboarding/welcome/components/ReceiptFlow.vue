<script setup lang="ts">
defineProps<{
  isVisible: boolean;
}>();

const steps = [
  { icon: '📸', label: 'Фото чека', type: 'receipt' as const },
  { icon: '🤖', label: 'Распознаём', type: 'processing' as const },
  { icon: '✅', label: 'Готово!', type: 'result' as const },
];
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
    <template v-for="(step, i) in steps" :key="i">
      <div
        class="w-28 rounded-xl border border-white/[0.08] p-3 text-center transition-all duration-500 sm:w-32 sm:p-4"
        :class="[
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
          step.type === 'processing' ? 'border-red-500/20 bg-red-500/10' : 'bg-white/[0.06]',
          step.type === 'result' ? 'border-emerald-500/20' : '',
        ]"
        :style="{ transitionDelay: `${i * 0.3}s` }"
      >
        <p class="mb-1.5 text-2xl">{{ step.icon }}</p>
        <p
          class="text-[10px]"
          :class="{
            'text-white/50': step.type === 'receipt',
            'text-red-400': step.type === 'processing',
            'text-emerald-400': step.type === 'result',
          }"
        >
          {{ step.label }}
        </p>

        <div
          v-if="step.type === 'receipt'"
          class="mt-2 rounded-md bg-white/[0.04] p-1.5 text-left text-[9px] text-white/40"
        >
          <p>Магнит</p>
          <p>Молоко...48₽</p>
          <p>Хлеб...35₽</p>
          <p class="mt-1 border-t border-dashed border-white/10 pt-1 font-semibold text-white">
            Итого: 83₽
          </p>
        </div>

        <div v-if="step.type === 'processing'" class="mt-2 space-y-1">
          <div class="h-1 rounded-full bg-white/10">
            <div
              class="h-1 rounded-full bg-red-400 transition-all duration-1000 ease-out"
              :style="{ width: isVisible ? '80%' : '0%', transitionDelay: '0.8s' }"
            />
          </div>
          <p class="text-[8px] text-white/40">Сумма, категория, дата</p>
        </div>

        <div v-if="step.type === 'result'" class="mt-2 space-y-1.5">
          <div class="rounded-md bg-emerald-500/10 p-1.5">
            <p class="text-xs font-bold text-white">−83 ₽</p>
            <p class="text-[9px] text-emerald-300">🛒 Продукты</p>
          </div>
          <div
            class="rounded-md bg-amber-500/10 p-1 transition-all duration-500"
            :class="isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'"
            :style="{ transitionDelay: '1.2s' }"
          >
            <p class="text-[8px] text-amber-300">👥 Долги созданы</p>
          </div>
        </div>
      </div>

      <div
        v-if="i < steps.length - 1"
        class="text-xl text-red-400 transition-all duration-300"
        :class="isVisible ? 'scale-100 opacity-100' : 'scale-50 opacity-0'"
        :style="{ transitionDelay: `${0.15 + i * 0.3}s` }"
      >
        →
      </div>
    </template>
  </div>
</template>
