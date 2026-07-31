// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { CloudWorkspaceStatus } from "@/features/finance/cloud-workspace-status"
import { financeIssueFrom } from "@/features/finance/finance-reliability"

afterEach(cleanup)

describe("CloudWorkspaceStatus", () => {
  it("distinguishes initial loading from an empty workspace", () => {
    const { rerender } = render(
      <CloudWorkspaceStatus
        state="loading"
        issue={null}
        isRefreshing
        onRetry={() => undefined}
      />
    )

    expect(
      screen.getByRole("status", { name: "Loading cloud workspace" })
    ).toBeTruthy()

    rerender(
      <CloudWorkspaceStatus
        state="empty"
        issue={null}
        isRefreshing={false}
        onRetry={() => undefined}
      />
    )

    expect(screen.getByText("Cloud workspace is ready")).toBeTruthy()
    expect(screen.getByText(/No transactions or budgets yet/)).toBeTruthy()
  })

  it("offers retry after a failed load", () => {
    const onRetry = vi.fn()

    render(
      <CloudWorkspaceStatus
        state="error"
        issue={financeIssueFrom("load", true)}
        isRefreshing={false}
        onRetry={onRetry}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(onRetry).toHaveBeenCalledOnce()
    expect(screen.getByText("Cloud data could not be loaded")).toBeTruthy()
  })

  it("makes failed mutations explicit while preserving a refresh action", () => {
    const onRetry = vi.fn()

    render(
      <CloudWorkspaceStatus
        state="ready"
        issue={financeIssueFrom("mutation", true)}
        isRefreshing={false}
        onRetry={onRetry}
      />
    )

    expect(screen.getByText("Change was not saved")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Refresh data" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
