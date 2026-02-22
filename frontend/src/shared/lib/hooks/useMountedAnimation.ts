import { ref, onMounted } from 'vue';

export function useMountedAnimation() {
  const isMounted = ref(false);
  onMounted(() => {
    requestAnimationFrame(() => {
      isMounted.value = true;
    });
  });
  return { isMounted };
}
