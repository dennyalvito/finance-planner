import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  AccountBudget,
  AccountCategory,
  AccountRecord,
  AccountTransaction,
  RemoteFinanceSnapshot,
  SyncOperation,
} from "@/data/account-finance.types"
import type { AccountFinanceDatabase } from "@/data/account-finance-store"
import {
  listAccountConflicts,
  listSyncOperations,
  markOperationAttempt,
  markOperationConflict,
  markOperationSynced,
  mergeRemoteSnapshot,
} from "@/data/account-finance-store"
import type { Database, Tables } from "@/data/database.types"

type CategoryRow = Tables<"categories">
type TransactionRow = Tables<"transactions">
type BudgetRow = Tables<"budgets">

const categoryColumns =
  "id,user_id,name,type,is_custom,created_at,updated_at,revision,deleted_at"
const transactionColumns =
  "id,user_id,type,amount,category_id,date,note,created_at,updated_at,revision,deleted_at"
const budgetColumns =
  "id,user_id,category_id,month,amount,updated_at,revision,deleted_at"

function deletedAt(value: string | null) {
  return value ? Date.parse(value) : undefined
}

export function mapRemoteCategoryRow(row: CategoryRow): AccountCategory {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    isCustom: row.is_custom,
    revision: row.revision,
    serverUpdatedAt: Date.parse(row.updated_at),
    deletedAt: deletedAt(row.deleted_at),
  }
}

export function mapRemoteTransactionRow(
  row: TransactionRow
): AccountTransaction {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    categoryId: row.category_id,
    date: row.date,
    note: row.note,
    createdAt: Date.parse(row.created_at),
    revision: row.revision,
    serverUpdatedAt: Date.parse(row.updated_at),
    deletedAt: deletedAt(row.deleted_at),
  }
}

export function mapRemoteBudgetRow(row: BudgetRow): AccountBudget {
  return {
    id: row.id,
    categoryId: row.category_id,
    amount: row.amount,
    month: row.month.slice(0, 7),
    updatedAt: Date.parse(row.updated_at),
    revision: row.revision,
    serverUpdatedAt: Date.parse(row.updated_at),
    deletedAt: deletedAt(row.deleted_at),
  }
}

export async function loadRemoteFinanceSnapshot(
  client: SupabaseClient<Database>,
  userId: string
): Promise<RemoteFinanceSnapshot> {
  const [transactionsResult, categoriesResult, budgetsResult] =
    await Promise.all([
      client
        .from("transactions")
        .select(transactionColumns)
        .eq("user_id", userId),
      client
        .from("categories")
        .select(categoryColumns)
        .or(`user_id.is.null,user_id.eq.${userId}`),
      client.from("budgets").select(budgetColumns).eq("user_id", userId),
    ])

  if (transactionsResult.error) throw transactionsResult.error
  if (categoriesResult.error) throw categoriesResult.error
  if (budgetsResult.error) throw budgetsResult.error

  return {
    transactions: transactionsResult.data.map(mapRemoteTransactionRow),
    categories: categoriesResult.data.map(mapRemoteCategoryRow),
    budgets: budgetsResult.data.map(mapRemoteBudgetRow),
  }
}

type ApplyResult =
  | { status: "synced"; remoteRecord: AccountRecord }
  | {
      status: "conflict"
      remoteRecord: AccountRecord | null
      reason: "version" | "category-in-use" | "category-unavailable"
    }

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  )
}

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? error.code
    : undefined
}

function isCategoryUnavailable(error: unknown) {
  return (
    errorCode(error) === "23514" &&
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.toLocaleLowerCase().includes("category")
  )
}

