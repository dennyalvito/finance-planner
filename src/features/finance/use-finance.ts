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
import {
  financeIssueFrom,
  isEmptyCloudSnapshot,
  safeFinanceError,
} from "@/features/finance/finance-reliability"
import type {
  CloudWorkspaceState,
  FinanceIssue,
} from "@/features/finance/finance-reliability"
import { getSupabaseClient } from "@/utils/supabase"

const emptySnapshot: FinanceSnapshot = {
  transactions: [],
  categories: [],
  budgets: [],
}

async function loadCloudSnapshot(repository: FinanceRepository) {
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await repository.load()
    } catch (error) {
      lastError = error
      if (attempt === 0) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, 150))
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
  const [cloudState, setCloudState] = useState<CloudWorkspaceState>("inactive")
  const [issue, setIssue] = useState<FinanceIssue | null>(null)
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine
  )
  const cloudLoadId = useRef(0)

  useEffect(() => {
    void ensureFinanceSeed()
  }, [])

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine)

    window.addEventListener("online", updateOnlineState)
    window.addEventListener("offline", updateOnlineState)
    return () => {
      window.removeEventListener("online", updateOnlineState)
      window.removeEventListener("offline", updateOnlineState)
    }
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
    setCloudState("loading")
    setIssue(null)

    if (!isOnline) {
      const offlineIssue = financeIssueFrom("load", false)
      setCloudState("offline")
      setIssue(offlineIssue)
      throw safeFinanceError(offlineIssue)
    }

    try {
      const snapshot = await loadCloudSnapshot(cloudRepository)
      if (requestId === cloudLoadId.current) {
        setCloudSnapshot(snapshot)
        setCloudState(isEmptyCloudSnapshot(snapshot) ? "empty" : "ready")
      }
    } catch {
      if (requestId === cloudLoadId.current) {
        const loadIssue = financeIssueFrom("load", isOnline)
        setCloudState(loadIssue.kind === "offline" ? "offline" : "error")
        setIssue(loadIssue)
      }
      throw safeFinanceError(financeIssueFrom("load", isOnline))
    }
  }, [cloudRepository, isOnline])

  useEffect(() => {
    if (!cloudRepository) {
      cloudLoadId.current += 1
      setCloudSnapshot(emptySnapshot)
      setCloudState("inactive")
      setIssue(null)
      return
    }

    setCloudSnapshot(emptySnapshot)
    setCloudState("loading")
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

      setIssue(null)

      if (repository.storage === "cloud" && !isOnline) {
        const offlineIssue = financeIssueFrom("mutation", false)
        setIssue(offlineIssue)
        throw safeFinanceError(offlineIssue)
      }

      let result: TResult
      try {
        result = await operation(repository)
      } catch {
        const mutationIssue = financeIssueFrom("mutation", isOnline)
        setIssue(mutationIssue)
        throw safeFinanceError(mutationIssue)
      }

      if (repository.storage === "cloud") {
        await reloadCloud().catch(() => undefined)
      }

      return result
    },
    [isOnline, reloadCloud, repository]
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
  const visibleCloudState =
    auth.status === "authenticated" && !isOnline && cloudState !== "loading"
      ? "offline"
      : cloudState

  return useMemo(
    () => ({
      ...snapshot,
      storage: repository?.storage ?? "device",
      isLoading: auth.status === "loading" || cloudState === "loading",
      isRefreshing: cloudState === "loading",
      cloudState: visibleCloudState,
      issue,
      retryCloud: reloadCloud,
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
      cloudState,
      createCategory,
      deleteTransaction,
      issue,
      reloadCloud,
      repository?.storage,
      saveBudget,
      snapshot,
      visibleCloudState,
    ]
  )
}
