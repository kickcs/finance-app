import { describe, it, expect, vi, afterEach } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { mockProfileResponse } from '@/test/mocks/handlers/profiles';
import { useShareCardNumber } from './useShareCardNumber';

const USER_ID = 'test-user-1';
const CARD = '8600123456789012';

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable(savedCard: string | null = CARD) {
  server.use(
    http.post('*/api/profiles/get-or-create', () =>
      HttpResponse.json({ ...mockProfileResponse, paymentCardNumber: savedCard }),
    ),
    http.get('*/api/profiles/me', () =>
      HttpResponse.json({ ...mockProfileResponse, paymentCardNumber: savedCard }),
    ),
  );

  let result!: ReturnType<typeof useShareCardNumber>;
  const Stub = defineComponent({
    setup() {
      result = useShareCardNumber(ref(USER_ID));
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub);
  return result;
}

afterEach(async () => {
  server.resetHandlers();
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

describe('useShareCardNumber', () => {
  it('берёт карту из профиля и прикладывает её к снимку', async () => {
    const c = mountComposable();
    await flushPromises();

    expect(c.savedCard.value).toBe(CARD);
    expect(c.attachedCard.value).toBe(CARD);
  });

  it('снятый переключатель оставляет снимок без карты', async () => {
    const c = mountComposable();
    await flushPromises();

    c.isAttached.value = false;

    expect(c.savedCard.value).toBe(CARD);
    expect(c.attachedCard.value).toBeNull();
  });

  it('без сохранённой карты в снимок ничего не уходит', async () => {
    const c = mountComposable(null);
    await flushPromises();

    expect(c.attachedCard.value).toBeNull();
  });

  it('правка начинается с уже сохранённого номера', async () => {
    const c = mountComposable();
    await flushPromises();

    c.startEdit();

    expect(c.isEditing.value).toBe(true);
    expect(c.draft.value).toBe(CARD);
  });

  it('короткий номер сохранить нельзя', async () => {
    const patchSpy = vi.fn();
    server.use(
      http.patch('*/api/profiles/me', () => {
        patchSpy();
        return HttpResponse.json(mockProfileResponse);
      }),
    );

    const c = mountComposable(null);
    await flushPromises();

    c.startEdit();
    c.draft.value = '86001234';

    expect(c.isDraftValid.value).toBe(false);
    await c.saveCard();
    await flushPromises();

    expect(patchSpy).not.toHaveBeenCalled();
    expect(c.isEditing.value).toBe(true);
  });

  it('сохранение уносит в профиль голые цифры', async () => {
    let patchBody: Record<string, unknown> | null = null;
    server.use(
      http.patch('*/api/profiles/me', async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...mockProfileResponse, ...patchBody });
      }),
    );

    const c = mountComposable(null);
    await flushPromises();

    c.startEdit();
    c.draft.value = '8600 1234 5678 9012';
    await c.saveCard();
    await flushPromises();

    expect((patchBody as Record<string, unknown> | null)?.paymentCardNumber).toBe(CARD);
    expect(c.isEditing.value).toBe(false);
  });

  it('после ошибки сохранения правка остаётся открытой', async () => {
    server.use(
      http.patch('*/api/profiles/me', () =>
        HttpResponse.json({ message: 'Server Error' }, { status: 500 }),
      ),
    );

    const c = mountComposable(null);
    await flushPromises();

    c.startEdit();
    c.draft.value = CARD;
    await c.saveCard();
    await flushPromises();

    expect(c.saveError.value).toBe('Не удалось сохранить карту');
    expect(c.isEditing.value).toBe(true);
    expect(c.isSaving.value).toBe(false);
  });

  it('открытие шторки возвращает карту в снимок и закрывает правку', async () => {
    const c = mountComposable();
    await flushPromises();

    c.isAttached.value = false;
    c.startEdit();

    c.reset();

    expect(c.isAttached.value).toBe(true);
    expect(c.isEditing.value).toBe(false);
    expect(c.attachedCard.value).toBe(CARD);
  });
});
