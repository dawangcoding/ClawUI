// ── Token 格式化工具函数 ──
// 移植自 openclaw/src/utils/usage-format.ts

export function formatTokenCount(value?: number): string {
   if (value === undefined || !Number.isFinite(value)) {
      return '0'
   }
   const safe = Math.max(0, value)
   if (safe >= 1_000_000) {
      return `${(safe / 1_000_000).toFixed(1)}m`
   }
   if (safe >= 1_000) {
      const precision = safe >= 10_000 ? 0 : 1
      const formattedThousands = (safe / 1_000).toFixed(precision)
      if (Number(formattedThousands) >= 1_000) {
         return `${(safe / 1_000_000).toFixed(1)}m`
      }
      return `${formattedThousands}k`
   }
   return String(Math.round(safe))
}

export function formatInputTokens(value?: number): string | null {
   if (value === undefined || value <= 0) return null
   return `↑${formatTokenCount(value)}`
}

export function formatOutputTokens(value?: number): string | null {
   if (value === undefined || value <= 0) return null
   return `↓${formatTokenCount(value)}`
}

export function formatCacheReadTokens(value?: number): string | null {
   if (value === undefined || value <= 0) return null
   return `R${formatTokenCount(value)}`
}

export function formatContextPercent(
   sessionTotalTokens?: number,
   contextTokens?: number,
): string | null {
   if (
      sessionTotalTokens === undefined ||
      contextTokens === undefined ||
      contextTokens <= 0
   ) {
      return null
   }
   const pct = Math.min(999, Math.round((sessionTotalTokens / contextTokens) * 100))
   return `${pct}% ctx`
}

export function formatMessageTime(timestamp: number): string {
   const d = new Date(timestamp)
   const h = String(d.getHours()).padStart(2, '0')
   const m = String(d.getMinutes()).padStart(2, '0')
   return `${h}:${m}`
}
