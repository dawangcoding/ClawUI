// ── 配置页面状态管理 Hook ──

import { useState, useCallback, useMemo, useEffect } from 'react'
import { message } from 'antd'
import { useGateway } from '../../contexts/GatewayContext'
import { RPC } from '../../../shared/types/gateway-rpc'
import type { ConfigSnapshot, ConfigSchemaResponse, ConfigUiHints } from '../../../shared/types/gateway-protocol'
import type { ConfigFormMode, JsonSchema, ConfigDiffEntry, ConfigSearchCriteria } from './config-types'
import {
   analyzeConfigSchema,
   computeDiff,
   coerceFormValues,
   serializeConfigForm,
   setPathValue,
   cloneConfigObject,
   buildVisibleSections,
   parseConfigSearchQuery,
} from './config-utils'
import type { SectionCategory } from './config-types'
import { createLogger } from '../../../shared/logger'

const log = createLogger('ConfigPage')

export interface UseConfigStateReturn {
   // 原始配置
   configRaw: string
   configHash: string
   configPath: string | null
   configValid: boolean | null
   configIssues: Array<{ path?: string; message: string }>

   // 表单对象
   formValue: Record<string, unknown> | null
   originalValue: Record<string, unknown> | null

   // Schema
   analyzedSchema: JsonSchema | null
   unsupportedPaths: Set<string>
   uiHints: ConfigUiHints

   // UI 状态
   formMode: ConfigFormMode
   activeSection: string | null
   searchQuery: string
   searchCriteria: ConfigSearchCriteria

   // 操作状态
   loading: boolean
   schemaLoading: boolean
   saving: boolean
   applying: boolean
   updating: boolean
   error: string | null

   // 敏感字段
   revealedPaths: Set<string>

   // 计算属性
   hasChanges: boolean
   diff: ConfigDiffEntry[]
   visibleSections: SectionCategory[]

   // 操作方法
   loadConfig: () => Promise<void>
   loadSchema: () => Promise<void>
   handleSave: () => Promise<void>
   handleApply: () => Promise<void>
   handleUpdate: () => Promise<void>
   handleOpenFile: () => Promise<void>
   handleReload: () => Promise<void>
   handleFormPatch: (path: Array<string | number>, value: unknown) => void
   handleRawChange: (text: string) => void
   handleModeChange: (mode: ConfigFormMode) => void
   handleSectionChange: (key: string | null) => void
   handleSearchChange: (query: string) => void
   toggleSensitivePath: (pathStr: string) => void
}

export interface UseConfigStateOptions {
   /** 仅显示指定 section key 的配置分区 */
   includeSections?: string[]
}

