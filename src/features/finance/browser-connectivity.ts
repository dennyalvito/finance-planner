export function browserIsOnline() {
  return typeof navigator === "undefined" || navigator.onLine
}

export function subscribeToBrowserConnectivity(
  onChange: (isOnline: boolean, reason: "change" | "resume") => void
) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => undefined
  }

  const update = () => onChange(browserIsOnline(), "change")
  const updateOnResume = () => onChange(browserIsOnline(), "resume")
  const updateWhenVisible = () => {
    if (document.visibilityState === "visible") updateOnResume()
  }

  window.addEventListener("online", update)
  window.addEventListener("offline", update)
  window.addEventListener("focus", updateOnResume)
  window.addEventListener("pageshow", updateOnResume)
  document.addEventListener("visibilitychange", updateWhenVisible)

  return () => {
    window.removeEventListener("online", update)
    window.removeEventListener("offline", update)
    window.removeEventListener("focus", updateOnResume)
    window.removeEventListener("pageshow", updateOnResume)
    document.removeEventListener("visibilitychange", updateWhenVisible)
  }
}
