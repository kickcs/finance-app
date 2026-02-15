<script setup lang="ts">
import { UIcon } from '@/shared/ui'

const debts = [
  {
    icon: 'arrow_outward',
    dotClass: 'bg-debt-given',
    iconClass: 'text-debt-given',
    label: 'Дал в долг',
    name: 'Иван',
    amount: '5 000 ₽',
  },
  {
    icon: 'call_received',
    dotClass: 'bg-debt-received',
    iconClass: 'text-debt-received',
    label: 'Взял в долг',
    name: 'Банк',
    amount: '15 000 ₽',
  },
] as const

const reminders = [
  { icon: 'bolt', iconBg: 'bg-warning/10', iconColor: 'text-warning', title: 'Электричество', date: '25 число', amount: '850 ₽' },
  { icon: 'wifi', iconBg: 'bg-primary/10', iconColor: 'text-primary', title: 'Интернет', date: '1 число', amount: '550 ₽' },
] as const

const features = [
  { icon: 'group', text: 'Учёт кто кому должен' },
  { icon: 'pie_chart', text: 'Частичные платежи' },
  { icon: 'notifications', text: 'Напоминания о платежах' },
] as const
</script>

<template>
  <div class="w-full h-full flex-shrink-0 flex flex-col items-center px-6 relative max-w-md mx-auto" style="contain: layout style paint">
    <!-- Title -->
    <div class="text-center mt-2 mb-4 z-10">
      <h1 class="text-3xl font-bold text-text-primary-dark tracking-tight leading-tight">Долги и подписки<br />под контролем</h1>
    </div>

    <div class="relative w-full flex-grow flex flex-col items-center justify-start gap-4">
      <!-- Two debt cards side by side -->
      <div class="grid grid-cols-2 gap-4 w-full z-10">
        <div
          v-for="debt in debts"
          :key="debt.label"
          class="bg-card-dark border border-white/5 rounded-xl p-4 flex flex-col justify-between h-28 relative overflow-hidden"
        >
          <div class="absolute top-0 right-0 p-3 opacity-10">
            <UIcon :name="debt.icon" :class="[debt.iconClass, 'text-4xl']" />
          </div>
          <div>
            <div class="flex items-center gap-2 mb-1">
              <div class="w-2 h-2 rounded-full" :class="debt.dotClass" />
              <span class="text-xs font-medium text-text-tertiary-dark uppercase tracking-wide">{{ debt.label }}</span>
            </div>
            <p class="text-sm font-semibold text-text-secondary-dark mt-2">{{ debt.name }}</p>
          </div>
          <div>
            <span class="text-xl font-bold text-text-primary-dark">{{ debt.amount }}</span>
          </div>
        </div>
      </div>

      <!-- Reminders card -->
      <div class="w-full bg-card-dark border border-white/5 rounded-xl p-4 z-10">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-text-secondary-dark">Напоминания</h3>
          <UIcon name="notifications" size="xs" class="text-text-tertiary-dark" />
        </div>
        <div class="space-y-3">
          <div
            v-for="item in reminders"
            :key="item.title"
            class="flex items-center justify-between bg-surface-dark/50 p-3 rounded-lg border border-white/5"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full flex items-center justify-center" :class="item.iconBg">
                <UIcon :name="item.icon" size="xs" :class="item.iconColor" />
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-medium text-text-primary-dark">{{ item.title }}</span>
                <span class="text-[10px] text-text-tertiary-dark">{{ item.date }}</span>
              </div>
            </div>
            <span class="text-xs font-semibold text-text-primary-dark bg-card-dark px-2 py-1 rounded border border-white/5">{{ item.amount }}</span>
          </div>
        </div>
      </div>

      <!-- Feature list -->
      <div class="w-full space-y-3 px-2 z-10">
        <div
          v-for="feat in features"
          :key="feat.text"
          class="flex items-center gap-3"
        >
          <div class="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <UIcon :name="feat.icon" size="xs" class="text-primary !text-sm" />
          </div>
          <span class="text-sm text-text-secondary-dark">{{ feat.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
