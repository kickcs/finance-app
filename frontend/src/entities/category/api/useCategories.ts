import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { categoryQueryKeys } from './queryKeys'
import { categoriesApi } from './categoriesApi'
import type { UserCategory, UserCategoryInsert } from '@/shared/api/database.types'
import { TRANSFER_CATEGORY, DEBT_CATEGORIES } from '../model/constants'
import type { Category } from '../model/types'

export function useCategories(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient()

  const queryKey = computed(() => {
    const uid = toValue(userId)
    return uid ? categoryQueryKeys.list(uid) : categoryQueryKeys.all
  })

  // Query for user categories from DB - initializes defaults if empty
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKey,
    queryFn: async () => {
      const uid = toValue(userId)
      if (!uid) return []
      // This will create default categories if user has none
      return categoriesApi.initializeDefaults(uid)
    },
    enabled: computed(() => !!toValue(userId)),
  })

  const categories = computed<UserCategory[]>(() => data.value ?? [])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (category: Omit<UserCategoryInsert, 'user_id'>) => {
      const uid = toValue(userId)
      if (!uid) throw new Error('User not authenticated')
      return categoriesApi.create({ ...category, user_id: uid })
    },
    onMutate: async (newCategory) => {
      const uid = toValue(userId)
      if (!uid) return

      await queryClient.cancelQueries({ queryKey: queryKey.value })
      const previousCategories = queryClient.getQueryData<UserCategory[]>(queryKey.value)

      const existingCategories = previousCategories ?? []
      const maxSortOrder = existingCategories.reduce((max, c) => Math.max(max, c.sort_order), -1)

      const optimisticCategory: UserCategory = {
        id: `temp-${Date.now()}`,
        user_id: uid,
        created_at: new Date().toISOString(),
        name: newCategory.name,
        icon: newCategory.icon,
        color: newCategory.color,
        type: newCategory.type,
        sort_order: maxSortOrder + 1,
      }

      queryClient.setQueryData<UserCategory[]>(queryKey.value, (old) => [...(old ?? []), optimisticCategory])

      return { previousCategories }
    },
    onError: (_err, _newCategory, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(queryKey.value, context.previousCategories)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<UserCategory, 'id' | 'user_id' | 'created_at'>> }) =>
      categoriesApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value })
      const previousCategories = queryClient.getQueryData<UserCategory[]>(queryKey.value)

      queryClient.setQueryData<UserCategory[]>(queryKey.value, (old) =>
        old?.map((c) => (c.id === id ? { ...c, ...updates } : c)) ?? []
      )

      return { previousCategories }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(queryKey.value, context.previousCategories)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value })
      const previousCategories = queryClient.getQueryData<UserCategory[]>(queryKey.value)

      queryClient.setQueryData<UserCategory[]>(queryKey.value, (old) => old?.filter((c) => c.id !== id) ?? [])

      return { previousCategories }
    },
    onError: (_err, _id, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(queryKey.value, context.previousCategories)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value })
    },
  })

  // Convert UserCategory to Category format for compatibility
  function userCategoryToCategory(uc: UserCategory): Category {
    return {
      id: uc.id,
      name: uc.name,
      icon: uc.icon,
      color: uc.color,
      type: uc.type,
    }
  }

  // Categories by type (from DB only)
  const expenseCategories = computed<Category[]>(() =>
    categories.value
      .filter((c) => c.type === 'expense')
      .map(userCategoryToCategory)
  )

  const incomeCategories = computed<Category[]>(() =>
    categories.value
      .filter((c) => c.type === 'income')
      .map(userCategoryToCategory)
  )

  // All categories (DB + system transfer/debt categories)
  const allCategories = computed<Category[]>(() => [
    ...categories.value.map(userCategoryToCategory),
    ...DEBT_CATEGORIES,
    TRANSFER_CATEGORY,
  ])

  // Get category by ID
  function getCategoryById(id: string): Category | undefined {
    // Check user categories first
    const userCat = categories.value.find((c) => c.id === id)
    if (userCat) return userCategoryToCategory(userCat)

    // Check debt categories
    const debtCat = DEBT_CATEGORIES.find((c) => c.id === id)
    if (debtCat) return debtCat

    // Check transfer category
    if (id === TRANSFER_CATEGORY.id) return TRANSFER_CATEGORY

    return undefined
  }

  // Get categories by type
  function getCategoriesByType(type: 'expense' | 'income' | 'transfer'): Category[] {
    if (type === 'transfer') return [TRANSFER_CATEGORY]
    return type === 'expense' ? expenseCategories.value : incomeCategories.value
  }

  async function createCategory(category: Omit<UserCategoryInsert, 'user_id'>) {
    return createMutation.mutateAsync(category)
  }

  async function updateCategory(id: string, updates: Partial<Omit<UserCategory, 'id' | 'user_id' | 'created_at'>>) {
    return updateMutation.mutateAsync({ id, updates })
  }

  async function deleteCategory(id: string) {
    return deleteMutation.mutateAsync(id)
  }

  // Reorder mutation
  const reorderMutation = useMutation({
    mutationFn: (categoryIds: string[]) => categoriesApi.reorder(categoryIds),
    onMutate: async (categoryIds) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value })
      const previousCategories = queryClient.getQueryData<UserCategory[]>(queryKey.value)

      // Optimistically update the order
      queryClient.setQueryData<UserCategory[]>(queryKey.value, (old) => {
        if (!old) return old
        const ordered: UserCategory[] = []
        for (const id of categoryIds) {
          const cat = old.find(c => c.id === id)
          if (cat) ordered.push(cat)
        }
        // Add any categories not in the list (shouldn't happen, but just in case)
        const remaining = old.filter(c => !categoryIds.includes(c.id))
        return [...ordered, ...remaining]
      })

      return { previousCategories }
    },
    onError: (_err, _categoryIds, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(queryKey.value, context.previousCategories)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value })
    },
  })

  async function reorderCategories(categoryIds: string[]) {
    return reorderMutation.mutateAsync(categoryIds)
  }

  return {
    // All user categories from DB
    categories,
    // By type
    expenseCategories,
    incomeCategories,
    allCategories,
    // Helpers
    getCategoryById,
    getCategoriesByType,
    // Mutations
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    // State
    isLoading,
    error,
    refetch,
  }
}
