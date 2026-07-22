import { describe, expect, it } from "vitest"

import {
  buildCashFlowSeries,
  buildCategorySpending,
  calculateBudgetProgress,
  summarizeLedger,
} from "@/domain/finance"
import type { Budget, Category, FinanceTransaction } from "@/domain/finance"

function transaction(
  overrides: Partial<FinanceTransaction>
): FinanceTransaction {
  return {
    id: "transaction-1",
    type: "expense",
    amount: 100_000,
    categoryId: "food",
    date: "2026-07-12",
    note: "",
    createdAt: 1,
    ...overrides,
  }
}

describe("finance domain", () => {
  it("derives net recorded cash flow from income and expenses", () => {
    const summary = summarizeLedger([
      transaction({ type: "income", amount: 5_000_000 }),
      transaction({ id: "transaction-2", amount: 1_250_000 }),
    ])

    expect(summary).toEqual({
      income: 5_000_000,
      expenses: 1_250_000,
      net: 3_750_000,
      savingsRate: 75,
    })
  })

  it("builds a stable six-month cash-flow series", () => {
    const series = buildCashFlowSeries(
      [
        transaction({ type: "income", amount: 4_000_000 }),
        transaction({ id: "transaction-2", date: "2026-06-08" }),
      ],
      2,
      new Date(2026, 6, 21)
    )

    expect(
      series.map(({ key, income, expense }) => ({
        key,
        income,
        expense,
      }))
    ).toEqual([
      { key: "2026-06", income: 0, expense: 100_000 },
      { key: "2026-07", income: 4_000_000, expense: 0 },
    ])
  })

  it("sorts expense categories by recorded spending", () => {
    const categories: Category[] = [
      { id: "food", name: "Food", type: "expense", isCustom: false },
      {
        id: "transport",
        name: "Transport",
        type: "expense",
        isCustom: false,
      },
    ]

    const spending = buildCategorySpending(
      [
        transaction({ amount: 200_000 }),
        transaction({ id: "transaction-2", categoryId: "transport" }),
      ],
      categories
    )

    expect(spending.map((item) => item.categoryId)).toEqual([
      "food",
      "transport",
    ])
  })

  it("keeps an absent budget distinct from a zero limit", () => {
    const result = calculateBudgetProgress([transaction({})], [], "2026-07")

    expect(result.configured).toBe(false)
    expect(result.limit).toBe(0)
    expect(result.percentage).toBe(0)
  })

  it("counts only spending in configured categories and month", () => {
    const budgets: Budget[] = [
      {
        id: "2026-07:food",
        categoryId: "food",
        month: "2026-07",
        amount: 500_000,
        updatedAt: 1,
      },
    ]
    const result = calculateBudgetProgress(
      [
        transaction({ amount: 200_000 }),
        transaction({ id: "transaction-2", categoryId: "transport" }),
        transaction({ id: "transaction-3", date: "2026-06-12" }),
      ],
      budgets,
      "2026-07"
    )

    expect(result).toMatchObject({
      configured: true,
      limit: 500_000,
      spent: 200_000,
      remaining: 300_000,
      percentage: 40,
    })
  })
})
