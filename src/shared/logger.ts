function timestamp(): string {
   const d = new Date()
   const h = String(d.getHours()).padStart(2, '0')
   const m = String(d.getMinutes()).padStart(2, '0')
   const s = String(d.getSeconds()).padStart(2, '0')
   const ms = String(d.getMilliseconds()).padStart(3, '0')
   return `${h}:${m}:${s}.${ms}`
}

const TRUNCATE_LIMIT = 15

/** 截断字符串，超过 limit 个字符只保留前 limit 个并附加 "…" */
export function truncateStr(value: string, limit = TRUNCATE_LIMIT): string {
   return value.length > limit ? value.slice(0, limit) + '…' : value
}

/**
 * 递归深拷贝对象，将所有长字符串截断为前 limit 个字符。
 * 返回一个新对象（不修改原值），可直接 JSON.stringify 输出完整结构。
 */
function truncateDeep(value: unknown, limit: number): unknown {
   if (value === null || value === undefined) return value
   if (typeof value === 'string') return truncateStr(value, limit)
   if (typeof value === 'number' || typeof value === 'boolean') return value
   if (Array.isArray(value)) return value.map((item) => truncateDeep(item, limit))
   if (typeof value === 'object') {
      const result: Record<string, unknown> = {}
      for (const key of Object.keys(value as Record<string, unknown>)) {
         result[key] = truncateDeep((value as Record<string, unknown>)[key], limit)
      }
      return result
   }
   return value
}

/**
 * 将任意值序列化为完整的 JSON 字符串，其中所有长字符串字段自动截断到前 15 个字符。
 * 保留完整的对象层级结构，适合打印全量通信内容。
 */
export function summarizeValue(value: unknown, limit = TRUNCATE_LIMIT): string {
   if (value === undefined) return 'undefined'
   try {
      return JSON.stringify(truncateDeep(value, limit))
   } catch {
      return String(value)
   }
}

export interface Logger {
   log: (msg: string, ...args: unknown[]) => void
   warn: (msg: string, ...args: unknown[]) => void
   error: (msg: string, ...args: unknown[]) => void
   debug: (msg: string, ...args: unknown[]) => void
}

export function createLogger(module: string): Logger {
   return {
      log: (msg: string, ...args: unknown[]) =>
         console.log(`[${timestamp()}] [${module}] ${msg}`, ...args),
      warn: (msg: string, ...args: unknown[]) =>
         console.warn(`[${timestamp()}] [${module}] ${msg}`, ...args),
      error: (msg: string, ...args: unknown[]) =>
         console.error(`[${timestamp()}] [${module}] ${msg}`, ...args),
      debug: (msg: string, ...args: unknown[]) =>
         console.debug(`[${timestamp()}] [${module}] ${msg}`, ...args),
   }
}
