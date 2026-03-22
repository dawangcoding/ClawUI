/**
 * 模型解析/构建工具 — 从 openclaw/ui agents-utils.ts 移植
 */

export function resolveModelLabel(model?: unknown): string {
   if (!model) return '-'
   if (typeof model === 'string') return model.trim() || '-'
   if (typeof model === 'object' && model) {
      const record = model as { primary?: string; fallbacks?: string[] }
      const primary = record.primary?.trim()
      if (primary) {
         const fallbackCount = Array.isArray(record.fallbacks) ? record.fallbacks.length : 0
         return fallbackCount > 0 ? `${primary} (+${fallbackCount} fallback)` : primary
      }
   }
   return '-'
}

export function resolveModelPrimary(model?: unknown): string | null {
   if (!model) return null
   if (typeof model === 'string') {
      const trimmed = model.trim()
      return trimmed || null
   }
   if (typeof model === 'object' && model) {
      const record = model as Record<string, unknown>
      const candidate =
         typeof record.primary === 'string'
            ? record.primary
            : typeof record.model === 'string'
              ? record.model
              : typeof record.id === 'string'
                ? record.id
                : typeof record.value === 'string'
                  ? record.value
                  : null
      return candidate?.trim() || null
   }
   return null
}

export function resolveModelFallbacks(model?: unknown): string[] | null {
   if (!model || typeof model === 'string') return null
   if (typeof model === 'object' && model) {
      const record = model as Record<string, unknown>
      const fallbacks = Array.isArray(record.fallbacks)
         ? record.fallbacks
         : Array.isArray(record.fallback)
           ? record.fallback
           : null
      return fallbacks
         ? fallbacks.filter((entry): entry is string => typeof entry === 'string')
         : null
   }
   return null
}

export function normalizeModelValue(label: string): string {
   const match = label.match(/^(.+) \(\+\d+ fallback\)$/)
   return match ? match[1] : label
}

export function parseFallbackList(value: string): string[] {
   return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
}

type ConfiguredModelOption = {
   value: string
   label: string
}

type ConfigSnapshot = {
   agents?: {
      defaults?: {
         workspace?: string
         model?: unknown
         models?: Record<string, { alias?: string }>
      }
      list?: Array<Record<string, unknown>>
   }
   tools?: Record<string, unknown>
}

function resolveConfiguredModels(
   configForm: Record<string, unknown> | null,
): ConfiguredModelOption[] {
   const cfg = configForm as ConfigSnapshot | null
   const models = cfg?.agents?.defaults?.models
   if (!models || typeof models !== 'object') return []
   const options: ConfiguredModelOption[] = []
   for (const [modelId, modelRaw] of Object.entries(models)) {
      const trimmed = modelId.trim()
      if (!trimmed) continue
      const alias =
         modelRaw && typeof modelRaw === 'object' && 'alias' in modelRaw
            ? typeof modelRaw.alias === 'string'
               ? modelRaw.alias.trim()
               : undefined
            : undefined
      const label = alias && alias !== trimmed ? `${alias} (${trimmed})` : trimmed
      options.push({ value: trimmed, label })
   }
   return options
}

export function buildModelOptions(
   configForm: Record<string, unknown> | null,
   current?: string | null,
): ConfiguredModelOption[] {
   const options = resolveConfiguredModels(configForm)
   const hasCurrent = current ? options.some((o) => o.value === current) : false
   if (current && !hasCurrent) {
      options.unshift({ value: current, label: `当前 (${current})` })
   }
   return options
}
