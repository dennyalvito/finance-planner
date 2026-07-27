import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/auth-provider"
import {
  getGoogleClientId,
  getGoogleIdentityController,
} from "@/features/auth/google-identity"
import { cn } from "@/lib/utils"

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
    let releaseCredentialHandler: (() => void) | undefined
    let releaseButtonLoadHandler: (() => void) | undefined
    let readyFallback: number | undefined

    const initialize = async () => {
      try {
        setStatus("loading")
        setErrorMessage(undefined)

        const controller = await getGoogleIdentityController(clientId)

        if (!active) return

        releaseCredentialHandler = controller.setCredentialHandler(
          (response) => {
            if (!active) {
              return
            }

            if (!response.credential) {
              setStatus("error")
              setErrorMessage("Google did not return a sign-in credential.")
              return
            }

            setStatus("submitting")
            void signInWithGoogleIdToken(response.credential, controller.nonce)
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
          }
        )

        container.replaceChildren()
        controller.identity.renderButton(container, {
          type: "standard",
          theme: "outline_dark",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.min(container.clientWidth || 320, 400),
        })

        const markReady = () => {
          if (readyFallback !== undefined) {
            window.clearTimeout(readyFallback)
            readyFallback = undefined
          }
          if (active) setStatus("ready")
        }
        const iframe = container.querySelector("iframe")

        if (iframe) {
          iframe.style.display = "block"
          iframe.style.width = "100%"
          iframe.style.height = "40px"
          iframe.style.backgroundColor = "transparent"
          iframe.style.colorScheme = "dark"
          iframe.addEventListener("load", markReady, { once: true })
          releaseButtonLoadHandler = () =>
            iframe.removeEventListener("load", markReady)
          readyFallback = window.setTimeout(markReady, 1_500)
        } else {
          markReady()
        }
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
      releaseCredentialHandler?.()
      releaseButtonLoadHandler?.()
      if (readyFallback !== undefined) window.clearTimeout(readyFallback)
      container.replaceChildren()
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
        className="relative mx-auto flex h-10 w-full max-w-[400px] justify-center overflow-hidden bg-muted"
        aria-busy={status === "loading" || status === "submitting"}
      >
        {status === "loading" && (
          <Skeleton className="absolute inset-0 h-10 w-full" />
        )}
        <div
          ref={containerRef}
          data-testid="google-sign-in-button"
          className={cn(
            "flex h-10 w-full justify-center transition-opacity duration-150",
            status === "loading" || status === "submitting"
              ? "pointer-events-none opacity-0"
              : "opacity-100"
          )}
        />
        {status === "submitting" && (
          <Button className="absolute inset-0 w-full" disabled>
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
