const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 1,
})

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function formatCurrency(value: number | undefined): string {
  if (value === undefined) {
    return '未记录'
  }

  return currencyFormatter.format(value)
}

export function formatScore(value: number | undefined): string {
  if (value === undefined) {
    return '待探'
  }

  return numberFormatter.format(value)
}

export function formatDate(value: string): string {
  const parsed = Date.parse(value)

  if (Number.isNaN(parsed)) {
    return value
  }

  return dateFormatter.format(parsed)
}

export function formatLocalDateInputValue(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

