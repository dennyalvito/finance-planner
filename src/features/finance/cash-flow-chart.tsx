import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { formatCompactRupiah } from "@/domain/finance"
import type { CashFlowPoint } from "@/domain/finance"

const chartConfig = {
  income: {
    label: "Income",
    color: "var(--chart-2)",
  },
  expense: {
    label: "Expense",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

function getSeriesLabel(name: string | number | undefined) {
  if (name === undefined) {
    return "Value"
  }

  const key = String(name)

  return key === "income" || key === "expense" ? chartConfig[key].label : key
}

export function CashFlowChart({ data }: { data: CashFlowPoint[] }) {
  return (
    <ChartContainer
      config={chartConfig}
      className="h-[260px] w-full min-w-0"
      data-testid="cash-flow-chart"
    >
      <AreaChart accessibilityLayer data={data}>
        <defs>
          <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-income)"
              stopOpacity={0.5}
            />
            <stop
              offset="95%"
              stopColor="var(--color-income)"
              stopOpacity={0.04}
            />
          </linearGradient>
          <linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-expense)"
              stopOpacity={0.4}
            />
            <stop
              offset="95%"
              stopColor="var(--color-expense)"
              stopOpacity={0.03}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={12}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex min-w-36 items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {getSeriesLabel(name)}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatCompactRupiah(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="income"
          stroke="var(--color-income)"
          fill="url(#income-fill)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="expense"
          stroke="var(--color-expense)"
          fill="url(#expense-fill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  )
}
