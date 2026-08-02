import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DesktopPage from './DesktopPage.vue';
import DesktopColumns from './DesktopColumns.vue';

describe('DesktopPage', () => {
  it('показывает заголовок и содержимое', () => {
    const wrapper = mount(DesktopPage, {
      props: { title: 'Главная' },
      slots: { default: '<p>содержимое</p>' },
    });

    expect(wrapper.text()).toContain('Главная');
    expect(wrapper.text()).toContain('содержимое');
  });

  it('не резервирует место под нижнюю навигацию', () => {
    const wrapper = mount(DesktopPage, { props: { title: 'Главная' } });
    expect(wrapper.html()).not.toContain('pb-28');
  });

  it('ограничивает ширину контента 1440 пикселями по умолчанию', () => {
    const wrapper = mount(DesktopPage, { props: { title: 'Главная' } });
    expect(wrapper.html()).toContain('max-w-[1440px]');
  });

  it('отдаёт scrollRef наружу', () => {
    const wrapper = mount(DesktopPage, { props: { title: 'Главная' } });
    expect((wrapper.vm as unknown as { scrollRef: unknown }).scrollRef).toBeTruthy();
  });
});

describe('DesktopColumns', () => {
  it('раскладывает слоты в сетку 8 и 4 по умолчанию', () => {
    const wrapper = mount(DesktopColumns, {
      slots: { main: '<p>основное</p>', aside: '<p>боковое</p>' },
    });

    const html = wrapper.html();
    expect(html).toContain('col-span-8');
    expect(html).toContain('col-span-4');
    expect(wrapper.text()).toContain('основное');
    expect(wrapper.text()).toContain('боковое');
  });

  it('делает боковую колонку липкой', () => {
    const wrapper = mount(DesktopColumns, { slots: { aside: '<p>боковое</p>' } });
    expect(wrapper.html()).toContain('sticky');
  });
});
