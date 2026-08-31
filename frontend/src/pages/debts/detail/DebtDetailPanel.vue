<script setup lang="ts">
import { UButton, UIcon } from '@/shared/ui';
import { useDebtDetailContext } from '../model/useDebtDetail';
import DebtDetailBody from './DebtDetailBody.vue';

/**
 * Правая колонка списка долгов. Своих запросов у неё нет: долг приходит из уже
 * загруженного списка, остальное — из `useDebtDetail` хозяина.
 */
const { debt, title, openEdit, openActions } = useDebtDetailContext();
</script>

<template>
  <div class="py-6">
    <!-- У панели нет `AppHeader`, куда страница унесла имя и действия, — своя
         строка-шапка несёт имя и «Редактировать», остальное открывает шторка. -->
    <div v-if="debt" class="mb-4 flex items-center justify-between gap-3">
      <h2
        class="min-w-0 truncate text-h3 font-bold text-text-primary-light dark:text-text-primary-dark"
      >
        {{ title }}
      </h2>

      <div class="flex shrink-0 items-center gap-1">
        <UButton
          v-if="!debt.is_closed"
          variant="ghost"
          size="sm"
          class="!p-2"
          aria-label="Редактировать"
          @click="openEdit"
        >
          <UIcon name="edit" size="sm" />
        </UButton>
        <UButton
          variant="ghost"
          size="sm"
          class="!p-2"
          aria-label="Ещё"
          data-testid="debt-panel-more-btn"
          @click="openActions"
        >
          <UIcon name="more_horiz" size="sm" />
        </UButton>
      </div>
    </div>

    <DebtDetailBody />
  </div>
</template>
