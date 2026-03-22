/**
 * Overview 页面工具函数
 */

/** 将毫秒时长格式化为人类可读字符串，如 "2天 3小时 15分钟" */
export function formatDurationHuman(ms: number): string {
   if (ms < 60_000) return '< 1分钟'
   const totalMinutes = Math.floor(ms / 60_000)
   const days = Math.floor(totalMinutes / 1440)
   const hours = Math.floor((totalMinutes % 1440) / 60)
   const minutes = totalMinutes % 60
   const parts: string[] = []
   if (days > 0) parts.push(`${days}天`)
   if (hours > 0) parts.push(`${hours}小时`)
   if (minutes > 0) parts.push(`${minutes}分钟`)
   return parts.join(' ') || '< 1分钟'
}

/** 将时间戳格式化为相对时间，如 "3分钟前" */
export function formatRelativeTime(ts: number): string {
   const diff = Date.now() - ts
   if (diff < 60_000) return '刚刚'
   const minutes = Math.floor(diff / 60_000)
   if (minutes < 60) return `${minutes}分钟前`
   const hours = Math.floor(minutes / 60)
   if (hours < 24) return `${hours}小时前`
   const days = Math.floor(hours / 24)
   return `${days}天前`
}

/** 格式化费用 */
export function formatCost(cost?: number | null): string {
   if (cost == null || cost === 0) return '$0.00'
   if (cost < 0.01) return `$${cost.toFixed(4)}`
   return `$${cost.toFixed(2)}`
}

/** 格式化 token 数量，如 "12.3K" / "1.5M" */
export function formatTokens(n?: number | null): string {
   if (n == null || n === 0) return '0'
   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
   if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
   return String(n)
}

/** 去除 ANSI 转义码 */
export function stripAnsi(text: string): string {
   return text
      .replace(/\x1b\]8;;.*?\x1b\\|\x1b\]8;;\x1b\\/g, '')
      .replace(/\x1b\[[0-9;]*m/g, '')
}

/** 将 payload 序列化为预览字符串，截断到 maxLen */
export function formatEventPayload(payload: unknown, maxLen = 120): string {
   if (payload == null) return ''
   try {
      const str = JSON.stringify(payload)
      return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
   } catch {
      return String(payload)
   }
}
