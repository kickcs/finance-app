<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import DashboardStandardMobile from './DashboardStandardMobile.vue';
import DashboardStandardDesktop from './DashboardStandardDesktop.vue';

const isDesktop = useMediaQuery('(min-width: 768px)');
</script>

<template>
  <DashboardStandardDesktop v-if="isDesktop" />
  <DashboardStandardMobile v-else />
</template>
