import { expect, test } from "@playwright/test"

test("keeps chart tooltips stable for display labels outside the chart config", async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))

  await page.goto("/")
  await page.locator('[data-app-ready="true"]').waitFor()

  const desktopOverview = page.getByTestId("desktop-overview")
  const cashFlowChart = desktopOverview.getByTestId("cash-flow-chart")
  const spendingChart = desktopOverview.getByTestId("spending-chart")

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

  const desktopOverview = page.getByTestId("desktop-overview")
  const cashFlowSkeleton = desktopOverview.getByTestId("cash-flow-skeleton")
  const spendingSkeleton = desktopOverview.getByTestId("spending-skeleton")
  const skeletonsAppeared = Promise.all([
    cashFlowSkeleton.waitFor({ state: "visible" }),
    spendingSkeleton.waitFor({ state: "visible" }),
  ])

  await page
    .getByRole("link", { name: "Overview", exact: true })
    .evaluate((link: HTMLAnchorElement) => link.click())
  await skeletonsAppeared

  await expect(page).toHaveURL(/\/$/)
  await expect(desktopOverview.getByTestId("cash-flow-chart")).toBeVisible()
  await expect(desktopOverview.getByTestId("spending-chart")).toBeVisible()
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

  await expect(
    page.getByTestId("desktop-overview").getByText("Net cash flow", {
      exact: true,
    })
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
  await expect(
    page.getByTestId("desktop-overview").getByText("Fresh groceries")
  ).toBeVisible()
  await expect(page.getByText("Example data")).toHaveCount(0)

  await page.reload()
  await page.locator('[data-app-ready="true"]').waitFor()
  await expect(
    page.getByTestId("desktop-overview").getByText("Fresh groceries")
  ).toBeVisible()
})

test("uses a bottom dock and transaction drawer on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.locator('[data-app-ready="true"]').waitFor()

  await expect(page.getByTestId("mobile-dock")).toBeVisible()
  await expect(page.getByTestId("add-transaction-desktop")).toBeHidden()
  await expect(
    page.getByRole("heading", { name: "Net cash flow" })
  ).toBeVisible()
  await expect(page.getByTestId("cash-flow-card")).toBeHidden()

  const activeHome = page.getByRole("link", { name: "Home" })
  await expect(activeHome).toHaveAttribute("aria-current", "page")
  await expect(activeHome).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")

  await page
    .getByRole("button", { name: "Change period, currently This month" })
    .click()
  await expect(page.getByTestId("period-filter-drawer")).toBeVisible()
  await page.getByRole("radio", { name: "Custom" }).click()
  await page.getByLabel("From").fill("2026-07-10")
  await page.getByLabel("To").fill("2026-07-20")
  await page.getByRole("button", { name: "Apply custom period" }).click()
  await expect(
    page.getByRole("button", {
      name: "Change period, currently 10 Jul – 20 Jul",
    })
  ).toBeVisible()

  await page
    .getByRole("button", {
      name: "Change period, currently 10 Jul – 20 Jul",
    })
    .click()
  await page.getByRole("radio", { name: "Today" }).click()
  await expect(
    page.getByRole("button", { name: "Change period, currently Today" })
  ).toBeVisible()

  await page.getByTestId("add-transaction-mobile").click()
  await expect(page.getByTestId("transaction-drawer")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Add transaction" })
  ).toBeVisible()
  const drawerBackdrop = await page
    .locator('[data-slot="drawer-overlay"]')
    .evaluate((element) => window.getComputedStyle(element).backdropFilter)
  expect(drawerBackdrop).toBe("none")

  const drawerBox = await page.getByTestId("transaction-drawer").boundingBox()
  expect(drawerBox).not.toBeNull()
  expect(drawerBox!.height).toBeLessThan(844 * 0.8)

  const expenseType = page.getByRole("radio", { name: "Expense" })
  const incomeType = page.getByRole("radio", { name: "Income" })
  await expect(expenseType).toHaveAttribute("data-state", "on")
  const selectedTypeColors = await expenseType.evaluate((element) => {
    const styles = window.getComputedStyle(element)

    return {
      background: styles.backgroundColor,
      foreground: styles.color,
    }
  })
  const unselectedTypeColors = await incomeType.evaluate((element) => {
    const styles = window.getComputedStyle(element)

    return {
      background: styles.backgroundColor,
      foreground: styles.color,
    }
  })
  expect(selectedTypeColors).not.toEqual(unselectedTypeColors)

  await page.getByLabel("Amount").fill("125000")
  const foodCategory = page.getByRole("radio", { name: "Food & dining" })
  await foodCategory.click()
  await expect(foodCategory).toHaveAttribute("data-state", "on")
  await page.getByRole("button", { name: "Save transaction" }).click()
  await expect(page.getByText("Transaction added")).toBeVisible()
  await expect(
    page
      .getByTestId("mobile-recent-activity")
      .getByText("Food & dining", { exact: true })
  ).toBeVisible()

  await page.getByRole("link", { name: "Budgets" }).click()
  await expect(page).toHaveURL(/\/budgets$/)
  await expect(page.getByRole("heading", { name: "Budgets" })).toBeVisible()
  await expect(page.getByTestId("route-stage")).toHaveAttribute(
    "data-view",
    "budgets"
  )
  await page.getByRole("button", { name: "Add budget" }).click()
  await expect(page.getByTestId("budget-drawer")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Set a monthly budget" })
  ).toBeVisible()
  await page.getByLabel("Expense category").click()
  await page.getByRole("option", { name: "Food & dining" }).click()
  await page.getByLabel("Monthly limit in IDR").fill("2000000")
  await page.getByRole("button", { name: "Save budget" }).click()
  await expect(page.getByText("Budget saved")).toBeVisible()

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
    duration: "0.1s",
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
  await page.route("https://accounts.google.com/gsi/client", async (route) => {
    await route.fulfill({
      contentType: "application/javascript",
      body: `
        window.google = {
          accounts: {
            id: {
              initialize(configuration) {
                document.body.dataset.googleNonce = configuration.nonce
              },
              renderButton(parent) {
                const button = document.createElement("button")
                button.type = "button"
                button.textContent = "Continue with Google"
                button.setAttribute("aria-label", "Google rendered sign-in")
                parent.appendChild(button)
              }
            }
          }
        }
      `,
    })
  })

  await page.goto("/settings")
  await page.locator('[data-app-ready="true"]').waitFor()

  await expect(page.getByText("This browser", { exact: true })).toBeVisible()
  await expect(
    page.getByText("Guest data stays in IndexedDB", { exact: false })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Continue with Google" })
  ).toBeEnabled()
  await page.getByRole("button", { name: "Continue with Google" }).click()

  const signInDialog = page.getByRole("dialog", { name: "Sign in to Coin" })
  await expect(signInDialog).toBeVisible()
  await expect(
    signInDialog.getByRole("button", { name: "Google rendered sign-in" })
  ).toBeVisible()
  await expect(
    signInDialog.getByRole("button", {
      name: "Use browser redirect instead",
    })
  ).toBeVisible()
  await expect
    .poll(() => page.locator("body").getAttribute("data-google-nonce"))
    .toMatch(/^[a-f0-9]{64}$/)
  await page.getByRole("button", { name: "Close" }).click()

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
