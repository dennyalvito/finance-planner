// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { SyncStatus } from "@/features/finance/sync-status"

afterEach(cleanup)

describe("SyncStatus", () => {
  it("keeps routine online synchronization quiet", () => {
    const { rerender } = render(
      <SyncStatus
        pendingCount={1}
        conflicts={[]}
        isOnline
        onUseCloud={async () => undefined}
        onUseDevice={async () => undefined}
      />
    )

    expect(screen.queryByText(/waiting to sync/)).toBeNull()

    rerender(
      <SyncStatus
        pendingCount={1}
        conflicts={[]}
        isOnline={false}
        onUseCloud={async () => undefined}
        onUseDevice={async () => undefined}
      />
    )

    expect(screen.getByText(/waiting to sync/)).toBeTruthy()
    expect(screen.getByText(/will sync when Coin is online/)).toBeTruthy()
  })
})
