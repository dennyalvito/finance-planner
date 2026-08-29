import { CircleDollarSignIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { GoogleSignInButton } from "@/features/auth/google-sign-in-button"
import { useIsMobile } from "@/hooks/use-mobile"

function CoinMark() {
  return (
    <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
      <CircleDollarSignIcon aria-hidden="true" className="size-6" />
    </span>
  )
}

function SignInActions({
  onContinueAsGuest,
}: {
  onContinueAsGuest: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <GoogleSignInButton />
      <Button type="button" variant="ghost" onClick={onContinueAsGuest}>
        Continue as guest
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Your guest ledger remains safely on this device.
      </p>
    </div>
  )
}

export function SignInDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isMobile = useIsMobile()

  const handleContinueAsGuest = () => {
    onOpenChange(false)
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="items-center gap-2 px-6 pt-5">
            <CoinMark />
            <DrawerTitle>Open your cloud workspace</DrawerTitle>
            <DrawerDescription className="max-w-xs">
              Sign in to access your transactions, budgets, and categories
              across devices.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <SignInActions onContinueAsGuest={handleContinueAsGuest} />
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center gap-2 px-4 pt-2 text-center">
          <CoinMark />
          <DialogTitle>Open your cloud workspace</DialogTitle>
          <DialogDescription className="max-w-xs">
            Sign in to access your transactions, budgets, and categories across
            devices.
          </DialogDescription>
        </DialogHeader>

        <SignInActions onContinueAsGuest={handleContinueAsGuest} />
      </DialogContent>
    </Dialog>
  )
}
