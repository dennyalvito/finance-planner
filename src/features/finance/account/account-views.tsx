import { useState } from "react"
import {
  CircleDollarSignIcon,
  ChevronRightIcon,
  CloudIcon,
  GaugeIcon,
  HardDriveIcon,
  LogInIcon,
  LogOutIcon,
  ShapesIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  calculateBudgetProgress,
  formatCompactRupiah,
  monthKey,
} from "@/domain/finance"
import type { Category } from "@/domain/finance"
import { CategoryManager } from "@/features/finance/category-manager"
import { getCategoryIcon } from "@/features/finance/category-icon"
import { accountInitials } from "@/features/finance/account/account-display"
import type { FinanceViewProps } from "@/features/finance/finance-view-types"
import { useAuth } from "@/features/auth/auth-provider"
import type { useFinance } from "@/features/finance/use-finance"

export function BudgetsView({
  categories,
  transactions,
  budgets,
  onBudget,
  canMutate,
}: FinanceViewProps & {
  onBudget: (categoryId?: string) => void
  canMutate: boolean
}) {
  const currentMonth = monthKey(new Date())
  const active = budgets.filter((budget) => budget.month === currentMonth)
  const overall = calculateBudgetProgress(transactions, budgets, currentMonth)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-[-0.03em] md:hidden">
        Budgets
      </h1>
      <Card className="bg-primary text-primary-foreground">
        <CardHeader>
          <CardTitle>Monthly breathing room</CardTitle>
          <CardDescription className="text-primary-foreground/65">
            Across every configured category
          </CardDescription>
          <CardAction>
            <GaugeIcon aria-hidden="true" />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <SummaryValue label="Limit" value={overall.limit} />
          <SummaryValue label="Spent" value={overall.spent} />
          <SummaryValue label="Remaining" value={overall.remaining} />
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2">
          <Progress
            value={overall.percentage}
            aria-label="Overall budget used"
          />
          <p className="text-xs text-primary-foreground/65">
            {Math.round(overall.percentage)}% used
          </p>
        </CardFooter>
      </Card>
      <section
        aria-label="Category budgets"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {active.map((budget) => {
          const category = categories.find(
            (item) => item.id === budget.categoryId
          )
          const spent = transactions
            .filter(
              (transaction) =>
                transaction.type === "expense" &&
                transaction.categoryId === budget.categoryId &&
                monthKey(transaction.date) === currentMonth
            )
            .reduce((total, transaction) => total + transaction.amount, 0)
          const percentage = Math.min((spent / budget.amount) * 100, 100)
          const Icon = getCategoryIcon(category?.name ?? "Other")
          return (
            <Card key={budget.id}>
              <CardHeader>
                <CardTitle>{category?.name ?? "Other"}</CardTitle>
                <CardDescription>
                  {formatCompactRupiah(spent)} spent
                </CardDescription>
                <CardAction>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-secondary">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatCompactRupiah(budget.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(percentage)}%
                  </p>
                </div>
                <Progress
                  value={percentage}
                  aria-label={`${category?.name ?? "Category"} budget used`}
                />
              </CardContent>
              <CardFooter>
                <div className="flex w-full items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onBudget(budget.categoryId)}
                    disabled={!canMutate}
                  >
                    Adjust limit
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )
        })}
        {!active.length && (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
              <GaugeIcon
                aria-hidden="true"
                className="size-7 text-muted-foreground"
              />
              <div>
                <p className="font-medium">No budget limits yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your recorded totals still work without them.
                </p>
              </div>
              <Button onClick={() => onBudget()} disabled={!canMutate}>
                Set the first budget
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}

function SummaryValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-primary-foreground/65">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] tabular-nums">
        {formatCompactRupiah(value)}
      </p>
    </div>
  )
}

export function PreferencesView({
  categories,
  onSignIn,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  canMutate,
}: {
  categories: Category[]
  onSignIn: () => void
  onCreateCategory: ReturnType<typeof useFinance>["createCategory"]
  onUpdateCategory: ReturnType<typeof useFinance>["updateCategory"]
  onDeleteCategory: ReturnType<typeof useFinance>["deleteCategory"]
  canMutate: boolean
}) {
  const auth = useAuth()
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const cloudWorkspace = auth.status === "authenticated"

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Card className="overflow-hidden">
        <CardHeader>
          <h1 className="font-heading text-base leading-snug font-medium">
            Preferences
          </h1>
          <CardDescription>
            Keep labels and display details easy to find.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Button
            variant="ghost"
            className="h-auto w-full justify-start rounded-none px-4 py-4 text-left"
            onClick={() => setCategoriesOpen(true)}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <ShapesIcon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Categories</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {categories.length} transaction labels
              </span>
            </span>
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
          <Separator />
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <CircleDollarSignIcon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Currency</p>
              <p className="text-xs text-muted-foreground">Indonesian rupiah</p>
            </div>
            <Badge variant="outline">IDR</Badge>
          </div>
        </CardContent>
      </Card>

      <CategoryManager
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories}
        canCustomize={cloudWorkspace}
        readOnly={!canMutate}
        onSignIn={onSignIn}
        onCreateCategory={onCreateCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
      />
    </div>
  )
}

export function ProfileView({
  onSignIn,
  onSignOut,
}: {
  onSignIn: () => void
  onSignOut: () => void
}) {
  const auth = useAuth()
  const cloudWorkspace = auth.status === "authenticated"
  const metadataName =
    typeof auth.user?.user_metadata.full_name === "string"
      ? auth.user.user_metadata.full_name
      : undefined
  const profileName = cloudWorkspace
    ? metadataName || auth.user?.email?.split("@")[0] || "Coin member"
    : "Guest profile"
  const profileDetail = cloudWorkspace
    ? auth.user?.email
    : "Your finance stays on this device"

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <h1 className="font-heading text-base leading-snug font-medium">
            Profile
          </h1>
          <CardDescription>
            Manage the account connected to this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 pt-2 text-center sm:flex-row sm:text-left">
          <Avatar className="size-16">
            <AvatarFallback className="text-lg font-semibold">
              {accountInitials(profileName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold tracking-[-0.02em]">
              {profileName}
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {profileDetail}
            </p>
          </div>
          {cloudWorkspace ? (
            <Button variant="outline" onClick={onSignOut}>
              <LogOutIcon data-icon="inline-start" />
              Sign out
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={!auth.configured || auth.status === "loading"}
              onClick={onSignIn}
            >
              <LogInIcon data-icon="inline-start" />
              Continue with Google
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            See where this workspace stores your recorded finance data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
            {cloudWorkspace ? (
              <CloudIcon aria-hidden="true" className="size-4" />
            ) : (
              <HardDriveIcon aria-hidden="true" className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {cloudWorkspace ? "Cloud workspace" : "On this device"}
            </p>
            <p className="text-xs text-muted-foreground">
              {cloudWorkspace
                ? "Stored in your private Coin account"
                : "Your guest ledger stays in this browser."}
            </p>
          </div>
          <Badge variant="outline">{cloudWorkspace ? "Cloud" : "Local"}</Badge>
        </CardContent>
      </Card>
    </div>
  )
}
