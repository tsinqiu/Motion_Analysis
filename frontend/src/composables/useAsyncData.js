import { onMounted, ref } from 'vue'

export function useAsyncData(loader, initialValue = null) {
  const data = ref(initialValue)
  const error = ref('')
  const loading = ref(false)

  async function load() {
    loading.value = true
    error.value = ''

    try {
      data.value = await loader()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '数据加载失败'
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  return {
    data,
    error,
    load,
    loading,
  }
}
