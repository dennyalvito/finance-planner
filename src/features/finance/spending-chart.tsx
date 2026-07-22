import { Pie, PieChart } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { formatCompactRupiah } from "@/domain/finance"
import type { CategorySpending } from "@/domain/finance"

const chartConfig = {
  value: {
    label: "Spent",
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

export function SpendingChart({ data }: { data: CategorySpending[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const chartData = data.slice(0, 5).map((item, index) => ({
    ...item,
    fill: fills[index],
  }))

  if (!chartData.length) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
        No expense data yet
      </div>
    )
  }

  return (
    <div className="relative mx-auto size-44">
      <ChartContainer
        config={chartConfig}
        className="size-44"
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
            innerRadius={52}
            outerRadius={78}
            strokeWidth={3}
          />
        </PieChart>
      </ChartContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs text-muted-foreground">Spent</span>
        <span className="text-sm font-semibold tabular-nums">
          {formatCompactRupiah(total)}
        </span>
      </div>
    </div>
  )
}
