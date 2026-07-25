import { useCallback, useEffect, useMemo, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"

import type {
  FinanceRepository,
  FinanceSnapshot,
} from "@/data/finance-repository.types"
import {
  ensureFinanceSeed,
  listBudgets,
  listCategories,
  listTransactions,
  localFinanceRepository,
} from "@/data/finance-repository"
import { createSupabaseFinanceRepository } from "@/data/supabase-finance-repository"
import type { NewTransaction, TransactionType } from "@/domain/finance"
import { useAuth } from "@/features/auth/auth-provider"
import { getSupabaseClient } from "@/utils/supabase"

const emptySnapshot: FinanceSnapshot = {
  transactions: [],
  categories: [],
  budgets: [],
}

function messageFrom(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The finance data request failed."
}

export function selectFinanceRepository(
  status: "loading" | "guest" | "authenticated",
  localRepository: FinanceRepository,
  cloudRepository?: FinanceRepository
) {
  if (status === "loading") return undefined
  return status === "authenticated" ? cloudRepository : localRepository
}

export function useFinance() {
  const auth = useAuth()
  const userId = auth.user?.id
  const [cloudSnapshot, setCloudSnapshot] =
    useState<FinanceSnapshot>(emptySnapshot)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void ensureFinanceSeed()
  }, [])

  const localTransactions = useLiveQuery(listTransactions, [], [])
  const localCategories = useLiveQuery(listCategories, [], [])
  const localBudgets = useLiveQuery(listBudgets, [], [])

  const cloudRepository = useMemo(() => {
    if (auth.status !== "authenticated" || !userId) return undefined
    const client = getSupabaseClient()
    return client ? createSupabaseFinanceRepository(client, userId) : undefined
  }, [auth.status, userId])

  const repository = selectFinanceRepository(
    auth.status,
    localFinanceRepository,
    cloudRepository
  )

  const reloadCloud = useCallback(async () => {
    if (!cloudRepository) return

    setCloudLoading(true)
    setError(null)
    try {
      setCloudSnapshot(await cloudRepository.load())
    } catch (loadError) {
      setError(messageFrom(loadError))
      throw loadError
    } finally {
      setCloudLoading(false)
    }
  }, [cloudRepository])

  useEffect(() => {
    if (!cloudRepository) {
      setCloudSnapshot(emptySnapshot)
      setCloudLoading(false)
      setError(null)
      return
    }

    void reloadCloud().catch(() => undefined)
  }, [cloudRepository, reloadCloud])

  const runMutation = useCallback(
    async <TResult>(
      operation: (activeRepository: FinanceRepository) => Promise<TResult>
    ) => {
      if (!repository) {
        throw new Error("The active workspace is still loading.")
      }

      setError(null)
      try {
        const result = await operation(repository)
        if (repository.storage === "cloud") await reloadCloud()
        return result
      } catch (mutationError) {
        setError(messageFrom(mutationError))
        throw mutationError
      }
    },
    [reloadCloud, repository]
  )

  const addTransaction = useCallback(
    (transaction: NewTransaction) =>
      runMutation((activeRepository) =>
        activeRepository.addTransaction(transaction)
      ),
    [runMutation]
  )
  const deleteTransaction = useCallback(
    (id: string) =>
      runMutation((activeRepository) => activeRepository.deleteTransaction(id)),
    [runMutation]
  )
  const createCategory = useCallback(
    (name: string, type: TransactionType) =>
      runMutation((activeRepository) =>
        activeRepository.createCategory(name, type)
      ),
    [runMutation]
  )
  const saveBudget = useCallback(
    (categoryId: string, amount: number) =>
      runMutation((activeRepository) =>
        activeRepository.saveBudget(categoryId, amount)
      ),
    [runMutation]
  )
  const clearDemoTransactions = useCallback(
    () =>
      runMutation((activeRepository) =>
        activeRepository.clearDemoTransactions()
      ),
    [runMutation]
  )

  const snapshot =
    auth.status === "authenticated"
      ? cloudSnapshot
      : auth.status === "guest"
        ? {
            transactions: localTransactions,
            categories: localCategories,
            budgets: localBudgets,
          }
        : emptySnapshot

  return useMemo(
    () => ({
      ...snapshot,
      storage: repository?.storage ?? "device",
      isLoading: auth.status === "loading" || cloudLoading,
      error,
      addTransaction,
      createCategory,
      deleteTransaction,
      saveBudget,
      clearDemoTransactions,
    }),
    [
      addTransaction,
      auth.status,
      clearDemoTransactions,
      cloudLoading,
      createCategory,
      deleteTransaction,
      error,
      repository?.storage,
      saveBudget,
      snapshot,
    ]
  )
}
