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

  await page.getByTestId("add-transaction-desktop").click()
  const amountInput = page.getByLabel("Amount in IDR")
  await amountInput.fill("125000")
  await expect(amountInput).toHaveValue("125.000")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add transaction" })
    .click()

  await expect(spendingChart).toBeVisible({ timeout: 15000 })
  const cashFlowBox = await cashFlowChart.boundingBox()
  expect(cashFlowBox).not.toBeNull()
  await cashFlowChart.hover({
    force: true,
    position: {
      x: cashFlowBox!.width / 2,
      y: cashFlowBox!.height / 2,
    },
  })
  await spendingChart.hover({ force: true, position: { x: 88, y: 30 } })

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
  await expect(
    desktopOverview.getByText("No expense data yet", { exact: true })
  ).toBeVisible()
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

  const scrollbarStyles = await page.evaluate(() => {
    const rootStyles = window.getComputedStyle(document.documentElement)
    const thumbStyles = window.getComputedStyle(
      document.documentElement,
      "::-webkit-scrollbar-thumb"
    )

    return {
      color: rootStyles.scrollbarColor,
      width: rootStyles.scrollbarWidth,
      thumbColor: thumbStyles.backgroundColor,
    }
  })

  expect(scrollbarStyles.width).toBe("thin")
  expect(scrollbarStyles.color).not.toBe("auto")
  expect(scrollbarStyles.thumbColor).not.toBe("rgba(0, 0, 0, 0)")

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
  const preferencesItem = await page
    .getByRole("link", { name: "Preferences" })
    .boundingBox()

  expect(overviewItem).not.toBeNull()
  expect(preferencesItem).not.toBeNull()
  expect(
    preferencesItem!.y - (overviewItem!.y + overviewItem!.height)
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

test("starts a first-time guest with an empty ledger", async ({ page }) => {
  await page.goto("/")
  await page.locator('[data-app-ready="true"]').waitFor()

  const desktopOverview = page.getByTestId("desktop-overview")

  await expect(
    desktopOverview.getByText("No transactions here", { exact: true })
  ).toBeVisible()
  await expect(desktopOverview.getByText("Example data")).toHaveCount(0)
  await expect(
    desktopOverview.getByText("No expense data yet", { exact: true })
  ).toBeVisible()

  await page.getByTestId("add-transaction-desktop").click()
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Category" })
    .click()
  await expect(
    page.getByRole("option", { name: "Food & dining" })
  ).toBeVisible()
})

test("records and persists a transaction from the desktop dashboard", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-07-25T12:00:00+07:00"))
  await page.goto("/")
  await page.locator('[data-app-ready="true"]').waitFor()

  await expect(
    page.getByTestId("desktop-overview").getByText("Net cash flow", {
      exact: true,
    })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Preferences" })).toBeVisible()

  await page.getByTestId("add-transaction-desktop").click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByLabel("Amount in IDR").fill("1500000")
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Category" })
    .click()
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

  await page.getByTestId("add-transaction-desktop").click()
  await page.getByLabel("Amount in IDR").fill("250000")
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Category" })
    .click()
  await page.getByRole("option", { name: "Food & dining" }).click()
  await page.getByLabel("Date").fill("2026-06-15")
  await page.getByLabel("Note").fill("Older groceries")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add transaction" })
    .click()

  await page.goto("/transactions")
  await page.locator('[data-app-ready="true"]').waitFor()
  await expect(page.getByTestId("transaction-summary")).toContainText(
    "2 entries"
  )

  await page
    .getByRole("button", {
      name: "Filter transaction date, currently All dates",
    })
    .click()
  const dateFilter = page.getByTestId("transaction-date-filter")
  await expect(dateFilter).toBeVisible()
  await dateFilter.getByRole("radio", { name: "This month" }).click()
  await expect(page.getByText("Fresh groceries")).toBeVisible()
  await expect(page.getByText("Older groceries")).toHaveCount(0)
  await expect(page.getByTestId("transaction-summary")).toContainText("1 entry")

  const transactionRow = page
    .locator("[data-transaction-row]")
    .filter({ hasText: "Fresh groceries" })
  await transactionRow.getByRole("button", { name: /Actions for/ }).click()
  await page.getByRole("menuitem", { name: "Edit" }).click()
  const editDialog = page.getByRole("dialog", { name: "Edit transaction" })
  await expect(editDialog).toBeVisible()
  await expect(page.getByLabel("Amount in IDR")).toHaveValue("1.500.000")
  await page.getByLabel("Amount in IDR").fill("1600000")
  await page.getByLabel("Note").fill("Fresh groceries updated")
  await editDialog.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Transaction updated")).toBeVisible()
  await expect(page.getByText("Fresh groceries updated")).toBeVisible()

  await page.reload()
  await page.locator('[data-app-ready="true"]').waitFor()
  await expect(page.getByText("Fresh groceries updated")).toBeVisible()
  await expect(page.getByText("Older groceries")).toBeVisible()
})

test("uses the simplified mobile dock and period controls", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-07-25T12:00:00+07:00"))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.locator('[data-app-ready="true"]').waitFor()

  await expect(page.getByTestId("mobile-dock")).toBeVisible()
  await expect(page.getByTestId("add-transaction-desktop")).toBeHidden()
  await expect(page.getByRole("link", { name: "Preferences" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Profile" })).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Net cash flow" })
  ).toBeVisible()
  await expect(page.getByTestId("cash-flow-card")).toBeHidden()
  await expect(
    page.getByRole("button", { name: "Change period, currently This month" })
  ).toBeVisible()

  const activeHome = page.getByRole("link", { name: "Home" })
  await expect(activeHome).toHaveAttribute("aria-current", "page")
  await expect(activeHome).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")

  await page
    .getByRole("button", { name: "Change period, currently This month" })
    .click()
  await expect(page.getByTestId("period-filter-drawer")).toBeVisible()
  const periodBackdrop = await page
    .locator('[data-slot="drawer-overlay"]')
    .evaluate((element) => window.getComputedStyle(element).backdropFilter)
  expect(periodBackdrop).toBe("none")
  await page.getByRole("radio", { name: "Custom" }).click()
  await expect(
    page.getByTestId("period-filter-drawer").locator('[data-slot="calendar"]')
  ).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("period-filter-drawer")).toBeHidden()
  await expect(
    page.getByRole("button", { name: "Change period, currently This month" })
  ).toBeVisible()

  await page
    .getByRole("button", { name: "Change period, currently This month" })
    .click()
  await page.getByRole("radio", { name: "Custom" }).click()
  await page.getByRole("button", { name: /Select from date/ }).click()
  const fromDateDialog = page.getByTestId("period-date-dialog")
  await expect(fromDateDialog).toBeVisible()
  await expect(fromDateDialog.getByRole("combobox")).toHaveCount(2)
  await page.locator('[data-date="2026-07-10"]').click()
  await expect(fromDateDialog).toHaveCount(0)
  await page.getByRole("button", { name: /Select to date/ }).click()
  await page.locator('[data-date="2026-07-20"]').click()
  await page.getByRole("button", { name: "Apply custom period" }).click()
  const customPeriodButton = page.getByRole("button", {
    name: /Change period, currently 10 Jul.*20 Jul/,
  })
  await expect(customPeriodButton).toBeVisible()

  await customPeriodButton.click()
  await page.getByRole("radio", { name: "Today" }).click()
  await expect(
    page.getByRole("button", { name: "Change period, currently Today" })
  ).toBeVisible()

  await page.getByTestId("add-transaction-mobile").click()
  await expect(page.getByTestId("transaction-drawer")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Add transaction" })
  ).toBeVisible()
  await expect(page.getByLabel("Amount")).toBeFocused()
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

  const amountInput = page.getByLabel("Amount")
  const amountStyles = await amountInput.evaluate((element) => {
    const styles = window.getComputedStyle(element)
    return { fontSize: styles.fontSize, fontWeight: styles.fontWeight }
  })
  expect(Number.parseFloat(amountStyles.fontSize)).toBeGreaterThanOrEqual(24)
  expect(Number(amountStyles.fontWeight)).toBeGreaterThanOrEqual(600)
  await amountInput.fill("125000")
  await expect(amountInput).toHaveValue("125.000")
  const foodCategory = page.getByRole("radio", { name: "Food & dining" })
  await expect(foodCategory).toHaveAttribute("data-state", "on")
  await page.getByRole("button", { name: "Save transaction" }).click()
  await expect(page.getByText("Transaction added")).toBeVisible()
  await expect(
    page
      .getByTestId("mobile-recent-activity")
      .getByText("Food & dining", { exact: true })
  ).toBeVisible()
  await expect(
    page.getByTestId("mobile-recent-activity").getByText(/^-Rp/)
  ).toHaveClass(/text-negative/)
  await expect(page.getByTestId("mobile-net-cash-flow-value")).toHaveClass(
    /text-negative/
  )

  const swipeMobileTransaction = async () => {
    const transactionRow = page
      .getByTestId("mobile-recent-activity")
      .locator("[data-transaction-row]")
      .filter({ hasText: "Food & dining" })
    const rowBox = await transactionRow.boundingBox()
    expect(rowBox).not.toBeNull()
    await page.mouse.move(
      rowBox!.x + rowBox!.width - 12,
      rowBox!.y + rowBox!.height / 2
    )
    await page.mouse.down()
    await page.mouse.move(rowBox!.x + 12, rowBox!.y + rowBox!.height / 2, {
      steps: 6,
    })
    await page.mouse.up()
    const editButton = page
      .getByTestId("mobile-recent-activity")
      .getByRole("button", {
        name: "Edit",
        includeHidden: true,
      })
    await expect(editButton).toBeVisible()
    return editButton
  }

  const openEditButton = await swipeMobileTransaction()
  await page.getByTestId("mobile-net-cash-flow").click()
  await expect(openEditButton).toHaveAttribute("tabindex", "-1")

  await (await swipeMobileTransaction()).click()
  await expect(
    page.getByRole("heading", { name: "Edit transaction" })
  ).toBeVisible()
  await page.getByLabel("Amount").fill("150000")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByText("Transaction updated")).toBeVisible()
  await expect(
    page.getByTestId("mobile-recent-activity").getByText("-Rp 150 rb")
  ).toBeVisible()
  await expect(page.getByTestId("transaction-drawer")).toBeHidden()

  await swipeMobileTransaction()
  const deleteButton = page.getByRole("button", {
    name: "Delete Food & dining transaction",
  })
  await deleteButton.click()
  const deleteDialog = page.getByRole("alertdialog")
  await expect(
    deleteDialog.getByRole("heading", { name: "Delete this transaction?" })
  ).toBeVisible()
  await deleteDialog.getByRole("button", { name: "Delete" }).click()
  await expect(
    page.getByTestId("mobile-recent-activity").getByText("No transactions here")
  ).toBeVisible()

  await page.getByRole("link", { name: "Budgets" }).click()
  await expect(page).toHaveURL(/\/budgets$/)
  await expect(page.getByTestId("route-stage")).toHaveAttribute(
    "data-view",
    "budgets"
  )
  await page.getByRole("button", { name: "Set the first budget" }).click()
  await expect(page.getByTestId("budget-drawer")).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Set a monthly budget" })
  ).toBeVisible()
  await expect(page.getByLabel("Monthly limit in IDR")).toBeFocused()
  await expect(page.getByLabel("Expense category")).toContainText(
    "Food & dining"
  )
  await page.getByLabel("Monthly limit in IDR").fill("2000000")
  await expect(page.getByLabel("Monthly limit in IDR")).toHaveValue("2.000.000")
  await page.getByRole("button", { name: "Save budget" }).click()
  await expect(page.getByText("Budget saved")).toBeVisible()

  await page.getByRole("button", { name: "Adjust limit" }).click()
  await expect(page.getByLabel("Monthly limit in IDR")).toHaveValue("2.000.000")
  await page.getByRole("button", { name: "Remove budget" }).click()
  const removeBudgetDialog = page.getByRole("alertdialog")
  await expect(
    removeBudgetDialog.getByRole("heading", {
      name: "Remove this monthly budget?",
    })
  ).toBeVisible()
  await removeBudgetDialog
    .getByRole("button", { name: "Remove budget" })
    .click()
  await expect(page.getByText("Budget removed")).toBeVisible()
  await expect(page.getByText("No budget limits yet")).toBeVisible()

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

