import Dexie from "dexie"
import type { EntityTable } from "dexie"

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

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function offsetDate(monthOffset: number, day: number) {
  const now = new Date()
  return toDateInput(
    new Date(now.getFullYear(), now.getMonth() + monthOffset, day)
  )
}

function demoTransactions(): FinanceTransaction[] {
  const now = Date.now()
  return [
    {
      id: "demo-salary-current",
      type: "income",
      amount: 12_500_000,
      categoryId: "salary",
      date: offsetDate(0, 1),
      note: "Monthly salary",
      createdAt: now - 6,
      isDemo: true,
    },
    {
      id: "demo-housing-current",
      type: "expense",
      amount: 3_200_000,
      categoryId: "housing",
      date: offsetDate(0, 3),
      note: "Rent",
      createdAt: now - 5,
      isDemo: true,
    },
    {
      id: "demo-food-current",
      type: "expense",
      amount: 680_000,
      categoryId: "food",
      date: offsetDate(0, 8),
      note: "Groceries and lunch",
      createdAt: now - 4,
      isDemo: true,
    },
    {
      id: "demo-transport-current",
      type: "expense",
      amount: 275_000,
      categoryId: "transport",
      date: offsetDate(0, 12),
      note: "Commuting",
      createdAt: now - 3,
      isDemo: true,
    },
    {
      id: "demo-income-previous",
      type: "income",
      amount: 11_800_000,
      categoryId: "salary",
      date: offsetDate(-1, 1),
      note: "Monthly salary",
      createdAt: now - 2,
      isDemo: true,
    },
    {
      id: "demo-expense-previous",
      type: "expense",
      amount: 4_860_000,
      categoryId: "shopping",
      date: offsetDate(-1, 16),
      note: "Monthly expenses",
      createdAt: now - 1,
      isDemo: true,
    },
  ]
}

function makeId(prefix: string) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

export async function ensureFinanceSeed() {
  const db = getFinanceDatabase()
  if (!db) return
  const seeded = await db.settings.get("seeded")
  if (seeded) return

  await db.transaction(
    "rw",
    db.categories,
    db.transactions,
    db.settings,
    async () => {
      await db.categories.bulkPut(builtInCategories)
      await db.transactions.bulkPut(demoTransactions())
      await db.settings.put({ key: "seeded", value: "1" })
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

export async function clearDemoTransactions() {
  const db = getFinanceDatabase()
  if (!db) return
  await db.transactions.filter((item) => item.isDemo === true).delete()
}