async function fetchRemoteRecord(
  client: SupabaseClient<Database>,
  userId: string,
  operation: SyncOperation
): Promise<AccountRecord | null> {
  if (operation.entity === "category") {
    const { data, error } = await client
      .from("categories")
      .select(categoryColumns)
      .eq("id", operation.record.id)
      .eq("user_id", userId)
      .maybeSingle()
    if (error) throw error
    return data ? mapRemoteCategoryRow(data) : null
  }

  if (operation.entity === "transaction") {
    const { data, error } = await client
      .from("transactions")
      .select(transactionColumns)
      .eq("id", operation.record.id)
      .eq("user_id", userId)
      .maybeSingle()
    if (error) throw error
    return data ? mapRemoteTransactionRow(data) : null
  }

  let query = client.from("budgets").select(budgetColumns).eq("user_id", userId)

  query =
    operation.baseRevision === null
      ? query
          .eq("category_id", operation.record.categoryId)
          .eq("month", `${operation.record.month}-01`)
      : query.eq("id", operation.record.id)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data ? mapRemoteBudgetRow(data) : null
}

async function insertOperation(
  client: SupabaseClient<Database>,
  userId: string,
  operation: SyncOperation
): Promise<ApplyResult> {
  if (operation.entity === "category") {
    const { data, error } = await client
      .from("categories")
      .insert({
        id: operation.record.id,
        user_id: userId,
        name: operation.record.name,
        type: operation.record.type,
        is_custom: true,
      })
      .select(categoryColumns)
      .single()
    if (error) {
      if (isUniqueViolation(error)) {
        return {
          status: "conflict",
          remoteRecord: await fetchRemoteRecord(client, userId, operation),
          reason: "version",
        }
      }
      if (isCategoryUnavailable(error)) {
        return {
          status: "conflict",
          remoteRecord: await fetchRemoteRecord(client, userId, operation),
          reason: "category-unavailable",
        }
      }
      throw error
    }
    return { status: "synced", remoteRecord: mapRemoteCategoryRow(data) }
  }

  if (operation.entity === "transaction") {
    const { data, error } = await client
      .from("transactions")
      .insert({
        id: operation.record.id,
        user_id: userId,
        type: operation.record.type,
        amount: operation.record.amount,
        category_id: operation.record.categoryId,
        date: operation.record.date,
        note: operation.record.note,
        created_at: new Date(operation.record.createdAt).toISOString(),
      })
      .select(transactionColumns)
      .single()
    if (error) {
      if (isUniqueViolation(error)) {
        return {
          status: "conflict",
          remoteRecord: await fetchRemoteRecord(client, userId, operation),
          reason: "version",
        }
      }
      if (isCategoryUnavailable(error)) {
        return {
          status: "conflict",
          remoteRecord: await fetchRemoteRecord(client, userId, operation),
          reason: "category-unavailable",
        }
      }
      throw error
    }
    return { status: "synced", remoteRecord: mapRemoteTransactionRow(data) }
  }

  const { data, error } = await client
    .from("budgets")
    .insert({
      id: operation.record.id,
      user_id: userId,
      category_id: operation.record.categoryId,
      month: `${operation.record.month}-01`,
      amount: operation.record.amount,
    })
    .select(budgetColumns)
    .single()
  if (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "conflict",
        remoteRecord: await fetchRemoteRecord(client, userId, operation),
        reason: "version",
      }
    }
    if (isCategoryUnavailable(error)) {
      return {
        status: "conflict",
        remoteRecord: await fetchRemoteRecord(client, userId, operation),
        reason: "category-unavailable",
      }
    }
    throw error
  }
  return { status: "synced", remoteRecord: mapRemoteBudgetRow(data) }
}

