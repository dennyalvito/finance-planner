const googleIdentityScriptUrl = "https://accounts.google.com/gsi/client"

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleIdConfiguration = {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  nonce: string
  use_fedcm_for_button: boolean
}

type GoogleButtonConfiguration = {
  type: "standard"
  theme: "outline" | "filled_black" | "outline_dark"
  size: "large"
  text: "continue_with"
  shape: "rectangular" | "pill"
  logo_alignment: "left"
  width: number
}

export type GoogleIdentity = {
  initialize: (configuration: GoogleIdConfiguration) => void
  renderButton: (
    parent: HTMLElement,
    configuration: GoogleButtonConfiguration
  ) => void
}

type GoogleIdentityController = {
  identity: GoogleIdentity
  nonce: string
  setCredentialHandler: (
    handler: (response: GoogleCredentialResponse) => void
  ) => () => void
}

type GoogleIdentityRuntime = {
  clientId: string
  nonce: string
  credentialHandler?: (response: GoogleCredentialResponse) => void
  controllerPromise?: Promise<GoogleIdentityController>
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentity
      }
    }
    __coinGoogleIdentityRuntime?: GoogleIdentityRuntime
  }
}

let googleIdentityPromise: Promise<GoogleIdentity> | undefined

export function getGoogleClientId() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ""

  if (
    clientId.startsWith("your-") ||
    !/^[a-zA-Z0-9-]+\.apps\.googleusercontent\.com$/.test(clientId)
  ) {
    return undefined
  }

  return clientId
}

export function generateGoogleNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  )
}

export async function hashGoogleNonce(nonce: string) {
  const encodedNonce = new TextEncoder().encode(nonce)
  const hashBuffer = await crypto.subtle.digest("SHA-256", encodedNonce)

  return Array.from(new Uint8Array(hashBuffer), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

export function loadGoogleIdentity() {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google sign-in is only available in the browser.")
    )
  }

  const loadedIdentity = window.google?.accounts?.id
  if (loadedIdentity) return Promise.resolve(loadedIdentity)

  googleIdentityPromise ??= new Promise<GoogleIdentity>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${googleIdentityScriptUrl}"]`
    )
    const script = existingScript ?? document.createElement("script")

    const handleLoad = () => {
      const identity = window.google?.accounts?.id

      if (!identity) {
        googleIdentityPromise = undefined
        reject(new Error("Google sign-in loaded without its identity API."))
        return
      }

      resolve(identity)
    }

    const handleError = () => {
      googleIdentityPromise = undefined
      reject(new Error("Google sign-in could not be loaded."))
    }

    script.addEventListener("load", handleLoad, { once: true })
    script.addEventListener("error", handleError, { once: true })

    if (!existingScript) {
      script.src = googleIdentityScriptUrl
      script.async = true
      script.defer = true
      document.head.append(script)
    }
  })

  return googleIdentityPromise
}

export function getGoogleIdentityController(clientId: string) {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google sign-in is only available in the browser.")
    )
  }

  const existingRuntime = window.__coinGoogleIdentityRuntime
  if (existingRuntime && existingRuntime.clientId !== clientId) {
    return Promise.reject(
      new Error(
        "The Google client ID changed. Reload the page before signing in."
      )
    )
  }

  const runtime =
    existingRuntime ??
    ({
      clientId,
      nonce: generateGoogleNonce(),
    } satisfies GoogleIdentityRuntime)

  window.__coinGoogleIdentityRuntime = runtime

  runtime.controllerPromise ??= (async () => {
    try {
      const identity = await loadGoogleIdentity()
      const hashedNonce = await hashGoogleNonce(runtime.nonce)

      identity.initialize({
        client_id: clientId,
        callback: (response) => runtime.credentialHandler?.(response),
        nonce: hashedNonce,
        use_fedcm_for_button: false,
      })

      return {
        identity,
        nonce: runtime.nonce,
        setCredentialHandler: (handler) => {
          runtime.credentialHandler = handler

          return () => {
            if (runtime.credentialHandler === handler) {
              runtime.credentialHandler = undefined
            }
          }
        },
      }
    } catch (error) {
      if (window.__coinGoogleIdentityRuntime === runtime) {
        window.__coinGoogleIdentityRuntime = undefined
      }
      throw error
    }
  })()

  return runtime.controllerPromise
}
