/**
 * 配置表单操作工具 — 从 openclaw/ui controllers/config.ts + agents-utils.ts 移植
 */

import { setPathValue, cloneConfigObject } from '../../../utils/configFormUtils'

type AgentConfigEntry = {
   id: string
   name?: string
   workspace?: string
   agentDir?: string
   model?: unknown
   skills?: string[]
   tools?: {
      profile?: string
      allow?: string[]
      alsoAllow?: string[]
      deny?: string[]
   }
}

type ConfigFormShape = {
   agents?: {
      defaults?: { workspace?: string; model?: unknown; models?: Record<string, unknown> }
      list?: AgentConfigEntry[]
   }
   tools?: {
      profile?: string
      allow?: string[]
      alsoAllow?: string[]
      deny?: string[]
   }
}

export function resolveAgentConfig(
   configForm: Record<string, unknown> | null,
   agentId: string,
): {
   entry: AgentConfigEntry | undefined
   defaults: ConfigFormShape['agents'] extends { defaults?: infer D } ? D : unknown
   globalTools: ConfigFormShape['tools']
} {
   const cfg = configForm as ConfigFormShape | null
   const list = cfg?.agents?.list ?? []
   const entry = list.find((agent) => agent?.id === agentId)
   return {
      entry,
      defaults: cfg?.agents?.defaults,
      globalTools: cfg?.tools,
   }
}

export function findAgentConfigEntryIndex(
   configForm: Record<string, unknown> | null,
   agentId: string,
): number {
   const cfg = configForm as ConfigFormShape | null
   const list = cfg?.agents?.list ?? []
   return list.findIndex((agent) => agent?.id === agentId)
}

export function ensureAgentConfigEntry(
   configForm: Record<string, unknown>,
   agentId: string,
): { form: Record<string, unknown>; index: number } {
   const idx = findAgentConfigEntryIndex(configForm, agentId)
   if (idx >= 0) return { form: configForm, index: idx }

   let form = cloneConfigObject(configForm)
   if (!form.agents || typeof form.agents !== 'object') {
      form = setPathValue(form, ['agents'], {})
   }
   const agents = form.agents as Record<string, unknown>
   if (!Array.isArray(agents.list)) {
      form = setPathValue(form, ['agents', 'list'], [])
   }
   const list = (form.agents as Record<string, unknown>).list as AgentConfigEntry[]
   const newIndex = list.length
   form = setPathValue(form, ['agents', 'list', newIndex], { id: agentId })
   return { form, index: newIndex }
}

export function updateAgentModel(
   configForm: Record<string, unknown>,
   agentId: string,
   modelId: string | null,
): Record<string, unknown> {
   const { form, index } = ensureAgentConfigEntry(configForm, agentId)
   if (modelId) {
      const currentModel = resolveCurrentModel(form, index)
      if (typeof currentModel === 'object' && currentModel) {
         return setPathValue(form, ['agents', 'list', index, 'model', 'primary'], modelId)
      }
      return setPathValue(form, ['agents', 'list', index, 'model'], modelId)
   }
   return setPathValue(form, ['agents', 'list', index, 'model'], undefined)
}

export function updateAgentModelFallbacks(
   configForm: Record<string, unknown>,
   agentId: string,
   fallbacks: string[],
): Record<string, unknown> {
   const { form, index } = ensureAgentConfigEntry(configForm, agentId)
   const currentModel = resolveCurrentModel(form, index)
   if (typeof currentModel === 'string' || !currentModel) {
      const primary = typeof currentModel === 'string' ? currentModel : ''
      if (fallbacks.length === 0 && primary) {
         return setPathValue(form, ['agents', 'list', index, 'model'], primary)
      }
      return setPathValue(form, ['agents', 'list', index, 'model'], {
         primary,
         fallbacks,
      })
   }
   return setPathValue(form, ['agents', 'list', index, 'model', 'fallbacks'], fallbacks)
}

export function updateAgentToolProfile(
   configForm: Record<string, unknown>,
   agentId: string,
   profile: string | null,
   clearAllow: boolean,
): Record<string, unknown> {
   const { form, index } = ensureAgentConfigEntry(configForm, agentId)
   let result = form
   if (profile) {
      result = setPathValue(result, ['agents', 'list', index, 'tools', 'profile'], profile)
   } else {
      result = setPathValue(result, ['agents', 'list', index, 'tools', 'profile'], undefined)
   }
   if (clearAllow) {
      result = setPathValue(result, ['agents', 'list', index, 'tools', 'allow'], undefined)
      result = setPathValue(result, ['agents', 'list', index, 'tools', 'alsoAllow'], undefined)
      result = setPathValue(result, ['agents', 'list', index, 'tools', 'deny'], undefined)
   }
   return result
}

export function updateAgentToolOverrides(
   configForm: Record<string, unknown>,
   agentId: string,
   alsoAllow: string[],
   deny: string[],
): Record<string, unknown> {
   const { form, index } = ensureAgentConfigEntry(configForm, agentId)
   let result = form
   result = setPathValue(
      result,
      ['agents', 'list', index, 'tools', 'alsoAllow'],
      alsoAllow.length > 0 ? alsoAllow : undefined,
   )
   result = setPathValue(
      result,
      ['agents', 'list', index, 'tools', 'deny'],
      deny.length > 0 ? deny : undefined,
   )
   return result
}

export function updateAgentSkillAllowlist(
   configForm: Record<string, unknown>,
   agentId: string,
   skills: string[] | undefined,
): Record<string, unknown> {
   const { form, index } = ensureAgentConfigEntry(configForm, agentId)
   return setPathValue(form, ['agents', 'list', index, 'skills'], skills)
}

function resolveCurrentModel(form: Record<string, unknown>, index: number): unknown {
   const cfg = form as ConfigFormShape
   const entry = cfg?.agents?.list?.[index]
   return entry?.model
}
