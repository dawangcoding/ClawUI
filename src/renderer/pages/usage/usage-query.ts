import type {
   SessionUsageEntry,
   SessionsUsageAggregates,
   CostUsageDailyEntry,
} from '../../../shared/types/gateway-protocol'
import type { QuerySuggestion } from './usage-types'

// ── 类型定义 ──

export type UsageQueryTerm = {
   key?: string
   value: string
   raw: string
}

export type UsageQueryResult = {
   sessions: SessionUsageEntry[]
   warnings: string[]
}

// ── 查询键集合 ──

const QUERY_KEYS = new Set([
   'agent',
   'channel',
   'chat',
   'provider',
   'model',
   'tool',
   'label',
   'key',
   'session',
   'id',
   'has',
   'mintokens',
   'maxtokens',
   'mincost',
   'maxcost',
   'minmessages',
   'maxmessages',
])

// ── 内部工具函数 ──

const normalizeQueryText = (value: string): string => value.trim().toLowerCase()

const globToRegex = (pattern: string): RegExp => {
   const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
   return new RegExp(`^${escaped}$`, 'i')
}

const parseQueryNumber = (value: string): number | null => {
   let raw = value.trim().toLowerCase()
   if (!raw) return null
   if (raw.startsWith('$')) raw = raw.slice(1)
   let multiplier = 1
   if (raw.endsWith('k')) {
      multiplier = 1_000
      raw = raw.slice(0, -1)
   } else if (raw.endsWith('m')) {
      multiplier = 1_000_000
      raw = raw.slice(0, -1)
   }
   const parsed = Number(raw)
   if (!Number.isFinite(parsed)) return null
   return parsed * multiplier
}

const getSessionText = (session: SessionUsageEntry): string[] => {
   const items: Array<string | undefined> = [
      session.label,
      session.key,
      session.sessionId,
   ]
   return items
      .filter((item): item is string => Boolean(item))
      .map((item) => item.toLowerCase())
}

const getSessionProviders = (session: SessionUsageEntry): string[] => {
   const providers = new Set<string>()
   if (session.modelProvider) {
      providers.add(session.modelProvider.toLowerCase())
   }
   if (session.providerOverride) {
      providers.add(session.providerOverride.toLowerCase())
   }
   if (session.origin?.provider) {
      providers.add(session.origin.provider.toLowerCase())
   }
   for (const entry of session.usage?.modelUsage ?? []) {
      if (entry.provider) {
         providers.add(entry.provider.toLowerCase())
      }
   }
   return Array.from(providers)
}

const getSessionModels = (session: SessionUsageEntry): string[] => {
   const models = new Set<string>()
   if (session.model) {
      models.add(session.model.toLowerCase())
   }
   for (const entry of session.usage?.modelUsage ?? []) {
      if (entry.model) {
         models.add(entry.model.toLowerCase())
      }
   }
   return Array.from(models)
}

const getSessionTools = (session: SessionUsageEntry): string[] =>
   (session.usage?.toolUsage?.tools ?? []).map((tool) => tool.name.toLowerCase())

// ── 查询解析 ──

export function extractQueryTerms(query: string): UsageQueryTerm[] {
   const rawTokens = query.match(/"[^"]+"|\S+/g) ?? []
   return rawTokens.map((token) => {
      const cleaned = token.replace(/^"|"$/g, '')
      const idx = cleaned.indexOf(':')
      if (idx > 0) {
         const key = cleaned.slice(0, idx)
         const value = cleaned.slice(idx + 1)
         return { key, value, raw: cleaned }
      }
      return { value: cleaned, raw: cleaned }
   })
}

export function matchesUsageQuery(
   session: SessionUsageEntry,
   term: UsageQueryTerm,
): boolean {
   const value = normalizeQueryText(term.value ?? '')
   if (!value) return true
   if (!term.key) {
      return getSessionText(session).some((text) => text.includes(value))
   }

   const key = normalizeQueryText(term.key)
   switch (key) {
      case 'agent':
         return session.agentId?.toLowerCase().includes(value) ?? false
      case 'channel':
         return session.channel?.toLowerCase().includes(value) ?? false
      case 'chat':
         return session.chatType?.toLowerCase().includes(value) ?? false
      case 'provider':
         return getSessionProviders(session).some((p) => p.includes(value))
      case 'model':
         return getSessionModels(session).some((m) => m.includes(value))
      case 'tool':
         return getSessionTools(session).some((t) => t.includes(value))
      case 'label':
         return session.label?.toLowerCase().includes(value) ?? false
      case 'key':
      case 'session':
      case 'id': {
         if (value.includes('*') || value.includes('?')) {
            const regex = globToRegex(value)
            return (
               regex.test(session.key) ||
               (session.sessionId ? regex.test(session.sessionId) : false)
            )
         }
         return (
            session.key.toLowerCase().includes(value) ||
            (session.sessionId?.toLowerCase().includes(value) ?? false)
         )
      }
      case 'has':
         switch (value) {
            case 'tools':
               return (session.usage?.toolUsage?.totalCalls ?? 0) > 0
            case 'errors':
               return (session.usage?.messageCounts?.errors ?? 0) > 0
            case 'context':
               return Boolean(session.contextWeight)
            case 'usage':
               return Boolean(session.usage)
            case 'model':
               return getSessionModels(session).length > 0
            case 'provider':
               return getSessionProviders(session).length > 0
            default:
               return true
         }
      case 'mintokens': {
         const threshold = parseQueryNumber(value)
         if (threshold === null) return true
         return (session.usage?.totalTokens ?? 0) >= threshold
      }
      case 'maxtokens': {
         const threshold = parseQueryNumber(value)
         if (threshold === null) return true
         return (session.usage?.totalTokens ?? 0) <= threshold
      }
      case 'mincost': {
         const threshold = parseQueryNumber(value)
         if (threshold === null) return true
         return (session.usage?.totalCost ?? 0) >= threshold
      }
      case 'maxcost': {
         const threshold = parseQueryNumber(value)
         if (threshold === null) return true
         return (session.usage?.totalCost ?? 0) <= threshold
      }
      case 'minmessages': {
         const threshold = parseQueryNumber(value)
         if (threshold === null) return true
         return (session.usage?.messageCounts?.total ?? 0) >= threshold
      }
      case 'maxmessages': {
         const threshold = parseQueryNumber(value)
         if (threshold === null) return true
         return (session.usage?.messageCounts?.total ?? 0) <= threshold
      }
      default:
         return true
   }
}

