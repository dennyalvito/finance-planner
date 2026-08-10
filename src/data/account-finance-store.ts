import Dexie from "dexie"
import type { EntityTable, Table } from "dexie"

import type {
  AccountBudget,
  AccountCategory,
  AccountRecord,
  AccountTransaction,
  RemoteFinanceSnapshot,
  SyncAction,
  SyncConflict,
  SyncEntity,
  SyncOperation,
} from "@/data/account-finance.types"
import { operationKey } from "@/data/account-finance.types"
import type {
  FinanceRepository,
  FinanceSnapshot,
} from "@/data/finance-repository.types"
import type {
  Budget,
  Category,
  FinanceTransaction,
  NewTransaction,
  TransactionType,
} from "@/domain/finance"
import { monthKey } from "@/domain/finance"

type AccountSetting = {
  key: string
  value: string
}

export class AccountFinanceDatabase extends Dexie {
  transactions!: EntityTable<AccountTransaction, "id">
  categories!: EntityTable<AccountCategory, "id">
  budgets!: EntityTable<AccountBudget, "id">
  syncQueue!: EntityTable<SyncOperation, "key">
  conflicts!: EntityTable<SyncConflict, "key">
  settings!: EntityTable<AccountSetting, "key">

  constructor(readonly userId: string) {
    super(`coin-account-${userId}`)
    this.version(1).stores({
      transactions: "id,date,type,categoryId,createdAt,deletedAt,syncStatus",
      categories: "id,name,type,isCustom,deletedAt,syncStatus",
      budgets: "id,[month+categoryId],month,categoryId,deletedAt,syncStatus",
      syncQueue: "key,entity,action,createdAt",
      conflicts: "key,detectedAt",
      settings: "key",
    })
  }
}

const accountDatabases = new Map<string, AccountFinanceDatabase>()

export function getAccountFinanceDatabase(userId: string) {
  let db = accountDatabases.get(userId)
  if (!db) {
    db = new AccountFinanceDatabase(userId)
    accountDatabases.set(userId, db)
  }
  return db
}

function visible<T extends { deletedAt?: number }>(records: T[]) {
  return records.filter((record) => record.deletedAt === undefined)
}

function toCategory(record: AccountCategory): Category {
  const { id, name, type, isCustom, syncStatus } = record
  return { id, name, type, isCustom, syncStatus }
}

function toTransaction(record: AccountTransaction): FinanceTransaction {
  const { id, type, amount, categoryId, date, note, createdAt, syncStatus } =
    record
  return {
    id,
    type,
    amount,
    categoryId,
    date,
    note,
    createdAt,
    syncStatus,
  }
}

function toBudget(record: AccountBudget): Budget {
  const { id, categoryId, amount, month, updatedAt, syncStatus } = record
  return { id, categoryId, amount, month, updatedAt, syncStatus }
}

export async function loadAccountSnapshot(
  db: AccountFinanceDatabase
): Promise<FinanceSnapshot> {
  const [transactions, categories, budgets] = await Promise.all([
    db.transactions.orderBy("date").reverse().toArray(),
    db.categories.orderBy("name").toArray(),
    db.budgets.toArray(),
  ])

  return {
    transactions: visible(transactions).map(toTransaction),
    categories: visible(categories).map(toCategory),
    budgets: visible(budgets).map(toBudget),
  }
}

export async function accountHasSnapshot(db: AccountFinanceDatabase) {
  return (await db.settings.get("hasSnapshot"))?.value === "true"
}

export async function accountPendingCount(db: AccountFinanceDatabase) {
  return db.syncQueue.count()
}

export async function listAccountConflicts(db: AccountFinanceDatabase) {
  return db.conflicts.orderBy("detectedAt").toArray()
}

export async function listSyncOperations(db: AccountFinanceDatabase) {
  return db.syncQueue.orderBy("createdAt").toArray()
}

function entityTable(
  db: AccountFinanceDatabase,
  entity: SyncEntity
): Table<AccountRecord, string> {
  if (entity === "category") {
    return db.categories as unknown as Table<AccountRecord, string>
  }
  if (entity === "transaction") {
    return db.transactions as unknown as Table<AccountRecord, string>
  }
  return db.budgets as unknown as Table<AccountRecord, string>
}

