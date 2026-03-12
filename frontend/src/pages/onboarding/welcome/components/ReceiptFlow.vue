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
  <div class="flex flex-wrap items-start justify-center gap-3 sm:gap-4">
    <template v-for="(step, i) in steps" :key="i">
      <div
        class="glass-card gradient-border w-32 rounded-2xl p-4 text-center transition-all duration-600 sm:w-36"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
        :style="{ transitionDelay: `${0.2 + i * 0.25}s` }"
      >
        <p class="mb-2 text-2xl">{{ step.icon }}</p>
        <p
          class="mb-2 text-[11px] font-semibold"
          :class="{
            'text-white/60': step.type === 'receipt',
            'text-rose-400': step.type === 'processing',
            'text-emerald-400': step.type === 'result',
          }"
        >
          {{ step.label }}
        </p>

        <!-- Receipt mockup -->
        <div
          v-if="step.type === 'receipt'"
          class="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 text-left text-[9px] text-white/35"
        >
          <p class="mb-1 text-[8px] font-medium text-white/20">МАГНИТ</p>
          <p>Молоко · · · 48₽</p>
          <p>Хлеб · · · · 35₽</p>
          <div class="mt-1.5 border-t border-dashed border-white/[0.06] pt-1.5">
            <p class="font-semibold text-white/60">Итого: 83₽</p>
          </div>
        </div>

        <!-- Processing indicator -->
        <div v-if="step.type === 'processing'" class="space-y-1.5">
          <div class="h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              class="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-1200 ease-out"
              :style="{
                width: isVisible ? '85%' : '0%',
                transitionDelay: '0.8s',
                boxShadow: '0 0 10px rgba(251, 113, 133, 0.3)',
              }"
            />
          </div>
          <p class="text-[8px] text-white/25">Сумма, категория, дата</p>
        </div>

        <!-- Result -->
        <div v-if="step.type === 'result'" class="space-y-1.5">
          <div class="rounded-lg border border-emerald-500/10 bg-emerald-500/[0.06] p-2">
            <p class="text-xs font-bold text-white">−83 ₽</p>
            <p class="text-[9px] text-emerald-400/70">Продукты</p>
          </div>
          <div
            class="rounded-lg border border-amber-500/10 bg-amber-500/[0.05] p-1.5 transition-all duration-500"
            :class="isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'"
            :style="{ transitionDelay: '1.2s' }"
          >
            <p class="text-[8px] font-medium text-amber-400/80">Долги созданы</p>
          </div>
        </div>
      </div>

      <!-- Connector line -->
      <div v-if="i < steps.length - 1" class="hidden items-center sm:flex">
        <div
          class="h-px w-6 bg-gradient-to-r from-white/15 to-white/5 transition-all duration-500"
          :class="isVisible ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'"
          :style="{ transitionDelay: `${0.3 + i * 0.25}s` }"
        />
      </div>
    </template>
  </div>
</template>
