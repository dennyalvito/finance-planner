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
  deleteTransaction: (id: string) => Promise<void>
  createCategory: (name: string, type: TransactionType) => Promise<Category>
  saveBudget: (categoryId: string, amount: number) => Promise<void>
  clearDemoTransactions: () => Promise<void>
}
