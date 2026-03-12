<script setup lang="ts"></script>

<template>
  <div class="flex flex-col items-center gap-3">
    <span class="text-[10px] font-medium uppercase tracking-[3px] text-white/30">
      Листайте вниз
    </span>
    <div class="relative h-8 w-px">
      <div
        class="scroll-line absolute inset-0 origin-top bg-gradient-to-b from-white/60 to-transparent"
      />
    </div>
  </div>
</template>

<style scoped>
.scroll-line {
  animation: scroll-line 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
</style>
