// ── 配置页工具函数 ──
// 纯函数，无 React 依赖

import type {
   JsonSchema,
   SchemaAnalysis,
   ConfigSearchCriteria,
   ConfigDiffEntry,
   SectionCategory,
   SectionMeta,
} from './config-types'
import type { ConfigUiHints, ConfigUiHint } from '../../../shared/types/gateway-protocol'

// ── 复用已有工具 ──
export { setPathValue, cloneConfigObject } from '../../utils/configFormUtils'

// ────────────────────────────────────────────
// A. Schema 分析
// ────────────────────────────────────────────

export function analyzeConfigSchema(raw: unknown): SchemaAnalysis {
   if (!raw || typeof raw !== 'object') {
      return { schema: null, unsupportedPaths: [] }
   }
   const unsupported: string[] = []
   const schema = normalizeSchemaNode(raw as JsonSchema, [], unsupported)
   return { schema, unsupportedPaths: unsupported }
}

function normalizeSchemaNode(
   node: JsonSchema,
   path: Array<string | number>,
   unsupported: string[],
): JsonSchema {
   // 处理 allOf — 合并
   if (node.allOf && node.allOf.length > 0) {
      let merged: JsonSchema = {}
      for (const seg of node.allOf) {
         merged = { ...merged, ...seg }
      }
      delete merged.allOf
      return normalizeSchemaNode({ ...node, ...merged, allOf: undefined }, path, unsupported)
   }

   // 处理 anyOf / oneOf
   const union = node.anyOf ?? node.oneOf
   if (union && union.length > 0) {
      const resolved = normalizeUnion(union, node, path, unsupported)
      if (resolved) return resolved
   }

   // 处理 object
   if (node.type === 'object' && node.properties) {
      const normalizedProps: Record<string, JsonSchema> = {}
      for (const [key, propSchema] of Object.entries(node.properties)) {
         normalizedProps[key] = normalizeSchemaNode(propSchema, [...path, key], unsupported)
      }
      return { ...node, properties: normalizedProps }
   }

   // 处理 array
   if (node.type === 'array' && node.items && !Array.isArray(node.items)) {
      return {
         ...node,
         items: normalizeSchemaNode(node.items, [...path, '*'], unsupported),
      }
   }

   return node
}

function normalizeUnion(
   variants: JsonSchema[],
   parent: JsonSchema,
   path: Array<string | number>,
   unsupported: string[],
): JsonSchema | null {
   // 过滤 null 变体
   const nonNull = variants.filter(
      (v) => v.type !== 'null' && !(v.const === null) && !(v.enum && v.enum.length === 1 && v.enum[0] === null),
   )
   const hasNull =
      variants.length !== nonNull.length || parent.nullable === true

   // 全部为字面量 (const/enum) → 枚举
   const allLiterals = nonNull.every((v) => v.const !== undefined || (v.enum && v.enum.length > 0))
   if (allLiterals && nonNull.length > 0) {
      const enumValues: unknown[] = []
      for (const v of nonNull) {
         if (v.const !== undefined) enumValues.push(v.const)
         else if (v.enum) enumValues.push(...v.enum)
      }
      return {
         ...parent,
         type: 'string',
         enum: enumValues,
         nullable: hasNull || undefined,
         anyOf: undefined,
         oneOf: undefined,
      }
   }

   // 只有一个非 null 变体 → 展开
   if (nonNull.length === 1) {
      const single = nonNull[0]
      return normalizeSchemaNode(
         { ...parent, ...single, nullable: hasNull || undefined, anyOf: undefined, oneOf: undefined },
         path,
         unsupported,
      )
   }

   // 简单类型 union (string | number) → 标记为 string
   const basicTypes = nonNull.filter(
      (v) => typeof v.type === 'string' && ['string', 'number', 'integer', 'boolean'].includes(v.type),
   )
   if (basicTypes.length === nonNull.length && nonNull.length <= 3) {
      return {
         ...parent,
         type: 'string',
         nullable: hasNull || undefined,
         anyOf: undefined,
         oneOf: undefined,
      }
   }

   // 复杂 union → unsupported
   unsupported.push(pathKey(path))
   return {
      ...parent,
      type: 'string',
      anyOf: undefined,
      oneOf: undefined,
      nullable: hasNull || undefined,
   }
}

