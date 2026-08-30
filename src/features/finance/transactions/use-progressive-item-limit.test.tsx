// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useProgressiveItemLimit } from "@/features/finance/transactions/use-progressive-item-limit"

describe("useProgressiveItemLimit", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("mounts a small first batch before progressively revealing a long list", () => {
    vi.useFakeTimers()

    const { result } = renderHook(() => useProgressiveItemLimit(90, true))

    expect(result.current).toBe(18)

    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe(36)

    act(() => vi.advanceTimersByTime(100))
    act(() => vi.advanceTimersByTime(100))
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe(90)
  })

  it("keeps normal page lists fully rendered", () => {
    const { result } = renderHook(() => useProgressiveItemLimit(90, false))

    expect(result.current).toBe(90)
  })
})
