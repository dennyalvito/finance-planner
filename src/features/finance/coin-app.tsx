import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { ReactNode } from "react"
import { Outlet, useLocation } from "@tanstack/react-router"
import { toast } from "sonner"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import type { Category, FinanceTransaction } from "@/domain/finance"
import { GuardedSignOutDialog } from "@/features/auth/guarded-sign-out-dialog"
import { SignInDialog } from "@/features/auth/sign-in-dialog"
import {
  AppHeader,
  CoinSidebar,
  getView,
  MobileDock,
} from "@/features/finance/account/account-navigation"
import {
  BudgetsView,
  PreferencesView,
  ProfileView,
} from "@/features/finance/account/account-views"
import type {
  DateRange,
  PeriodPreset,
} from "@/features/finance/finance-view-types"
import { BudgetDialog } from "@/features/finance/budget-dialog"
import { TransactionDialog } from "@/features/finance/transaction-dialog"
import { TransactionsView } from "@/features/finance/transactions/transaction-history"
import { OverviewView } from "@/features/finance/overview/overview-view"
import { CloudWorkspaceStatus } from "@/features/finance/cloud-workspace-status"
import { SyncStatus } from "@/features/finance/sync-status"
import { useFinance } from "@/features/finance/use-finance"
import { useAuth } from "@/features/auth/auth-provider"

type CoinAppContextValue = ReturnType<typeof useFinance> & {
  openBudget: (categoryId?: string) => void
  openSignIn: () => void
  openTransaction: (transaction?: FinanceTransaction) => void
  overviewCustomRange: DateRange
  overviewPeriod: PeriodPreset
  overviewPeriodOpen: boolean
  setOverviewCustomRange: (range: DateRange) => void
  setOverviewPeriod: (period: PeriodPreset) => void
  setOverviewPeriodOpen: (open: boolean) => void
  requestSignOut: () => void
}

type TransactionOverlayContextValue = {
  openTransaction: (transaction?: FinanceTransaction) => void
}

const CoinAppContext = createContext<CoinAppContextValue | null>(null)
const TransactionOverlayContext =
  createContext<TransactionOverlayContextValue | null>(null)

function useCoinApp() {
  const context = useContext(CoinAppContext)

  if (!context) {
    throw new Error("Coin route pages must render inside CoinApp.")
  }

  return context
}

function useTransactionOverlay() {
  const context = useContext(TransactionOverlayContext)

  if (!context) {
    throw new Error(
      "Transaction actions must render inside TransactionOverlayProvider."
    )
  }

  return context
}

function TransactionOverlayProvider({
  categories,
  children,
  onCreateCategory,
  onAdd,
  onUpdate,
}: {
  categories: Category[]
  children: ReactNode
  onCreateCategory: (
    name: string,
    type: FinanceTransaction["type"]
  ) => Promise<Category>
  onAdd: ReturnType<typeof useFinance>["addTransaction"]
  onUpdate: ReturnType<typeof useFinance>["updateTransaction"]
}) {
  const [open, setOpen] = useState(false)
  const [transaction, setTransaction] = useState<FinanceTransaction>()
  const openTransaction = useCallback(
    (nextTransaction?: FinanceTransaction) => {
      setTransaction(nextTransaction)
      setOpen(true)
    },
    []
  )
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setTransaction(undefined)
  }, [])
  const handleSubmit = useCallback(
    (draft: Parameters<typeof onAdd>[0]) =>
      transaction ? onUpdate(transaction.id, draft) : onAdd(draft),
    [onAdd, onUpdate, transaction]
  )
  const value = useMemo(() => ({ openTransaction }), [openTransaction])

  return (
    <TransactionOverlayContext.Provider value={value}>
      {children}
      <TransactionDialog
        open={open}
        onOpenChange={handleOpenChange}
        categories={categories}
        transaction={transaction}
        onCreateCategory={onCreateCategory}
        onSubmit={handleSubmit}
      />
    </TransactionOverlayContext.Provider>
  )
}

export function CoinApp() {
  const finance = useFinance()

  return (
    <TransactionOverlayProvider
      categories={finance.categories}
      onCreateCategory={finance.createCategory}
      onAdd={finance.addTransaction}
      onUpdate={finance.updateTransaction}
    >
      <CoinAppShell finance={finance} />
    </TransactionOverlayProvider>
  )
}

