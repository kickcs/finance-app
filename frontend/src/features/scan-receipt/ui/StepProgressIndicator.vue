<script setup lang="ts">
defineProps<{
  currentStep: number;
  totalSteps: number;
}>();
</script>

<template>
  <div
    class="flex-shrink-0 flex gap-1 px-5 pb-3"
    role="progressbar"
    :aria-valuenow="currentStep"
    aria-valuemin="1"
    aria-valuemax="4"
    :aria-label="`Шаг ${currentStep} из ${totalSteps}`"
  >
    <div
      v-for="i in totalSteps"
      :key="i"
      class="flex-1 h-1 rounded-full overflow-hidden transition-colors duration-300"
      :class="
        i < currentStep
          ? 'bg-primary'
          : i > currentStep
            ? 'bg-border-light dark:bg-border-dark'
            : 'bg-border-light dark:bg-border-dark'
      "
    >
      <div
        v-if="i === currentStep"
        class="h-full w-full bg-primary origin-left"
        style="animation: stepFill 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards"
      />
      <div v-else-if="i < currentStep" class="h-full w-full bg-primary" />
    </div>
  </div>
</template>

<style scoped>
@keyframes stepFill {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
</style>
