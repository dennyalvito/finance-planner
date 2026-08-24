// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  browserIsOnline,
  subscribeToBrowserConnectivity,
} from "@/features/finance/browser-connectivity"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("browser connectivity", () => {
  it("reads the browser's current connectivity state", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)

    expect(browserIsOnline()).toBe(false)
  })

  it("rechecks connectivity when an installed app resumes", () => {
    let online = false
    let visibilityState: DocumentVisibilityState = "hidden"
    vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online)
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibilityState
    )
    const onChange = vi.fn()
    const unsubscribe = subscribeToBrowserConnectivity(onChange)

    online = true
    window.dispatchEvent(new Event("focus"))
    window.dispatchEvent(new PageTransitionEvent("pageshow"))
    document.dispatchEvent(new Event("visibilitychange"))

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenNthCalledWith(1, true, "change")
    expect(onChange).toHaveBeenNthCalledWith(2, true, "resume")

    visibilityState = "visible"
    document.dispatchEvent(new Event("visibilitychange"))
    expect(onChange).toHaveBeenLastCalledWith(true, "resume")

    unsubscribe()
    online = false
    window.dispatchEvent(new Event("offline"))
    expect(onChange).toHaveBeenCalledTimes(3)
  })
})
