import { startTransition, useEffect, useState } from "react"

const initialItemCount = 18
const itemBatchSize = 18
const batchDelayMs = 100

export function useProgressiveItemLimit(total: number, enabled: boolean) {
  const [limit, setLimit] = useState(() =>
    enabled ? Math.min(initialItemCount, total) : total
  )

  useEffect(() => {
    setLimit(enabled ? Math.min(initialItemCount, total) : total)
  }, [enabled, total])

  useEffect(() => {
    if (!enabled || limit >= total) return

    const timeout = window.setTimeout(() => {
      startTransition(() => {
        setLimit((current) => Math.min(current + itemBatchSize, total))
      })
    }, batchDelayMs)

    return () => window.clearTimeout(timeout)
  }, [enabled, limit, total])

  return enabled ? Math.min(limit, total) : total
}