export function filterSessionsByQuery(
   sessions: SessionUsageEntry[],
   query: string,
): UsageQueryResult {
   const terms = extractQueryTerms(query)
   if (terms.length === 0) {
      return { sessions, warnings: [] }
   }

   const warnings: string[] = []
   for (const term of terms) {
      if (!term.key) continue
      const normalizedKey = normalizeQueryText(term.key)
      if (!QUERY_KEYS.has(normalizedKey)) {
         warnings.push(`未知过滤器: ${term.key}`)
         continue
      }
      if (term.value === '') {
         warnings.push(`${term.key} 缺少值`)
      }
      if (normalizedKey === 'has') {
         const allowed = new Set([
            'tools', 'errors', 'context', 'usage', 'model', 'provider',
         ])
         if (term.value && !allowed.has(normalizeQueryText(term.value))) {
            warnings.push(`未知 has:${term.value}`)
         }
      }
      if (
         [
            'mintokens', 'maxtokens', 'mincost',
            'maxcost', 'minmessages', 'maxmessages',
         ].includes(normalizedKey)
      ) {
         if (term.value && parseQueryNumber(term.value) === null) {
            warnings.push(`${term.key} 数值无效`)
         }
      }
   }

   const filtered = sessions.filter((session) =>
      terms.every((term) => matchesUsageQuery(session, term)),
   )
   return { sessions: filtered, warnings }
}

// ── 查询操作 ──

export function addQueryToken(query: string, token: string): string {
   const trimmed = query.trim()
   if (!trimmed) return `${token} `

   const tokens = trimmed.split(/\s+/)
   const last = tokens[tokens.length - 1] ?? ''
   const tokenKey = token.includes(':') ? token.split(':')[0] : null
   const lastKey = last.includes(':') ? last.split(':')[0] : null
   if (last.endsWith(':') && tokenKey && lastKey === tokenKey) {
      tokens[tokens.length - 1] = token
      return `${tokens.join(' ')} `
   }
   if (tokens.includes(token)) {
      return `${tokens.join(' ')} `
   }
   return `${tokens.join(' ')} ${token} `
}

export function removeQueryToken(query: string, token: string): string {
   const tokens = query.trim().split(/\s+/).filter(Boolean)
   const next = tokens.filter((entry) => entry !== token)
   return next.length ? `${next.join(' ')} ` : ''
}

export function setQueryTokensForKey(
   query: string,
   key: string,
   values: string[],
): string {
   const normalizedKey = normalizeQueryText(key)
   const tokens = extractQueryTerms(query)
      .filter((term) => normalizeQueryText(term.key ?? '') !== normalizedKey)
      .map((term) => term.raw)
   const next = [...tokens, ...values.map((value) => `${key}:${value}`)]
   return next.length ? `${next.join(' ')} ` : ''
}

// ── 查询建议 ──

