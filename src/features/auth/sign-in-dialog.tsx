import { useCallback, useState } from "react"
import { ExternalLinkIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/features/auth/auth-provider"
import { GoogleSignInButton } from "@/features/auth/google-sign-in-button"

export function SignInDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const auth = useAuth()
  const [redirecting, setRedirecting] = useState(false)

  const handleSuccess = useCallback(() => {
    toast.success("Signed in. Your cloud workspace is ready.")
    onOpenChange(false)
  }, [onOpenChange])

  const handleRedirect = async () => {
    try {
      setRedirecting(true)
      await auth.signInWithGoogle()
    } catch (error) {
      setRedirecting(false)
      toast.error(
        error instanceof Error ? error.message : "Google sign-in failed."
      )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setRedirecting(false)
        onOpenChange(nextOpen)
      }}
    >
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

          <div className="flex items-center gap-3" aria-hidden="true">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <Button
            variant="outline"
            disabled={redirecting}
            onClick={() => void handleRedirect()}
          >
            <ExternalLinkIcon data-icon="inline-start" />
            {redirecting ? "Redirecting…" : "Use browser redirect instead"}
          </Button>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Coin does not offer email/password signup. You can close this dialog
            to keep using guest mode.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
