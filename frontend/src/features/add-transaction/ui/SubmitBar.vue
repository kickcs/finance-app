<script setup lang="ts">
/**
 * Липкий подвал формы: кнопка отправки не должна уезжать за экран, когда форма
 * выше вьюпорта или когда под раскрытым полем поднимается клавиатура.
 *
 * Живёт отдельным компонентом, потому что нужен и общей форме (расход, доход,
 * перевод), и панели долга, которая владеет собственным сабмитом.
 *
 * Требует от родителя горизонтальный паддинг `px-4` — подвал компенсирует его
 * через `-mx-4 px-4`, чтобы подложка шла от края до края.
 */
</script>

<template>
  <div
    class="submit-bar sticky bottom-0 -mx-4 mt-auto px-4 pt-3 [--bar-bg:var(--color-background-light)] dark:[--bar-bg:var(--color-background-dark)]"
  >
    <slot name="hint" />
    <slot />
  </div>
</template>

<style scoped>
/*
 * Подложка кнопки повторяет фон страницы. Цвет приходит переменной `--bar-bg`:
 * её ставит Tailwind-вариант `dark:` прямо на элементе — через
 * `:global(html.dark)` не выйдет, тема навешивается классом на `html`, а не на
 * конкретный узел. Верх полупрозрачный, чтобы содержимое уезжало под панель,
 * а не обрывалось.
 */
.submit-bar {
  background: linear-gradient(to bottom, transparent 0, var(--bar-bg) 0.75rem, var(--bar-bg));
  padding-bottom: max(var(--safe-area-inset-bottom), 0.75rem);
}
</style>
