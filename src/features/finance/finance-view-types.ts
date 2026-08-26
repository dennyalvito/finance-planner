import type { Budget, Category, FinanceTransaction } from "@/domain/finance"

export type CoinView =
  "overview" | "transactions" | "budgets" | "preferences" | "profile"

export type PeriodPreset = "day" | "week" | "month" | "year" | "custom"
export type TransactionPeriod = "all" | PeriodPreset

export type DateRange = {
  from: string
  to: string
}

export type FinanceViewProps = {
  categories: Category[]
  transactions: FinanceTransaction[]
  budgets: Budget[]
}

export const periodOptions: Array<{ value: PeriodPreset; label: string }> = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom" },
]

export const transactionPeriodOptions: Array<{
  value: TransactionPeriod
  label: string
}> = [{ value: "all", label: "All dates" }, ...periodOptions]

export function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

export function dateFromKey(value: string) {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function formatPeriodDate(value: string) {
  const date = dateFromKey(value)
  if (!date) return "Select date"

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function getPeriodRange(
  period: PeriodPreset,
  customRange: DateRange,
  now = new Date()
): DateRange {
  if (period === "custom" && customRange.from && customRange.to) {
    return customRange
  }
  if (period === "custom") period = "month"

  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const to = new Date(from)

  if (period === "week") {
    const mondayOffset = (from.getDay() + 6) % 7
    from.setDate(from.getDate() - mondayOffset)
    to.setDate(from.getDate() + 6)
  } else if (period === "month") {
    from.setDate(1)
    to.setMonth(to.getMonth() + 1, 0)
  } else if (period === "year") {
    from.setMonth(0, 1)
    to.setMonth(11, 31)
  }

  return { from: dateKey(from), to: dateKey(to) }
}

export function getPeriodLabel(period: PeriodPreset, range: DateRange) {
  if (period !== "custom") {
    return periodOptions.find((option) => option.value === period)?.label ?? ""
  }
  if (!range.from || !range.to) return "Custom period"

  const format = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    })

  return `${format(range.from)} – ${format(range.to)}`
}
