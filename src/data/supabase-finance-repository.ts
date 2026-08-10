import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Tables } from "@/data/database.types"
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

type CategoryRow = Tables<"categories">
type TransactionRow = Tables<"transactions">
type BudgetRow = Tables<"budgets">

function safeRupiah(value: number, field: string) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${field} is outside the supported rupiah range.`)
  }

  return value
}

export function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    isCustom: row.is_custom,
  }
}

export function mapTransactionRow(row: TransactionRow): FinanceTransaction {
  return {
    id: row.id,
    type: row.type,
    amount: safeRupiah(row.amount, "Transaction amount"),
    categoryId: row.category_id,
    date: row.date,
    note: row.note,
    createdAt: Date.parse(row.created_at),
  }
}

export function mapBudgetRow(row: BudgetRow): Budget {
  return {
    id: row.id,
    categoryId: row.category_id,
    amount: safeRupiah(row.amount, "Budget amount"),
    month: row.month.slice(0, 7),
    updatedAt: Date.parse(row.updated_at),
  }
}

export function createSupabaseFinanceRepository(
  client: SupabaseClient<Database>,
  userId: string
): FinanceRepository {
  async function load(): Promise<FinanceSnapshot> {
    const [transactionsResult, categoriesResult, budgetsResult] =
      await Promise.all([
        client
          .from("transactions")
          .select(
            "id,user_id,type,amount,category_id,date,note,created_at,updated_at,revision,deleted_at"
          )
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false }),
        client
          .from("categories")
          .select(
            "id,user_id,name,type,is_custom,created_at,updated_at,revision,deleted_at"
          )
          .or(`user_id.is.null,user_id.eq.${userId}`)
          .is("deleted_at", null)
          .order("name"),
        client
          .from("budgets")
          .select(
            "id,user_id,category_id,month,amount,updated_at,revision,deleted_at"
          )
          .eq("user_id", userId)
          .is("deleted_at", null),
      ])

    if (transactionsResult.error) throw transactionsResult.error
    if (categoriesResult.error) throw categoriesResult.error
    if (budgetsResult.error) throw budgetsResult.error

    return {
      transactions: transactionsResult.data.map(mapTransactionRow),
      categories: categoriesResult.data.map(mapCategoryRow),
      budgets: budgetsResult.data.map(mapBudgetRow),
    }
  }

  async function addTransaction(transaction: NewTransaction) {
    const { error } = await client.from("transactions").insert({
      user_id: userId,
      type: transaction.type,
      amount: transaction.amount,
      category_id: transaction.categoryId,
      date: transaction.date,
      note: transaction.note,
    })

    if (error) throw error
  }

  async function deleteTransaction(id: string) {
    const { error } = await client
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)

    if (error) throw error
  }

  async function updateTransaction(id: string, transaction: NewTransaction) {
    const { data, error } = await client
      .from("transactions")
      .update({
        type: transaction.type,
        amount: transaction.amount,
        category_id: transaction.categoryId,
        date: transaction.date,
        note: transaction.note,
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error("Transaction was not found.")
  }

  async function createCategory(name: string, type: TransactionType) {
    const { data, error } = await client
      .from("categories")
      .insert({
        id: `category-${globalThis.crypto.randomUUID()}`,
        user_id: userId,
        name: name.trim(),
        type,
        is_custom: true,
      })
      .select(
        "id,user_id,name,type,is_custom,created_at,updated_at,revision,deleted_at"
      )
      .single()

    if (error) throw error
    return mapCategoryRow(data)
  }

  async function updateCategory(id: string, name: string) {
    const { data, error } = await client
      .from("categories")
      .update({ name: name.trim() })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("is_custom", true)
      .select("id")
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error("Custom category was not found.")
  }

  async function deleteCategory(id: string) {
    const { data, error } = await client
      .from("categories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("is_custom", true)
      .select("id")
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error("Custom category was not found.")
  }

  async function saveBudget(categoryId: string, amount: number) {
    const month = `${monthKey(new Date())}-01`
    const { error } = await client.from("budgets").upsert(
      {
        user_id: userId,
        category_id: categoryId,
        month,
        amount,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
      { onConflict: "user_id,month,category_id" }
    )

    if (error) throw error
  }

  async function deleteBudget(categoryId: string, month: string) {
    const { data, error } = await client
      .from("budgets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("category_id", categoryId)
      .eq("month", `${month}-01`)
      .select("id")
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error("Budget was not found.")
  }

  return {
    storage: "cloud",
    load,
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
