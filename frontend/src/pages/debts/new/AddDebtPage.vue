<script setup lang="ts">
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
useRouter().replace({ name: ROUTE_NAMES.DEBTS_LIST });
</script>
<template><div /></template>
