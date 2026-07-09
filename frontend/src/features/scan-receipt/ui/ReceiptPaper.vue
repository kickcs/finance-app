<script setup lang="ts">
/**
 * «Лист термочека» — общая бумага шагов визарда.
 * Всё, что печатается на бумаге, набирается font-mono (термопринтер
 * умеет один шрифт); app-хром вокруг остаётся Inter.
 */
defineProps<{
  /** Печатная шапка листа (микро-капс по центру) */
  title?: string;
}>();
</script>

<template>
  <div class="relative bg-card-light dark:bg-card-dark drop-shadow-sm">
    <slot name="header">
      <div
        v-if="title"
        class="px-4 pt-4 pb-3 text-center border-b border-dashed border-border-light dark:border-border-dark"
      >
        <h2
          class="font-mono text-caption-sm font-bold uppercase tracking-widest text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          {{ title }}
        </h2>
      </div>
    </slot>

    <slot />

    <!-- Оторванный нижний край -->
    <div
      class="receipt-edge absolute inset-x-0 -bottom-2 h-3 bg-card-light dark:bg-card-dark z-10"
    />
  </div>
</template>

<style>
@import './transitions.css';
</style>
