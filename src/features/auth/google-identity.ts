const googleIdentityScriptUrl = "https://accounts.google.com/gsi/client"

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleIdConfiguration = {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  nonce: string
  use_fedcm_for_prompt: boolean
}

type GoogleButtonConfiguration = {
  type: "standard"
  theme: "outline"
  size: "large"
  text: "continue_with"
  shape: "rectangular"
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

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentity
      }
    }
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
