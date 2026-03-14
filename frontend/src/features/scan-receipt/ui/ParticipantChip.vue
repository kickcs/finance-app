<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { getInitial } from '@/shared/lib/format/text';
import { ALL_PARTICIPANTS_ID } from '../model/constants';
import type { Participant } from '../model/types';

defineProps<{
  participant: Participant;
  isActive: boolean;
  paidByName?: string;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    type="button"
    :aria-label="`${participant.name}${isActive ? ', фильтр активен' : ''}`"
    :aria-pressed="isActive"
    class="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full border transition-all duration-150 active:scale-95"
    :class="
      cn(
        isActive
          ? 'border-transparent text-white shadow-sm'
          : 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark',
      )
    "
    :style="isActive ? { backgroundColor: participant.color } : {}"
    @click="emit('click')"
  >
    <!-- Avatar circle with first letter -->
    <div
      class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
      :style="{ backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : participant.color + '33' }"
      aria-hidden="true"
    >
      <UIcon
        v-if="participant.id === ALL_PARTICIPANTS_ID"
        name="group"
        size="xs"
        :style="{ color: isActive ? '#fff' : participant.color }"
      />
      <span
        v-else
        class="text-[10px] font-bold leading-none"
        :style="{ color: isActive ? '#fff' : participant.color }"
      >
        {{ getInitial(participant.name) }}
      </span>
    </div>
    <span class="text-sm font-medium whitespace-nowrap">
      {{ participant.name }}
    </span>
    <span
      v-if="paidByName"
      class="text-[10px] opacity-70 whitespace-nowrap"
      :class="isActive ? 'text-white/70' : 'text-text-tertiary-light dark:text-text-tertiary-dark'"
    >
      → {{ paidByName }}
    </span>
  </button>
</template>
