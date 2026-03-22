import type { LogEntry, LogLevel } from '../../../shared/types/gateway-protocol'

const LEVELS = new Set<LogLevel>(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])

function parseMaybeJsonString(value: unknown): Record<string, unknown> | null {
   if (typeof value !== 'string') return null
   const trimmed = value.trim()
   if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null
   try {
      const parsed = JSON.parse(trimmed) as unknown
      if (!parsed || typeof parsed !== 'object') return null
      return parsed as Record<string, unknown>
   } catch {
      return null
   }
}

function normalizeLevel(value: unknown): LogLevel | null {
   if (typeof value !== 'string') return null
   const lowered = value.toLowerCase() as LogLevel
   return LEVELS.has(lowered) ? lowered : null
}

export function parseLogLine(line: string): LogEntry {
   if (!line.trim()) {
      return { raw: line, message: line }
   }
   try {
      const obj = JSON.parse(line) as Record<string, unknown>
      const meta =
         obj && typeof obj._meta === 'object' && obj._meta !== null
            ? (obj._meta as Record<string, unknown>)
            : null
      const time =
         typeof obj.time === 'string'
            ? obj.time
            : typeof meta?.date === 'string'
              ? (meta.date as string)
              : null
      const level = normalizeLevel(meta?.logLevelName ?? meta?.level)

      const contextCandidate =
         typeof obj['0'] === 'string'
            ? (obj['0'] as string)
            : typeof meta?.name === 'string'
              ? (meta.name as string)
              : null
      const contextObj = parseMaybeJsonString(contextCandidate)
      let subsystem: string | null = null
      if (contextObj) {
         if (typeof contextObj.subsystem === 'string') {
            subsystem = contextObj.subsystem
         } else if (typeof contextObj.module === 'string') {
            subsystem = contextObj.module
         }
      }
      if (!subsystem && contextCandidate && contextCandidate.length < 120) {
         subsystem = contextCandidate
      }

      let message: string | null = null
      if (typeof obj['1'] === 'string') {
         message = obj['1']
      } else if (typeof obj['2'] === 'string') {
         message = obj['2']
      } else if (!contextObj && typeof obj['0'] === 'string') {
         message = obj['0'] as string
      } else if (typeof obj.message === 'string') {
         message = obj.message
      }

      return {
         raw: line,
         time,
         level,
         subsystem,
         message: message ?? line,
         meta: meta ?? undefined,
      }
   } catch {
      return { raw: line, message: line }
   }
}
