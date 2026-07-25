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

  await expect(cashFlowChart).toBeVisible()
  expect(pageErrors).toEqual([])
})

test("shows selective chart skeletons before mounting overview charts", async ({
  page,
}) => {
  await page.goto("/budgets")
  await page.locator('[data-app-ready="true"]').waitFor()

  const cashFlowSkeleton = page.getByTestId("cash-flow-skeleton")
  const spendingSkeleton = page.getByTestId("spending-skeleton")
  const skeletonsAppeared = Promise.all([
    cashFlowSkeleton.waitFor({ state: "visible" }),
    spendingSkeleton.waitFor({ state: "visible" }),
  ])

  await page
    .getByRole("link", { name: "Overview", exact: true })
    .evaluate((link: HTMLAnchorElement) => link.click())
  await skeletonsAppeared

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByTestId("cash-flow-chart")).toBeVisible()
  await expect(page.getByTestId("spending-chart")).toBeVisible()
  await expect(cashFlowSkeleton).toHaveCount(0)
  await expect(spendingSkeleton).toHaveCount(0)
})

test("collapses the desktop sidebar to icons and keeps the chart card content-sized", async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/")
  await page.locator('[data-app-ready="true"]').waitFor()

  const chartCard = page.getByTestId("cash-flow-card")
  const chart = page.getByTestId("cash-flow-chart")
  const cardBox = await chartCard.boundingBox()
  const chartBox = await chart.boundingBox()

  expect(cardBox).not.toBeNull()
  expect(chartBox).not.toBeNull()
  expect(
    cardBox!.y + cardBox!.height - (chartBox!.y + chartBox!.height)
  ).toBeLessThan(40)

  const overviewItem = await page
    .getByRole("link", { name: "Overview" })
    .boundingBox()
  const transactionsItem = await page
    .getByRole("link", { name: "Transactions" })
    .boundingBox()

  expect(overviewItem).not.toBeNull()
  expect(transactionsItem).not.toBeNull()
  expect(
    transactionsItem!.y - (overviewItem!.y + overviewItem!.height)
  ).toBeGreaterThanOrEqual(4)

  await page.locator('[data-sidebar="trigger"]').click()

  const sidebar = page.locator('[data-slot="sidebar"][data-state="collapsed"]')
  await expect(sidebar).toBeVisible()

  const sidebarContainer = page.locator('[data-slot="sidebar-container"]')
  await expect(sidebarContainer).toHaveCSS("width", "48px")

  const overviewLabel = page
    .locator('[data-sidebar="menu-button"]')
    .filter({ hasText: "Overview" })
    .locator("span")
  const labelBox = await overviewLabel.boundingBox()

  expect(labelBox).not.toBeNull()
  expect(labelBox!.width).toBeLessThanOrEqual(1)
  expect(labelBox!.height).toBeLessThanOrEqual(1)

  await page.getByRole("link", { name: "Budgets" }).click()
  await expect(page).toHaveURL(/\/budgets$/)
  await expect(
    page.locator('[data-slot="sidebar"][data-state="collapsed"]')
  ).toBeVisible()
  expect(pageErrors).toEqual([])
})

test("records and persists a transaction from the desktop dashboard", async ({
  page,
}) => {
  await page.goto("/")
  await page.locator('[data-app-ready="true"]').waitFor()

  await expect(page.getByText("Recorded net", { exact: true })).toBeVisible()
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
  await expect(page.getByTestId("route-stage")).toHaveAttribute(
    "data-view",
    "budgets"
  )
  const animation = await page
    .getByTestId("route-stage")
    .evaluate((element) => {
      const styles = window.getComputedStyle(element)

      return {
        duration: styles.animationDuration,
        name: styles.animationName,
      }
    })
  expect(animation).toEqual({
    duration: "0.14s",
    name: "coin-route-enter",
  })

  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  )
  expect(hasOverflow).toBe(false)
})

test("labels the guest workspace and offers Google account mode", async ({
  page,
}) => {
  await page.goto("/settings")
  await page.locator('[data-app-ready="true"]').waitFor()

  await expect(page.getByText("This browser", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Guest data stays in IndexedDB", { exact: false })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Continue with Google" })
  ).toBeEnabled()

  await page.getByRole("button", { name: "Open profile menu" }).click()
  const profileMenu = page.getByRole("menu")
  await expect(
    profileMenu.getByText("Guest mode", { exact: true })
  ).toBeVisible()
  await expect(
    profileMenu.getByText("On this device", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Continue with Google" })
  ).toBeVisible()
})
