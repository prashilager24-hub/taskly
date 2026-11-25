const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
const numFmt = new Intl.NumberFormat("en-IN")

export const inr = (n: number) => inrFmt.format(n)
export const num = (n: number) => numFmt.format(n)

/** ₹12.4L / ₹1.2Cr style for dashboards. */
export function inrShort(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2).replace(/\.?0+$/, "")}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, "")}L`
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`
  return `₹${n}`
}
