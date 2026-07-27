import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/auth-provider"
import {
  generateGoogleNonce,
  getGoogleClientId,
  hashGoogleNonce,
  loadGoogleIdentity,
} from "@/features/auth/google-identity"

type GoogleButtonStatus = "loading" | "ready" | "submitting" | "error"

export function GoogleSignInButton({ onSuccess }: { onSuccess: () => void }) {
  const { signInWithGoogleIdToken } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<GoogleButtonStatus>("loading")
  const [errorMessage, setErrorMessage] = useState<string>()
  const clientId = getGoogleClientId()

  useEffect(() => {
    const container = containerRef.current
    if (!clientId || !container) return

    let active = true

    const initialize = async () => {
      try {
        setStatus("loading")
        setErrorMessage(undefined)

        const identity = await loadGoogleIdentity()
        const nonce = generateGoogleNonce()
        const hashedNonce = await hashGoogleNonce(nonce)

        if (!active) return

        identity.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!active) return

            if (!response.credential) {
              setStatus("error")
              setErrorMessage("Google did not return a sign-in credential.")
              return
            }

            setStatus("submitting")
            void signInWithGoogleIdToken(response.credential, nonce)
              .then(() => {
                if (active) onSuccess()
              })
              .catch((error: unknown) => {
                if (!active) return
                setStatus("error")
                setErrorMessage(
                  error instanceof Error
                    ? error.message
                    : "Google sign-in failed."
                )
              })
          },
          nonce: hashedNonce,
          use_fedcm_for_prompt: true,
        })

        container.replaceChildren()
        identity.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.min(container.clientWidth || 320, 320),
        })
        setStatus("ready")
      } catch (error) {
        if (!active) return
        setStatus("error")
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Google sign-in could not be loaded."
        )
      }
    }

    void initialize()

    return () => {
      active = false
    }
  }, [clientId, onSuccess, signInWithGoogleIdToken])

  if (!clientId) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Google sign-in is not configured for this environment.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative flex min-h-10 w-full justify-center"
        aria-busy={status === "loading" || status === "submitting"}
      >
        {status === "loading" && (
          <Skeleton className="absolute inset-x-auto h-10 w-full max-w-80" />
        )}
        <div
          ref={containerRef}
          data-testid="google-sign-in-button"
          className={
            status === "loading" || status === "submitting"
              ? "invisible flex min-h-10 w-full justify-center"
              : "flex min-h-10 w-full justify-center"
          }
        />
        {status === "submitting" && (
          <Button
            className="absolute inset-x-0 mx-auto w-full max-w-80"
            disabled
          >
            <Spinner data-icon="inline-start" />
            Signing in…
          </Button>
        )}
      </div>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
