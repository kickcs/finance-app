<script setup lang="ts">
import { UIcon } from '@/shared/ui';

const categories = [
  { label: 'Продукты', amount: '32,500 ₽', color: '#4F46E5' },
  { label: 'Разное', amount: '21,400 ₽', color: '#8B5CF6' },
  { label: 'Развлечения', amount: '16,800 ₽', color: '#EC4899' },
  { label: 'Транспорт', amount: '13,500 ₽', color: '#06B6D4' },
] as const;

const chartSegments = [
  { stroke: '#4F46E5', dasharray: '210 500', offset: '0' },
  { stroke: '#8B5CF6', dasharray: '140 500', offset: '-220' },
  { stroke: '#EC4899', dasharray: '90 500', offset: '-370' },
  { stroke: '#06B6D4', dasharray: '50 500', offset: '-470' },
] as const;
</script>

<template>
  <div class="w-full h-full flex-shrink-0 flex flex-col items-center px-6 relative">
    <!-- Title -->
    <div class="text-center mt-2 mb-4 w-full relative z-10">
      <h1 class="text-3xl font-bold text-text-primary-dark tracking-tight leading-tight">
        Анализируйте свои
        <br />
        расходы
      </h1>
    </div>

    <!-- Analytics card -->
    <div
      class="w-full bg-card-dark border border-white/5 rounded-2xl p-5 relative overflow-hidden mb-4 z-10"
    >
      <!-- Tab bar -->
      <div class="flex bg-black/20 p-1 rounded-lg mb-5 relative z-10">
        <div
          class="flex-1 py-1.5 text-xs font-medium text-text-tertiary-dark text-center rounded-md"
        >
          Неделя
        </div>
        <div
          class="flex-1 py-1.5 text-xs font-medium text-text-primary-dark bg-white/10 text-center rounded-md shadow-sm"
        >
          Месяц
        </div>
        <div
          class="flex-1 py-1.5 text-xs font-medium text-text-tertiary-dark text-center rounded-md"
        >
          Год
        </div>
      </div>

      <!-- Chart + legend -->
      <div class="flex flex-col items-center justify-center gap-6">
        <!-- Donut chart -->
        <div class="relative w-36 h-36 flex-shrink-0">
          <svg class="transform -rotate-90 w-full h-full" viewBox="0 0 200 200">
            <circle
              v-for="(seg, idx) in chartSegments"
              :key="idx"
              cx="100"
              cy="100"
              r="80"
              fill="transparent"
              :stroke="seg.stroke"
              stroke-width="20"
              :stroke-dasharray="seg.dasharray"
              :stroke-dashoffset="seg.offset"
              stroke-linecap="round"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span
              class="text-caption-sm text-text-tertiary-dark font-medium uppercase tracking-wider"
            >
              Итого
            </span>
            <span class="text-xl font-bold text-text-primary-dark">₽84,200</span>
          </div>
        </div>

        <!-- Legend -->
        <div class="w-full grid grid-cols-1 gap-3">
          <div v-for="cat in categories" :key="cat.label" class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: cat.color }" />
              <span class="text-sm text-text-secondary-dark font-medium">{{ cat.label }}</span>
            </div>
            <span class="text-sm font-semibold text-text-primary-dark">{{ cat.amount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom feature tags -->
    <div class="w-full flex justify-center gap-8 mb-4 z-10">
      <div class="flex items-center gap-2 text-text-tertiary-dark">
        <UIcon name="pie_chart" size="sm" class="text-primary" />
        <span class="text-xs font-medium">Детальная аналитика</span>
      </div>
      <div class="flex items-center gap-2 text-text-tertiary-dark">
        <UIcon name="trending_up" size="sm" class="text-primary" />
        <span class="text-xs font-medium">Сравнение доходов</span>
      </div>
    </div>
  </div>
</template>
