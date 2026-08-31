import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { loadAccountDataWithRetry } from "@/features/finance/account-data-loader"
import {
  browserIsOnline,
  subscribeToBrowserConnectivity,
} from "@/features/finance/browser-connectivity"
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

export function selectFinanceRepository(
  status: "loading" | "guest" | "authenticated",
  localRepository: FinanceRepository,
  cloudRepository?: FinanceRepository
) {
  if (status === "loading") return undefined
  return status === "authenticated" ? cloudRepository : localRepository
}

type CloudRefresh = {
  userId: string
  promise: Promise<void>
}

export function useFinance() {
  const auth = useAuth()
  const userId = auth.user?.id
  const [cloudSnapshot, setCloudSnapshot] =
    useState<FinanceSnapshot>(emptySnapshot)
  const [hasCloudSnapshot, setHasCloudSnapshot] = useState(false)
  const [cloudState, setCloudState] = useState<CloudWorkspaceState>("inactive")
  const [issue, setIssue] = useState<FinanceIssue | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isOnline, setIsOnline] = useState(browserIsOnline)
  const activeUserId = useRef(userId)
  const hasCloudSnapshotRef = useRef(false)
  const activeRefresh = useRef<CloudRefresh | null>(null)

  activeUserId.current = userId

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

  const refreshCloud = useCallback(
    async (afterCurrent = false): Promise<void> => {
      if (!cloudRepository || !userId) return

      const current = activeRefresh.current
      if (current?.userId === userId) {
        if (afterCurrent) {
          await current.promise
          if (activeRefresh.current === current) activeRefresh.current = null
          if (activeUserId.current === userId) await refreshCloud(false)
          return
        }
        return current.promise
      }

      const currentlyOnline = browserIsOnline()
      setIsOnline(currentlyOnline)
      if (!currentlyOnline) {
        setCloudState("offline")
        setIssue(financeIssueFrom("load", false))
        return
      }

      const request = (async () => {
        if (!hasCloudSnapshotRef.current) setCloudState("loading")
        setIsRefreshing(true)
        setIssue(null)

        try {
          const nextSnapshot = hasCloudSnapshotRef.current
            ? await cloudRepository.load()
            : await loadAccountDataWithRetry({
                load: cloudRepository.load,
                canRetry: () =>
                  activeUserId.current === userId && browserIsOnline(),
              })
          if (activeUserId.current !== userId) return

          hasCloudSnapshotRef.current = true
          setHasCloudSnapshot(true)
          setCloudSnapshot(nextSnapshot)
          setCloudState(isEmptyCloudSnapshot(nextSnapshot) ? "empty" : "ready")
        } catch {
          if (activeUserId.current !== userId) return
          const stillOnline = browserIsOnline()
          setIsOnline(stillOnline)
          setCloudState(stillOnline ? "error" : "offline")
          setIssue(financeIssueFrom("load", stillOnline))
        } finally {
          if (activeUserId.current === userId) setIsRefreshing(false)
        }
      })()

      const tracked = { userId, promise: request }
      activeRefresh.current = tracked
      try {
        await request
      } finally {
        if (activeRefresh.current === tracked) activeRefresh.current = null
      }
    },
    [cloudRepository, userId]
  )

  useEffect(() => {
    setIsOnline(browserIsOnline())
    setIssue(null)
    setCloudSnapshot(emptySnapshot)
    setHasCloudSnapshot(false)
    hasCloudSnapshotRef.current = false

    if (auth.status !== "authenticated" || !userId) {
      setCloudState("inactive")
      setIsRefreshing(false)
      return
    }

    if (browserIsOnline()) {
      void refreshCloud()
    } else {
      setCloudState("offline")
      setIssue(financeIssueFrom("load", false))
    }
  }, [auth.status, refreshCloud, userId])

  useEffect(
    () =>
      subscribeToBrowserConnectivity((currentlyOnline, reason) => {
        setIsOnline(currentlyOnline)
        if (auth.status !== "authenticated") return

        if (!currentlyOnline) {
          setCloudState("offline")
          setIssue(financeIssueFrom("load", false))
          return
        }

        if (reason === "resume" || cloudState === "offline") {
          void refreshCloud()
        }
      }),
    [auth.status, cloudState, refreshCloud]
  )

  const runMutation = useCallback(
    async <TResult>(
      operation: (activeRepository: FinanceRepository) => Promise<TResult>
    ) => {
      if (!repository) {
        throw new Error("The active workspace is still loading.")
      }

      if (repository.storage === "cloud" && !browserIsOnline()) {
        const nextIssue = financeIssueFrom("mutation", false)
        setIsOnline(false)
        setCloudState("offline")
        setIssue(nextIssue)
        throw safeFinanceError(nextIssue)
      }

      setIssue(null)
      try {
        const result = await operation(repository)
        if (repository.storage === "cloud") await refreshCloud(true)
        return result
      } catch (error) {
        if (repository.storage !== "cloud") throw error

        const stillOnline = browserIsOnline()
        const nextIssue = financeIssueFrom("mutation", stillOnline)
        setIsOnline(stillOnline)
        setIssue(nextIssue)
        if (!stillOnline) setCloudState("offline")
        throw safeFinanceError(nextIssue)
      }
    },
    [refreshCloud, repository]
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
  const updateTransaction = useCallback(
    (id: string, transaction: NewTransaction) =>
      runMutation((activeRepository) =>
        activeRepository.updateTransaction(id, transaction)
      ),
    [runMutation]
  )
  const createCategory = useCallback(
    (name: string, type: TransactionType) =>
      runMutation((activeRepository) =>
        activeRepository.createCategory(name, type)
      ),
    [runMutation]
  )
  const updateCategory = useCallback(
    (id: string, name: string) =>
      runMutation((activeRepository) =>
        activeRepository.updateCategory(id, name)
      ),
    [runMutation]
  )
  const deleteCategory = useCallback(
    (id: string) =>
      runMutation((activeRepository) => activeRepository.deleteCategory(id)),
    [runMutation]
  )
  const saveBudget = useCallback(
    (categoryId: string, amount: number) =>
      runMutation((activeRepository) =>
        activeRepository.saveBudget(categoryId, amount)
      ),
    [runMutation]
  )
  const deleteBudget = useCallback(
    (categoryId: string, month: string) =>
      runMutation((activeRepository) =>
        activeRepository.deleteBudget(categoryId, month)
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
  const isCloudWorkspace = auth.status === "authenticated"
  const isGuestStorageLoading =
    auth.status === "guest" && localCategories.length === 0
  const canMutate =
    !isCloudWorkspace ||
    (isOnline && hasCloudSnapshot && cloudState !== "loading")

  return useMemo(
    () => ({
      ...snapshot,
      storage: repository?.storage ?? "device",
      isLoading:
        auth.status === "loading" ||
        isGuestStorageLoading ||
        (isCloudWorkspace && cloudState === "loading" && !hasCloudSnapshot),
      isRefreshing,
      isOnline,
      canMutate,
      hasCloudSnapshot,
      cloudState,
      issue,
      retryCloud: () => refreshCloud(true),
      addTransaction,
      updateTransaction,
      createCategory,
      updateCategory,
      deleteCategory,
      deleteTransaction,
      saveBudget,
      deleteBudget,
      clearDemoTransactions,
    }),
    [
      addTransaction,
      auth.status,
      canMutate,
      clearDemoTransactions,
      cloudState,
      createCategory,
      deleteBudget,
      deleteCategory,
      deleteTransaction,
      hasCloudSnapshot,
      isCloudWorkspace,
      isGuestStorageLoading,
      isOnline,
      isRefreshing,
      issue,
      refreshCloud,
      repository?.storage,
      saveBudget,
      snapshot,
      updateCategory,
      updateTransaction,
    ]
  )
}
