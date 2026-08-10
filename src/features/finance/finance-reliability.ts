import type { FinanceSnapshot } from "@/data/finance-repository.types"

export type FinanceIssueSource = "load" | "mutation" | "sync"
export type FinanceIssueKind = "offline" | "request"

export type FinanceIssue = {
  source: FinanceIssueSource
  kind: FinanceIssueKind
  title: string
  message: string
}

export type CloudWorkspaceState =
  "inactive" | "loading" | "empty" | "ready" | "offline" | "error"

function browserIsOnline() {
  return typeof navigator === "undefined" || navigator.onLine
}

export function isEmptyCloudSnapshot(snapshot: FinanceSnapshot) {
  return (
    snapshot.transactions.length === 0 &&
    snapshot.budgets.length === 0 &&
    snapshot.categories.every((category) => !category.isCustom)
  )
}

export function financeIssueFrom(
  source: FinanceIssueSource,
  online = browserIsOnline()
): FinanceIssue {
  if (!online) {
    return source === "load"
      ? {
          source,
          kind: "offline",
          title: "Cloud workspace is offline",
          message:
            "Connect to the internet, then retry to load your cloud workspace.",
        }
      : {
          source,
          kind: "offline",
          title: "Change was not saved",
          message:
            "Coin is offline. Reconnect and try the change again before leaving this page.",
        }
  }

  return source === "load"
    ? {
        source,
        kind: "request",
        title: "Cloud data could not be loaded",
        message:
          "Your cloud workspace was not changed. Retry when your connection is stable.",
      }
    : {
        source,
        kind: "request",
        title: "Change was not saved",
        message:
          "Your cloud workspace was not updated. Review the form and try again.",
      }
}

export function safeFinanceError(issue: FinanceIssue) {
  return new Error(issue.message)
}

export function syncIssueFrom(online = browserIsOnline()): FinanceIssue {
  return online
    ? {
        source: "sync",
        kind: "request",
        title: "Some changes are waiting to sync",
        message:
          "Your changes are safe on this device. Coin will retry when the cloud connection is available.",
      }
    : {
        source: "sync",
        kind: "offline",
        title: "Working offline",
        message:
          "Changes are saved on this device and will sync when Coin is open and online.",
      }
}
