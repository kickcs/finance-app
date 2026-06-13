<script setup lang="ts">
import { ref } from 'vue';
import { UIcon, EmptyState, useToast } from '@/shared/ui';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useTelegramCards } from '@/entities/imported-transaction';
import { useAccounts, AccountSelector } from '@/entities/account';
import { useHaptics } from '@/shared/lib/haptics';

const { userId } = useCurrentUser();
const { cards, isLoading, setCardAccount, deleteCardMapping } = useTelegramCards(userId);
const { accounts } = useAccounts(userId);
const { toast } = useToast();
const { trigger } = useHaptics();

const expandedCard = ref<string | null>(null);

function accountName(accountId: string | null): string | null {
  if (!accountId) return null;
  return accounts.value.find((a) => a.id === accountId)?.name ?? null;
}

function accountColor(accountId: string | null): string | null {
  if (!accountId) return null;
  return accounts.value.find((a) => a.id === accountId)?.color ?? null;
}

function toggleExpand(cardMask: string) {
  trigger('selection');
  expandedCard.value = expandedCard.value === cardMask ? null : cardMask;
}

async function handleSelect(cardMask: string, accountId: string) {
  await setCardAccount(cardMask, accountId);
  expandedCard.value = null;
  trigger('success');
  toast({ title: 'Счёт привязан к карте', variant: 'default' });
}

async function handleUnlink(cardMask: string) {
  await deleteCardMapping(cardMask);
  if (expandedCard.value === cardMask) expandedCard.value = null;
  trigger('warning');
  toast({ title: 'Привязка удалена', variant: 'default' });
}
</script>

<template>
  <div class="space-y-2.5">
    <div class="flex items-center gap-2 px-0.5">
      <h3 class="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark">
        Мои карты
      </h3>
      <span
        v-if="cards.length"
        class="text-caption-sm font-medium text-text-tertiary-light dark:text-text-tertiary-dark tabular-nums"
      >
        {{ cards.length }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-2">
      <div
        v-for="i in 2"
        :key="i"
        class="h-14 rounded-xl bg-surface-light dark:bg-surface-dark animate-shimmer"
      />
    </div>

    <!-- Empty -->
    <EmptyState
      v-else-if="!cards.length"
      variant="inline"
      icon="credit_card"
      title="Карт пока нет"
      description="Карты появятся после первого импортированного сообщения от банка."
    />

    <!-- Cards -->
    <ul v-else class="space-y-2">
      <li
        v-for="card in cards"
        :key="card.card_mask"
        class="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden"
      >
        <!-- Row -->
        <div class="flex items-center gap-3 px-3.5 py-3">
          <button
            type="button"
            class="flex flex-1 min-w-0 items-center gap-3 text-left"
            :aria-expanded="expandedCard === card.card_mask"
            @click="toggleExpand(card.card_mask)"
          >
            <span
              class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-light text-primary"
            >
              <UIcon name="credit_card" size="sm" />
            </span>
            <span class="min-w-0 flex-1">
              <span
                class="block font-mono text-sm font-semibold tracking-wide text-text-primary-light dark:text-text-primary-dark"
              >
                {{ card.card_mask }}
              </span>
              <span class="mt-0.5 flex items-center gap-1.5">
                <span
                  v-if="accountColor(card.account_id)"
                  class="h-2 w-2 shrink-0 rounded-full"
                  :style="{ backgroundColor: accountColor(card.account_id) as string }"
                />
                <span
                  class="truncate text-xs"
                  :class="
                    card.account_id
                      ? 'text-text-secondary-light dark:text-text-secondary-dark'
                      : 'text-text-tertiary-light dark:text-text-tertiary-dark'
                  "
                >
                  {{ accountName(card.account_id) ?? 'Счёт не выбран' }}
                </span>
              </span>
            </span>
            <UIcon
              name="expand_more"
              size="sm"
              class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark transition-transform duration-200"
              :class="expandedCard === card.card_mask ? 'rotate-180' : ''"
            />
          </button>

          <button
            v-if="card.account_id"
            type="button"
            aria-label="Удалить привязку"
            class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-tertiary-light dark:text-text-tertiary-dark transition-colors hover:bg-danger/10 hover:text-danger active:bg-danger/10"
            @click="handleUnlink(card.card_mask)"
          >
            <UIcon name="delete" size="sm" />
          </button>
        </div>

        <!-- Expanded selector -->
        <div
          v-if="expandedCard === card.card_mask"
          class="border-t border-border-light dark:border-border-dark px-3.5 py-3"
        >
          <AccountSelector
            v-if="accounts.length"
            :accounts="accounts"
            :selected-id="card.account_id"
            label="Привязать к счёту"
            @select="(accountId) => handleSelect(card.card_mask, accountId)"
          />
          <p v-else class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            Сначала создай счёт, чтобы привязать карту.
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>
