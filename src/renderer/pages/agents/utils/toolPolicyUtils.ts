/**
 * 工具策略核心逻辑 — 从 openclaw/src/agents/tool-policy-shared.ts + tool-catalog.ts 移植
 * 纯函数模块，零 React 依赖
 */

import type { AgentToolSection, ToolPolicy } from '../types'
import type { ToolsCatalogResult, ToolCatalogProfile } from '../../../../shared/types/gateway-protocol'

// ── 工具 Profile ID ──

export type ToolProfileId = 'minimal' | 'coding' | 'messaging' | 'full'

// ── 工具别名映射 ──

const TOOL_NAME_ALIASES: Record<string, string> = {
   bash: 'exec',
   'apply-patch': 'apply_patch',
}

// ── 核心工具定义 ──

type CoreToolDefinition = {
   id: string
   label: string
   description: string
   sectionId: string
   profiles: ToolProfileId[]
   includeInGroup?: boolean
}

const CORE_TOOL_SECTION_ORDER: Array<{ id: string; label: string }> = [
   { id: 'fs', label: 'Files' },
   { id: 'runtime', label: 'Runtime' },
   { id: 'web', label: 'Web' },
   { id: 'memory', label: 'Memory' },
   { id: 'sessions', label: 'Sessions' },
   { id: 'ui', label: 'UI' },
   { id: 'messaging', label: 'Messaging' },
   { id: 'automation', label: 'Automation' },
   { id: 'nodes', label: 'Nodes' },
   { id: 'agents', label: 'Agents' },
   { id: 'media', label: 'Media' },
]

const CORE_TOOL_DEFINITIONS: CoreToolDefinition[] = [
   { id: 'read', label: 'read', description: 'Read file contents', sectionId: 'fs', profiles: ['coding'] },
   { id: 'write', label: 'write', description: 'Create or overwrite files', sectionId: 'fs', profiles: ['coding'] },
   { id: 'edit', label: 'edit', description: 'Make precise edits', sectionId: 'fs', profiles: ['coding'] },
   { id: 'apply_patch', label: 'apply_patch', description: 'Patch files (OpenAI)', sectionId: 'fs', profiles: ['coding'] },
   { id: 'exec', label: 'exec', description: 'Run shell commands', sectionId: 'runtime', profiles: ['coding'] },
   { id: 'process', label: 'process', description: 'Manage background processes', sectionId: 'runtime', profiles: ['coding'] },
   { id: 'web_search', label: 'web_search', description: 'Search the web', sectionId: 'web', profiles: ['coding'], includeInGroup: true },
   { id: 'web_fetch', label: 'web_fetch', description: 'Fetch web content', sectionId: 'web', profiles: ['coding'], includeInGroup: true },
   { id: 'memory_search', label: 'memory_search', description: 'Semantic search', sectionId: 'memory', profiles: ['coding'], includeInGroup: true },
   { id: 'memory_get', label: 'memory_get', description: 'Read memory files', sectionId: 'memory', profiles: ['coding'], includeInGroup: true },
   { id: 'sessions_list', label: 'sessions_list', description: 'List sessions', sectionId: 'sessions', profiles: ['coding', 'messaging'], includeInGroup: true },
   { id: 'sessions_history', label: 'sessions_history', description: 'Session history', sectionId: 'sessions', profiles: ['coding', 'messaging'], includeInGroup: true },
   { id: 'sessions_send', label: 'sessions_send', description: 'Send to session', sectionId: 'sessions', profiles: ['coding', 'messaging'], includeInGroup: true },
   { id: 'sessions_spawn', label: 'sessions_spawn', description: 'Spawn sub-agent', sectionId: 'sessions', profiles: ['coding'], includeInGroup: true },
   { id: 'sessions_yield', label: 'sessions_yield', description: 'End turn to receive sub-agent results', sectionId: 'sessions', profiles: ['coding'], includeInGroup: true },
   { id: 'subagents', label: 'subagents', description: 'Manage sub-agents', sectionId: 'sessions', profiles: ['coding'], includeInGroup: true },
   { id: 'session_status', label: 'session_status', description: 'Session status', sectionId: 'sessions', profiles: ['minimal', 'coding', 'messaging'], includeInGroup: true },
   { id: 'browser', label: 'browser', description: 'Control web browser', sectionId: 'ui', profiles: [], includeInGroup: true },
   { id: 'canvas', label: 'canvas', description: 'Control canvases', sectionId: 'ui', profiles: [], includeInGroup: true },
   { id: 'message', label: 'message', description: 'Send messages', sectionId: 'messaging', profiles: ['messaging'], includeInGroup: true },
   { id: 'cron', label: 'cron', description: 'Schedule tasks', sectionId: 'automation', profiles: ['coding'], includeInGroup: true },
   { id: 'gateway', label: 'gateway', description: 'Gateway control', sectionId: 'automation', profiles: [], includeInGroup: true },
   { id: 'nodes', label: 'nodes', description: 'Nodes + devices', sectionId: 'nodes', profiles: [], includeInGroup: true },
   { id: 'agents_list', label: 'agents_list', description: 'List agents', sectionId: 'agents', profiles: [], includeInGroup: true },
   { id: 'image', label: 'image', description: 'Image understanding', sectionId: 'media', profiles: ['coding'], includeInGroup: true },
   { id: 'image_generate', label: 'image_generate', description: 'Image generation', sectionId: 'media', profiles: ['coding'], includeInGroup: true },
   { id: 'tts', label: 'tts', description: 'Text-to-speech conversion', sectionId: 'media', profiles: [], includeInGroup: true },
]