// ────────────────────────────────────────────
// B. 路径操作
// ────────────────────────────────────────────

export function pathKey(path: Array<string | number>): string {
   return path.filter((p) => typeof p === 'string').join('.')
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

export function removePathValue(
   obj: Record<string, unknown>,
   path: Array<string | number>,
): Record<string, unknown> {
   if (path.length === 0) return obj
   const clone = structuredClone(obj)
   let current: Record<string, unknown> = clone
   for (let i = 0; i < path.length - 1; i++) {
      const key = String(path[i])
      if (FORBIDDEN_KEYS.has(key)) return clone
      const next = current[key]
      if (next === undefined || next === null) return clone
      if (Array.isArray(next)) {
         current[key] = [...next]
      } else if (typeof next === 'object') {
         current[key] = { ...(next as Record<string, unknown>) }
      } else {
         return clone
      }
      current = current[key] as Record<string, unknown>
   }
   const lastKey = path[path.length - 1]
   if (typeof lastKey === 'number' && Array.isArray(current)) {
      ;(current as unknown as unknown[]).splice(lastKey, 1)
   } else {
      delete current[String(lastKey)]
   }
   return clone
}

export function serializeConfigForm(form: Record<string, unknown>): string {
   return `${JSON.stringify(form, null, 2).trimEnd()}\n`
}

// ────────────────────────────────────────────
// C. 搜索
// ────────────────────────────────────────────

export function parseConfigSearchQuery(query: string): ConfigSearchCriteria {
   const tags: string[] = []
   const raw = query.trim()
   const stripped = raw.replace(/(^|\s)tag:([^\s]+)/gi, (_, _leading: string, token: string) => {
      tags.push(token.trim().toLowerCase())
      return ''
   })
   return { text: stripped.trim().toLowerCase(), tags }
}

export function matchesNodeSearch(
   schema: JsonSchema,
   value: unknown,
   path: Array<string | number>,
   hints: ConfigUiHints,
   criteria: ConfigSearchCriteria,
): boolean {
   if (!criteria.text && criteria.tags.length === 0) return true

   const hint = hintForPath(path, hints)
   const fieldLabel = hint?.label ?? schema.title ?? humanize(String(path[path.length - 1] ?? ''))
   const fieldHelp = hint?.help ?? schema.description

   // 文本匹配
   if (criteria.text) {
      const candidates = [
         fieldLabel,
         fieldHelp,
         pathKey(path),
         ...(schema.enum?.map(String) ?? []),
      ]
      const textMatched = candidates.some(
         (c) => c !== undefined && c.toLowerCase().includes(criteria.text),
      )
      if (textMatched) return true
   }

   // tag 匹配
   if (criteria.tags.length > 0) {
      const fieldTags = normalizeTags(hint?.tags ?? schema['x-tags'] ?? schema.tags)
      const tagMatched = criteria.tags.every((t) =>
         fieldTags.some((ft) => ft.toLowerCase() === t),
      )
      if (tagMatched) return true
   }

   // 递归子节点
   if (schema.type === 'object' && schema.properties) {
      const objValue = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
      for (const [key, propSchema] of Object.entries(schema.properties)) {
         if (matchesNodeSearch(propSchema, objValue[key], [...path, key], hints, criteria)) {
            return true
         }
      }
   }

   if (schema.type === 'array' && schema.items && !Array.isArray(schema.items) && Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
         if (matchesNodeSearch(schema.items, value[i], [...path, i], hints, criteria)) {
            return true
         }
      }
   }

   // 仅文本为空 + tag 未匹配到 → 不匹配
   if (!criteria.text && criteria.tags.length > 0) return false

   return false
}

function normalizeTags(tags: string[] | undefined): string[] {
   if (!tags || !Array.isArray(tags)) return []
   return tags.filter((t) => typeof t === 'string' && t.length > 0)
}

