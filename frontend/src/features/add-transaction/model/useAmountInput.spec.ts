import { describe, it, expect, vi } from 'vitest';
import { defineComponent, h, nextTick, ref, type Ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useAmountInput } from './useAmountInput';

function mountHarness(autofocus: Ref<boolean>) {
  const Harness = defineComponent({
    setup() {
      const { inputRef } = useAmountInput({
        amount: () => 0,
        autofocus: () => autofocus.value,
        onChange: vi.fn(),
      });
      return { inputRef };
    },
    render() {
      return h('input', { ref: 'inputRef' });
    },
  });

  return mount(Harness, { attachTo: document.body });
}

/** Фокус ставится через `nextTick` внутри watcher — нужно два прогона очереди. */
async function settle() {
  await nextTick();
  await nextTick();
}

describe('useAmountInput', () => {
  it('не фокусит поле, пока autofocus выключен', async () => {
    const wrapper = mountHarness(ref(false));
    await settle();
    expect(document.activeElement).not.toBe(wrapper.element);
  });

  it('фокусит поле, когда autofocus включается', async () => {
    const autofocus = ref(false);
    const wrapper = mountHarness(autofocus);

    autofocus.value = true;
    await settle();

    expect(document.activeElement).toBe(wrapper.element);
  });

  it('фокусит один раз: повторное включение не выдёргивает фокус', async () => {
    const autofocus = ref(false);
    const wrapper = mountHarness(autofocus);

    autofocus.value = true;
    await settle();
    (wrapper.element as HTMLInputElement).blur();

    autofocus.value = false;
    await nextTick();
    autofocus.value = true;
    await settle();

    expect(document.activeElement).not.toBe(wrapper.element);
  });

  it('фокусит сразу, если autofocus включён с самого начала', async () => {
    const wrapper = mountHarness(ref(true));
    await settle();
    expect(document.activeElement).toBe(wrapper.element);
  });
});
