import { describe, expect, it, vi } from "vitest"

import { loadAccountDataWithRetry } from "@/features/finance/account-data-loader"

describe("loadAccountDataWithRetry", () => {
  it("keeps loading through transient startup failures", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValue("loaded")
    const wait = vi.fn(async () => undefined)

    await expect(
      loadAccountDataWithRetry({
        load,
        canRetry: () => true,
        retryDelays: [500, 1_500],
        wait,
      })
    ).resolves.toBe("loaded")

    expect(load).toHaveBeenCalledTimes(3)
    expect(wait).toHaveBeenNthCalledWith(1, 500)
    expect(wait).toHaveBeenNthCalledWith(2, 1_500)
  })

  it("surfaces a persistent failure after the retry budget", async () => {
    const error = new Error("persistent failure")
    const load = vi.fn<() => Promise<never>>().mockRejectedValue(error)

    await expect(
      loadAccountDataWithRetry({
        load,
        canRetry: () => true,
        retryDelays: [0, 0],
        wait: async () => undefined,
      })
    ).rejects.toBe(error)

    expect(load).toHaveBeenCalledTimes(3)
  })

  it("stops retrying when the account or connectivity changes", async () => {
    const error = new Error("cancelled failure")
    const load = vi.fn<() => Promise<never>>().mockRejectedValue(error)
    let active = true

    await expect(
      loadAccountDataWithRetry({
        load,
        canRetry: () => active,
        retryDelays: [500, 1_500],
        wait: async () => {
          active = false
        },
      })
    ).rejects.toBe(error)

    expect(load).toHaveBeenCalledOnce()
  })
})
