const idrIntegerFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
})

export function sanitizeIdrAmount(value: string) {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
}

export function formatIdrAmountInput(value: string) {
  const digits = sanitizeIdrAmount(value)
  return digits ? idrIntegerFormatter.format(BigInt(digits)) : ""
}

export function parseIdrAmount(value: string) {
  const digits = sanitizeIdrAmount(value)
  return digits ? Number(digits) : 0
}
