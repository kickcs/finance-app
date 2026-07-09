<script setup lang="ts">
defineProps<{
  currentStep: number;
  totalSteps: number;
}>();
</script>

<template>
  <!-- Прорезь принтера: пройденное «пропечатано» краской, будущее — перфорация -->
  <div class="flex-shrink-0 px-5 pb-3">
    <div
      class="flex items-center gap-1.5 h-2.5 px-1.5 rounded-full bg-surface-light dark:bg-surface-dark shadow-inner"
      role="progressbar"
      :aria-valuenow="currentStep"
      aria-valuemin="1"
      :aria-valuemax="totalSteps"
      :aria-label="`Шаг ${currentStep} из ${totalSteps}`"
    >
      <template v-for="i in totalSteps" :key="i">
        <div v-if="i < currentStep" class="flex-1 h-[3px] rounded-full bg-primary" />
        <div
          v-else-if="i === currentStep"
          class="flex-1 h-[3px] rounded-full bg-border-light dark:bg-border-dark overflow-hidden"
        >
          <div
            class="h-full w-full rounded-full bg-primary origin-left"
            style="animation: stepFill 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards"
          />
        </div>
        <div
          v-else
          class="flex-1 h-0 border-t-[3px] border-dotted border-border-light dark:border-border-dark"
        />
      </template>
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