export function useConfigState(options?: UseConfigStateOptions): UseConfigStateReturn {
   const { rpc, connected } = useGateway()

   // ── 原始配置 ──
   const [configRaw, setConfigRaw] = useState('')
   const [configRawOriginal, setConfigRawOriginal] = useState('')
   const [configHash, setConfigHash] = useState('')
   const [configPath, setConfigPath] = useState<string | null>(null)
   const [configValid, setConfigValid] = useState<boolean | null>(null)
   const [configIssues, setConfigIssues] = useState<Array<{ path?: string; message: string }>>([])

   // ── 表单对象 ──
   const [formValue, setFormValue] = useState<Record<string, unknown> | null>(null)
   const [originalValue, setOriginalValue] = useState<Record<string, unknown> | null>(null)

   // ── Schema ──
   const [rawSchema, setRawSchema] = useState<unknown>(null)
   const [uiHints, setUiHints] = useState<ConfigUiHints>({})

   // ── UI 状态 ──
   const [formMode, setFormMode] = useState<ConfigFormMode>('form')
   const [activeSection, setActiveSection] = useState<string | null>(null)
   const [searchQuery, setSearchQuery] = useState('')

   // ── 操作状态 ──
   const [loading, setLoading] = useState(false)
   const [schemaLoading, setSchemaLoading] = useState(false)
   const [saving, setSaving] = useState(false)
   const [applying, setApplying] = useState(false)
   const [updating, setUpdating] = useState(false)
   const [error, setError] = useState<string | null>(null)

   // ── 敏感字段 ──
   const [revealedPaths, setRevealedPaths] = useState<Set<string>>(new Set())

   // ── 计算: Schema 分析 ──
   const { analyzedSchema, unsupportedPaths } = useMemo(() => {
      if (!rawSchema) return { analyzedSchema: null, unsupportedPaths: new Set<string>() }
      const analysis = analyzeConfigSchema(rawSchema)
      return {
         analyzedSchema: analysis.schema,
         unsupportedPaths: new Set(analysis.unsupportedPaths),
      }
   }, [rawSchema])

   // ── 计算: Diff ──
   const diff = useMemo<ConfigDiffEntry[]>(() => {
      if (formMode === 'raw') return []
      return computeDiff(originalValue, formValue)
   }, [formMode, originalValue, formValue])

   // ── 计算: hasChanges ──
   const hasChanges = useMemo(() => {
      if (formMode === 'form') return diff.length > 0
      return configRaw !== configRawOriginal
   }, [formMode, diff, configRaw, configRawOriginal])

   // ── 计算: 搜索条件 ──
   const searchCriteria = useMemo(() => parseConfigSearchQuery(searchQuery), [searchQuery])

   // ── 计算: 可见 sections ──
   const visibleSections = useMemo(() => {
      const all = buildVisibleSections(analyzedSchema?.properties ?? undefined)
      if (!options?.includeSections) return all
      const includeSet = new Set(options.includeSections)
      return all
         .map((cat) => ({
            ...cat,
            sections: cat.sections.filter((s) => includeSet.has(s.key)),
         }))
         .filter((cat) => cat.sections.length > 0)
   }, [analyzedSchema, options?.includeSections])

   // ── 加载配置 ──
   const loadConfig = useCallback(async () => {
      if (!connected) return
      setLoading(true)
      setError(null)
      try {
         const result = await rpc<ConfigSnapshot>(RPC.CONFIG_GET, {})
         const raw = result?.raw ?? ''
         setConfigRaw(raw)
         setConfigRawOriginal(raw)
         setConfigHash(result?.hash ?? '')
         setConfigPath(result?.path ?? null)
         setConfigValid(result?.valid ?? null)
         setConfigIssues(result?.issues ?? [])

         // 尝试 parse
         let parsed: Record<string, unknown> | null = null
         try {
            const obj = JSON.parse(raw)
            if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
               parsed = obj as Record<string, unknown>
            }
         } catch {
            // raw 可能不是标准 JSON，忽略 parse 失败
            log.warn('Config raw is not valid JSON, form mode may be limited')
         }
         setFormValue(parsed)
         setOriginalValue(parsed)
         log.log('Config loaded, hash=%s', result?.hash)
      } catch (err) {
         const errMsg = err instanceof Error ? err.message : String(err)
         log.error('Failed to load config: %s', errMsg)
         setError(errMsg)
      } finally {
         setLoading(false)
      }
   }, [rpc, connected])

   // ── 加载 Schema ──
   const loadSchema = useCallback(async () => {
      if (!connected) return
      setSchemaLoading(true)
      try {
         const result = await rpc<ConfigSchemaResponse>(RPC.CONFIG_SCHEMA, {})
         setRawSchema(result?.schema ?? null)
         setUiHints(result?.uiHints ?? {})
         log.log('Schema loaded, version=%s', result?.version)
      } catch (err) {
         log.error('Failed to load schema: %s', err instanceof Error ? err.message : String(err))
         // Schema 加载失败不设 error，不阻塞页面使用
      } finally {
         setSchemaLoading(false)
      }
   }, [rpc, connected])

   // ── 序列化当前表单值 ──
   const serializeCurrent = useCallback((): string => {
      if (formMode === 'raw') return configRaw
      if (!formValue || !analyzedSchema) return configRaw
      const coerced = coerceFormValues(formValue, analyzedSchema) as Record<string, unknown>
      return serializeConfigForm(coerced)
   }, [formMode, configRaw, formValue, analyzedSchema])

   // ── 保存 ──
   const handleSave = useCallback(async () => {
      setSaving(true)
      setError(null)
      try {
         const raw = serializeCurrent()
         await rpc(RPC.CONFIG_SET, { raw, baseHash: configHash })
         message.success('配置已保存')
         await loadConfig()
      } catch (err) {
         const errMsg = err instanceof Error ? err.message : String(err)
         setError(errMsg)
         message.error('保存失败')
      } finally {
         setSaving(false)
      }
   }, [rpc, configHash, serializeCurrent, loadConfig])

   // ── 应用 ──
   const handleApply = useCallback(async () => {
      setApplying(true)
      setError(null)
      try {
         const raw = serializeCurrent()
         await rpc(RPC.CONFIG_APPLY, { raw, baseHash: configHash, sessionKey: 'main' })
         message.success('配置已应用，正在重启...')
         // 延迟重新加载，等待重启
         setTimeout(() => {
            loadConfig()
         }, 2000)
      } catch (err) {
         const errMsg = err instanceof Error ? err.message : String(err)
         setError(errMsg)
         message.error('应用失败')
      } finally {
         setApplying(false)
      }
   }, [rpc, configHash, serializeCurrent, loadConfig])

   // ── 更新 ──
   const handleUpdate = useCallback(async () => {
      setUpdating(true)
      try {
         await rpc(RPC.UPDATE_RUN, { sessionKey: 'main' })
         message.success('更新已启动')
      } catch (err) {
         message.error('更新失败')
      } finally {
         setUpdating(false)
      }
   }, [rpc])

   // ── 打开文件 ──
   const handleOpenFile = useCallback(async () => {
      try {
         await rpc(RPC.CONFIG_OPEN_FILE, {})
      } catch (err) {
         message.error('无法打开配置文件')
      }
   }, [rpc])

   // ── 重新加载 ──
   const handleReload = useCallback(async () => {
      await loadConfig()
      message.success('配置已重新加载')
   }, [loadConfig])

   // ── 表单补丁 ──
   const handleFormPatch = useCallback(
      (path: Array<string | number>, value: unknown) => {
         setFormValue((prev) => {
            if (!prev) return prev
            const updated = setPathValue(prev, path, value)
            // 同步到 raw
            setConfigRaw(serializeConfigForm(updated))
            return updated
         })
      },
      [],
   )

   // ── Raw 文本变更 ──
   const handleRawChange = useCallback((text: string) => {
      setConfigRaw(text)
      // 尝试同步到 formValue
      try {
         const parsed = JSON.parse(text)
         if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            setFormValue(parsed as Record<string, unknown>)
         }
      } catch {
         // JSON 无效时不同步
      }
   }, [])

   // ── 模式切换 ──
   const handleModeChange = useCallback(
      (mode: ConfigFormMode) => {
         if (mode === formMode) return
         if (mode === 'raw' && formValue && analyzedSchema) {
            // Form → Raw: 序列化
            const coerced = coerceFormValues(formValue, analyzedSchema) as Record<string, unknown>
            setConfigRaw(serializeConfigForm(coerced))
         } else if (mode === 'form') {
            // Raw → Form: 尝试 parse
            try {
               const parsed = JSON.parse(configRaw)
               if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  setFormValue(parsed as Record<string, unknown>)
               } else {
                  message.warning('配置不是有效的 JSON 对象，无法切换到表单模式')
                  return
               }
            } catch {
               message.warning('JSON 格式错误，无法切换到表单模式')
               return
            }
         }
         setFormMode(mode)
      },
      [formMode, formValue, analyzedSchema, configRaw],
   )

   // ── Section 切换 ──
   const handleSectionChange = useCallback((key: string | null) => {
      setActiveSection(key)
   }, [])

   // ── 搜索 ──
   const handleSearchChange = useCallback((query: string) => {
      setSearchQuery(query)
   }, [])

   // ── 敏感路径切换 ──
   const toggleSensitivePath = useCallback((pathStr: string) => {
      setRevealedPaths((prev) => {
         const next = new Set(prev)
         if (next.has(pathStr)) {
            next.delete(pathStr)
         } else {
            next.add(pathStr)
         }
         return next
      })
   }, [])

   // ── 初始化加载 ──
   useEffect(() => {
      if (connected) {
         loadConfig()
         loadSchema()
      }
   }, [connected, loadConfig, loadSchema])

   // ── 选择第一个可见 section ──
   useEffect(() => {
      if (visibleSections.length > 0 && activeSection === null) {
         // 有 includeSections 时保持 null（用于"全部"概览 tab）
         if (options?.includeSections) return
         const firstKey = visibleSections[0].sections[0]?.key ?? null
         setActiveSection(firstKey)
      }
   }, [visibleSections, activeSection, options?.includeSections])

   return {
      configRaw,
      configHash,
      configPath,
      configValid,
      configIssues,
      formValue,
      originalValue,
      analyzedSchema,
      unsupportedPaths,
      uiHints,
      formMode,
      activeSection,
      searchQuery,
      searchCriteria,
      loading,
      schemaLoading,
      saving,
      applying,
      updating,
      error,
      revealedPaths,
      hasChanges,
      diff,
      visibleSections,
      loadConfig,
      loadSchema,
      handleSave,
      handleApply,
      handleUpdate,
      handleOpenFile,
      handleReload,
      handleFormPatch,
      handleRawChange,
      handleModeChange,
      handleSectionChange,
      handleSearchChange,
      toggleSensitivePath,
   }
}
