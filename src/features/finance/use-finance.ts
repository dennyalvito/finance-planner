import { useCallback, useEffect, useMemo, useState, useRef } from "react"
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

async function loadCloudSnapshot(repository: FinanceRepository) {
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await repository.load()
    } catch (error) {
      lastError = error
      if (attempt === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 150))
      }
    }
  }

  throw lastError
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
  const cloudLoadId = useRef(0)

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

    const requestId = ++cloudLoadId.current
    setCloudLoading(true)
    setError(null)
    try {
      const snapshot = await loadCloudSnapshot(cloudRepository)
      if (requestId === cloudLoadId.current) {
        setCloudSnapshot(snapshot)
      }
    } catch (loadError) {
      if (requestId === cloudLoadId.current) {
        setError(messageFrom(loadError))
      }
      throw loadError
    } finally {
      if (requestId === cloudLoadId.current) {
        setCloudLoading(false)
      }
    }
  }, [cloudRepository])

  useEffect(() => {
    if (!cloudRepository) {
      cloudLoadId.current += 1
      setCloudSnapshot(emptySnapshot)
      setCloudLoading(false)
      setError(null)
      return
    }

    setCloudSnapshot(emptySnapshot)
    void reloadCloud().catch(() => undefined)

    return () => {
      cloudLoadId.current += 1
    }
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
