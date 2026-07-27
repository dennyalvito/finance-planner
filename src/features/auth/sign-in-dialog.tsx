import { useCallback } from "react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { GoogleSignInButton } from "@/features/auth/google-sign-in-button"

export function SignInDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const handleSuccess = useCallback(() => {
    toast.success("Signed in. Your cloud workspace is ready.")
    onOpenChange(false)
  }, [onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to Coin</DialogTitle>
          <DialogDescription>
            Use Google to open your private cloud workspace. Your guest ledger
            stays unchanged in this browser.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <GoogleSignInButton onSuccess={handleSuccess} />

          <p className="text-xs leading-relaxed text-muted-foreground">
            Coin does not offer email/password signup. You can close this dialog
            to keep using guest mode.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
