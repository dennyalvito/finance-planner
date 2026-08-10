import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"

import type { SyncConflict } from "@/data/account-finance.types"
import {
  accountHasSnapshot,
  accountPendingCount,
  clearAccountFinanceDatabase,
  createAccountFinanceRepository,
  getAccountFinanceDatabase,
  listAccountConflicts,
  loadAccountSnapshot,
  resolveConflictWithCloud,
  resolveConflictWithDevice,
} from "@/data/account-finance-store"
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
import { syncAccountFinance } from "@/data/supabase-finance-sync"
import type { NewTransaction, TransactionType } from "@/domain/finance"
import { useAuth } from "@/features/auth/auth-provider"
import {
  financeIssueFrom,
  isEmptyCloudSnapshot,
  syncIssueFrom,
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

async function withAccountSyncLock(
  userId: string,
  synchronize: () => Promise<unknown>
) {
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    return navigator.locks.request(`coin-account-sync:${userId}`, synchronize)
  }
  return synchronize()
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
  const [cloudState, setCloudState] = useState<CloudWorkspaceState>("inactive")
  const [issue, setIssue] = useState<FinanceIssue | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine
  )
  const syncPromise = useRef<Promise<void> | null>(null)
  const syncRequested = useRef(false)

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

  const accountDb = useMemo(
    () =>
      auth.status === "authenticated" && userId
        ? getAccountFinanceDatabase(userId)
        : undefined,
    [auth.status, userId]
  )
  const accountRepository = useMemo(
    () => (accountDb ? createAccountFinanceRepository(accountDb) : undefined),
    [accountDb]
  )
  const accountSnapshot = useLiveQuery(
    () => (accountDb ? loadAccountSnapshot(accountDb) : emptySnapshot),
    [accountDb],
    emptySnapshot
  )
  const hasAccountSnapshot = useLiveQuery(
    () => (accountDb ? accountHasSnapshot(accountDb) : false),
    [accountDb]
  )
  const pendingCount = useLiveQuery(
    () => (accountDb ? accountPendingCount(accountDb) : 0),
    [accountDb],
    0
  )
  const conflicts = useLiveQuery(
    () => (accountDb ? listAccountConflicts(accountDb) : []),
    [accountDb],
    []
  )

  const repository = selectFinanceRepository(
    auth.status,
    localFinanceRepository,
    accountRepository
  )

  const syncNow = useCallback(async () => {
    if (!accountDb || !userId) return
    if (syncPromise.current) {
      syncRequested.current = true
      return syncPromise.current
    }

    if (!isOnline) {
      const hasSnapshot = await accountHasSnapshot(accountDb)
      setCloudState("offline")
      setIssue(
        hasSnapshot ? syncIssueFrom(false) : financeIssueFrom("load", false)
      )
      return
    }

    const client = getSupabaseClient()
    if (!client) return

    const run = (async () => {
      const hasSnapshot = await accountHasSnapshot(accountDb)
      setIsRefreshing(true)
      if (!hasSnapshot) setCloudState("loading")
      setIssue(null)

      try {
        await withAccountSyncLock(userId, () =>
          syncAccountFinance(client, userId, accountDb)
        )
        const snapshot = await loadAccountSnapshot(accountDb)
        setCloudState(isEmptyCloudSnapshot(snapshot) ? "empty" : "ready")
      } catch {
        const stillOnline = navigator.onLine
        setCloudState(stillOnline ? "error" : "offline")
        setIssue(
          (await accountHasSnapshot(accountDb))
            ? syncIssueFrom(stillOnline)
            : financeIssueFrom("load", stillOnline)
        )
      } finally {
        setIsRefreshing(false)
      }
    })()

    syncPromise.current = run
    try {
      await run
    } finally {
      syncPromise.current = null
      if (syncRequested.current) {
        syncRequested.current = false
        queueMicrotask(() => void syncNow())
      }
    }
  }, [accountDb, isOnline, userId])

  useEffect(() => {
    if (!accountDb) {
      setCloudState("inactive")
      setIssue(null)
      return
    }

    if (isOnline) {
      void syncNow()
      return
    }

    void accountHasSnapshot(accountDb).then((hasSnapshot) => {
      setCloudState("offline")
      setIssue(
        hasSnapshot ? syncIssueFrom(false) : financeIssueFrom("load", false)
      )
    })
  }, [accountDb, isOnline, syncNow])

  const runMutation = useCallback(
    async <TResult>(
      operation: (activeRepository: FinanceRepository) => Promise<TResult>
    ) => {
      if (!repository) {
        throw new Error("The active workspace is still loading.")
      }

      setIssue(null)
      const result = await operation(repository)

      if (repository.storage === "cloud") {
        if (isOnline) {
          void syncNow()
        } else {
          setCloudState("offline")
          setIssue(syncIssueFrom(false))
        }
      }

      return result
    },
    [isOnline, repository, syncNow]
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

  const useCloudConflict = useCallback(
    async (conflict: SyncConflict) => {
      if (!accountDb) return
      await resolveConflictWithCloud(accountDb, conflict)
      if (isOnline) void syncNow()
    },
    [accountDb, isOnline, syncNow]
  )
  const useDeviceConflict = useCallback(
    async (conflict: SyncConflict) => {
      if (!accountDb) return
      await resolveConflictWithDevice(accountDb, conflict)
      if (isOnline) void syncNow()
    },
    [accountDb, isOnline, syncNow]
  )
  const clearAccountData = useCallback(async () => {
    if (!userId) return
    await clearAccountFinanceDatabase(userId)
  }, [userId])
  const getPendingCount = useCallback(
    () => (accountDb ? accountPendingCount(accountDb) : Promise.resolve(0)),
    [accountDb]
  )
  const syncPendingChanges = useCallback(async () => {
    await syncNow()
    return getPendingCount()
  }, [getPendingCount, syncNow])

  const snapshot =
    auth.status === "authenticated"
      ? accountSnapshot
      : auth.status === "guest"
        ? {
            transactions: localTransactions,
            categories: localCategories,
            budgets: localBudgets,
          }
        : emptySnapshot
  const loadingAccountCache =
    auth.status === "authenticated" && hasAccountSnapshot === undefined

  return useMemo(
    () => ({
      ...snapshot,
      storage: repository?.storage ?? "device",
      isLoading:
        auth.status === "loading" ||
        loadingAccountCache ||
        (cloudState === "loading" && !hasAccountSnapshot),
      isRefreshing,
      isOnline,
      cloudState,
      issue,
      pendingCount,
      conflicts,
      retryCloud: syncNow,
      syncNow,
      syncPendingChanges,
      useCloudConflict,
      useDeviceConflict,
      clearAccountData,
      getPendingCount,
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
      clearAccountData,
      clearDemoTransactions,
      cloudState,
      conflicts,
      createCategory,
      deleteBudget,
      deleteCategory,
      deleteTransaction,
      getPendingCount,
      hasAccountSnapshot,
      isOnline,
      isRefreshing,
      issue,
      loadingAccountCache,
      pendingCount,
      repository?.storage,
      saveBudget,
      snapshot,
      syncNow,
      syncPendingChanges,
      updateCategory,
      updateTransaction,
      useCloudConflict,
      useDeviceConflict,
    ]
  )
}
