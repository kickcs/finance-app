<script setup lang="ts">
export interface FilterChip {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

const props = defineProps<{
  items: FilterChip[];
  selectedIds: string[];
  label?: string;
}>();

const emit = defineEmits<{
  toggle: [id: string];
  clear: [];
}>();

function isSelected(id: string): boolean {
  return props.selectedIds.includes(id);
}

function handleChipClick(id: string) {
  emit('toggle', id);
}
</script>

<template>
  <div class="space-y-1.5">
    <div v-if="label" class="flex items-center justify-between px-1">
      <span class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        {{ label }}
        <span v-if="selectedIds.length > 0" class="text-primary">({{ selectedIds.length }})</span>
      </span>
      <button
        v-if="selectedIds.length > 0"
        data-testid="filter-chips-clear"
        class="text-xs text-primary hover:text-primary/80 transition-colors"
        @click="emit('clear')"
      >
        Сбросить
      </button>
    </div>

    <!-- Horizontal scrollable chips -->
    <div class="-mx-5 px-5 overflow-x-auto scrollbar-hide">
      <div class="flex gap-1.5 pb-1">
        <button
          v-for="item in items"
          :key="item.id"
          :data-testid="`filter-chip-${item.id}`"
          :class="[
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
            'transition-all duration-200 flex-shrink-0',
            isSelected(item.id)
              ? 'bg-primary text-white shadow-sm'
              : [
                  'bg-surface-light dark:bg-surface-dark',
                  'text-text-primary-light dark:text-text-primary-dark',
                  'active:bg-border-light dark:active:bg-border-dark',
                ],
          ]"
          @click="handleChipClick(item.id)"
        >
          <span
            v-if="item.color"
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="{
              backgroundColor: isSelected(item.id) ? 'white' : item.color,
            }"
          />
          <span>{{ item.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
