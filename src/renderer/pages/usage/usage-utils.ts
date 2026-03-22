import type {
   CostUsageTotals,
   SessionsUsageAggregates,
   SessionUsageEntry,
   SessionLatencyStats,
   SessionDailyLatency,
   SessionDailyModelUsage,
} from '../../../shared/types/gateway-protocol'
import type { UsageInsightStats, UsageMosaicStats } from './usage-types'

// ── 星期标签（中文） ──

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// ── 格式化工具 ──

export function formatTokens(n: number): string {
   if (n >= 1_000_000) {
      return `${(n / 1_000_000).toFixed(1)}M`
   }
   if (n >= 1_000) {
      return `${(n / 1_000).toFixed(1)}K`
   }
   return String(n)
}

export function formatCost(n: number, decimals = 2): string {
   return `$${n.toFixed(decimals)}`
}

export function formatDayLabel(dateStr: string): string {
   const date = parseYmdDate(dateStr)
   if (!date) return dateStr
   return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}

export function formatFullDate(dateStr: string): string {
   const date = parseYmdDate(dateStr)
   if (!date) return dateStr
   return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`
}

export function formatDurationCompact(ms?: number): string {
   if (!ms || ms <= 0) return '< 1m'
   const totalMinutes = Math.floor(ms / 60_000)
   if (totalMinutes < 1) return '< 1m'
   const hours = Math.floor(totalMinutes / 60)
   const minutes = totalMinutes % 60
   if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
   if (hours > 0) return `${hours}h`
   return `${minutes}m`
}

export function formatIsoDate(date: Date): string {
   const y = date.getFullYear()
   const m = String(date.getMonth() + 1).padStart(2, '0')
   const d = String(date.getDate()).padStart(2, '0')
   return `${y}-${m}-${d}`
}

export function pct(part: number, total: number): number {
   if (total <= 0) return 0
   return (part / total) * 100
}

// ── 日期解析 ──

function parseYmdDate(dateStr: string): Date | null {
   const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
   if (!match) return null
   const [, y, m, d] = match
   const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
   return Number.isNaN(date.valueOf()) ? null : date
}

// ── Totals 操作 ──

export function createEmptyCostUsageTotals(): CostUsageTotals {
   return {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      totalCost: 0,
      inputCost: 0,
      outputCost: 0,
      cacheReadCost: 0,
      cacheWriteCost: 0,
      missingCostEntries: 0,
   }
}

export function mergeCostUsageTotals(
   target: CostUsageTotals,
   source: Partial<CostUsageTotals>,
): void {
   target.input += source.input ?? 0
   target.output += source.output ?? 0
   target.cacheRead += source.cacheRead ?? 0
   target.cacheWrite += source.cacheWrite ?? 0
   target.totalTokens += source.totalTokens ?? 0
   target.totalCost += source.totalCost ?? 0
   target.inputCost += source.inputCost ?? 0
   target.outputCost += source.outputCost ?? 0
   target.cacheReadCost += source.cacheReadCost ?? 0
   target.cacheWriteCost += source.cacheWriteCost ?? 0
   target.missingCostEntries += source.missingCostEntries ?? 0
}

// ── 时区工具 ──

export function getZonedHour(date: Date, zone: 'local' | 'utc'): number {
   return zone === 'utc' ? date.getUTCHours() : date.getHours()
}

export function getZonedWeekday(date: Date, zone: 'local' | 'utc'): number {
   return zone === 'utc' ? date.getUTCDay() : date.getDay()
}

function setToHourEnd(date: Date, zone: 'local' | 'utc'): Date {
   const next = new Date(date)
   if (zone === 'utc') {
      next.setUTCMinutes(59, 59, 999)
   } else {
      next.setMinutes(59, 59, 999)
   }
   return next
}

// ── Latency 合并（内联自 openclaw/src/shared/usage-aggregates） ──

interface LatencyTotals {
   count: number
   sum: number
   min: number
   max: number
   p95Max: number
}

interface DailyLatencyAccum {
   date: string
   count: number
   sum: number
   min: number
   max: number
   p95Max: number
}

function mergeLatency(
   totals: LatencyTotals,
   latency: SessionLatencyStats | undefined,
): void {
   if (!latency || latency.count <= 0) return
   totals.count += latency.count
   totals.sum += latency.avgMs * latency.count
   totals.min = Math.min(totals.min, latency.minMs)
   totals.max = Math.max(totals.max, latency.maxMs)
   totals.p95Max = Math.max(totals.p95Max, latency.p95Ms)
}

function mergeDailyLatency(
   map: Map<string, DailyLatencyAccum>,
   dailyLatency?: SessionDailyLatency[] | null,
): void {
   for (const day of dailyLatency ?? []) {
      const existing = map.get(day.date) ?? {
         date: day.date,
         count: 0,
         sum: 0,
         min: Number.POSITIVE_INFINITY,
         max: 0,
         p95Max: 0,
      }
      existing.count += day.count
      existing.sum += day.avgMs * day.count
      existing.min = Math.min(existing.min, day.minMs)
      existing.max = Math.max(existing.max, day.maxMs)
      existing.p95Max = Math.max(existing.p95Max, day.p95Ms)
      map.set(day.date, existing)
   }
}

// ── 聚合：从会话构建 Aggregates ──

export function buildAggregatesFromSessions(
   sessions: SessionUsageEntry[],
   fallback?: SessionsUsageAggregates | null,
): SessionsUsageAggregates {
   if (sessions.length === 0) {
      return (
         fallback ?? {
            messages: {
               total: 0, user: 0, assistant: 0,
               toolCalls: 0, toolResults: 0, errors: 0,
            },
            tools: { totalCalls: 0, uniqueTools: 0, tools: [] },
            byModel: [],
            byProvider: [],
            byAgent: [],
            byChannel: [],
            daily: [],
         }
      )
   }

   const messages = {
      total: 0, user: 0, assistant: 0,
      toolCalls: 0, toolResults: 0, errors: 0,
   }

   const toolMap = new Map<string, number>()
   const modelMap = new Map<
      string,
      { provider?: string; model?: string; count: number; totals: CostUsageTotals }
   >()
   const providerMap = new Map<
      string,
      { provider?: string; model?: string; count: number; totals: CostUsageTotals }
   >()
   const agentMap = new Map<string, CostUsageTotals>()
   const channelMap = new Map<string, CostUsageTotals>()
   const dailyMap = new Map<
      string,
      {
         date: string
         tokens: number
         cost: number
         messages: number
         toolCalls: number
         errors: number
      }
   >()
   const dailyLatencyMap = new Map<string, DailyLatencyAccum>()
   const modelDailyMap = new Map<
      string,
      {
         date: string
         provider?: string
         model?: string
         tokens: number
         cost: number
         count: number
      }
   >()
   const latencyTotals: LatencyTotals = {
      count: 0, sum: 0,
      min: Number.POSITIVE_INFINITY, max: 0, p95Max: 0,
   }

   for (const session of sessions) {
      const usage = session.usage
      if (!usage) continue

      // 消息统计
      if (usage.messageCounts) {
         messages.total += usage.messageCounts.total
         messages.user += usage.messageCounts.user
         messages.assistant += usage.messageCounts.assistant
         messages.toolCalls += usage.messageCounts.toolCalls
         messages.toolResults += usage.messageCounts.toolResults
         messages.errors += usage.messageCounts.errors
      }

      // 工具统计
      if (usage.toolUsage) {
         for (const tool of usage.toolUsage.tools) {
            toolMap.set(tool.name, (toolMap.get(tool.name) ?? 0) + tool.count)
         }
      }

      // 模型 & 提供商统计
      if (usage.modelUsage) {
         for (const entry of usage.modelUsage) {
            const modelKey =
               `${entry.provider ?? 'unknown'}::${entry.model ?? 'unknown'}`
            const modelExisting = modelMap.get(modelKey) ?? {
               provider: entry.provider,
               model: entry.model,
               count: 0,
               totals: createEmptyCostUsageTotals(),
            }
            modelExisting.count += entry.count
            mergeCostUsageTotals(modelExisting.totals, entry.totals)
            modelMap.set(modelKey, modelExisting)

            const providerKey = entry.provider ?? 'unknown'
            const providerExisting = providerMap.get(providerKey) ?? {
               provider: entry.provider,
               model: undefined,
               count: 0,
               totals: createEmptyCostUsageTotals(),
            }
            providerExisting.count += entry.count
            mergeCostUsageTotals(providerExisting.totals, entry.totals)
            providerMap.set(providerKey, providerExisting)
         }
      }

      // 延迟统计
      mergeLatency(latencyTotals, usage.latency)

      // Agent 统计
      if (session.agentId) {
         const totals =
            agentMap.get(session.agentId) ?? createEmptyCostUsageTotals()
         mergeCostUsageTotals(totals, usage)
         agentMap.set(session.agentId, totals)
      }

      // Channel 统计
      if (session.channel) {
         const totals =
            channelMap.get(session.channel) ?? createEmptyCostUsageTotals()
         mergeCostUsageTotals(totals, usage)
         channelMap.set(session.channel, totals)
      }

      // 每日 token/cost 统计
      for (const day of usage.dailyBreakdown ?? []) {
         const daily = dailyMap.get(day.date) ?? {
            date: day.date, tokens: 0, cost: 0,
            messages: 0, toolCalls: 0, errors: 0,
         }
         daily.tokens += day.tokens
         daily.cost += day.cost
         dailyMap.set(day.date, daily)
      }

      // 每日消息统计
      for (const day of usage.dailyMessageCounts ?? []) {
         const daily = dailyMap.get(day.date) ?? {
            date: day.date, tokens: 0, cost: 0,
            messages: 0, toolCalls: 0, errors: 0,
         }
         daily.messages += day.total
         daily.toolCalls += day.toolCalls
         daily.errors += day.errors
         dailyMap.set(day.date, daily)
      }

      // 每日延迟
      mergeDailyLatency(dailyLatencyMap, usage.dailyLatency)

      // 每日模型统计
      for (const day of usage.dailyModelUsage ?? []) {
         const key =
            `${day.date}::${day.provider ?? 'unknown'}::${day.model ?? 'unknown'}`
         const existing = modelDailyMap.get(key) ?? {
            date: day.date,
            provider: day.provider,
            model: day.model,
            tokens: 0, cost: 0, count: 0,
         }
         existing.tokens += day.tokens
         existing.cost += day.cost
         existing.count += day.count
         modelDailyMap.set(key, existing)
      }
   }

   // 构建 byChannel
   const byChannel = Array.from(channelMap.entries())
      .map(([channel, totals]) => ({ channel, totals }))
      .toSorted((a, b) => b.totals.totalCost - a.totals.totalCost)

   // 构建 latency
   const latency: SessionLatencyStats | undefined =
      latencyTotals.count > 0
         ? {
              count: latencyTotals.count,
              avgMs: latencyTotals.sum / latencyTotals.count,
              minMs: latencyTotals.min === Number.POSITIVE_INFINITY
                 ? 0 : latencyTotals.min,
              maxMs: latencyTotals.max,
              p95Ms: latencyTotals.p95Max,
           }
         : undefined

   // 构建 dailyLatency
   const dailyLatency: SessionDailyLatency[] =
      Array.from(dailyLatencyMap.values())
         .map((entry) => ({
            date: entry.date,
            count: entry.count,
            avgMs: entry.count ? entry.sum / entry.count : 0,
            minMs: entry.min === Number.POSITIVE_INFINITY ? 0 : entry.min,
            maxMs: entry.max,
            p95Ms: entry.p95Max,
         }))
         .toSorted((a, b) => a.date.localeCompare(b.date))

   // 构建 modelDaily
   const modelDaily: SessionDailyModelUsage[] =
      Array.from(modelDailyMap.values()).toSorted(
         (a, b) => a.date.localeCompare(b.date) || b.cost - a.cost,
      )

   return {
      messages,
      tools: {
         totalCalls: Array.from(toolMap.values())
            .reduce((sum, count) => sum + count, 0),
         uniqueTools: toolMap.size,
         tools: Array.from(toolMap.entries())
            .map(([name, count]) => ({ name, count }))
            .toSorted((a, b) => b.count - a.count),
      },
      byModel: Array.from(modelMap.values()).toSorted(
         (a, b) => b.totals.totalCost - a.totals.totalCost,
      ),
      byProvider: Array.from(providerMap.values()).toSorted(
         (a, b) => b.totals.totalCost - a.totals.totalCost,
      ),
      byAgent: Array.from(agentMap.entries())
         .map(([agentId, totals]) => ({ agentId, totals }))
         .toSorted((a, b) => b.totals.totalCost - a.totals.totalCost),
      byChannel,
      latency,
      dailyLatency,
      modelDaily,
      daily: Array.from(dailyMap.values()).toSorted(
         (a, b) => a.date.localeCompare(b.date),
      ),
   }
}

// ── 洞察统计 ──

export function buildUsageInsightStats(
   sessions: SessionUsageEntry[],
   totals: CostUsageTotals | null,
   aggregates: SessionsUsageAggregates,
): UsageInsightStats {
   let durationSumMs = 0
   let durationCount = 0
   for (const session of sessions) {
      const duration = session.usage?.durationMs ?? 0
      if (duration > 0) {
         durationSumMs += duration
         durationCount += 1
      }
   }

   const avgDurationMs = durationCount ? durationSumMs / durationCount : 0
   const throughputTokensPerMin =
      totals && durationSumMs > 0
         ? totals.totalTokens / (durationSumMs / 60_000)
         : undefined
   const throughputCostPerMin =
      totals && durationSumMs > 0
         ? totals.totalCost / (durationSumMs / 60_000)
         : undefined

   const errorRate = aggregates.messages.total
      ? aggregates.messages.errors / aggregates.messages.total
      : 0

   const peakErrorDay = aggregates.daily
      .filter((day) => day.messages > 0 && day.errors > 0)
      .map((day) => ({
         date: day.date,
         errors: day.errors,
         messages: day.messages,
         rate: day.errors / day.messages,
      }))
      .toSorted((a, b) => b.rate - a.rate || b.errors - a.errors)[0]

   return {
      durationSumMs,
      durationCount,
      avgDurationMs,
      throughputTokensPerMin,
      throughputCostPerMin,
      errorRate,
      peakErrorDay,
   }
}

// ── 热力图/马赛克统计 ──

export function buildUsageMosaicStats(
   sessions: SessionUsageEntry[],
   timeZone: 'local' | 'utc',
): UsageMosaicStats {
   const hourTotals = Array.from({ length: 24 }, () => 0)
   const weekdayTotals = Array.from({ length: 7 }, () => 0)
   let totalTokens = 0
   let hasData = false

   for (const session of sessions) {
      const usage = session.usage
      if (!usage || !usage.totalTokens || usage.totalTokens <= 0) continue
      totalTokens += usage.totalTokens

      const start = usage.firstActivity ?? session.updatedAt
      const end = usage.lastActivity ?? session.updatedAt
      if (!start || !end) continue
      hasData = true

      const startMs = Math.min(start, end)
      const endMs = Math.max(start, end)
      const durationMs = Math.max(endMs - startMs, 1)
      const totalMinutes = durationMs / 60_000

      let cursor = startMs
      while (cursor < endMs) {
         const date = new Date(cursor)
         const hour = getZonedHour(date, timeZone)
         const weekday = getZonedWeekday(date, timeZone)
         const nextHour = setToHourEnd(date, timeZone)
         const nextMs = Math.min(nextHour.getTime(), endMs)
         const minutes = Math.max((nextMs - cursor) / 60_000, 0)
         const share = minutes / totalMinutes
         hourTotals[hour] += usage.totalTokens * share
         weekdayTotals[weekday] += usage.totalTokens * share
         cursor = nextMs + 1
      }
   }

   const weekdayLabels = WEEKDAYS.map((label, index) => ({
      label,
      tokens: weekdayTotals[index],
   }))

   return { hasData, totalTokens, hourTotals, weekdayTotals: weekdayLabels }
}

// ── 错误高峰小时分布 ──

function formatHourLabel(hour: number): string {
   const date = new Date()
   date.setHours(hour, 0, 0, 0)
   return date.toLocaleTimeString('zh-CN', { hour: 'numeric' })
}

export function buildPeakErrorHours(
   sessions: SessionUsageEntry[],
   timeZone: 'local' | 'utc',
): Array<{ label: string; value: string; sub: string }> {
   const hourErrors = Array.from({ length: 24 }, () => 0)
   const hourMsgs = Array.from({ length: 24 }, () => 0)

   for (const session of sessions) {
      const usage = session.usage
      if (!usage?.messageCounts || usage.messageCounts.total === 0) continue

      const start = usage.firstActivity ?? session.updatedAt
      const end = usage.lastActivity ?? session.updatedAt
      if (!start || !end) continue

      const startMs = Math.min(start, end)
      const endMs = Math.max(start, end)
      const durationMs = Math.max(endMs - startMs, 1)
      const totalMinutes = durationMs / 60_000

      let cursor = startMs
      while (cursor < endMs) {
         const date = new Date(cursor)
         const hour = getZonedHour(date, timeZone)
         const nextHour = setToHourEnd(date, timeZone)
         const nextMs = Math.min(nextHour.getTime(), endMs)
         const minutes = Math.max((nextMs - cursor) / 60_000, 0)
         const share = minutes / totalMinutes
         hourErrors[hour] += usage.messageCounts.errors * share
         hourMsgs[hour] += usage.messageCounts.total * share
         cursor = nextMs + 1
      }
   }

   return hourMsgs
      .map((msgs, hour) => {
         const errors = hourErrors[hour]
         const rate = msgs > 0 ? errors / msgs : 0
         return { hour, rate, errors, msgs }
      })
      .filter((entry) => entry.msgs > 0 && entry.errors > 0)
      .toSorted((a, b) => b.rate - a.rate)
      .slice(0, 5)
      .map((entry) => ({
         label: formatHourLabel(entry.hour),
         value: `${(entry.rate * 100).toFixed(2)}%`,
         sub: `${Math.round(entry.errors)} 错误 · ${Math.round(entry.msgs)} 消息`,
      }))
}

// ── 错误高峰日分布 ──

export function buildPeakErrorDays(
   aggregates: SessionsUsageAggregates,
): Array<{ label: string; value: string; sub: string }> {
   return aggregates.daily
      .filter((day) => day.messages > 0 && day.errors > 0)
      .map((day) => ({
         date: day.date,
         errors: day.errors,
         messages: day.messages,
         rate: day.errors / day.messages,
      }))
      .toSorted((a, b) => b.rate - a.rate || b.errors - a.errors)
      .slice(0, 5)
      .map((entry) => ({
         label: formatDayLabel(entry.date),
         value: `${(entry.rate * 100).toFixed(2)}%`,
         sub: `${entry.errors} 错误 · ${entry.messages} 消息`,
      }))
}
