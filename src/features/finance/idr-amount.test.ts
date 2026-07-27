import { describe, expect, it } from "vitest"

import {
  formatIdrAmountInput,
  parseIdrAmount,
  sanitizeIdrAmount,
} from "@/features/finance/idr-amount"

describe("IDR amount input", () => {
  it("formats whole rupiah with Indonesian thousand separators", () => {
    expect(formatIdrAmountInput("1000000")).toBe("1.000.000")
  })

  it("keeps storage values as integer rupiah", () => {
    expect(parseIdrAmount("1.250.000")).toBe(1_250_000)
    expect(sanitizeIdrAmount("Rp 001.250.000")).toBe("1250000")
  })
})
