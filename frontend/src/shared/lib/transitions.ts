/**
 * Reusable transition class presets for Vue TransitionGroup
 *
 * Свойства перечислены поимённо вместо `transition-all`: меняются только
 * opacity и transform, а `all` заставляет браузер отслеживать каждое
 * анимируемое свойство элемента — на длинных списках это лишняя работа
 * в каждом кадре.
 */
export const listTransition = {
  enterActiveClass: 'transition-[opacity,transform] duration-150 ease-out',
  leaveActiveClass: 'transition-[opacity,transform] duration-150 ease-in',
  enterFromClass: 'opacity-0 -translate-y-1.5',
  leaveToClass: 'opacity-0 translate-y-1.5',
  /** При перестановке элемента меняется только transform. */
  moveClass: 'transition-transform duration-150 ease-out',
} as const;
