/**
 * Reusable transition class presets for Vue TransitionGroup
 */
export const listTransition = {
  enterActiveClass: 'transition-all duration-150 ease-out',
  leaveActiveClass: 'transition-all duration-150 ease-in',
  enterFromClass: 'opacity-0 -translate-y-1.5',
  leaveToClass: 'opacity-0 translate-y-1.5',
  moveClass: 'transition-all duration-150 ease-out',
} as const;
