<script setup lang="ts">
import { computed } from 'vue';
import {
  SubscriptionCard,
  SubscriptionCardSkeleton,
  useUpcomingSubscriptions,
} from '@/entities/recurring-subscription';
import { SectionHeader } from '@/shared/ui';

const props = defineProps<{
  userId: string;
  currency?: string;
}>();

const emit = defineEmits<{
  'subscription-click': [id: string];
  'add-click': [];
  'view-all': [];
}>();

const { upcoming, isLoading } = useUpcomingSubscriptions(
  computed(() => props.userId),
  7,
);

const displayItems = computed(() => upcoming.value.slice(0, 3));
const hasSubscriptions = computed(() => upcoming.value.length > 0);
</script>

<template>
  <div>
    <SectionHeader
      title="Подписки"
      :count="upcoming.length"
      show-add
      show-view-all
      view-all-text="Все"
      @add-click="emit('add-click')"
      @view-all="emit('view-all')"
    />

    <div class="mt-3 space-y-2">
      <!-- Loading state -->
      <template v-if="isLoading">
        <SubscriptionCardSkeleton v-for="i in 3" :key="i" />
      </template>

      <!-- Subscription list -->
      <template v-else-if="hasSubscriptions">
        <SubscriptionCard
          v-for="sub in displayItems"
          :key="sub.id"
          :subscription="sub"
          compact
          @click="emit('subscription-click', sub.id)"
        />
      </template>

      <!-- Empty state -->
      <p
        v-else
        class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark py-3 text-center"
      >
        Нет активных подписок
      </p>
    </div>
  </div>
</template>
