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
  onRetry: () => void
}

function LoadingCloudWorkspace() {
  return (
    <div
      className="flex flex-col gap-4"
      aria-label="Loading cloud workspace"
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

  if (state === "error" || (state === "offline" && issue?.source === "load")) {
    const offline = state === "offline"

    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {offline ? <WifiOffIcon /> : <CloudAlertIcon />}
          </EmptyMedia>
          <EmptyTitle>
            {issue?.title ?? "Cloud data could not be loaded"}
          </EmptyTitle>
          <EmptyDescription>
            {issue?.message ??
              "Your cloud workspace was not changed. Retry when your connection is stable."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onRetry} disabled={isRefreshing || offline}>
            {isRefreshing ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            {isRefreshing ? "Retrying..." : "Retry"}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  if (state === "empty") {
    return (
      <Alert>
        <CloudIcon />
        <AlertTitle>Cloud workspace is ready</AlertTitle>
        <AlertDescription>
          No transactions or budgets yet. Add your first record when you are
          ready.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert>
      <WifiOffIcon />
      <AlertTitle>{issue?.title ?? "Cloud workspace is offline"}</AlertTitle>
      <AlertDescription>
        {issue?.message ??
          "Existing data remains visible, but cloud changes need an internet connection."}
      </AlertDescription>
    </Alert>
  )
}
