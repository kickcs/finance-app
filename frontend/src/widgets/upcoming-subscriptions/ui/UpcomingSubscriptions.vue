<script setup lang="ts">
import { computed } from 'vue';
import {
  SubscriptionCard,
  SubscriptionCardSkeleton,
  useUpcomingSubscriptions,
} from '@/entities/recurring-subscription';
import { EmptyState, SectionHeader } from '@/shared/ui';
import { UPCOMING_SUBSCRIPTION_DAYS } from '@/shared/config/dashboard';

const props = defineProps<{
  userId: string;
  hidden?: boolean;
}>();

const emit = defineEmits<{
  'subscription-click': [id: string];
  'add-click': [];
  'view-all': [];
}>();

const PREVIEW_LIMIT = 3;

const { upcoming, isLoading } = useUpcomingSubscriptions(
  () => props.userId,
  UPCOMING_SUBSCRIPTION_DAYS,
);

const preview = computed(() => upcoming.value.slice(0, PREVIEW_LIMIT));
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
      <template v-if="isLoading">
        <SubscriptionCardSkeleton v-for="i in PREVIEW_LIMIT" :key="i" />
      </template>

      <template v-else-if="preview.length">
        <SubscriptionCard
          v-for="sub in preview"
          :key="sub.id"
          :subscription="sub"
          compact
          :hidden="hidden"
          @click="emit('subscription-click', sub.id)"
        />
      </template>

      <EmptyState
        v-else
        variant="inline"
        icon="subscriptions"
        title="Нет активных подписок"
        description="Отслеживайте регулярные списания"
        :action="{ label: 'Добавить подписку', onClick: () => emit('add-click') }"
      />
    </div>
  </div>
</template>
