import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue'
import { haptics } from '@/shared/lib/haptics'

export interface PullToRefreshConfig {
  /** Pull distance threshold to trigger refresh (default: 64px) */
  threshold?: number
  /** Maximum pull distance (default: 128px) */
  maxPull?: number
  /** Callback when refresh is triggered */
  onRefresh: () => Promise<void>
  /** Optional scroll container ref (defaults to window scrolling) */
  containerRef?: Ref<HTMLElement | null | undefined>
}

export function usePullToRefresh(config: PullToRefreshConfig) {
  const {
    threshold = 64,
    maxPull = 128,
    onRefresh,
    containerRef,
  } = config

  const pullDistance = ref(0)
  const isRefreshing = ref(false)
  const isPulling = ref(false)
  const isThresholdReached = ref(false)

  let startX = 0
  let startY = 0
  let isVerticalPull: boolean | null = null
  let hasTriggeredHaptic = false
  let rafId: number | null = null
  let animationId: number | null = null

  function getScrollTop(): number {
    if (containerRef?.value) {
      return containerRef.value.scrollTop
    }
    return window.scrollY
  }

  function onTouchStart(e: TouchEvent) {
    if (isRefreshing.value) return
    if (getScrollTop() > 0) return

    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    isVerticalPull = null
    hasTriggeredHaptic = false
  }

  function onTouchMove(e: TouchEvent) {
    if (!e.touches[0]) return
    if (isRefreshing.value) return
    if (getScrollTop() > 0) {
      if (isPulling.value) resetPull()
      return
    }

    const currentY = e.touches[0].clientY
    const currentX = e.touches[0].clientX
    const diffY = currentY - startY
    const diffX = currentX - startX

    // Only activate on downward pull
    if (diffY <= 0) {
      if (isPulling.value) resetPull()
      return
    }

    // Determine direction in first 10px of movement
    if (isVerticalPull === null && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
      isVerticalPull = Math.abs(diffY) > Math.abs(diffX)
    }

    if (isVerticalPull !== true) return

    e.preventDefault()
    isPulling.value = true

    // Exponential resistance for natural iOS-like spring feel
    const distance = maxPull * (1 - Math.exp((-0.5 * diffY) / maxPull))

    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      pullDistance.value = Math.max(0, Math.min(distance, maxPull))

      const reached = pullDistance.value >= threshold
      if (reached && !hasTriggeredHaptic) {
        haptics.pullThreshold()
        hasTriggeredHaptic = true
        isThresholdReached.value = true
      } else if (!reached && hasTriggeredHaptic) {
        hasTriggeredHaptic = false
        isThresholdReached.value = false
      }
    })
  }

  async function onTouchEnd() {
    if (isRefreshing.value) return
    if (!isPulling.value) return

    isPulling.value = false

    if (pullDistance.value >= threshold) {
      isRefreshing.value = true
      pullDistance.value = threshold // Snap to threshold during refresh

      try {
        await onRefresh()
        if (!isPulling.value) {
          haptics.success()
        }
      } catch {
        // Silently handle — old data remains visible
      } finally {
        isRefreshing.value = false
        if (!isPulling.value) {
          isThresholdReached.value = false
          animateToZero()
        }
      }
    } else {
      isThresholdReached.value = false
      animateToZero()
    }
  }

  function animateToZero() {
    if (animationId !== null) cancelAnimationFrame(animationId)

    const startValue = pullDistance.value
    const startTime = performance.now()
    const duration = 300

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      pullDistance.value = startValue * (1 - eased)

      if (progress < 1) {
        animationId = requestAnimationFrame(animate)
      } else {
        pullDistance.value = 0
        animationId = null
      }
    }

    animationId = requestAnimationFrame(animate)
  }

  function resetPull() {
    isPulling.value = false
    isThresholdReached.value = false
    isVerticalPull = null
    hasTriggeredHaptic = false
    pullDistance.value = 0
    startX = 0
    startY = 0
  }

  function addListeners(target: HTMLElement | Window) {
    target.addEventListener('touchstart', onTouchStart as EventListener, { passive: true })
    target.addEventListener('touchmove', onTouchMove as EventListener, { passive: false })
    target.addEventListener('touchend', onTouchEnd as EventListener, { passive: true })
  }

  function removeListeners(target: HTMLElement | Window) {
    target.removeEventListener('touchstart', onTouchStart as EventListener)
    target.removeEventListener('touchmove', onTouchMove as EventListener)
    target.removeEventListener('touchend', onTouchEnd as EventListener)
  }

  let currentTarget: HTMLElement | Window | null = null

  function setupListeners() {
    const newTarget = containerRef?.value ?? window
    if (newTarget === currentTarget) return

    if (currentTarget) {
      removeListeners(currentTarget)
    }
    currentTarget = newTarget
    addListeners(currentTarget)
  }

  onMounted(() => {
    setupListeners()
  })

  // Watch for containerRef changes (container may mount later)
  if (containerRef) {
    watch(containerRef, () => {
      setupListeners()
    })
  }

  onUnmounted(() => {
    if (currentTarget) {
      removeListeners(currentTarget)
      currentTarget = null
    }
    if (rafId !== null) cancelAnimationFrame(rafId)
    if (animationId !== null) cancelAnimationFrame(animationId)
  })

  return {
    pullDistance,
    isRefreshing,
    isPulling,
    isThresholdReached,
    resetPull,
  }
}
