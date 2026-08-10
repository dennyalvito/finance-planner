import { useEffect, useState } from "react"
import {
  CloudUploadIcon,
  GitCompareArrowsIcon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import type { AccountRecord, SyncConflict } from "@/data/account-finance.types"
import { formatRupiah } from "@/domain/finance"

type SyncStatusProps = {
  pendingCount: number
  conflicts: SyncConflict[]
  isOnline: boolean
  isRefreshing: boolean
  onSync: () => Promise<unknown>
  onUseCloud: (conflict: SyncConflict) => Promise<void>
  onUseDevice: (conflict: SyncConflict) => Promise<void>
}

function recordFields(record: AccountRecord | null) {
  if (!record) return [["Status", "No cloud record"]] as const
  if (record.deletedAt !== undefined) {
    return [["Status", "Deleted in cloud"]] as const
  }
  if ("isCustom" in record) {
    return [
      ["Name", record.name],
      ["Type", record.type === "expense" ? "Expense" : "Income"],
    ] as const
  }
  if ("date" in record) {
    return [
      ["Amount", formatRupiah(record.amount)],
      ["Date", record.date],
      ["Category", record.categoryId],
      ["Note", record.note || "No note"],
    ] as const
  }
  return [
    ["Limit", formatRupiah(record.amount)],
    ["Month", record.month],
    ["Category", record.categoryId],
  ] as const
}

function VersionCard({
  title,
  description,
  record,
  destructive,
}: {
  title: string
  description: string
  record: AccountRecord | null
  destructive?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <Badge variant={destructive ? "destructive" : "secondary"}>
            {record?.deletedAt !== undefined || !record ? "Deleted" : "Active"}
          </Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {recordFields(record).map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-right text-sm font-medium">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function conflictTitle(conflict: SyncConflict) {
  if (conflict.operation.entity === "category") return "Category conflict"
  if (conflict.operation.entity === "budget") return "Budget conflict"
  return "Transaction conflict"
}

export function SyncStatus({
  pendingCount,
  conflicts,
  isOnline,
  isRefreshing,
  onSync,
  onUseCloud,
  onUseDevice,
}: SyncStatusProps) {
  const [conflictsOpen, setConflictsOpen] = useState(false)
  const [resolving, setResolving] = useState(false)
  const conflict = conflicts.at(0)

  useEffect(() => {
    if (conflicts.length === 0) setConflictsOpen(false)
  }, [conflicts.length])

  async function resolve(action: "cloud" | "device") {
    if (!conflict) return
    setResolving(true)
    try {
      await (action === "cloud" ? onUseCloud(conflict) : onUseDevice(conflict))
      toast.success("Sync conflict resolved")
    } catch (error) {
      toast.error("Could not resolve conflict", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setResolving(false)
    }
  }

  const remoteDeleted =
    conflict?.remoteRecord === null ||
    conflict?.remoteRecord.deletedAt !== undefined
  const deviceDeletes = conflict?.operation.action === "delete"
  const cloudLabel =
    conflict?.reason === "category-in-use"
      ? "Keep category"
      : conflict?.reason === "category-unavailable" &&
          conflict.remoteRecord === null
        ? "Discard pending record"
        : remoteDeleted
          ? "Keep cloud deletion"
          : "Use cloud version"
  const deviceLabel = deviceDeletes
    ? "Delete updated record"
    : remoteDeleted
      ? "Restore edited version"
      : "Keep this device"

  return (
    <>
      {conflicts.length > 0 ? (
        <Alert variant="destructive">
          <GitCompareArrowsIcon />
          <AlertTitle>
            {conflicts.length} sync{" "}
            {conflicts.length === 1 ? "conflict" : "conflicts"}
          </AlertTitle>
          <AlertDescription>
            Coin needs your choice for records changed on more than one device.
          </AlertDescription>
          <AlertAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConflictsOpen(true)}
            >
              Review conflicts
            </Button>
          </AlertAction>
        </Alert>
      ) : pendingCount > 0 ? (
        <Alert>
          <CloudUploadIcon />
          <AlertTitle>
            {pendingCount} {pendingCount === 1 ? "change" : "changes"} waiting
            to sync
          </AlertTitle>
          <AlertDescription>
            {isOnline
              ? "Your changes are safe on this device while Coin updates the cloud."
              : "Your changes are safe on this device and will sync when Coin is online."}
          </AlertDescription>
          <AlertAction>
            <Button
              variant="outline"
              size="sm"
              disabled={!isOnline || isRefreshing}
              onClick={() => void onSync()}
            >
              {isRefreshing ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              {isRefreshing ? "Syncing..." : "Sync now"}
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      <Dialog open={conflictsOpen} onOpenChange={setConflictsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {conflict ? conflictTitle(conflict) : "Sync conflicts"}
            </DialogTitle>
            <DialogDescription>
              {conflict?.reason === "category-in-use"
                ? "Transactions or budgets from another device now use this category, so Coin cannot delete it."
                : conflict?.reason === "category-unavailable"
                  ? "This pending record uses a category deleted on another device. Change or remove the local record, or accept the cloud result."
                  : "This record changed after this device went offline. Choose which result Coin should keep."}
            </DialogDescription>
          </DialogHeader>
          {conflict && (
            <div className="grid gap-3 sm:grid-cols-2">
              <VersionCard
                title="This device"
                description="Your pending offline change"
                record={conflict.operation.record}
                destructive={deviceDeletes}
              />
              <VersionCard
                title="Cloud"
                description="The latest synchronized version"
                record={conflict.remoteRecord}
                destructive={remoteDeleted}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={resolving}
              onClick={() => void resolve("cloud")}
            >
              {cloudLabel}
            </Button>
            {conflict?.reason === "category-unavailable" ? (
              <Button
                disabled={resolving}
                onClick={() => setConflictsOpen(false)}
              >
                Close and edit record
              </Button>
            ) : conflict?.reason !== "category-in-use" ? (
              <Button
                disabled={resolving}
                onClick={() => void resolve("device")}
              >
                {resolving && <Spinner data-icon="inline-start" />}
                {deviceLabel}
              </Button>
            ) : null}
          </DialogFooter>
          {conflicts.length > 1 && (
            <p className="text-center text-xs text-muted-foreground">
              {conflicts.length - 1} more{" "}
              {conflicts.length - 1 === 1 ? "conflict" : "conflicts"} after this
              one
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
