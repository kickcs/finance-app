import { onMounted, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { loadTelegramWebApp, type TelegramWebApp } from '@/shared/lib/telegram/loadTelegramWebApp';
import { useAuth, waitForAuth } from '@/shared/api/composables/useAuth';
import { HttpError } from '@/shared/api/http';
import { useTheme } from '@/features/toggle-theme';
import { importedTransactionsApi } from '@/entities/imported-transaction';
import { ROUTE_NAMES } from '@/shared/config/routeNames';

export type TmaEntryState = 'loading' | 'not-telegram' | 'confirm-link' | 'login' | 'error';

/** Состояние-машина входа через Telegram Mini App (страница /tma) */
export function useTmaEntry() {
  const router = useRouter();
  const { signIn, signOut, applySession, refreshUser, user } = useAuth();
  const { setTheme } = useTheme();

  const state = ref<TmaEntryState>('loading');
  const errorKey = ref<string | null>(null); // ключ i18n внутри features.tmaAuth
  const webApp = shallowRef<TelegramWebApp | null>(null);

  /** Дотягивает полный профиль (guard'у нужен hasCompletedOnboarding) и уходит в инбокс */
  async function finishAuthAndGoInbox() {
    try {
      await refreshUser();
    } catch {
      // Профиль подтянется позже — не блокируем переход в инбокс
    }
    void router.replace({ name: ROUTE_NAMES.IMPORT_INBOX });
  }

  async function linkAndGo() {
    if (!webApp.value) return;
    try {
      await importedTransactionsApi.tmaLink(webApp.value.initData);
      await finishAuthAndGoInbox();
    } catch (err) {
      const status = err instanceof HttpError ? err.status : undefined;
      errorKey.value = status === 409 ? 'errors.alreadyLinkedOther' : 'errors.generic';
      state.value = 'error';
    }
  }

  async function submitLogin(email: string, password: string) {
    // Ошибку логина ловит форма (показывает login.error), сюда долетает только успех
    await signIn(email, password);
    await linkAndGo();
  }

  async function start() {
    state.value = 'loading';
    errorKey.value = null;

    const wa = webApp.value ?? (await loadTelegramWebApp());
    webApp.value = wa;
    if (!wa || !wa.initData) {
      state.value = 'not-telegram';
      return;
    }
    wa.ready();
    wa.expand();
    setTheme(wa.colorScheme);

    try {
      const res = await importedTransactionsApi.tmaAuth(wa.initData);
      if (res.linked) {
        applySession(res.accessToken, res.user);
        await finishAuthAndGoInbox();
        return;
      }
      // Не привязан: если в webview уже есть сессия — предлагаем привязать её
      const existing = await waitForAuth();
      state.value = existing ? 'confirm-link' : 'login';
    } catch (err) {
      const status = err instanceof HttpError ? err.status : undefined;
      errorKey.value = status === 401 ? 'errors.staleInitData' : 'errors.generic';
      state.value = 'error';
    }
  }

  async function switchAccount() {
    try {
      await signOut();
    } catch {
      // Продолжаем к форме логина даже если запрос логаута не удался
    }
    state.value = 'login';
  }

  onMounted(() => void start());

  return { state, errorKey, user, start, linkAndGo, submitLogin, switchAccount, webApp };
}
