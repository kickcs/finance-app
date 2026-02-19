import { ref, onMounted } from 'vue';

export function useMountAnimation() {
  const isMounted = ref(false);
  onMounted(() => {
    requestAnimationFrame(() => {
      isMounted.value = true;
    });
  });
  return { isMounted };
}
