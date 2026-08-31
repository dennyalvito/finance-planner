import type { FinanceSnapshot } from "@/data/finance-repository.types"

export type FinanceIssueSource = "load" | "mutation"
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
          title: "Account data needs a connection",
          message: "Reconnect to load your signed-in account data.",
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
        title: "Account data could not be loaded",
        message:
          "Your data is safe. Check your connection and try loading it again.",
      }
    : {
        source,
        kind: "request",
        title: "Change was not saved",
        message: "Your account was not updated. Review the form and try again.",
      }
}

export function safeFinanceError(issue: FinanceIssue) {
  return new Error(issue.message)
}