function CoinAppShell({ finance }: { finance: ReturnType<typeof useFinance> }) {
  const auth = useAuth()
  const { signOut } = auth
  const { clearAccountData, getPendingCount, syncPendingChanges } = finance
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const view = getView(pathname)
  const [isInteractive, setIsInteractive] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [budgetCategoryId, setBudgetCategoryId] = useState<string>()
  const [signInOpen, setSignInOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signOutPendingCount, setSignOutPendingCount] = useState(0)
  const [overviewPeriod, setOverviewPeriod] = useState<PeriodPreset>("month")
  const [overviewPeriodOpen, setOverviewPeriodOpen] = useState(false)
  const [overviewCustomRange, setOverviewCustomRange] = useState<DateRange>(
    () => ({ from: "", to: "" })
  )
  const { openTransaction } = useTransactionOverlay()
  const openNewTransaction = useCallback(
    () => openTransaction(),
    [openTransaction]
  )
  const appReady = isInteractive && !finance.isLoading
  const openBudget = useCallback((categoryId?: string) => {
    setBudgetCategoryId(categoryId)
    setBudgetOpen(true)
  }, [])
  const openSignIn = useCallback(() => setSignInOpen(true), [])
  const completeSignOut = useCallback(async () => {
    await signOut()
    await clearAccountData()
    toast.success("Signed out. Your guest workspace is still on this device.")
  }, [clearAccountData, signOut])
  const requestSignOut = useCallback(() => {
    void getPendingCount()
      .then(async (currentPendingCount) => {
        if (currentPendingCount > 0) {
          setSignOutPendingCount(currentPendingCount)
          setSignOutOpen(true)
          return
        }
        await completeSignOut()
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Sign-out failed.")
      })
  }, [completeSignOut, getPendingCount])
  const syncAndSignOut = useCallback(async () => {
    const remaining = await syncPendingChanges()
    if (remaining === 0) await completeSignOut()
    return remaining
  }, [completeSignOut, syncPendingChanges])
  const contextValue = useMemo(
    () => ({
      ...finance,
      openBudget,
      openSignIn,
      openTransaction,
      overviewCustomRange,
      overviewPeriod,
      overviewPeriodOpen,
      setOverviewCustomRange,
      setOverviewPeriod,
      setOverviewPeriodOpen,
      requestSignOut,
    }),
    [
      finance,
      openBudget,
      openSignIn,
      openTransaction,
      overviewCustomRange,
      overviewPeriod,
      overviewPeriodOpen,
      requestSignOut,
    ]
  )

  useEffect(() => {
    setIsInteractive(true)
  }, [])

  return (
    <CoinAppContext.Provider value={contextValue}>
      <SidebarProvider>
        <CoinSidebar
          view={view}
          onAdd={openNewTransaction}
          onSignIn={openSignIn}
          onSignOut={requestSignOut}
        />
        <SidebarInset
          data-app-ready={appReady ? "true" : "false"}
          aria-busy={!appReady}
          inert={!appReady}
          className="min-w-0 pb-24 md:pb-0"
        >
          <AppHeader view={view} onAdd={openNewTransaction} />
          <div
            key={view}
            data-testid="route-stage"
            data-view={view}
            className="coin-route-enter mx-auto flex w-full max-w-384 flex-1 flex-col px-4 py-5 sm:px-6 md:py-7 xl:px-8"
          >
            <div className="flex flex-col gap-5">
              <CloudWorkspaceStatus
                state={finance.cloudState}
                issue={finance.issue}
                isRefreshing={finance.isRefreshing}
                onRetry={() => void finance.retryCloud()}
              />
              {finance.storage === "cloud" && (
                <SyncStatus
                  pendingCount={finance.pendingCount}
                  conflicts={finance.conflicts}
                  isOnline={finance.isOnline}
                  onUseCloud={finance.useCloudConflict}
                  onUseDevice={finance.useDeviceConflict}
                />
              )}
              {finance.cloudState !== "loading" &&
                !(
                  finance.cloudState === "error" &&
                  finance.issue?.source !== "sync"
                ) &&
                !(
                  finance.cloudState === "offline" &&
                  finance.issue?.source === "load"
                ) && <Outlet />}
            </div>
          </div>
        </SidebarInset>

        <MobileDock view={view} onAdd={openNewTransaction} />
        <BudgetDialog
          open={budgetOpen}
          onOpenChange={setBudgetOpen}
          categories={finance.categories}
          budgets={finance.budgets}
          initialCategoryId={budgetCategoryId}
          onSubmit={finance.saveBudget}
          onDelete={finance.deleteBudget}
        />
        <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
        <GuardedSignOutDialog
          open={signOutOpen}
          onOpenChange={setSignOutOpen}
          pendingCount={Math.max(signOutPendingCount, finance.pendingCount)}
          isOnline={finance.isOnline}
          onSync={syncAndSignOut}
          onDiscardAndSignOut={completeSignOut}
        />
      </SidebarProvider>
    </CoinAppContext.Provider>
  )
}

export function OverviewPage() {
  const finance = useCoinApp()

  return (
    <OverviewView
      categories={finance.categories}
      transactions={finance.transactions}
      budgets={finance.budgets}
      onAdd={() => finance.openTransaction()}
      onEdit={finance.openTransaction}
      onBudget={finance.openBudget}
      onDelete={finance.deleteTransaction}
      onClearDemo={finance.clearDemoTransactions}
      period={finance.overviewPeriod}
      periodOpen={finance.overviewPeriodOpen}
      customRange={finance.overviewCustomRange}
      onPeriodOpenChange={finance.setOverviewPeriodOpen}
      onPeriodChange={finance.setOverviewPeriod}
      onCustomRangeChange={finance.setOverviewCustomRange}
    />
  )
}

export function TransactionsPage() {
  const finance = useCoinApp()

  return (
    <TransactionsView
      categories={finance.categories}
      transactions={finance.transactions}
      onAdd={() => finance.openTransaction()}
      onEdit={finance.openTransaction}
      onDelete={finance.deleteTransaction}
      onClearDemo={finance.clearDemoTransactions}
    />
  )
}

export function BudgetsPage() {
  const finance = useCoinApp()

  return (
    <BudgetsView
      categories={finance.categories}
      transactions={finance.transactions}
      budgets={finance.budgets}
      onBudget={finance.openBudget}
    />
  )
}

export function PreferencesPage() {
  const finance = useCoinApp()

  return (
    <PreferencesView
      categories={finance.categories}
      onSignIn={finance.openSignIn}
      onCreateCategory={finance.createCategory}
      onUpdateCategory={finance.updateCategory}
      onDeleteCategory={finance.deleteCategory}
    />
  )
}

export function ProfilePage() {
  const finance = useCoinApp()

  return (
    <ProfileView
      onSignIn={finance.openSignIn}
      onSignOut={finance.requestSignOut}
    />
  )
}

export function SettingsPage() {
  return <PreferencesPage />
}