test("opens a large mobile ledger progressively and keeps category details scrollable", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-08-30T12:00:00+07:00"))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await page.locator('[data-app-ready="true"]').waitFor()

  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("coin-finance")
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const categoryIds = [
      "salary",
      "freelance",
      "gift",
      "food",
      "transport",
      "housing",
      "shopping",
      "health",
      "leisure",
    ]

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("transactions", "readwrite")
      const store = transaction.objectStore("transactions")

      for (let index = 0; index < 90; index += 1) {
        const categoryId = categoryIds[index % categoryIds.length]
        store.put({
          id: `performance-${index}`,
          type: index % categoryIds.length < 3 ? "income" : "expense",
          amount: 10_000 + index,
          categoryId,
          date: "2026-08-30",
          note: `Performance fixture ${index}`,
          createdAt: index,
        })
      }

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    database.close()
  })

  await page.reload()
  await page.locator('[data-app-ready="true"]').waitFor()
  await expect(
    page.getByTestId("mobile-recent-activity").getByText("See all")
  ).toBeVisible()

  await page.evaluate(() => {
    const state = window as typeof window & {
      firstLedgerRenderCount?: number
    }
    const captureFirstRender = () => {
      const list = document.querySelector<HTMLElement>(
        '[data-total-transactions="90"]'
      )
      if (!list || state.firstLedgerRenderCount !== undefined) return false
      state.firstLedgerRenderCount = Number(list.dataset.renderedTransactions)
      return true
    }
    const observer = new MutationObserver(() => {
      if (captureFirstRender()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    captureFirstRender()
  })

  await page.getByTestId("mobile-recent-activity").getByText("See all").click()
  await expect(page.getByTestId("responsive-drawer")).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              firstLedgerRenderCount?: number
            }
          ).firstLedgerRenderCount
      )
    )
    .toBe(18)
  await expect(page.locator('[data-total-transactions="90"]')).toHaveAttribute(
    "data-rendered-transactions",
    "90"
  )

  await page.keyboard.press("Escape")
  await expect(page.getByTestId("responsive-drawer")).toBeHidden()
  await page
    .getByRole("button", { name: "Open category activity details" })
    .click()

  const categoryScrollRegion = page.getByTestId("responsive-overlay-scroll")
  await expect(categoryScrollRegion).toBeVisible()
  await expect(categoryScrollRegion).toHaveAttribute(
    "data-vaul-no-drag",
    "true"
  )
  await expect(
    categoryScrollRegion.locator('[data-slot="scroll-area-scrollbar"]')
  ).toBeVisible()
  const scrollState = await categoryScrollRegion
    .locator('[data-slot="scroll-area-viewport"]')
    .evaluate((element) => {
      const styles = window.getComputedStyle(element)
      return {
        overflowY: styles.overflowY,
        scrollable: element.scrollHeight > element.clientHeight,
      }
    })
  expect(scrollState).toEqual({
    overflowY: "scroll",
    scrollable: true,
  })
})