// ────────────────────────────────────────────
// D. 敏感字段检测
// ────────────────────────────────────────────

const SENSITIVE_PATTERNS = [
   /token$/i,
   /password/i,
   /secret/i,
   /api.?key/i,
   /serviceaccount(?:ref)?$/i,
]

const SENSITIVE_WHITELIST_SUFFIXES = [
   'maxtokens',
   'maxoutputtokens',
   'contexttokens',
   'passwordfile',
   'tokencount',
   'tokenlimit',
   'inputtokens',
   'outputtokens',
   'totaltokens',
]

export function isSensitiveConfigPath(pathStr: string): boolean {
   const lower = pathStr.toLowerCase()
   if (SENSITIVE_WHITELIST_SUFFIXES.some((s) => lower.endsWith(s))) return false
   return SENSITIVE_PATTERNS.some((p) => p.test(pathStr))
}

export function isFieldSensitive(
   path: Array<string | number>,
   hints: ConfigUiHints,
): boolean {
   const hint = hintForPath(path, hints)
   if (hint?.sensitive === true) return true
   return isSensitiveConfigPath(pathKey(path))
}

// ────────────────────────────────────────────
// E. Diff 计算
// ────────────────────────────────────────────

export function computeDiff(
   original: Record<string, unknown> | null,
   current: Record<string, unknown> | null,
): ConfigDiffEntry[] {
   const diffs: ConfigDiffEntry[] = []
   diffRecursive(original ?? {}, current ?? {}, [], diffs)
   return diffs
}

function diffRecursive(
   a: unknown,
   b: unknown,
   path: string[],
   diffs: ConfigDiffEntry[],
): void {
   if (a === b) return
   if (a === null || a === undefined) {
      if (b !== null && b !== undefined) {
         diffs.push({ path: path.join('.') || '<root>', from: a, to: b })
      }
      return
   }
   if (b === null || b === undefined) {
      diffs.push({ path: path.join('.') || '<root>', from: a, to: b })
      return
   }
   if (typeof a !== typeof b) {
      diffs.push({ path: path.join('.') || '<root>', from: a, to: b })
      return
   }
   if (Array.isArray(a) || Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) {
         diffs.push({ path: path.join('.') || '<root>', from: a, to: b })
      }
      return
   }
   if (typeof a === 'object' && typeof b === 'object') {
      const aObj = a as Record<string, unknown>
      const bObj = b as Record<string, unknown>
      const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)])
      for (const key of allKeys) {
         diffRecursive(aObj[key], bObj[key], [...path, key], diffs)
      }
      return
   }
   if (a !== b) {
      diffs.push({ path: path.join('.') || '<root>', from: a, to: b })
   }
}

// ────────────────────────────────────────────
// F. 类型强制转换
// ────────────────────────────────────────────

export function coerceFormValues(value: unknown, schema: JsonSchema): unknown {
   if (value === null || value === undefined) return value

   const type = typeof schema.type === 'string' ? schema.type : undefined

   if (type === 'number' || type === 'integer') {
      if (typeof value === 'string') {
         const trimmed = value.trim()
         if (trimmed === '') return undefined
         const num = type === 'integer' ? parseInt(trimmed, 10) : parseFloat(trimmed)
         return isNaN(num) ? value : num
      }
      return value
   }

   if (type === 'boolean') {
      if (typeof value === 'string') {
         if (value === 'true') return true
         if (value === 'false') return false
      }
      return value
   }

   if (type === 'object' && schema.properties && value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>
      const result: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(obj)) {
         const propSchema = schema.properties[key]
         result[key] = propSchema ? coerceFormValues(val, propSchema) : val
      }
      return result
   }

   if (type === 'array' && schema.items && !Array.isArray(schema.items) && Array.isArray(value)) {
      return value.map((item) => coerceFormValues(item, schema.items as JsonSchema))
   }

   return value
}

// ────────────────────────────────────────────
// G. UI Hints 解析
// ────────────────────────────────────────────

