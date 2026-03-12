<script setup lang="ts">
defineProps<{
  isVisible: boolean;
}>();

const steps = [
  { icon: '📸', label: 'Снимок чека', type: 'receipt' as const },
  { icon: '🤖', label: 'Распознавание ИИ', type: 'processing' as const },
  { icon: '🚀', label: 'Готово!', type: 'result' as const },
];
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-4 sm:gap-6 relative z-10">
    <template v-for="(step, i) in steps" :key="i">
      <div
        class="glass-card gradient-border w-36 rounded-3xl p-5 text-center transition-all duration-700 sm:w-44 group hover:-translate-y-2 hover:shadow-2xl hover:shadow-rose-900/10"
        :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'"
        :style="{ transitionDelay: `${100 + i * 200}ms` }"
      >
        <div
          class="mb-4 text-3xl transition-transform group-hover:scale-110 duration-500 relative inline-block"
        >
          <span class="relative z-10">{{ step.icon }}</span>
          <div class="absolute inset-x-0 bottom-0 h-4 bg-white/20 blur-md rounded-full -z-10" />
        </div>
        <p
          class="mb-3 text-[11px] font-bold uppercase tracking-wider"
          :class="{
            'text-white/70': step.type === 'receipt',
            'text-rose-400': step.type === 'processing',
            'text-emerald-400': step.type === 'result',
          }"
        >
          {{ step.label }}
        </p>

        <!-- Receipt mockup -->
        <div
          v-if="step.type === 'receipt'"
          class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left text-[10px] text-white/40 shadow-inner overflow-hidden relative"
        >
          <div
            class="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none"
          />
          <p class="mb-1 text-[8px] font-bold text-white/30 tracking-[2px] uppercase">
            Супермаркет
          </p>
          <div class="flex justify-between mb-0.5">
            <p>Латте</p>
            <p>250₽</p>
          </div>
          <div class="flex justify-between mb-1.5">
            <p>Брауни</p>
            <p>150₽</p>
          </div>
          <div class="mt-2 border-t border-dashed border-white/[0.1] pt-2 flex justify-between">
            <p class="font-bold text-white/80">Итого</p>
            <p class="font-bold text-white font-['Unbounded']">400₽</p>
          </div>
        </div>

        <!-- Processing indicator -->
        <div v-if="step.type === 'processing'" class="space-y-3 mt-4">
          <div class="h-1.5 overflow-hidden rounded-full bg-white/[0.08] relative">
            <div
              class="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400 transition-all duration-[1500ms] ease-out"
              :style="{
                width: isVisible ? '100%' : '0%',
                transitionDelay: '800ms',
                boxShadow: '0 0 12px rgba(251, 113, 133, 0.4)',
              }"
            />
          </div>
          <div class="flex flex-col gap-1">
            <div class="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                class="h-full bg-white/20 rounded-full"
                :style="{ width: isVisible ? '100%' : '0%', transition: 'width 1s ease-out 1s' }"
              />
            </div>
            <div class="h-1.5 w-2/3 bg-white/5 rounded-full mx-auto overflow-hidden">
              <div
                class="h-full bg-white/20 rounded-full"
                :style="{ width: isVisible ? '100%' : '0%', transition: 'width 1s ease-out 1.2s' }"
              />
            </div>
          </div>
        </div>

        <!-- Result -->
        <div v-if="step.type === 'result'" class="space-y-2 mt-2">
          <div class="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.08] p-3">
            <p class="text-lg font-black text-emerald-300 font-['Unbounded']">−400 ₽</p>
            <p class="text-[9px] uppercase tracking-wider font-bold text-emerald-400/60 mt-1">
              Кафе и рестораны
            </p>
          </div>
          <div
            class="rounded-xl border border-rose-500/15 bg-rose-500/[0.08] p-2 transition-all duration-700 mt-2 flex items-center justify-center gap-1.5"
            :class="isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'"
            :style="{ transitionDelay: '1200ms' }"
          >
            <span class="text-xs">🤝</span>
            <p class="text-[9px] font-bold uppercase tracking-wider text-rose-300">Разделено</p>
          </div>
        </div>
      </div>

      <!-- Connector arrow -->
      <div v-if="i < steps.length - 1" class="hidden items-center sm:flex relative z-0">
        <div
          class="h-[2px] w-8 bg-gradient-to-r from-white/20 to-transparent transition-all duration-700 relative"
          :class="isVisible ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'"
          :style="{ transitionDelay: `${300 + i * 200}ms` }"
        >
          <div
            class="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/30 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          />
        </div>
      </div>
    </template>
  </div>
</template>