// ── 构建工具组映射 ──

function buildToolGroupMap(): Record<string, string[]> {
   const sectionToolMap = new Map<string, string[]>()
   for (const tool of CORE_TOOL_DEFINITIONS) {
      const groupId = `group:${tool.sectionId}`
      const list = sectionToolMap.get(groupId) ?? []
      list.push(tool.id)
      sectionToolMap.set(groupId, list)
   }
   const openclawTools = CORE_TOOL_DEFINITIONS.filter((t) => t.includeInGroup).map((t) => t.id)
   return {
      'group:openclaw': openclawTools,
      ...Object.fromEntries(sectionToolMap.entries()),
   }
}

const TOOL_GROUPS = buildToolGroupMap()

// ── Profile 策略定义 ──

function listCoreToolIdsForProfile(profile: ToolProfileId): string[] {
   return CORE_TOOL_DEFINITIONS.filter((t) => t.profiles.includes(profile)).map((t) => t.id)
}

const CORE_TOOL_PROFILES: Record<ToolProfileId, ToolPolicy> = {
   minimal: { allow: listCoreToolIdsForProfile('minimal') },
   coding: { allow: listCoreToolIdsForProfile('coding') },
   messaging: { allow: listCoreToolIdsForProfile('messaging') },
   full: {},
}

// ── 导出常量 ──

export const PROFILE_OPTIONS: readonly { id: string; label: string }[] = [
   { id: 'minimal', label: 'Minimal' },
   { id: 'coding', label: 'Coding' },
   { id: 'messaging', label: 'Messaging' },
   { id: 'full', label: 'Full' },
]

export const FALLBACK_TOOL_SECTIONS: AgentToolSection[] = CORE_TOOL_SECTION_ORDER.map(
   (section) => ({
      id: section.id,
      label: section.label,
      tools: CORE_TOOL_DEFINITIONS.filter((t) => t.sectionId === section.id).map((t) => ({
         id: t.id,
         label: t.label,
         description: t.description,
      })),
   }),
).filter((s) => s.tools.length > 0)

// ── 导出函数 ──

export function normalizeToolName(name: string): string {
   const normalized = name.trim().toLowerCase()
   return TOOL_NAME_ALIASES[normalized] ?? normalized
}

export function normalizeToolList(list?: string[]): string[] {
   if (!list) return []
   return list.map(normalizeToolName).filter(Boolean)
}

