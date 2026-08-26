import { Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { formatCompactRupiah } from "@/domain/finance"
import type { CategorySpending } from "@/domain/finance"
import { cn } from "@/lib/utils"

const chartConfig = {
  value: {
    label: "Amount",
  },
  first: { color: "var(--chart-1)" },
  second: { color: "var(--chart-2)" },
  third: { color: "var(--chart-3)" },
  fourth: { color: "var(--chart-4)" },
  fifth: { color: "var(--chart-5)" },
} satisfies ChartConfig

const fills = [
  "var(--color-first)",
  "var(--color-second)",
  "var(--color-third)",
  "var(--color-fourth)",
  "var(--color-fifth)",
]

export function SpendingChart({
  data,
  compact = false,
  centerLabel = "Spent",
  centerValue,
  centerTone = "default",
  emptyLabel = "No expense data yet",
}: {
  data: CategorySpending[]
  compact?: boolean
  centerLabel?: string
  centerValue?: number
  centerTone?: "default" | "positive" | "negative"
  emptyLabel?: string
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const chartData = data.slice(0, 5).map((item, index) => ({
    ...item,
    fill: fills[index],
  }))

  if (!chartData.length) {
    return (
      <div
        className={
          compact
            ? "flex size-36 items-center justify-center text-center text-xs text-muted-foreground"
            : "flex h-44 items-center justify-center text-sm text-muted-foreground"
        }
      >
        {emptyLabel}
      </div>
    )
  }

  return (
    <div
      className={
        compact ? "relative mx-auto size-36" : "relative mx-auto size-44"
      }
    >
      <ChartContainer
        config={chartConfig}
        className={compact ? "size-36" : "size-44"}
        data-testid="spending-chart"
      >
        <PieChart accessibilityLayer>
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => formatCompactRupiah(Number(value))}
              />
            }
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={compact ? 42 : 52}
            outerRadius={compact ? 64 : 78}
            strokeWidth={3}
          />
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs text-muted-foreground">{centerLabel}</span>
        <span
          className={cn(
            compact
              ? "text-xs font-semibold tabular-nums"
              : "text-sm font-semibold tabular-nums",
            centerTone === "positive" && "text-positive",
            centerTone === "negative" && "text-negative"
          )}
        >
          {formatCompactRupiah(centerValue ?? total)}
        </span>
      </div>
    </div>
  )
}
