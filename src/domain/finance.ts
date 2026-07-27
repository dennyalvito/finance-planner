export type TransactionType = "income" | "expense"

export type Category = {
  id: string
  name: string
  type: TransactionType
  isCustom: boolean
}

export type FinanceTransaction = {
  id: string
  type: TransactionType
  amount: number
  categoryId: string
  date: string
  note: string
  createdAt: number
  isDemo?: boolean
}

export type NewTransaction = Omit<
  FinanceTransaction,
  "id" | "createdAt" | "isDemo"
>

export type Budget = {
  id: string
  categoryId: string
  amount: number
  month: string
  updatedAt: number
}

export type LedgerSummary = {
  income: number
  expenses: number
  net: number
  savingsRate: number
}

export type CashFlowPoint = {
  key: string
  label: string
  income: number
  expense: number
}

export type CategorySpending = {
  categoryId: string
  name: string
  value: number
}

export type CategoryCashFlow = CategorySpending & {
  type: TransactionType
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompactRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

export function summarizeLedger(
  transactions: FinanceTransaction[]
): LedgerSummary {
  const income = transactions.reduce(
    (total, transaction) =>
      transaction.type === "income" ? total + transaction.amount : total,
    0
  )
  const expenses = transactions.reduce(
    (total, transaction) =>
      transaction.type === "expense" ? total + transaction.amount : total,
    0
  )

  return {
    income,
    expenses,
    net: income - expenses,
    savingsRate: income > 0 ? ((income - expenses) / income) * 100 : 0,
  }
}

export function monthKey(date: Date | string) {
  const value = typeof date === "string" ? new Date(`${date}T00:00:00`) : date
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`
}

export function buildCashFlowSeries(
  transactions: FinanceTransaction[],
  count = 6,
  now = new Date()
): CashFlowPoint[] {
  const points = Array.from({ length: count }, (_, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - (count - 1 - index),
      1
    )
    return {
      key: monthKey(date),
      label: date.toLocaleDateString("id-ID", { month: "short" }),
      income: 0,
      expense: 0,
    }
  })
  const byMonth = new Map(points.map((point) => [point.key, point]))

  for (const transaction of transactions) {
    const point = byMonth.get(monthKey(transaction.date))
    if (!point) continue
    point[transaction.type] += transaction.amount
  }

  return points
}

export function buildCategorySpending(
  transactions: FinanceTransaction[],
  categories: Category[]
): CategorySpending[] {
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    if (transaction.type !== "expense") continue
    totals.set(
      transaction.categoryId,
      (totals.get(transaction.categoryId) ?? 0) + transaction.amount
    )
  }

  return [...totals.entries()]
    .map(([categoryId, value]) => ({
      categoryId,
      name:
        categories.find((category) => category.id === categoryId)?.name ??
        "Other",
      value,
    }))
    .sort((left, right) => right.value - left.value)
}

export function buildCategoryCashFlow(
  transactions: FinanceTransaction[],
  categories: Category[]
): CategoryCashFlow[] {
  const totals = new Map<
    string,
    { categoryId: string; type: TransactionType; value: number }
  >()

  for (const transaction of transactions) {
    const key = `${transaction.type}:${transaction.categoryId}`
    const current = totals.get(key)
    totals.set(key, {
      categoryId: transaction.categoryId,
      type: transaction.type,
      value: (current?.value ?? 0) + transaction.amount,
    })
  }

  return [...totals.values()]
    .map((item) => ({
      ...item,
      name:
        categories.find((category) => category.id === item.categoryId)?.name ??
        "Other",
    }))
    .sort((left, right) => right.value - left.value)
}

export function calculateBudgetProgress(
  transactions: FinanceTransaction[],
  budgets: Budget[],
  month = monthKey(new Date())
) {
  const activeBudgets = budgets.filter((budget) => budget.month === month)
  const categoryIds = new Set(activeBudgets.map((budget) => budget.categoryId))
  const limit = activeBudgets.reduce(
    (total, budget) => total + budget.amount,
    0
  )
  const spent = transactions.reduce((total, transaction) => {
    const belongsToBudget =
      transaction.type === "expense" &&
      monthKey(transaction.date) === month &&
      categoryIds.has(transaction.categoryId)
    return belongsToBudget ? total + transaction.amount : total
  }, 0)

  return {
    limit,
    spent,
    remaining: Math.max(limit - spent, 0),
    percentage: limit > 0 ? Math.min((spent / limit) * 100, 100) : 0,
    configured: activeBudgets.length > 0,
  }
}
