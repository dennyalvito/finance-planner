import { describe, expect, it } from "vitest"

import {
  financeIssueFrom,
  isEmptyCloudSnapshot,
  safeFinanceError,
} from "@/features/finance/finance-reliability"

describe("finance reliability messages", () => {
  it("uses a safe offline message for failed cloud loads", () => {
    const issue = financeIssueFrom("load", false)

    expect(issue).toEqual({
      source: "load",
      kind: "offline",
      title: "Account data needs a connection",
      message: "Reconnect to load your signed-in account data.",
    })
  })

  it("uses a safe mutation error without backend details", () => {
    const issue = financeIssueFrom("mutation", true)
    const error = safeFinanceError(issue)

    expect(error.message).toBe(
      "Your account was not updated. Review the form and try again."
    )
    expect(error.message).not.toContain("supabase")
    expect(error.message).not.toContain("http")
  })
})

describe("empty cloud workspace detection", () => {
  it("treats built-in categories without finance rows as an empty workspace", () => {
    expect(
      isEmptyCloudSnapshot({
        transactions: [],
        budgets: [],
        categories: [
          {
            id: "food",
            name: "Food & dining",
            type: "expense",
            isCustom: false,
          },
        ],
      })
    ).toBe(true)
  })

  it("treats a custom category as meaningful cloud data", () => {
    expect(
      isEmptyCloudSnapshot({
        transactions: [],
        budgets: [],
        categories: [
          {
            id: "category-personal",
            name: "Pet care",
            type: "expense",
            isCustom: true,
          },
        ],
      })
    ).toBe(false)
  })
})