test("labels the guest workspace and offers Google account mode", async ({
  page,
}) => {
  await page.route("**/auth/v1/authorize?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>OAuth handoff captured</title>",
    })
  })

  await page.goto("/preferences")
  await page.locator('[data-app-ready="true"]').waitFor()

  await expect(
    page
      .getByTestId("route-stage")
      .getByRole("heading", { name: "Preferences", exact: true })
  ).toBeVisible()
  await expect(page.getByText("Indonesian rupiah")).toBeVisible()
  await page.getByRole("button", { name: /Categories/ }).click()
  const categoryDialog = page.getByRole("dialog", { name: "Categories" })
  await expect(categoryDialog).toBeVisible()
  await expect(categoryDialog.getByText("Personal categories")).toBeVisible()
  await expect(
    categoryDialog.getByRole("button", { name: "Sign in to customize" })
  ).toBeVisible()
  await categoryDialog.getByRole("button", { name: "Close" }).click()
  await expect(
    page.getByRole("button", { name: "Continue with Google" })
  ).toBeEnabled()

  await page.goto("/profile")
  await page.locator('[data-app-ready="true"]').waitFor()
  await expect(
    page
      .getByTestId("route-stage")
      .getByRole("heading", { name: "Profile", exact: true })
  ).toBeVisible()
  await expect(
    page.getByTestId("route-stage").getByText("On this device", { exact: true })
  ).toBeVisible()

  await expect(
    page.getByRole("button", { name: "Open profile menu" })
  ).toHaveCount(0)
  await expect(page.locator('[aria-label="Profile"]')).toBeVisible()

  await page
    .getByTestId("route-stage")
    .getByRole("button", { name: "Continue with Google" })
    .click()

  const signInDialog = page.getByRole("dialog", {
    name: "Use Coin across devices",
  })
  await expect(signInDialog).toBeVisible()
  await expect(
    signInDialog.getByRole("button", { name: "Continue with Google" })
  ).toBeVisible()
  await expect(signInDialog.locator("iframe")).toHaveCount(0)
  await expect(
    signInDialog.getByRole("button", {
      name: "Use browser redirect instead",
    })
  ).toHaveCount(0)

  const oauthRequestPromise = page.waitForRequest("**/auth/v1/authorize?**")
  await signInDialog
    .getByRole("button", { name: "Continue with Google" })
    .click()
  const oauthRequest = await oauthRequestPromise
  const oauthUrl = new URL(oauthRequest.url())

  expect(oauthUrl.searchParams.get("provider")).toBe("google")
  expect(oauthUrl.searchParams.get("redirect_to")).toBe(
    "http://localhost:3000/profile"
  )
})
