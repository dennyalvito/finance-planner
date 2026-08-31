const startupRetryDelays = [500, 1_500] as const

type AccountDataLoaderOptions<T> = {
  load: () => Promise<T>
  canRetry: () => boolean
  retryDelays?: readonly number[]
  wait?: (delay: number) => Promise<void>
}

function waitFor(delay: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delay))
}

export async function loadAccountDataWithRetry<T>({
  load,
  canRetry,
  retryDelays = startupRetryDelays,
  wait = waitFor,
}: AccountDataLoaderOptions<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await load()
    } catch (error) {
      const delay = retryDelays.at(attempt)
      if (delay === undefined || !canRetry()) throw error
      await wait(delay)
      if (!canRetry()) throw error
    }
  }
}
