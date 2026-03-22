/**
 * 将毫秒级时间戳转换为中文相对时间描述
 */
export function formatRelativeTime(timestampMs: number | null | undefined): string {
   if (timestampMs == null || !Number.isFinite(timestampMs)) return '未知'

   const now = Date.now()
   const diffMs = now - timestampMs
   const absDiff = Math.abs(diffMs)
   const suffix = diffMs >= 0 ? '前' : '后'

   const seconds = Math.floor(absDiff / 1000)
   if (seconds < 60) return '刚刚'

   const minutes = Math.floor(seconds / 60)
   if (minutes < 60) return `${minutes}m ${suffix}`

   const hours = Math.floor(minutes / 60)
   if (hours < 48) return `${hours}h ${suffix}`

   const days = Math.floor(hours / 24)
   return `${days}d ${suffix}`
}
