// ── 配置页面类型定义 ──

import type { ConfigUiHints, ConfigIssue } from '../../../shared/types/gateway-protocol'

// ── JSON Schema 类型 ──

export interface JsonSchema {
   type?: string | string[]
   title?: string
   description?: string
   tags?: string[]
   'x-tags'?: string[]
   properties?: Record<string, JsonSchema>
   items?: JsonSchema | JsonSchema[]
   additionalProperties?: JsonSchema | boolean
   enum?: unknown[]
   const?: unknown
   default?: unknown
   anyOf?: JsonSchema[]
   oneOf?: JsonSchema[]
   allOf?: JsonSchema[]
   nullable?: boolean
   minimum?: number
   maximum?: number
   minLength?: number
   maxLength?: number
   pattern?: string
   required?: string[]
}

// ── Schema 分析结果 ──

export interface SchemaAnalysis {
   schema: JsonSchema | null
   unsupportedPaths: string[]
}

// ── 编辑模式 ──

export type ConfigFormMode = 'form' | 'raw'

// ── 搜索 ──

export interface ConfigSearchCriteria {
   text: string
   tags: string[]
}

// ── Diff ──

export interface ConfigDiffEntry {
   path: string
   from: unknown
   to: unknown
}

// ── Section 分类 ──

export interface SectionDef {
   key: string
   label: string
}

export interface SectionCategory {
   id: string
   label: string
   sections: SectionDef[]
}

// ── Section 元数据 ──

export interface SectionMeta {
   label: string
   description: string
}

// ── 页面状态 ──

export interface ConfigPageState {
   // 原始配置
   configRaw: string
   configRawOriginal: string
   configHash: string
   configPath: string | null
   configValid: boolean | null
   configIssues: ConfigIssue[]

   // 解析后的表单对象
   formValue: Record<string, unknown> | null
   originalValue: Record<string, unknown> | null

   // Schema
   schema: unknown
   analyzedSchema: JsonSchema | null
   unsupportedPaths: string[]
   uiHints: ConfigUiHints

   // UI 状态
   formMode: ConfigFormMode
   activeSection: string | null
   searchQuery: string

   // 操作状态
   loading: boolean
   schemaLoading: boolean
   saving: boolean
   applying: boolean
   updating: boolean
   error: string | null

   // 敏感字段
   revealedPaths: Set<string>
}
