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
        hasSnapshot={false}
        onRetry={() => undefined}
      />
    )

    expect(
      screen.getByRole("status", { name: "Loading account data" })
    ).toBeTruthy()

    rerender(
      <CloudWorkspaceStatus
        state="empty"
        issue={null}
        isRefreshing={false}
        hasSnapshot
        onRetry={() => undefined}
      />
    )

    expect(screen.getByText("Your account is ready")).toBeTruthy()
    expect(screen.getByText(/No transactions or budgets yet/)).toBeTruthy()
  })

  it("offers retry after a failed load", () => {
    const onRetry = vi.fn()

    render(
      <CloudWorkspaceStatus
        state="error"
        issue={financeIssueFrom("load", true)}
        isRefreshing={false}
        hasSnapshot={false}
        onRetry={onRetry}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(onRetry).toHaveBeenCalledOnce()
    expect(screen.getByText("Account data could not be loaded")).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/cloud|supabase/i)
  })

  it("makes failed mutations explicit while preserving a refresh action", () => {
    const onRetry = vi.fn()

    render(
      <CloudWorkspaceStatus
        state="ready"
        issue={financeIssueFrom("mutation", true)}
        isRefreshing={false}
        hasSnapshot
        onRetry={onRetry}
      />
    )

    expect(screen.getByText("Change was not saved")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Refresh data" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("keeps a loaded account snapshot visible as read-only while offline", () => {
    render(
      <CloudWorkspaceStatus
        state="offline"
        issue={financeIssueFrom("load", false)}
        isRefreshing={false}
        hasSnapshot
        onRetry={() => undefined}
      />
    )

    expect(screen.getByText("Viewing previously loaded data")).toBeTruthy()
    expect(screen.getByText(/previously loaded data is read-only/)).toBeTruthy()
  })

  it("shows account placeholders after an offline reload", () => {
    render(
      <CloudWorkspaceStatus
        state="offline"
        issue={financeIssueFrom("load", false)}
        isRefreshing={false}
        hasSnapshot={false}
        onRetry={() => undefined}
      />
    )

    expect(screen.getByText("Connect to load your account")).toBeTruthy()
    expect(
      screen.getByLabelText("Account data unavailable offline")
    ).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/cloud|supabase/i)
  })
})
