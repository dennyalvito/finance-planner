import {
  CloudAlertIcon,
  CloudIcon,
  RefreshCwIcon,
  WifiOffIcon,
} from "lucide-react"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import type {
  CloudWorkspaceState,
  FinanceIssue,
} from "@/features/finance/finance-reliability"

type CloudWorkspaceStatusProps = {
  state: CloudWorkspaceState
  issue: FinanceIssue | null
  isRefreshing: boolean
  hasSnapshot: boolean
  onRetry: () => void
}

function LoadingCloudWorkspace() {
  return (
    <div
      className="flex flex-col gap-4"
      aria-label="Loading account data"
      role="status"
    >
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

export function CloudWorkspaceStatus({
  state,
  issue,
  isRefreshing,
  hasSnapshot,
  onRetry,
}: CloudWorkspaceStatusProps) {
  if (issue?.source === "mutation") {
    return (
      <Alert variant="destructive">
        <CloudAlertIcon />
        <AlertTitle>{issue.title}</AlertTitle>
        <AlertDescription>{issue.message}</AlertDescription>
        <AlertAction>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRefreshing || state === "offline"}
          >
            {isRefreshing ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            {isRefreshing ? "Retrying..." : "Refresh data"}
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (state === "inactive" || state === "ready") return null

  if (state === "loading") {
    return <LoadingCloudWorkspace />
  }

  if ((state === "error" || state === "offline") && !hasSnapshot) {
    const offline = state === "offline"

    return (
      <div className="flex flex-col gap-5">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {offline ? <WifiOffIcon /> : <CloudAlertIcon />}
            </EmptyMedia>
            <EmptyTitle>
              {offline
                ? "Connect to load your account"
                : (issue?.title ?? "Account data could not be loaded")}
            </EmptyTitle>
            <EmptyDescription>
              {offline
                ? "Coin can open offline, but signed-in data needs a connection. Guest data remains available on this device."
                : (issue?.message ??
                  "Your data is safe. Check your connection and try loading it again.")}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={onRetry} disabled={isRefreshing || offline}>
              {isRefreshing ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              {isRefreshing
                ? "Retrying..."
                : offline
                  ? "Waiting for connection"
                  : "Retry"}
            </Button>
          </EmptyContent>
        </Empty>
        <div
          className="grid gap-4 sm:grid-cols-2"
          aria-label="Account data unavailable offline"
        >
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  if (state === "empty") {
    return (
      <Alert>
        <CloudIcon />
        <AlertTitle>Your account is ready</AlertTitle>
        <AlertDescription>
          No transactions or budgets yet. Add your first record when you are
          ready.
        </AlertDescription>
      </Alert>
    )
  }

  if (state === "offline") {
    return (
      <Alert>
        <WifiOffIcon />
        <AlertTitle>Viewing previously loaded data</AlertTitle>
        <AlertDescription>
          Coin is offline. This previously loaded data is read-only and will
          refresh when the connection returns.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert>
      <CloudAlertIcon />
      <AlertTitle>
        {issue?.title ?? "Account data could not be refreshed"}
      </AlertTitle>
      <AlertDescription>
        {issue?.message ??
          "The previously loaded account data remains visible. Retry when your connection is stable."}
      </AlertDescription>
      <AlertAction>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RefreshCwIcon data-icon="inline-start" />
          )}
          {isRefreshing ? "Retrying..." : "Retry"}
        </Button>
      </AlertAction>
    </Alert>
  )
}
