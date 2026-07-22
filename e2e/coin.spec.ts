import { expect, test } from "@playwright/test"

test("keeps chart tooltips stable for display labels outside the chart config", async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))

  await page.goto("/")
  await page.locator('[data-app-ready="true"]').waitFor()

  const cashFlowChart = page.getByTestId("cash-flow-chart")
  const spendingChart = page.getByTestId("spending-chart")

  await cashFlowChart.hover({ position: { x: 240, y: 130 } })
  await spendingChart.hover({ position: { x: 88, y: 30 } })

  await expect(
    page.getByRole("heading", { name: "Your money, in one place." })
  ).toBeVisible()
  expect(pageErrors).toEqual([])
})

test("records and persists a transaction from the desktop dashboard", async ({
  page,
}) => {
  await page.goto("/")
  await page.locator('[data-app-ready="true"]').waitFor()

  await expect(
    page.getByRole("heading", { name: "Your money, in one place." })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Transactions" })).toBeVisible()

  await page.getByTestId("add-transaction-desktop").click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByLabel("Amount in IDR").fill("1500000")
  await page.getByLabel("Category").click()
  await page.getByRole("option", { name: "Food & dining" }).click()
  await page.getByLabel("Note").fill("Fresh groceries")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add transaction" })
    .click()

  await expect(page.getByText("Transaction added")).toBeVisible()
  await expect(page.getByText("Fresh groceries")).toBeVisible()
  await expect(page.getByText("Example data")).toHaveCount(0)

  await page.reload()
  await page.locator('[data-app-ready="true"]').waitFor()
  await expect(page.getByText("Fresh groceries")).toBeVisible()
})

test("uses a bottom dock and transaction drawer on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.locator('[data-app-ready="true"]').waitFor()

  await expect(page.getByTestId("mobile-dock")).toBeVisible()
  await expect(page.getByTestId("add-transaction-desktop")).toBeHidden()

  await page.getByTestId("add-transaction-mobile").click()
  await expect(page.getByTestId("transaction-drawer")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Add a transaction" })
  ).toBeVisible()

  await page.getByRole("button", { name: "Cancel" }).click()
  await page.getByRole("link", { name: "Budgets" }).click()
  await expect(page).toHaveURL(/\/budgets$/)
  await expect(page.getByRole("heading", { name: "Budgets" })).toBeVisible()

  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  )
  expect(hasOverflow).toBe(false)
})
