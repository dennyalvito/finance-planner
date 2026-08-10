import { useState } from "react"
import { LogOutIcon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"

type GuardedSignOutDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingCount: number
  isOnline: boolean
  onSync: () => Promise<number>
  onDiscardAndSignOut: () => Promise<void>
}

export function GuardedSignOutDialog({
  open,
  onOpenChange,
  pendingCount,
  isOnline,
  onSync,
  onDiscardAndSignOut,
}: GuardedSignOutDialogProps) {
  const [working, setWorking] = useState<"sync" | "discard">()

  async function syncChanges() {
    setWorking("sync")
    try {
      const remaining = await onSync()
      if (remaining === 0) {
        onOpenChange(false)
      } else {
        toast.error("Some changes still need attention", {
          description: `${remaining} ${remaining === 1 ? "change remains" : "changes remain"} on this device.`,
        })
      }
    } finally {
      setWorking(undefined)
    }
  }

  async function discardChanges() {
    setWorking("discard")
    try {
      await onDiscardAndSignOut()
      onOpenChange(false)
    } catch (error) {
      toast.error("Could not sign out", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setWorking(undefined)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <TriangleAlertIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>Pending changes will be lost</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingCount} {pendingCount === 1 ? "change is" : "changes are"}{" "}
            stored only on this device. Discarding them signs you out without
            sending them to your Coin account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={working !== undefined}>
            Stay signed in
          </AlertDialogCancel>
          {isOnline && (
            <AlertDialogAction
              variant="outline"
              disabled={working !== undefined}
              onClick={(event) => {
                event.preventDefault()
                void syncChanges()
              }}
            >
              {working === "sync" && <Spinner data-icon="inline-start" />}
              Sync changes
            </AlertDialogAction>
          )}
          <AlertDialogAction
            variant="destructive"
            disabled={working !== undefined}
            onClick={(event) => {
              event.preventDefault()
              void discardChanges()
            }}
          >
            {working === "discard" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <LogOutIcon data-icon="inline-start" />
            )}
            Discard and sign out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
