import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"

const googleIdentityHeaders = createMiddleware().server(({ next }) => {
  setResponseHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
  setResponseHeader("Referrer-Policy", "strict-origin-when-cross-origin")

  return next()
})

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, googleIdentityHeaders],
}))
