import { createClient } from "@supabase/supabase-js"
import { expect, test } from "@playwright/test"

import type { Database } from "../src/data/database.types"

const supabaseUrl =
  process.env.COIN_E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const publishableKey =
  process.env.COIN_E2E_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const testEmail = process.env.COIN_E2E_USER_EMAIL
const testPassword = process.env.COIN_E2E_USER_PASSWORD
const cloudTestConfigured = Boolean(
  supabaseUrl && publishableKey && testEmail && testPassword
)

test.describe("authenticated cloud workspace", () => {
  test.skip(
    !cloudTestConfigured,
    "Set dedicated COIN_E2E Supabase credentials to run cloud workflows."
  )

  test("persists cloud data and restores the earlier guest workspace on sign-out", async ({
    page,
  }) => {
    const client = createClient<Database>(supabaseUrl!, publishableKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
    const { data, error } = await client.auth.signInWithPassword({
      email: testEmail!,
      password: testPassword!,
    })

    expect(error).toBeNull()
    expect(data.session).not.toBeNull()

    const projectRef = new URL(supabaseUrl!).hostname.split(".")[0]
    const storageKey = `sb-${projectRef}-auth-token`
    const guestNote = `Preserved guest ${crypto.randomUUID()}`
    const cloudNote = `Cloud persistence ${crypto.randomUUID()}`

    await page.goto("/transactions")
    await page.locator('[data-app-ready="true"]').waitFor()
    await page.getByTestId("add-transaction-desktop").click()
    await page.getByLabel("Amount in IDR").fill("11000")
    await page.getByLabel("Note").fill(guestNote)
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add transaction" })
      .click()
    await expect(page.getByText(guestNote)).toBeVisible()

    await page.evaluate(
      ([key, session]) => localStorage.setItem(key, JSON.stringify(session)),
      [storageKey, data.session] as const
    )
    await page.reload()
    await page.locator('[data-app-ready="true"]').waitFor()

    await expect(
      page.getByText("Cloud workspace", { exact: true }).first()
    ).toBeVisible()
    await expect(page.getByText(guestNote)).toHaveCount(0)

    await page.getByTestId("add-transaction-desktop").click()
    await page.getByLabel("Amount in IDR").fill("22000")
    await page.getByLabel("Note").fill(cloudNote)
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add transaction" })
      .click()
    await expect(page.getByText(cloudNote)).toBeVisible()

    await page.reload()
    await page.locator('[data-app-ready="true"]').waitFor()
    await expect(page.getByText(cloudNote)).toBeVisible()

    await page.goto("/settings")
    await page.getByRole("button", { name: "Sign out" }).click()
    await expect(page.getByText(/Signed out/)).toBeVisible()

    await page.goto("/transactions")
    await page.locator('[data-app-ready="true"]').waitFor()
    await expect(page.getByText(guestNote)).toBeVisible()
    await expect(page.getByText(cloudNote)).toHaveCount(0)

    const { error: cleanupError } = await client
      .from("transactions")
      .delete()
      .eq("note", cloudNote)

    expect(cleanupError).toBeNull()
  })
})