function pendingRecord<T extends AccountRecord>(
  record: T,
  action: SyncAction
): T {
  return {
    ...record,
    deletedAt: action === "delete" ? Date.now() : undefined,
    syncStatus: "pending",
  }
}

async function queueRecord(
  db: AccountFinanceDatabase,
  entity: SyncEntity,
  record: AccountRecord,
  action: SyncAction
) {
  const key = operationKey(entity, record.id)
  const existing = await db.syncQueue.get(key)
  const table = entityTable(db, entity)

  if (action === "delete" && existing?.baseRevision === null) {
    await table.delete(record.id)
    await db.syncQueue.delete(key)
    await db.conflicts.delete(key)
    return
  }

  const nextRecord = pendingRecord(record, action)
  const operation = {
    key,
    entity,
    action,
    record: nextRecord,
    baseRevision:
      existing?.baseRevision ?? (record.revision > 0 ? record.revision : null),
    createdAt: existing?.createdAt ?? Date.now(),
    attempts: existing?.attempts ?? 0,
  } as SyncOperation

  await table.put(nextRecord)
  await db.syncQueue.put(operation)
  await db.conflicts.delete(key)
}

function activeRecord<T extends { deletedAt?: number }>(record: T | undefined) {
  return record && record.deletedAt === undefined ? record : undefined
}

async function categoryNameExists(
  db: AccountFinanceDatabase,
  name: string,
  type: TransactionType,
  exceptId?: string
) {
  const normalized = name.trim().toLocaleLowerCase()
  return db.categories
    .where("type")
    .equals(type)
    .filter(
      (category) =>
        category.deletedAt === undefined &&
        category.id !== exceptId &&
        category.name.trim().toLocaleLowerCase() === normalized
    )
    .first()
}

