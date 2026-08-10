import type {
  Budget,
  Category,
  FinanceTransaction,
  RecordSyncStatus,
} from "@/domain/finance"

export type SyncEntity = "category" | "transaction" | "budget"
export type SyncAction = "upsert" | "delete"

type AccountRecordMetadata = {
  revision: number
  serverUpdatedAt: number
  deletedAt?: number
  syncStatus?: RecordSyncStatus
}

export type AccountCategory = Category & AccountRecordMetadata
export type AccountTransaction = FinanceTransaction & AccountRecordMetadata
export type AccountBudget = Budget & AccountRecordMetadata
export type AccountRecord = AccountCategory | AccountTransaction | AccountBudget

type SyncOperationBase = {
  key: string
  action: SyncAction
  baseRevision: number | null
  createdAt: number
  attempts: number
  lastError?: string
}

export type CategorySyncOperation = SyncOperationBase & {
  entity: "category"
  record: AccountCategory
}

export type TransactionSyncOperation = SyncOperationBase & {
  entity: "transaction"
  record: AccountTransaction
}

export type BudgetSyncOperation = SyncOperationBase & {
  entity: "budget"
  record: AccountBudget
}

export type SyncOperation =
  CategorySyncOperation | TransactionSyncOperation | BudgetSyncOperation

export type SyncConflict = {
  key: string
  operation: SyncOperation
  remoteRecord: AccountRecord | null
  reason: "version" | "category-in-use" | "category-unavailable"
  detectedAt: number
}

export type RemoteFinanceSnapshot = {
  transactions: AccountTransaction[]
  categories: AccountCategory[]
  budgets: AccountBudget[]
}

export type AccountStoreState = {
  hasSnapshot: boolean
}

export function operationKey(entity: SyncEntity, recordId: string) {
  return `${entity}:${recordId}`
}
