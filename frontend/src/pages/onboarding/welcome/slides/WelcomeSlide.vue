<script setup lang="ts">
import { UIcon } from '@/shared/ui'
</script>

<template>
  <div class="w-full h-full flex-shrink-0 flex flex-col items-center justify-between px-6 pt-2 pb-6 relative z-10" style="contain: layout style paint">
    <!-- Title -->
    <div class="text-center w-full z-20">
      <h1 class="text-[32px] font-bold text-primary tracking-tight leading-tight">Ouro</h1>
      <p class="text-text-tertiary-dark text-sm mt-1 font-medium tracking-wide">Ваш личный финансовый помощник</p>
    </div>

    <!-- Cards area -->
    <div class="relative w-full max-w-sm flex-grow flex items-center justify-center py-6">
      <!-- Background glow -->
      <div class="absolute w-[80%] aspect-square bg-primary/20 blur-[80px] rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      <div class="relative w-full flex flex-col items-center justify-center gap-6">
        <!-- Main balance card -->
        <div class="w-full bg-card-dark border border-white/10 rounded-2xl p-6 shadow-2xl shadow-black/50 z-20 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
          <div class="flex justify-between items-start mb-8 relative z-10">
            <div>
              <p class="text-text-tertiary-dark text-xs font-medium uppercase tracking-wider mb-1">Общий баланс</p>
              <h2 class="text-4xl font-bold text-text-primary-dark tracking-tight">$12,450.00</h2>
            </div>
            <div class="bg-primary/10 p-2.5 rounded-xl border border-primary/20">
              <UIcon name="account_balance_wallet" size="md" class="text-primary" />
            </div>
          </div>
          <!-- Mini dots decoration -->
          <div class="relative z-10">
            <div class="flex items-center gap-1.5 opacity-60">
              <div class="h-1.5 w-10 bg-primary rounded-full" />
              <div class="h-1.5 w-1.5 bg-surface-dark rounded-full" />
              <div class="h-1.5 w-1.5 bg-surface-dark rounded-full" />
            </div>
          </div>
        </div>

        <!-- Two sub-cards -->
        <div class="flex gap-4 w-full px-1">
          <div class="flex-1 bg-card-dark border border-white/5 rounded-2xl p-5 shadow-lg shadow-black/30 z-10 transform translate-y-2">
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <span class="text-[10px] text-text-tertiary-dark font-semibold uppercase tracking-wider">Наличные</span>
                <UIcon name="payments" size="sm" class="text-success" />
              </div>
              <p class="text-xl font-bold text-text-primary-dark tracking-tight">$850.00</p>
            </div>
          </div>
          <div class="flex-1 bg-card-dark border border-white/5 rounded-2xl p-5 shadow-lg shadow-black/30 z-10 transform -translate-y-2">
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <span class="text-[10px] text-text-tertiary-dark font-semibold uppercase tracking-wider">Карта</span>
                <UIcon name="credit_card" size="sm" class="text-primary" />
              </div>
              <p class="text-xl font-bold text-text-primary-dark tracking-tight">$11,600.00</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom description -->
    <div class="text-center w-full max-w-xs mb-4">
      <h3 class="text-lg text-text-secondary-dark font-medium leading-relaxed">
        Управляйте деньгами просто и удобно
      </h3>
    </div>
  </div>
</template>