export function createAccountFinanceRepository(
  db: AccountFinanceDatabase
): FinanceRepository {
  async function addTransaction(transaction: NewTransaction) {
    const category = activeRecord(
      await db.categories.get(transaction.categoryId)
    )
    if (!category || category.type !== transaction.type) {
      throw new Error("Choose an available category of the same type.")
    }

    const now = Date.now()
    const record: AccountTransaction = {
      ...transaction,
      id: globalThis.crypto.randomUUID(),
      createdAt: now,
      revision: 0,
      serverUpdatedAt: now,
    }

    await db.transaction(
      "rw",
      db.transactions,
      db.syncQueue,
      db.conflicts,
      () => queueRecord(db, "transaction", record, "upsert")
    )
  }

  async function updateTransaction(id: string, transaction: NewTransaction) {
    const current = activeRecord(await db.transactions.get(id))
    if (!current) throw new Error("Transaction was not found.")
    const category = activeRecord(
      await db.categories.get(transaction.categoryId)
    )
    if (!category || category.type !== transaction.type) {
      throw new Error("Choose an available category of the same type.")
    }

    await db.transaction(
      "rw",
      db.transactions,
      db.syncQueue,
      db.conflicts,
      () =>
        queueRecord(db, "transaction", { ...current, ...transaction }, "upsert")
    )
  }

  async function deleteTransaction(id: string) {
    const current = activeRecord(await db.transactions.get(id))
    if (!current) throw new Error("Transaction was not found.")
    await db.transaction(
      "rw",
      db.transactions,
      db.syncQueue,
      db.conflicts,
      () => queueRecord(db, "transaction", current, "delete")
    )
  }

  async function createCategory(name: string, type: TransactionType) {
    const trimmedName = name.trim()
    if (await categoryNameExists(db, trimmedName, type)) {
      throw new Error("A category with this name already exists.")
    }

    const now = Date.now()
    const record: AccountCategory = {
      id: `category-${globalThis.crypto.randomUUID()}`,
      name: trimmedName,
      type,
      isCustom: true,
      revision: 0,
      serverUpdatedAt: now,
    }

    await db.transaction("rw", db.categories, db.syncQueue, db.conflicts, () =>
      queueRecord(db, "category", record, "upsert")
    )
    return toCategory({ ...record, syncStatus: "pending" })
  }

  async function updateCategory(id: string, name: string) {
    const current = activeRecord(await db.categories.get(id))
    if (!current || !current.isCustom) {
      throw new Error("Only custom categories can be renamed.")
    }
    const trimmedName = name.trim()
    if (await categoryNameExists(db, trimmedName, current.type, id)) {
      throw new Error("A category with this name already exists.")
    }

    await db.transaction("rw", db.categories, db.syncQueue, db.conflicts, () =>
      queueRecord(db, "category", { ...current, name: trimmedName }, "upsert")
    )
  }

  async function deleteCategory(id: string) {
    const current = activeRecord(await db.categories.get(id))
    if (!current || !current.isCustom) {
      throw new Error("Only custom categories can be deleted.")
    }

    const [transactionCount, budgetCount] = await Promise.all([
      db.transactions
        .where("categoryId")
        .equals(id)
        .filter((transaction) => transaction.deletedAt === undefined)
        .count(),
      db.budgets
        .where("categoryId")
        .equals(id)
        .filter((budget) => budget.deletedAt === undefined)
        .count(),
    ])
    if (transactionCount > 0 || budgetCount > 0) {
      throw new Error(
        "This category is used by transactions or budgets. Reassign or remove them first."
      )
    }

    await db.transaction("rw", db.categories, db.syncQueue, db.conflicts, () =>
      queueRecord(db, "category", current, "delete")
    )
  }

  async function saveBudget(categoryId: string, amount: number) {
    const category = activeRecord(await db.categories.get(categoryId))
    if (!category || category.type !== "expense") {
      throw new Error("Choose an available expense category.")
    }

    const month = monthKey(new Date())
    const existing = await db.budgets
      .where("[month+categoryId]")
      .equals([month, categoryId])
      .first()
    const now = Date.now()
    const record: AccountBudget = existing
      ? { ...existing, amount, updatedAt: now, deletedAt: undefined }
      : {
          id: globalThis.crypto.randomUUID(),
          categoryId,
          amount,
          month,
          updatedAt: now,
          revision: 0,
          serverUpdatedAt: now,
        }

    await db.transaction("rw", db.budgets, db.syncQueue, db.conflicts, () =>
      queueRecord(db, "budget", record, "upsert")
    )
  }

  async function deleteBudget(categoryId: string, month: string) {
    const current = activeRecord(
      await db.budgets
        .where("[month+categoryId]")
        .equals([month, categoryId])
        .first()
    )
    if (!current) throw new Error("Budget was not found.")
    await db.transaction("rw", db.budgets, db.syncQueue, db.conflicts, () =>
      queueRecord(db, "budget", current, "delete")
    )
  }

  return {
    storage: "cloud",
    load: () => loadAccountSnapshot(db),
    addTransaction,
    updateTransaction,
    deleteTransaction,
    createCategory,
    updateCategory,
    deleteCategory,
    saveBudget,
    deleteBudget,
    clearDemoTransactions: async () => undefined,
  }
}

async function mergeEntityRecords<T extends AccountRecord>(
  table: {
    toArray: () => Promise<T[]>
    put: (record: T) => Promise<unknown>
    delete: (id: string) => Promise<unknown>
  },
  entity: SyncEntity,
  remoteRecords: T[],
  queuedKeys: Set<string>
) {
  const remoteIds = new Set(remoteRecords.map((record) => record.id))
  const localRecords = await table.toArray()

  for (const localRecord of localRecords) {
    if (
      !remoteIds.has(localRecord.id) &&
      !queuedKeys.has(operationKey(entity, localRecord.id))
    ) {
      await table.delete(localRecord.id)
    }
  }

  for (const remoteRecord of remoteRecords) {
    if (!queuedKeys.has(operationKey(entity, remoteRecord.id))) {
      await table.put({ ...remoteRecord, syncStatus: undefined })
    }
  }
}

export async function mergeRemoteSnapshot(
  db: AccountFinanceDatabase,
  snapshot: RemoteFinanceSnapshot
) {
  await db.transaction(
    "rw",
    db.transactions,
    db.categories,
    db.budgets,
    db.syncQueue,
    db.settings,
    async () => {
      const queuedKeys = new Set(
        (await db.syncQueue.toCollection().primaryKeys()).map(String)
      )
      await mergeEntityRecords(
        db.categories,
        "category",
        snapshot.categories,
        queuedKeys
      )
      await mergeEntityRecords(
        db.transactions,
        "transaction",
        snapshot.transactions,
        queuedKeys
      )
      await mergeEntityRecords(
        db.budgets,
        "budget",
        snapshot.budgets,
        queuedKeys
      )
      await db.settings.put({ key: "hasSnapshot", value: "true" })
    }
  )
}

