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
import { useAuth } from "@/features/auth/auth-provider"
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
import { BudgetDialog } from "@/features/finance/budget-dialog"
import { CloudWorkspaceStatus } from "@/features/finance/cloud-workspace-status"
import type {
  DateRange,
  PeriodPreset,
} from "@/features/finance/finance-view-types"
import { OverviewView } from "@/features/finance/overview/overview-view"
import { TransactionDialog } from "@/features/finance/transaction-dialog"
import { TransactionsView } from "@/features/finance/transactions/transaction-history"
import { useFinance } from "@/features/finance/use-finance"

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
  disabled,
  onCreateCategory,
  onAdd,
  onUpdate,
}: {
  categories: Category[]
  children: ReactNode
  disabled: boolean
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
        disabled={disabled}
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
      disabled={!finance.canMutate}
      onCreateCategory={finance.createCategory}
      onAdd={finance.addTransaction}
      onUpdate={finance.updateTransaction}
    >
      <CoinAppShell finance={finance} />
    </TransactionOverlayProvider>
  )
}

function CoinAppShell({ finance }: { finance: ReturnType<typeof useFinance> }) {
  const { signOut } = useAuth()
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const view = getView(pathname)
  const [isInteractive, setIsInteractive] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [budgetCategoryId, setBudgetCategoryId] = useState<string>()
  const [signInOpen, setSignInOpen] = useState(false)
  const [overviewPeriod, setOverviewPeriod] = useState<PeriodPreset>("month")
  const [overviewPeriodOpen, setOverviewPeriodOpen] = useState(false)
  const [overviewCustomRange, setOverviewCustomRange] = useState<DateRange>(
    () => ({ from: "", to: "" })
  )
  const { openTransaction } = useTransactionOverlay()
  const appReady = isInteractive && !finance.isLoading
  const showReadOnlyMessage = useCallback(() => {
    toast.error("Account data is read-only while offline.")
  }, [])
  const openEditableTransaction = useCallback(
    (transaction?: FinanceTransaction) => {
      if (!finance.canMutate) {
        showReadOnlyMessage()
        return
      }
      openTransaction(transaction)
    },
    [finance.canMutate, openTransaction, showReadOnlyMessage]
  )
  const openNewTransaction = useCallback(
    () => openEditableTransaction(),
    [openEditableTransaction]
  )
  const openBudget = useCallback(
    (categoryId?: string) => {
      if (!finance.canMutate) {
        showReadOnlyMessage()
        return
      }
      setBudgetCategoryId(categoryId)
      setBudgetOpen(true)
    },
    [finance.canMutate, showReadOnlyMessage]
  )
  const openSignIn = useCallback(() => setSignInOpen(true), [])
  const requestSignOut = useCallback(() => {
    void signOut()
      .then(() => {
        toast.success(
          "Signed out. Your guest workspace is still on this device."
        )
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Sign-out failed.")
      })
  }, [signOut])
  const contextValue = useMemo(
    () => ({
      ...finance,
      openBudget,
      openSignIn,
      openTransaction: openEditableTransaction,
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
      openEditableTransaction,
      openSignIn,
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
          canMutate={finance.canMutate}
        />
        <SidebarInset
          data-app-ready={appReady ? "true" : "false"}
          aria-busy={!appReady}
          inert={!appReady}
          className="min-w-0 pb-24 md:pb-0"
        >
          <AppHeader
            view={view}
            onAdd={openNewTransaction}
            canMutate={finance.canMutate}
          />
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
                hasSnapshot={finance.hasCloudSnapshot}
                onRetry={() => void finance.retryCloud()}
              />
              {finance.cloudState !== "loading" &&
                !(
                  (finance.cloudState === "error" ||
                    finance.cloudState === "offline") &&
                  !finance.hasCloudSnapshot
                ) && <Outlet />}
            </div>
          </div>
        </SidebarInset>

        <MobileDock
          view={view}
          onAdd={openNewTransaction}
          canMutate={finance.canMutate}
        />
        <BudgetDialog
          open={budgetOpen}
          onOpenChange={setBudgetOpen}
          categories={finance.categories}
          budgets={finance.budgets}
          initialCategoryId={budgetCategoryId}
          disabled={!finance.canMutate}
          onSubmit={finance.saveBudget}
          onDelete={finance.deleteBudget}
        />
        <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
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
      canMutate={finance.canMutate}
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
      canMutate={finance.canMutate}
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
      canMutate={finance.canMutate}
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
      canMutate={finance.canMutate}
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
