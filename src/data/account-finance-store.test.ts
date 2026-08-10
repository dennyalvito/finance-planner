import "fake-indexeddb/auto"

import { afterEach, describe, expect, it } from "vitest"

import type {
  AccountCategory,
  AccountTransaction,
} from "@/data/account-finance.types"
import {
  clearAccountFinanceDatabase,
  createAccountFinanceRepository,
  getAccountFinanceDatabase,
  listAccountConflicts,
  listSyncOperations,
  loadAccountSnapshot,
  markOperationConflict,
  mergeRemoteSnapshot,
  resolveConflictWithDevice,
  resolveConflictWithCloud,
} from "@/data/account-finance-store"
import { orderSyncOperations } from "@/data/supabase-finance-sync"

const openedUsers = new Set<string>()

function setup() {
  const userId = crypto.randomUUID()
  openedUsers.add(userId)
  const db = getAccountFinanceDatabase(userId)
  return { db, repository: createAccountFinanceRepository(db) }
}

function syncedCategory(
  overrides: Partial<AccountCategory> = {}
): AccountCategory {
  return {
    id: "food",
    name: "Food & dining",
    type: "expense",
    isCustom: false,
    revision: 1,
    serverUpdatedAt: Date.now(),
    ...overrides,
  }
}

function syncedTransaction(
  overrides: Partial<AccountTransaction> = {}
): AccountTransaction {
  return {
    id: "transaction-one",
    type: "expense",
    amount: 100_000,
    categoryId: "food",
    date: "2026-08-10",
    note: "Dinner",
    createdAt: Date.now(),
    revision: 1,
    serverUpdatedAt: Date.now(),
    ...overrides,
  }
}

afterEach(async () => {
  await Promise.all(
    [...openedUsers].map((userId) => clearAccountFinanceDatabase(userId))
  )
  openedUsers.clear()
})

