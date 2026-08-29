import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

import type { Database, Tables } from "@/data/database.types"
import type { FinanceRepository } from "@/data/finance-repository.types"
import {
  createSupabaseFinanceRepository,
  mapBudgetRow,
  mapCategoryRow,
  mapTransactionRow,
} from "@/data/supabase-finance-repository"
import { selectFinanceRepository } from "@/features/finance/use-finance"

const localRepository = { storage: "device" } as FinanceRepository
const cloudRepository = { storage: "cloud" } as FinanceRepository
const userId = "4b724aed-d2eb-42e9-8d7b-6a5194339fb7"

function createDeleteClient() {
  const chain = {
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: { id: "record-id" }, error: null }),
  }
  chain.delete.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)

  const from = vi.fn().mockReturnValue(chain)
  return {
    chain,
    client: { from } as unknown as SupabaseClient<Database>,
    from,
  }
}

describe("finance repository selection", () => {
  it("waits while auth is loading", () => {
    expect(
      selectFinanceRepository("loading", localRepository, cloudRepository)
    ).toBeUndefined()
  })

  it("selects Dexie for guests and Supabase for signed-in users", () => {
    expect(
      selectFinanceRepository("guest", localRepository, cloudRepository)
    ).toBe(localRepository)
    expect(
      selectFinanceRepository("authenticated", localRepository, cloudRepository)
    ).toBe(cloudRepository)
  })
})

describe("Supabase finance row mapping", () => {
  it("maps database rows into the shared finance domain", () => {
    const category: Tables<"categories"> = {
      id: "food",
      user_id: null,
      name: "Food & dining",
      type: "expense",
      is_custom: false,
      created_at: "2026-07-25T10:00:00.000Z",
    }
    const transaction: Tables<"transactions"> = {
      id: "9a13d26e-eb01-48a8-8dcf-8a1da5c91085",
      user_id: userId,
      type: "expense",
      amount: 125_000,
      category_id: "food",
      date: "2026-07-25",
      note: "Lunch",
      created_at: "2026-07-25T10:00:00.000Z",
    }
    const budget: Tables<"budgets"> = {
      id: "f21fc143-87bb-40fb-ab5e-2537d823fc38",
      user_id: transaction.user_id,
      category_id: "food",
      month: "2026-07-01",
      amount: 2_000_000,
      updated_at: "2026-07-25T11:00:00.000Z",
    }

    expect(mapCategoryRow(category)).toEqual({
      id: "food",
      name: "Food & dining",
      type: "expense",
      isCustom: false,
    })
    expect(mapTransactionRow(transaction)).toMatchObject({
      id: transaction.id,
      amount: 125_000,
      categoryId: "food",
      date: "2026-07-25",
      note: "Lunch",
    })
    expect(mapBudgetRow(budget)).toMatchObject({
      id: budget.id,
      amount: 2_000_000,
      categoryId: "food",
      month: "2026-07",
    })
  })

  it("rejects rupiah values outside JavaScript's safe integer range", () => {
    const row: Tables<"transactions"> = {
      id: "9a13d26e-eb01-48a8-8dcf-8a1da5c91085",
      user_id: userId,
      type: "income",
      amount: Number.MAX_SAFE_INTEGER + 1,
      category_id: "salary",
      date: "2026-07-25",
      note: "",
      created_at: "2026-07-25T10:00:00.000Z",
    }

    expect(() => mapTransactionRow(row)).toThrow(
      "outside the supported rupiah range"
    )
  })
})

describe("Supabase finance deletion", () => {
  it.each([
    [
      "transactions",
      (repository: FinanceRepository) =>
        repository.deleteTransaction("record-id"),
    ],
    [
      "categories",
      (repository: FinanceRepository) => repository.deleteCategory("record-id"),
    ],
    [
      "budgets",
      (repository: FinanceRepository) =>
        repository.deleteBudget("food", "2026-08"),
    ],
  ] as const)("physically deletes %s", async (table, remove) => {
    const { chain, client, from } = createDeleteClient()
    const repository = createSupabaseFinanceRepository(client, userId)

    await remove(repository)

    expect(from).toHaveBeenCalledWith(table)
    expect(chain.delete).toHaveBeenCalledOnce()
  })
})