export function hintForPath(
   path: Array<string | number>,
   hints: ConfigUiHints,
): ConfigUiHint | undefined {
   if (!hints) return undefined
   const key = pathKey(path)
   const direct = hints[key]
   if (direct) return direct

   // 通配符匹配
   const segments = key.split('.')
   for (const [hintKey, hint] of Object.entries(hints)) {
      if (!hintKey.includes('*')) continue
      const hintSegments = hintKey.split('.')
      if (hintSegments.length !== segments.length) continue
      let match = true
      for (let i = 0; i < segments.length; i++) {
         if (hintSegments[i] !== '*' && hintSegments[i] !== segments[i]) {
            match = false
            break
         }
      }
      if (match) return hint
   }

   return undefined
}

export function humanize(key: string): string {
   return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/^./, (s) => s.toUpperCase())
}

// ────────────────────────────────────────────
// H. Section 分类常量
// ────────────────────────────────────────────

export const SECTION_CATEGORIES: SectionCategory[] = [
   {
      id: 'core',
      label: '核心',
      sections: [
         { key: 'env', label: '环境变量' },
         { key: 'auth', label: '身份认证' },
         { key: 'update', label: '更新' },
         { key: 'meta', label: '元信息' },
         { key: 'logging', label: '日志' },
         { key: 'diagnostics', label: '诊断' },
         { key: 'cli', label: 'CLI' },
         { key: 'secrets', label: '密钥' },
      ],
   },
   {
      id: 'ai',
      label: 'AI 和 Agent',
      sections: [
         { key: 'agents', label: 'Agent' },
         { key: 'models', label: '模型' },
         { key: 'skills', label: '技能' },
         { key: 'tools', label: '工具' },
         { key: 'memory', label: '记忆' },
         { key: 'session', label: '会话' },
      ],
   },
   {
      id: 'comm',
      label: '通信',
      sections: [
         { key: 'channels', label: '频道' },
         { key: 'messages', label: '消息' },
         { key: 'broadcast', label: '广播' },
         { key: 'talk', label: '对话' },
         { key: 'audio', label: '音频' },
      ],
   },
   {
      id: 'auto',
      label: '自动化',
      sections: [
         { key: 'commands', label: '命令' },
         { key: 'hooks', label: '钩子' },
         { key: 'bindings', label: '绑定' },
         { key: 'cron', label: '定时任务' },
         { key: 'approvals', label: '审批' },
         { key: 'plugins', label: '插件' },
      ],
   },
   {
      id: 'infra',
      label: '基础设施',
      sections: [
         { key: 'gateway', label: '网关' },
         { key: 'web', label: 'Web' },
         { key: 'browser', label: '浏览器' },
         { key: 'nodeHost', label: '节点主机' },
         { key: 'canvasHost', label: 'Canvas 主机' },
         { key: 'discovery', label: '发现' },
         { key: 'media', label: '媒体' },
      ],
   },
   {
      id: 'appearance',
      label: '外观',
      sections: [
         { key: 'ui', label: 'UI' },
         { key: 'wizard', label: '设置向导' },
      ],
   },
   {
      id: 'protocol',
      label: '协议',
      sections: [
         { key: 'acp', label: 'ACP' },
         { key: 'mcp', label: 'MCP' },
      ],
   },
]