export function buildQuerySuggestions(
   query: string,
   sessions: SessionUsageEntry[],
   aggregates?: SessionsUsageAggregates | null,
): QuerySuggestion[] {
   const trimmed = query.trim()
   if (!trimmed) return []

   const tokens = trimmed.length ? trimmed.split(/\s+/) : []
   const lastToken = tokens.length ? tokens[tokens.length - 1] : ''
   const [rawKey, rawValue] = lastToken.includes(':')
      ? [
           lastToken.slice(0, lastToken.indexOf(':')),
           lastToken.slice(lastToken.indexOf(':') + 1),
        ]
      : ['', '']

   const key = rawKey.toLowerCase()
   const value = rawValue.toLowerCase()

   const unique = (items: Array<string | undefined>): string[] => {
      const set = new Set<string>()
      for (const item of items) {
         if (item) set.add(item)
      }
      return Array.from(set)
   }

   const agents = unique(sessions.map((s) => s.agentId)).slice(0, 6)
   const channels = unique(sessions.map((s) => s.channel)).slice(0, 6)
   const providers = unique([
      ...sessions.map((s) => s.modelProvider),
      ...sessions.map((s) => s.providerOverride),
      ...(aggregates?.byProvider.map((p) => p.provider) ?? []),
   ]).slice(0, 6)
   const models = unique([
      ...sessions.map((s) => s.model),
      ...(aggregates?.byModel.map((m) => m.model) ?? []),
   ]).slice(0, 6)
   const tools = unique(
      aggregates?.tools.tools.map((t) => t.name) ?? [],
   ).slice(0, 6)

   if (!key) {
      return [
         { label: 'agent:', value: 'agent:' },
         { label: 'channel:', value: 'channel:' },
         { label: 'provider:', value: 'provider:' },
         { label: 'model:', value: 'model:' },
         { label: 'tool:', value: 'tool:' },
         { label: 'has:errors', value: 'has:errors' },
         { label: 'has:tools', value: 'has:tools' },
         { label: 'minTokens:', value: 'minTokens:' },
         { label: 'maxCost:', value: 'maxCost:' },
      ]
   }

   const suggestions: QuerySuggestion[] = []
   const addValues = (prefix: string, vals: string[]) => {
      for (const val of vals) {
         if (!value || val.toLowerCase().includes(value)) {
            suggestions.push({
               label: `${prefix}:${val}`,
               value: `${prefix}:${val}`,
            })
         }
      }
   }

   switch (key) {
      case 'agent':
         addValues('agent', agents)
         break
      case 'channel':
         addValues('channel', channels)
         break
      case 'provider':
         addValues('provider', providers)
         break
      case 'model':
         addValues('model', models)
         break
      case 'tool':
         addValues('tool', tools)
         break
      case 'has':
         for (const entry of [
            'errors', 'tools', 'context', 'usage', 'model', 'provider',
         ]) {
            if (!value || entry.includes(value)) {
               suggestions.push({
                  label: `has:${entry}`,
                  value: `has:${entry}`,
               })
            }
         }
         break
      default:
         break
   }

   return suggestions
}

// ── CSV 导出 ──

function csvEscape(value: string): string {
   if (/[",\n]/.test(value)) {
      return `"${value.replaceAll('"', '""')}"`
   }
   return value
}

function toCsvRow(
   values: Array<string | number | undefined | null>,
): string {
   return values
      .map((v) => {
         if (v === undefined || v === null) return ''
         return csvEscape(String(v))
      })
      .join(',')
}

export function buildSessionsCsv(sessions: SessionUsageEntry[]): string {
   const rows = [
      toCsvRow([
         'key', 'label', 'agentId', 'channel', 'provider', 'model',
         'updatedAt', 'durationMs', 'messages', 'errors', 'toolCalls',
         'inputTokens', 'outputTokens', 'cacheReadTokens',
         'cacheWriteTokens', 'totalTokens', 'totalCost',
      ]),
   ]

   for (const session of sessions) {
      const usage = session.usage
      rows.push(
         toCsvRow([
            session.key,
            session.label ?? '',
            session.agentId ?? '',
            session.channel ?? '',
            session.modelProvider ?? session.providerOverride ?? '',
            session.model ?? session.modelOverride ?? '',
            session.updatedAt
               ? new Date(session.updatedAt).toISOString()
               : '',
            usage?.durationMs ?? '',
            usage?.messageCounts?.total ?? '',
            usage?.messageCounts?.errors ?? '',
            usage?.messageCounts?.toolCalls ?? '',
            usage?.input ?? '',
            usage?.output ?? '',
            usage?.cacheRead ?? '',
            usage?.cacheWrite ?? '',
            usage?.totalTokens ?? '',
            usage?.totalCost ?? '',
         ]),
      )
   }

   return rows.join('\n')
}

export function buildDailyCsv(daily: CostUsageDailyEntry[]): string {
   const rows = [
      toCsvRow([
         'date', 'input', 'output', 'cacheRead', 'cacheWrite',
         'totalTokens', 'inputCost', 'outputCost', 'cacheReadCost',
         'cacheWriteCost', 'totalCost',
      ]),
   ]

   for (const day of daily) {
      rows.push(
         toCsvRow([
            day.date,
            day.input,
            day.output,
            day.cacheRead,
            day.cacheWrite,
            day.totalTokens,
            day.inputCost ?? '',
            day.outputCost ?? '',
            day.cacheReadCost ?? '',
            day.cacheWriteCost ?? '',
            day.totalCost,
         ]),
      )
   }

   return rows.join('\n')
}

export function downloadTextFile(
   filename: string,
   content: string,
   type = 'text/plain',
): void {
   const blob = new Blob([content], { type: `${type};charset=utf-8` })
   const url = URL.createObjectURL(blob)
   const a = document.createElement('a')
   a.href = url
   a.download = filename
   a.click()
   URL.revokeObjectURL(url)
}
