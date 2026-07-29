import { useState } from "react"
import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/auth-provider"

function GoogleIcon(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 18 18" {...props}>
      <path
        fill="#4285f4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.614"
      />
      <path
        fill="#34a853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18"
      />
      <path
        fill="#fbbc05"
        d="M3.963 10.706A5.4 5.4 0 0 1 3.682 9c0-.592.102-1.167.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.45.347 2.824.956 4.038z"
      />
      <path
        fill="#ea4335"
        d="M9 3.58c1.322 0 2.508.454 3.442 1.345l2.582-2.582C13.463.89 11.43 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58"
      />
    </svg>
  )
}

export function GoogleSignInButton() {
  const { configured, signInWithGoogle } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()

  if (!configured) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Google sign-in is not configured for this environment.
      </p>
    )
  }

  const handleSignIn = async () => {
    setSubmitting(true)
    setErrorMessage(undefined)

    try {
      await signInWithGoogle()
    } catch (error) {
      setSubmitting(false)
      setErrorMessage(
        error instanceof Error ? error.message : "Google sign-in failed."
      )
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={submitting}
        onClick={() => void handleSignIn()}
      >
        {submitting ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <GoogleIcon aria-hidden="true" data-icon="inline-start" />
        )}
        {submitting ? "Opening Google…" : "Continue with Google"}
      </Button>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
