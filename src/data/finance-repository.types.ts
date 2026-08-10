import type {
  Budget,
  Category,
  FinanceTransaction,
  NewTransaction,
  TransactionType,
} from "@/domain/finance"

export type FinanceSnapshot = {
  transactions: FinanceTransaction[]
  categories: Category[]
  budgets: Budget[]
}

export type FinanceRepository = {
  storage: "device" | "cloud"
  load: () => Promise<FinanceSnapshot>
  addTransaction: (transaction: NewTransaction) => Promise<void>
  updateTransaction: (id: string, transaction: NewTransaction) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  createCategory: (name: string, type: TransactionType) => Promise<Category>
  updateCategory: (id: string, name: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  saveBudget: (categoryId: string, amount: number) => Promise<void>
  deleteBudget: (categoryId: string, month: string) => Promise<void>
  clearDemoTransactions: () => Promise<void>
}