async function updateOperation(
  client: SupabaseClient<Database>,
  userId: string,
  operation: SyncOperation
): Promise<ApplyResult> {
  const deleted =
    operation.action === "delete" ? new Date().toISOString() : null

  if (operation.entity === "category") {
    const { data, error } = await client
      .from("categories")
      .update({ name: operation.record.name, deleted_at: deleted })
      .eq("id", operation.record.id)
      .eq("user_id", userId)
      .eq("is_custom", true)
      .eq("revision", operation.baseRevision!)
      .select(categoryColumns)
      .maybeSingle()
    if (error) {
      if (operation.action === "delete" && errorCode(error) === "23503") {
        return {
          status: "conflict",
          remoteRecord: await fetchRemoteRecord(client, userId, operation),
          reason: "category-in-use",
        }
      }
      throw error
    }
    if (data) {
      return { status: "synced", remoteRecord: mapRemoteCategoryRow(data) }
    }
  } else if (operation.entity === "transaction") {
    const { data, error } = await client
      .from("transactions")
      .update({
        type: operation.record.type,
        amount: operation.record.amount,
        category_id: operation.record.categoryId,
        date: operation.record.date,
        note: operation.record.note,
        deleted_at: deleted,
      })
      .eq("id", operation.record.id)
      .eq("user_id", userId)
      .eq("revision", operation.baseRevision!)
      .select(transactionColumns)
      .maybeSingle()
    if (error) {
      if (isCategoryUnavailable(error)) {
        return {
          status: "conflict",
          remoteRecord: await fetchRemoteRecord(client, userId, operation),
          reason: "category-unavailable",
        }
      }
      throw error
    }
    if (data) {
      return { status: "synced", remoteRecord: mapRemoteTransactionRow(data) }
    }
  } else {
    const { data, error } = await client
      .from("budgets")
      .update({ amount: operation.record.amount, deleted_at: deleted })
      .eq("id", operation.record.id)
      .eq("user_id", userId)
      .eq("revision", operation.baseRevision!)
      .select(budgetColumns)
      .maybeSingle()
    if (error) {
      if (isCategoryUnavailable(error)) {
        return {
          status: "conflict",
          remoteRecord: await fetchRemoteRecord(client, userId, operation),
          reason: "category-unavailable",
        }
      }
      throw error
    }
    if (data) {
      return { status: "synced", remoteRecord: mapRemoteBudgetRow(data) }
    }
  }

  return {
    status: "conflict",
    remoteRecord: await fetchRemoteRecord(client, userId, operation),
    reason: "version",
  }
}

export async function applySyncOperation(
  client: SupabaseClient<Database>,
  userId: string,
  operation: SyncOperation
) {
  return operation.baseRevision === null
    ? insertOperation(client, userId, operation)
    : updateOperation(client, userId, operation)
}

function operationWeight(operation: SyncOperation) {
  if (operation.entity === "category" && operation.action === "upsert") return 0
  if (operation.entity === "transaction" && operation.action === "upsert") {
    return 1
  }
  if (operation.entity === "budget" && operation.action === "upsert") return 2
  if (operation.entity === "transaction") return 3
  if (operation.entity === "budget") return 4
  return 5
}

export function orderSyncOperations(operations: SyncOperation[]) {
  return [...operations].sort(
    (left, right) =>
      operationWeight(left) - operationWeight(right) ||
      left.createdAt - right.createdAt
  )
}

function operationCategoryId(operation: SyncOperation) {
  if (operation.entity === "category") return operation.record.id
  return operation.record.categoryId
}

export async function syncAccountFinance(
  client: SupabaseClient<Database>,
  userId: string,
  db: AccountFinanceDatabase
) {
  const existingConflicts = new Set(
    (await listAccountConflicts(db)).map((conflict) => conflict.key)
  )
  const blockedCategories = new Set<string>()
  let synced = 0
  let conflicts = 0

  for (const operation of orderSyncOperations(await listSyncOperations(db))) {
    if (existingConflicts.has(operation.key)) continue
    if (
      operation.entity !== "category" &&
      blockedCategories.has(operationCategoryId(operation))
    ) {
      continue
    }

    try {
      const result = await applySyncOperation(client, userId, operation)
      if (result.status === "conflict") {
        await markOperationConflict(
          db,
          operation,
          result.remoteRecord,
          result.reason
        )
        if (operation.entity === "category") {
          blockedCategories.add(operation.record.id)
        }
        conflicts += 1
        continue
      }
      await markOperationSynced(db, operation, result.remoteRecord)
      synced += 1
    } catch (error) {
      await markOperationAttempt(
        db,
        operation,
        error instanceof Error ? error.message : "Synchronization failed."
      )
      throw error
    }
  }

  const snapshot = await loadRemoteFinanceSnapshot(client, userId)
  await mergeRemoteSnapshot(db, snapshot)
  return { synced, conflicts }
}
