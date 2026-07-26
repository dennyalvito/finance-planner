import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { Session, User } from "@supabase/supabase-js"

import { getSupabaseClient, isSupabaseConfigured } from "@/utils/supabase"

export type AuthStatus = "loading" | "guest" | "authenticated"

type AuthContextValue = {
  status: AuthStatus
  user: User | null
  configured: boolean
  signInWithGoogle: () => Promise<void>
  signInWithGoogleIdToken: (token: string, nonce: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function authState(session: Session | null) {
  return {
    status: session ? ("authenticated" as const) : ("guest" as const),
    user: session?.user ?? null,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured()
  const [state, setState] = useState<{
    status: AuthStatus
    user: User | null
  }>({
    status: configured ? "loading" : "guest",
    user: null,
  })

  useEffect(() => {
    const client = getSupabaseClient()

    if (!client) {
      setState({ status: "guest", user: null })
      return
    }

    let active = true
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setState(authState(session))
    })

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      setState(error ? authState(null) : authState(data.session))
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const client = getSupabaseClient()
    if (!client) {
      throw new Error("Cloud storage is not configured.")
    }

    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) throw error
  }, [])

  const signInWithGoogleIdToken = useCallback(
    async (token: string, nonce: string) => {
      const client = getSupabaseClient()
      if (!client) {
        throw new Error("Cloud storage is not configured.")
      }

      const { error } = await client.auth.signInWithIdToken({
        provider: "google",
        token,
        nonce,
      })

      if (error) throw error
    },
    []
  )

  const signOut = useCallback(async () => {
    const client = getSupabaseClient()
    if (!client) return

    const { error } = await client.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      configured,
      signInWithGoogle,
      signInWithGoogleIdToken,
      signOut,
    }),
    [configured, signInWithGoogle, signInWithGoogleIdToken, signOut, state]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.")
  }

  return context
}
