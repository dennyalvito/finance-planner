import { describe, expect, it } from "vitest"

import {
  generateGoogleNonce,
  hashGoogleNonce,
} from "@/features/auth/google-identity"

describe("Google identity nonce", () => {
  it("generates a cryptographically random 256-bit value", () => {
    const first = generateGoogleNonce()
    const second = generateGoogleNonce()

    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(second).toMatch(/^[a-f0-9]{64}$/)
    expect(second).not.toBe(first)
  })

  it("hashes the raw nonce with SHA-256", async () => {
    await expect(hashGoogleNonce("coin-nonce")).resolves.toBe(
      "6e94a2e812b8e865a2cb4d5042d1adaa4475b9086070007e1137b75ee4eff0c2"
    )
  })
})