export const SECTION_META: Record<string, SectionMeta> = {
   env: { label: '环境变量', description: '传递给 Gateway 进程的环境变量' },
   auth: { label: '身份认证', description: 'API 密钥和认证配置' },
   update: { label: '更新', description: '自动更新设置和发布通道' },
   meta: { label: '元信息', description: '项目名称和元数据' },
   logging: { label: '日志', description: '日志级别和输出配置' },
   diagnostics: { label: '诊断', description: '诊断和调试配置' },
   cli: { label: 'CLI', description: '命令行接口配置' },
   secrets: { label: '密钥', description: '密钥存储和解析配置' },
   agents: { label: 'Agent', description: 'Agent 配置、模型和身份' },
   models: { label: '模型', description: '模型提供者和配置' },
   skills: { label: '技能', description: '技能管理和权限' },
   tools: { label: '工具', description: '工具配置和权限' },
   memory: { label: '记忆', description: '记忆和上下文管理' },
   session: { label: '会话', description: '会话默认配置' },
   channels: { label: '频道', description: '消息频道（Telegram、Discord 等）' },
   messages: { label: '消息', description: '消息处理配置' },
   broadcast: { label: '广播', description: '广播消息配置' },
   talk: { label: '对话', description: '实时对话配置' },
   audio: { label: '音频', description: '音频处理配置' },
   commands: { label: '命令', description: '斜杠命令配置' },
   hooks: { label: '钩子', description: '生命周期钩子配置' },
   bindings: { label: '绑定', description: '命令绑定配置' },
   cron: { label: '定时任务', description: '定时任务和计划执行' },
   approvals: { label: '审批', description: '执行审批配置' },
   plugins: { label: '插件', description: '插件管理配置' },
   gateway: { label: '网关', description: '网关服务配置' },
   web: { label: 'Web', description: 'Web 服务器配置' },
   browser: { label: '浏览器', description: '浏览器自动化配置' },
   nodeHost: { label: '节点主机', description: '节点主机配置' },
   canvasHost: { label: 'Canvas 主机', description: 'Canvas 主机配置' },
   discovery: { label: '发现', description: '服务发现配置' },
   media: { label: '媒体', description: '媒体处理配置' },
   ui: { label: 'UI', description: '用户界面配置' },
   wizard: { label: '设置向导', description: '设置向导配置' },
   acp: { label: 'ACP', description: 'Agent Communication Protocol 配置' },
   mcp: { label: 'MCP', description: 'Model Context Protocol 配置' },
}

// ── 配置主页面只显示的 section keys ──

export const CONFIG_PAGE_SECTION_KEYS = [
   'env',
   'auth',
   'update',
   'meta',
   'logging',
   'diagnostics',
   'cli',
   'secrets',
   'acp',
   'mcp',
] as const

// ── 基础设施 section keys ──

export const INFRASTRUCTURE_SECTION_KEYS = [
   'gateway',
   'web',
   'browser',
   'nodeHost',
   'canvasHost',
   'discovery',
   'media',
] as const

/**
 * 过滤 section 列表，只保留指定 key
 */
export function filterVisibleSections(
   categories: SectionCategory[],
   includeSections: readonly string[],
): SectionCategory[] {
   const allowed = new Set(includeSections)
   return categories
      .map((cat) => ({
         ...cat,
         sections: cat.sections.filter((s) => allowed.has(s.key)),
      }))
      .filter((cat) => cat.sections.length > 0)
}

/**
 * 获取 schema 中存在的 section，按分类组织
 */
export function buildVisibleSections(
   schemaProps: Record<string, JsonSchema> | undefined,
): SectionCategory[] {
   if (!schemaProps) return []
   const existingKeys = new Set(Object.keys(schemaProps))
   const categorisedKeys = new Set<string>()

   const result: SectionCategory[] = []
   for (const cat of SECTION_CATEGORIES) {
      const visibleSections = cat.sections.filter((s) => {
         if (existingKeys.has(s.key)) {
            categorisedKeys.add(s.key)
            return true
         }
         return false
      })
      if (visibleSections.length > 0) {
         result.push({ ...cat, sections: visibleSections })
      }
   }

   // 未分类的 key 归入 "其他"
   const uncategorised = [...existingKeys].filter((k) => !categorisedKeys.has(k))
   if (uncategorised.length > 0) {
      result.push({
         id: 'other',
         label: '其他',
         sections: uncategorised.map((k) => ({
            key: k,
            label: SECTION_META[k]?.label ?? humanize(k),
         })),
      })
   }

   return result
}

/**
 * 获取 schema 中所有 section key 的 flat 列表
 */
export function flatSectionKeys(categories: SectionCategory[]): string[] {
   return categories.flatMap((c) => c.sections.map((s) => s.key))
}
