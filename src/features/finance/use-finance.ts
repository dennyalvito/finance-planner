import { useEffect } from "react"
import { useLiveQuery } from "dexie-react-hooks"

import {
  addTransaction,
  clearDemoTransactions,
  createCategory,
  deleteTransaction,
  ensureFinanceSeed,
  listBudgets,
  listCategories,
  listTransactions,
  saveBudget,
} from "@/data/finance-repository"

export function useFinance() {
  useEffect(() => {
    void ensureFinanceSeed()
  }, [])

  const transactions = useLiveQuery(listTransactions, [], [])
  const categories = useLiveQuery(listCategories, [], [])
  const budgets = useLiveQuery(listBudgets, [], [])

  return {
    transactions,
    categories,
    budgets,
    addTransaction,
    createCategory,
    deleteTransaction,
    saveBudget,
    clearDemoTransactions,
  }
}
