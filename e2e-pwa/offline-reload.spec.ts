import { expect, test } from "@playwright/test"

test("reloads the guest workspace and remains writable while offline", async ({
  context,
  page,
}) => {
  await page.goto("/")
  await page.locator('[data-app-ready="true"]').waitFor()

  await page.getByTestId("add-transaction-desktop").click()
  await page.getByLabel("Amount in IDR").fill("125000")
  await page.getByLabel("Note").fill("Cached before reload")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add transaction" })
    .click()
  await expect(
    page.getByTestId("desktop-overview").getByText("Cached before reload")
  ).toBeVisible()

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.locator('[data-app-ready="true"]').waitFor()
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller))
    )
    .toBe(true)

  await context.setOffline(true)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.locator('[data-app-ready="true"]').waitFor()

  await expect(
    page.getByTestId("desktop-overview").getByText("Cached before reload")
  ).toBeVisible()

  await page.getByTestId("add-transaction-desktop").click()
  await page.getByLabel("Amount in IDR").fill("75000")
  await page.getByLabel("Note").fill("Added after offline reload")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add transaction" })
    .click()
  await expect(
    page.getByTestId("desktop-overview").getByText("Added after offline reload")
  ).toBeVisible()

  await context.setOffline(false)
  await page.reload()
  await page.locator('[data-app-ready="true"]').waitFor()
  await expect(
    page.getByTestId("desktop-overview").getByText("Cached before reload")
  ).toBeVisible()
  await expect(
    page.getByTestId("desktop-overview").getByText("Added after offline reload")
  ).toBeVisible()
})