export async function markOperationAttempt(
  db: AccountFinanceDatabase,
  operation: SyncOperation,
  message: string
) {
  await db.syncQueue.update(operation.key, {
    attempts: operation.attempts + 1,
    lastError: message,
  })
}

export async function markOperationSynced(
  db: AccountFinanceDatabase,
  operation: SyncOperation,
  remoteRecord: AccountRecord
) {
  await db.transaction(
    "rw",
    entityTable(db, operation.entity),
    db.syncQueue,
    db.conflicts,
    async () => {
      await entityTable(db, operation.entity).put({
        ...remoteRecord,
        syncStatus: undefined,
      })
      await db.syncQueue.delete(operation.key)
      await db.conflicts.delete(operation.key)
    }
  )
}

export async function markOperationConflict(
  db: AccountFinanceDatabase,
  operation: SyncOperation,
  remoteRecord: AccountRecord | null,
  reason: SyncConflict["reason"] = "version"
) {
  const record = { ...operation.record, syncStatus: "conflict" as const }
  const nextOperation = {
    ...operation,
    record,
    attempts: operation.attempts + 1,
  } as SyncOperation
  await db.transaction(
    "rw",
    entityTable(db, operation.entity),
    db.syncQueue,
    db.conflicts,
    async () => {
      await entityTable(db, operation.entity).put(record)
      await db.syncQueue.put(nextOperation)
      await db.conflicts.put({
        key: operation.key,
        operation: nextOperation,
        remoteRecord,
        reason,
        detectedAt: Date.now(),
      })
    }
  )
}

export async function resolveConflictWithCloud(
  db: AccountFinanceDatabase,
  conflict: SyncConflict
) {
  const table = entityTable(db, conflict.operation.entity)
  await db.transaction("rw", table, db.syncQueue, db.conflicts, async () => {
    if (conflict.remoteRecord) {
      if (conflict.remoteRecord.id !== conflict.operation.record.id) {
        await table.delete(conflict.operation.record.id)
      }
      await table.put({ ...conflict.remoteRecord, syncStatus: undefined })
    } else {
      await table.delete(conflict.operation.record.id)
    }
    await db.syncQueue.delete(conflict.operation.key)
    await db.conflicts.delete(conflict.key)
  })
}

export async function resolveConflictWithDevice(
  db: AccountFinanceDatabase,
  conflict: SyncConflict
) {
  const { operation, remoteRecord } = conflict
  const oldTable = entityTable(db, operation.entity)

  if (operation.action === "delete" && !remoteRecord) {
    await db.transaction(
      "rw",
      oldTable,
      db.syncQueue,
      db.conflicts,
      async () => {
        await oldTable.delete(operation.record.id)
        await db.syncQueue.delete(operation.key)
        await db.conflicts.delete(conflict.key)
      }
    )
    return
  }

  const remoteId = remoteRecord?.id ?? operation.record.id
  const preferredRecord =
    operation.action === "delete" && remoteRecord
      ? remoteRecord
      : operation.record
  const nextRecord = {
    ...preferredRecord,
    id: remoteId,
    revision: remoteRecord?.revision ?? 0,
    serverUpdatedAt: remoteRecord?.serverUpdatedAt ?? Date.now(),
    deletedAt: operation.action === "delete" ? Date.now() : undefined,
    syncStatus: "pending" as const,
  } as AccountRecord
  const nextKey = operationKey(operation.entity, remoteId)
  const nextOperation = {
    ...operation,
    key: nextKey,
    record: nextRecord,
    baseRevision: remoteRecord?.revision ?? null,
    attempts: 0,
    lastError: undefined,
  } as SyncOperation

  await db.transaction("rw", oldTable, db.syncQueue, db.conflicts, async () => {
    if (remoteId !== operation.record.id) {
      await oldTable.delete(operation.record.id)
    }
    await oldTable.put(nextRecord)
    await db.syncQueue.delete(operation.key)
    await db.syncQueue.put(nextOperation)
    await db.conflicts.delete(conflict.key)
  })
}

export async function clearAccountFinanceDatabase(userId: string) {
  const db = accountDatabases.get(userId) ?? getAccountFinanceDatabase(userId)
  db.close()
  await db.delete()
  accountDatabases.delete(userId)
}
