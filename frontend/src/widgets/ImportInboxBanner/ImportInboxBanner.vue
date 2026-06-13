<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { UIcon } from '@/shared/ui';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useImportedTransactions } from '@/entities/imported-transaction';

const router = useRouter();
const { userId } = useCurrentUser();
const { pendingCount } = useImportedTransactions(userId);

const label = computed(() => {
  const n = pendingCount.value;
  const word = pluralize(n, 'операция', 'операции', 'операций');
  return `${n} ${word} на подтверждение`;
});

function openInbox() {
  router.push({ name: ROUTE_NAMES.IMPORT_INBOX });
}
</script>

<template>
  <button
    v-if="pendingCount > 0"
    type="button"
    class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary-light text-left transition-transform active:scale-[0.99]"
    @click="openInbox"
  >
    <div class="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
      <UIcon name="inbox" size="sm" class="text-primary" />
    </div>

    <div class="flex-1 min-w-0">
      <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
        {{ label }}
      </p>
      <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
        Из Telegram — проверьте и подтвердите
      </p>
    </div>

    <span
      class="shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-white text-xs font-semibold flex items-center justify-center"
    >
      {{ pendingCount > 99 ? '99+' : pendingCount }}
    </span>

    <UIcon name="chevron_right" size="sm" class="shrink-0 text-primary" />
  </button>
</template>
