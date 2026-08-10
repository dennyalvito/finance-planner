import Dexie from "dexie"
import type { EntityTable } from "dexie"

import type { FinanceRepository } from "@/data/finance-repository.types"

import type {
  Budget,
  Category,
  FinanceTransaction,
  NewTransaction,
  TransactionType,
} from "@/domain/finance"
import { monthKey } from "@/domain/finance"

type Setting = {
  key: string
  value: string
}

class CoinDatabase extends Dexie {
  transactions!: EntityTable<FinanceTransaction, "id">
  categories!: EntityTable<Category, "id">
  budgets!: EntityTable<Budget, "id">
  settings!: EntityTable<Setting, "key">

  constructor() {
    super("coin-finance")
    this.version(1).stores({
      transactions: "id,date,type,categoryId,createdAt",
      categories: "id,type,isCustom",
      budgets: "id,month,categoryId",
      settings: "key",
    })
    this.version(2).stores({
      transactions: "id,date,type,categoryId,createdAt",
      categories: "id,name,type",
      budgets: "id,month,categoryId",
      settings: "key",
    })
    this.version(3).stores({
      transactions: "id,date,type,categoryId,createdAt",
      categories: "id,name,type",
      budgets: "id,[month+categoryId],month,categoryId",
      settings: "key",
    })
  }
}

let database: CoinDatabase | undefined

export function getFinanceDatabase() {
  if (typeof indexedDB === "undefined") return undefined
  database ??= new CoinDatabase()
  return database
}

const builtInCategories: Category[] = [
  { id: "salary", name: "Salary", type: "income", isCustom: false },
  { id: "freelance", name: "Freelance", type: "income", isCustom: false },
  { id: "gift", name: "Gift", type: "income", isCustom: false },
  { id: "food", name: "Food & dining", type: "expense", isCustom: false },
  { id: "transport", name: "Transport", type: "expense", isCustom: false },
  { id: "housing", name: "Housing", type: "expense", isCustom: false },
  { id: "shopping", name: "Shopping", type: "expense", isCustom: false },
  { id: "health", name: "Health", type: "expense", isCustom: false },
  { id: "leisure", name: "Leisure", type: "expense", isCustom: false },
]

function makeId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

export async function ensureFinanceSeed() {
  const db = getFinanceDatabase()
  if (!db) return
  const seeded = await db.settings.get("seeded")
  if (seeded?.value === "2") return

  await db.transaction(
    "rw",
    db.categories,
    db.transactions,
    db.settings,
    async () => {
      await db.categories.bulkPut(builtInCategories)
      await db.transactions.filter((item) => item.isDemo === true).delete()
      await db.settings.put({ key: "seeded", value: "2" })
    }
  )
}

export async function listTransactions() {
  const db = getFinanceDatabase()
  return db ? db.transactions.orderBy("date").reverse().toArray() : []
}

export async function listCategories() {
  const db = getFinanceDatabase()
  return db ? db.categories.orderBy("name").toArray() : []
}

export async function listBudgets() {
  const db = getFinanceDatabase()
  return db ? db.budgets.toArray() : []
}

export async function addTransaction(transaction: NewTransaction) {
  const db = getFinanceDatabase()
  if (!db) throw new Error("Local storage is unavailable.")

  await db.transaction("rw", db.transactions, async () => {
    await db.transactions.filter((item) => item.isDemo === true).delete()
    await db.transactions.add({
      ...transaction,
      id: makeId("transaction"),
      createdAt: Date.now(),
    })
  })
}

export async function deleteTransaction(id: string) {
  const db = getFinanceDatabase()
  if (!db) throw new Error("Local storage is unavailable.")
  await db.transactions.delete(id)
}

export async function updateTransaction(
  id: string,
  transaction: NewTransaction
) {
  const db = getFinanceDatabase()
  if (!db) throw new Error("Local storage is unavailable.")
  const updated = await db.transactions.update(id, transaction)
  if (!updated) throw new Error("Transaction was not found.")
}

export async function createCategory(name: string, type: TransactionType) {
  const db = getFinanceDatabase()
  if (!db) throw new Error("Local storage is unavailable.")
  const category: Category = {
    id: makeId("category"),
    name: name.trim(),
    type,
    isCustom: true,
  }
  await db.categories.add(category)
  return category
}

export async function updateCategory(id: string, name: string) {
  const db = getFinanceDatabase()
  if (!db) throw new Error("Local storage is unavailable.")
  const category = await db.categories.get(id)
  if (!category?.isCustom) {
    throw new Error("Only custom categories can be renamed.")
  }
  const duplicate = await db.categories
    .where("type")
    .equals(category.type)
    .filter(
      (item) =>
        item.id !== id &&
        item.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase()
    )
    .first()
  if (duplicate) throw new Error("A category with this name already exists.")
  const updated = await db.categories.update(id, { name: name.trim() })
  if (!updated) throw new Error("Category was not found.")
}

export async function deleteCategory(id: string) {
  const db = getFinanceDatabase()
  if (!db) throw new Error("Local storage is unavailable.")
  const category = await db.categories.get(id)
  if (!category?.isCustom) {
    throw new Error("Only custom categories can be deleted.")
  }

  const [transactionCount, budgetCount] = await Promise.all([
    db.transactions.where("categoryId").equals(id).count(),
    db.budgets.where("categoryId").equals(id).count(),
  ])
  if (transactionCount > 0 || budgetCount > 0) {
    throw new Error(
      "This category is used by transactions or budgets. Reassign or remove them first."
    )
  }
  await db.categories.delete(id)
}

export async function saveBudget(categoryId: string, amount: number) {
  const db = getFinanceDatabase()
  if (!db) throw new Error("Local storage is unavailable.")
  const month = monthKey(new Date())
  await db.budgets.put({
    id: `${month}:${categoryId}`,
    categoryId,
    amount,
    month,
    updatedAt: Date.now(),
  })
}

export async function deleteBudget(categoryId: string, month: string) {
  const db = getFinanceDatabase()
  if (!db) throw new Error("Local storage is unavailable.")
  await db.budgets
    .where("[month+categoryId]")
    .equals([month, categoryId])
    .delete()
}

export async function clearDemoTransactions() {
  const db = getFinanceDatabase()
  if (!db) return
  await db.transactions.filter((item) => item.isDemo === true).delete()
}

export const localFinanceRepository: FinanceRepository = {
  storage: "device",
  load: async () => ({
    transactions: await listTransactions(),
    categories: await listCategories(),
    budgets: await listBudgets(),
  }),
  addTransaction,
  updateTransaction,
  deleteTransaction,
  createCategory,
  updateCategory,
  deleteCategory,
  saveBudget,
  deleteBudget,
  clearDemoTransactions,
}