describe("account finance offline outbox", () => {
  it("orders a new category before its dependent transaction and budget", async () => {
    const { db, repository } = setup()
    const category = await repository.createCategory("Pet care", "expense")

    await repository.addTransaction({
      type: "expense",
      amount: 125_000,
      categoryId: category.id,
      date: "2026-08-10",
      note: "Vet",
    })
    await repository.saveBudget(category.id, 1_000_000)

    const operations = orderSyncOperations(await listSyncOperations(db))
    expect(operations.map((operation) => operation.entity)).toEqual([
      "category",
      "transaction",
      "budget",
    ])
    expect((await loadAccountSnapshot(db)).transactions[0]).toMatchObject({
      note: "Vet",
      syncStatus: "pending",
    })
  })

  it("compacts repeated renames into the pending category creation", async () => {
    const { db, repository } = setup()
    const category = await repository.createCategory("Pet care", "expense")

    await repository.updateCategory(category.id, "Pets")
    await repository.updateCategory(category.id, "Pet essentials")

    const operations = await listSyncOperations(db)
    expect(operations).toHaveLength(1)
    expect(operations[0]).toMatchObject({
      entity: "category",
      action: "upsert",
      baseRevision: null,
      record: { name: "Pet essentials" },
    })
  })

  it("cancels an unsynced category creation when the unused category is deleted", async () => {
    const { db, repository } = setup()
    const category = await repository.createCategory("Temporary", "expense")

    await repository.deleteCategory(category.id)

    expect(await listSyncOperations(db)).toHaveLength(0)
    expect((await loadAccountSnapshot(db)).categories).toHaveLength(0)
  })

  it("prevents deleting a custom category used by local records", async () => {
    const { repository } = setup()
    const category = await repository.createCategory("Pet care", "expense")
    await repository.addTransaction({
      type: "expense",
      amount: 50_000,
      categoryId: category.id,
      date: "2026-08-10",
      note: "Food",
    })

    await expect(repository.deleteCategory(category.id)).rejects.toThrow(
      "used by transactions or budgets"
    )
  })

  it("keeps the original cloud revision across repeated offline edits", async () => {
    const { db, repository } = setup()
    await mergeRemoteSnapshot(db, {
      categories: [
        syncedCategory({
          id: "category-pets",
          name: "Pets",
          isCustom: true,
          revision: 4,
        }),
      ],
      transactions: [],
      budgets: [],
    })

    await repository.updateCategory("category-pets", "Pet care")
    await repository.updateCategory("category-pets", "Pet essentials")

    expect((await listSyncOperations(db))[0]).toMatchObject({
      baseRevision: 4,
      record: { name: "Pet essentials" },
    })
  })

  it("rebases the device version after a conflict choice", async () => {
    const { db, repository } = setup()
    const remoteV1 = syncedCategory({
      id: "category-pets",
      name: "Pets",
      isCustom: true,
      revision: 1,
    })
    await mergeRemoteSnapshot(db, {
      categories: [remoteV1],
      transactions: [],
      budgets: [],
    })
    await repository.updateCategory(remoteV1.id, "Pet care")
    const operation = (await listSyncOperations(db))[0]
    const remoteV2 = { ...remoteV1, name: "Animals", revision: 2 }

    await markOperationConflict(db, operation, remoteV2)
    const conflict = (await listAccountConflicts(db))[0]
    await resolveConflictWithDevice(db, conflict)

    expect((await listSyncOperations(db))[0]).toMatchObject({
      baseRevision: 2,
      record: { name: "Pet care", syncStatus: "pending" },
    })
  })

  it("replaces a colliding local budget ID when the cloud version wins", async () => {
    const { db, repository } = setup()
    await mergeRemoteSnapshot(db, {
      categories: [syncedCategory()],
      transactions: [],
      budgets: [],
    })
    await repository.saveBudget("food", 750_000)
    const operation = (await listSyncOperations(db))[0]
    if (operation.entity !== "budget")
      throw new Error("Expected budget operation")

    await markOperationConflict(db, operation, {
      id: "cloud-budget",
      categoryId: "food",
      amount: 500_000,
      month: operation.record.month,
      updatedAt: Date.now(),
      revision: 3,
      serverUpdatedAt: Date.now(),
    })
    const conflict = (await listAccountConflicts(db))[0]
    await resolveConflictWithCloud(db, conflict)

    expect((await loadAccountSnapshot(db)).budgets).toEqual([
      expect.objectContaining({ id: "cloud-budget", amount: 500_000 }),
    ])
    expect(await listSyncOperations(db)).toHaveLength(0)
  })

  it("restores a local edit on top of a newer cloud deletion", async () => {
    const { db, repository } = setup()
    const original = syncedTransaction()
    await mergeRemoteSnapshot(db, {
      categories: [syncedCategory()],
      transactions: [original],
      budgets: [],
    })
    await repository.updateTransaction(original.id, {
      type: "expense",
      amount: 125_000,
      categoryId: "food",
      date: "2026-08-10",
      note: "Dinner edited offline",
    })
    const operation = (await listSyncOperations(db))[0]
    await markOperationConflict(db, operation, {
      ...original,
      revision: 2,
      deletedAt: Date.now(),
    })

    await resolveConflictWithDevice(db, (await listAccountConflicts(db))[0])

    expect((await listSyncOperations(db))[0]).toMatchObject({
      action: "upsert",
      baseRevision: 2,
      record: {
        note: "Dinner edited offline",
        deletedAt: undefined,
        syncStatus: "pending",
      },
    })
  })

  it("deletes the latest cloud edit when the device deletion wins", async () => {
    const { db, repository } = setup()
    const original = syncedTransaction()
    await mergeRemoteSnapshot(db, {
      categories: [syncedCategory()],
      transactions: [original],
      budgets: [],
    })
    await repository.deleteTransaction(original.id)
    const operation = (await listSyncOperations(db))[0]
    await markOperationConflict(db, operation, {
      ...original,
      amount: 150_000,
      note: "Edited on device one",
      revision: 2,
    })

    await resolveConflictWithDevice(db, (await listAccountConflicts(db))[0])

    expect((await listSyncOperations(db))[0]).toMatchObject({
      action: "delete",
      baseRevision: 2,
      record: {
        amount: 150_000,
        note: "Edited on device one",
        syncStatus: "pending",
      },
    })
  })

  it("merges different records from two devices without a conflict", async () => {
    const { db, repository } = setup()
    await mergeRemoteSnapshot(db, {
      categories: [syncedCategory()],
      transactions: [],
      budgets: [],
    })
    await repository.addTransaction({
      type: "expense",
      amount: 50_000,
      categoryId: "food",
      date: "2026-08-10",
      note: "Device one",
    })

    await mergeRemoteSnapshot(db, {
      categories: [syncedCategory()],
      transactions: [
        syncedTransaction({ id: "device-two", note: "Device two" }),
      ],
      budgets: [],
    })

    expect((await loadAccountSnapshot(db)).transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ note: "Device one" }),
        expect.objectContaining({ note: "Device two" }),
      ])
    )
  })
})
