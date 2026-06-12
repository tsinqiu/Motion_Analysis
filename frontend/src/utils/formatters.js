export function formatDistance(value) {
  if (value === null || value === undefined) return '--'
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`
  return `${Math.round(value)} m`
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '--'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m ${rest}s`
}

export function formatClockDuration(seconds) {
  if (seconds === null || seconds === undefined) return '--'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = Math.floor(seconds % 60)
  return [hours, minutes, rest].map((part) => String(part).padStart(2, '0')).join(':')
}

export function formatPace(speedMps) {
  if (!speedMps) return '--'
  const secondsPerKm = 1000 / speedMps
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds} /km`
}

export function formatSpeed(speedMps) {
  if (!speedMps) return '--'
  return `${(speedMps * 3.6).toFixed(1)} km/h`
}

export function formatCalories(value) {
  if (value === null || value === undefined) return '--'
  return `${Math.round(value).toLocaleString('zh-CN')} kcal`
}

export function formatFatKg(calories) {
  if (!calories) return '--'
  return `${(calories / 7700).toFixed(2)} kg`
}

export function formatDateTime(value) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatDate(value) {
  if (!value) return '--'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}
