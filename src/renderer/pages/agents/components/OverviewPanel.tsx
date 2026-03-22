import React, { useMemo, useCallback, useState, useRef } from 'react'
import { Select, Button, Tag } from 'antd'
import {
   CloseOutlined,
   FolderOutlined,
   RobotOutlined,
   ThunderboltOutlined,
   ToolOutlined,
} from '@ant-design/icons'
import type { AgentsPageState } from '../hooks/useAgentsPageState'
import type { AgentContext } from '../types'
import { resolveAgentConfig } from '../utils/agentConfigUtils'
import {
   resolveModelPrimary,
   resolveModelFallbacks,
   buildModelOptions,
   parseFallbackList,
} from '../utils/modelUtils'
import {
   resolveToolProfileOptions,
   resolveToolSections,
} from '../utils/toolPolicyUtils'
import styles from '../AgentsPage.module.css'

type Props = {
   state: AgentsPageState
   context: AgentContext | null
   onSwitchPanel: (panel: 'files' | 'tools' | 'skills') => void
}

export default function OverviewPanel({ state, context, onSwitchPanel }: Props) {
   const { agents, config, tools, handleModelChange, handleModelFallbacksChange, handleToolsProfileChange } = state
   const agentId = agents.selectedAgentId

   // ── 模型解析 ──
   const agentConfig = useMemo(() => {
      if (!agentId || !config.form) return null
      return resolveAgentConfig(config.form, agentId)
   }, [agentId, config.form])

   const currentModel = useMemo(() => {
      const entryModel = (agentConfig?.entry as Record<string, unknown> | undefined)?.model
      return entryModel ?? null
   }, [agentConfig])

   const primaryModel = resolveModelPrimary(currentModel)
   const fallbacks = resolveModelFallbacks(currentModel) ?? []
   const modelOptions = useMemo(() => buildModelOptions(config.form, primaryModel), [config.form, primaryModel])

   // 从 defaults 继承的 model
   const inheritedModel = useMemo(() => {
      const defaultsModel = (agentConfig?.defaults as Record<string, unknown> | undefined)?.model
      if (!defaultsModel) return null
      if (typeof defaultsModel === 'string') return defaultsModel
      if (typeof defaultsModel === 'object' && defaultsModel) {
         return (defaultsModel as Record<string, unknown>).primary as string ?? null
      }
      return null
   }, [agentConfig])

   // ── 工具 Profile ──
   const currentToolProfile = useMemo(() => {
      const toolsCfg = (agentConfig?.entry as Record<string, unknown> | undefined)?.tools as
         | Record<string, unknown>
         | undefined
      return (toolsCfg?.profile as string) ?? null
   }, [agentConfig])

   const profileOptions = useMemo(() => resolveToolProfileOptions(tools.result), [tools.result])

   // ── Fallback 输入 ──
   const [fallbackInput, setFallbackInput] = useState('')
   const inputRef = useRef<HTMLInputElement>(null)

   const handleFallbackKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
         if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            const items = parseFallbackList(fallbackInput)
            if (items.length > 0) {
               handleModelFallbacksChange([...fallbacks, ...items])
               setFallbackInput('')
            }
         } else if (e.key === 'Backspace' && !fallbackInput && fallbacks.length > 0) {
            handleModelFallbacksChange(fallbacks.slice(0, -1))
         }
      },
      [fallbackInput, fallbacks, handleModelFallbacksChange],
   )

   const removeFallback = useCallback(
      (index: number) => {
         handleModelFallbacksChange(fallbacks.filter((_, i) => i !== index))
      },
      [fallbacks, handleModelFallbacksChange],
   )

   return (
      <div>
         {/* Overview 统计网格 */}
         <div className={styles.overviewGrid}>
            <div
               className={styles.kvItemClickable}
               onClick={() => onSwitchPanel('files')}
               title="查看文件"
            >
               <div className={styles.kvHeader}>
                  <FolderOutlined className={styles.kvIcon} />
                  <span className={styles.kvLabel}>工作区</span>
               </div>
               <span className={styles.kvLink}>
                  {context?.workspace ?? '-'}
               </span>
            </div>
            <div className={styles.kvItem}>
               <div className={styles.kvHeader}>
                  <RobotOutlined className={styles.kvIcon} />
                  <span className={styles.kvLabel}>当前模型</span>
               </div>
               <span className={styles.kvValue}>{context?.model ?? '-'}</span>
            </div>
            <div
               className={styles.kvItemClickable}
               onClick={() => onSwitchPanel('skills')}
            >
               <div className={styles.kvHeader}>
                  <ThunderboltOutlined className={styles.kvIcon} />
                  <span className={styles.kvLabel}>技能过滤</span>
               </div>
               <span className={styles.kvLink}>
                  {context?.skillsLabel ?? '-'}
               </span>
            </div>
            <div
               className={styles.kvItemClickable}
               onClick={() => onSwitchPanel('tools')}
            >
               <div className={styles.kvHeader}>
                  <ToolOutlined className={styles.kvIcon} />
                  <span className={styles.kvLabel}>工具配置</span>
               </div>
               <span className={styles.kvLink}>
                  {currentToolProfile ?? '默认'}
               </span>
            </div>
         </div>

         {/* 模型选择 */}
         <div className={styles.configSection}>
            <div className={styles.configSectionHeader}>
               <div className={styles.configSectionIcon}>
                  <RobotOutlined />
               </div>
               <span className={styles.configSectionTitle}>模型选择</span>
            </div>
            <div className={styles.configFields}>
               <div className={styles.configFieldRow}>
                  <span className={styles.configFieldLabel}>
                     主模型
                     {!primaryModel && inheritedModel && (
                        <span style={{ fontWeight: 400, marginLeft: 6 }}>
                           (继承: {inheritedModel})
                        </span>
                     )}
                  </span>
                  <Select
                     size="small"
                     style={{ width: '100%' }}
                     value={primaryModel ?? undefined}
                     onChange={(v) => handleModelChange(v || null)}
                     options={modelOptions.map((o) => ({ value: o.value, label: o.label }))}
                     placeholder={inheritedModel ? `继承默认 (${inheritedModel})` : '选择模型'}
                     allowClear
                     showSearch
                  />
               </div>
               <div className={styles.configFieldRow}>
                  <span className={styles.configFieldLabel}>回退模型</span>
                  <div
                     className={styles.chipInput}
                     onClick={() => inputRef.current?.focus()}
                  >
                     {fallbacks.map((fb, i) => (
                        <span key={`${fb}-${i}`} className={styles.chip}>
                           {fb}
                           <button
                              className={styles.chipClose}
                              onClick={(e) => {
                                 e.stopPropagation()
                                 removeFallback(i)
                              }}
                           >
                              <CloseOutlined />
                           </button>
                        </span>
                     ))}
                     <input
                        ref={inputRef}
                        className={styles.chipInputField}
                        value={fallbackInput}
                        onChange={(e) => setFallbackInput(e.target.value)}
                        onKeyDown={handleFallbackKeyDown}
                        placeholder={fallbacks.length === 0 ? '输入模型名, 回车添加' : ''}
                     />
                  </div>
               </div>
            </div>
         </div>

         {/* 工具 Profile 选择 */}
         <div className={styles.configSection} style={{ marginTop: 12 }}>
            <div className={styles.configSectionHeader}>
               <div className={styles.configSectionIcon}>
                  <ToolOutlined />
               </div>
               <span className={styles.configSectionTitle}>工具配置</span>
            </div>
            <div className={styles.configFields}>
               <div className={styles.configFieldRow}>
                  <span className={styles.configFieldLabel}>Profile</span>
                  <Select
                     size="small"
                     style={{ width: '100%' }}
                     value={currentToolProfile ?? undefined}
                     onChange={(v) => handleToolsProfileChange(v || null, false)}
                     options={profileOptions.map((o) => ({ value: o.id, label: o.label }))}
                     placeholder="默认 (继承全局)"
                     allowClear
                  />
               </div>
            </div>
         </div>
      </div>
   )
}