export function expandToolGroups(list?: string[]): string[] {
   const normalized = normalizeToolList(list)
   const expanded: string[] = []
   for (const value of normalized) {
      const group = TOOL_GROUPS[value]
      if (group) {
         expanded.push(...group)
         continue
      }
      expanded.push(value)
   }
   return Array.from(new Set(expanded))
}

export function resolveToolProfilePolicy(profile?: string): ToolPolicy | undefined {
   if (!profile) return undefined
   const resolved = CORE_TOOL_PROFILES[profile as ToolProfileId]
   if (!resolved) return undefined
   if (!resolved.allow && !resolved.deny) return undefined
   return {
      allow: resolved.allow ? [...resolved.allow] : undefined,
      deny: resolved.deny ? [...resolved.deny] : undefined,
   }
}

// ── 通配符匹配 ──

type CompiledPattern =
   | { kind: 'all' }
   | { kind: 'exact'; value: string }
   | { kind: 'regex'; value: RegExp }

function compilePattern(pattern: string): CompiledPattern {
   const normalized = normalizeToolName(pattern)
   if (!normalized) return { kind: 'exact', value: '' }
   if (normalized === '*') return { kind: 'all' }
   if (!normalized.includes('*')) return { kind: 'exact', value: normalized }
   const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
   return { kind: 'regex', value: new RegExp(`^${escaped.replaceAll('\\*', '.*')}$`) }
}

function compilePatterns(patterns?: string[]): CompiledPattern[] {
   if (!Array.isArray(patterns)) return []
   return expandToolGroups(patterns)
      .map(compilePattern)
      .filter((p) => p.kind !== 'exact' || p.value.length > 0)
}

function matchesAny(name: string, patterns: CompiledPattern[]): boolean {
   for (const pattern of patterns) {
      if (pattern.kind === 'all') return true
      if (pattern.kind === 'exact' && name === pattern.value) return true
      if (pattern.kind === 'regex' && pattern.value.test(name)) return true
   }
   return false
}

export function isAllowedByPolicy(name: string, policy?: ToolPolicy): boolean {
   if (!policy) return true
   const normalized = normalizeToolName(name)
   const deny = compilePatterns(policy.deny)
   if (matchesAny(normalized, deny)) return false
   const allow = compilePatterns(policy.allow)
   if (allow.length === 0) return true
   if (matchesAny(normalized, allow)) return true
   if (normalized === 'apply_patch' && matchesAny('exec', allow)) return true
   return false
}

export function matchesList(name: string, list?: string[]): boolean {
   if (!Array.isArray(list) || list.length === 0) return false
   const normalized = normalizeToolName(name)
   const patterns = compilePatterns(list)
   if (matchesAny(normalized, patterns)) return true
   if (normalized === 'apply_patch' && matchesAny('exec', patterns)) return true
   return false
}

// ── 工具目录解析 ──

export function resolveToolSections(
   catalogResult: ToolsCatalogResult | null,
): AgentToolSection[] {
   if (catalogResult?.groups?.length) {
      return catalogResult.groups.map((group) => ({
         id: group.id,
         label: group.label,
         source: group.source,
         pluginId: group.pluginId,
         tools: group.tools.map((tool) => ({
            id: tool.id,
            label: tool.label,
            description: tool.description,
            source: tool.source,
            pluginId: tool.pluginId,
            optional: tool.optional,
            defaultProfiles: [...tool.defaultProfiles],
         })),
      }))
   }
   return FALLBACK_TOOL_SECTIONS
}

export function resolveToolProfileOptions(
   catalogResult: ToolsCatalogResult | null,
): readonly { id: string; label: string }[] {
   if (catalogResult?.profiles && Array.isArray(catalogResult.profiles)) {
      const arr = catalogResult.profiles as ToolCatalogProfile[]
      if (arr.length > 0 && typeof arr[0] === 'object' && 'id' in arr[0]) {
         return arr
      }
   }
   return PROFILE_OPTIONS
}
