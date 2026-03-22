/**
 * 代理页顶层聚合 Hook — 组合所有子 Hook + 业务回调
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useGateway } from '../../../contexts/GatewayContext'
import { RPC } from '../../../../shared/types/gateway-rpc'
import { createLogger } from '../../../../shared/logger'
import type { AgentsPanel } from '../types'
import { useAgentsList } from './useAgentsList'
import { useAgentConfig } from './useAgentConfig'
import { useAgentFiles } from './useAgentFiles'
import { useAgentToolsCatalog } from './useAgentToolsCatalog'
import { useAgentSkills } from './useAgentSkills'
import { useAgentChannels } from './useAgentChannels'
import { useAgentCron } from './useAgentCron'
import {
   updateAgentModel,
   updateAgentModelFallbacks,
   updateAgentToolProfile,
   updateAgentToolOverrides,
   updateAgentSkillAllowlist,
   resolveAgentConfig,
} from '../utils/agentConfigUtils'

const log = createLogger('AgentsPageState')

export function useAgentsPageState() {
   const { rpc, connected } = useGateway()

   // ── 子 Hooks ──
   const agents = useAgentsList()
   const config = useAgentConfig()
   const files = useAgentFiles()
   const tools = useAgentToolsCatalog()
   const skills = useAgentSkills()
   const channels = useAgentChannels()
   const cron = useAgentCron()

   // ── 面板状态 ──
   const [activePanel, setActivePanel] = useState<AgentsPanel>('overview')

   // 避免重复加载的 ref
   const prevAgentIdRef = useRef<string | null>(null)
   const channelsLoadedRef = useRef(false)
   const cronLoadedRef = useRef(false)

   // ── Agent 切换时自动加载 files / tools / skills ──
   useEffect(() => {
      const agentId = agents.selectedAgentId
      if (!agentId || !connected) return
      if (agentId === prevAgentIdRef.current) return
      prevAgentIdRef.current = agentId

      // 重置懒加载标记
      channelsLoadedRef.current = false
      cronLoadedRef.current = false

      // 清理上一个 agent 的文件状态
      files.clearState()

      // 并行加载
      files.loadFiles(agentId)
      tools.loadCatalog(agentId)
      skills.loadSkills(agentId)

      // 切换 agent 后回到 overview
      setActivePanel('overview')
   }, [agents.selectedAgentId, connected]) // eslint-disable-line react-hooks/exhaustive-deps

   // ── 面板切换时懒加载 Channels / Cron ──
   useEffect(() => {
      if (activePanel === 'channels' && !channelsLoadedRef.current) {
         channelsLoadedRef.current = true
         channels.loadChannels()
      }
      if (activePanel === 'cron' && !cronLoadedRef.current) {
         cronLoadedRef.current = true
         cron.loadCron()
      }
   }, [activePanel]) // eslint-disable-line react-hooks/exhaustive-deps

   // ── 业务回调: Model ──

   const handleModelChange = useCallback(
      (modelId: string | null) => {
         const agentId = agents.selectedAgentId
         if (!agentId || !config.form) return
         const newForm = updateAgentModel(config.form, agentId, modelId)
         config.patchForm(newForm)
      },
      [agents.selectedAgentId, config.form, config.patchForm],
   )

   const handleModelFallbacksChange = useCallback(
      (fallbacks: string[]) => {
         const agentId = agents.selectedAgentId
         if (!agentId || !config.form) return
         const newForm = updateAgentModelFallbacks(config.form, agentId, fallbacks)
         config.patchForm(newForm)
      },
      [agents.selectedAgentId, config.form, config.patchForm],
   )

   // ── 业务回调: Tools ──

   const handleToolsProfileChange = useCallback(
      (profile: string | null, clearAllow: boolean) => {
         const agentId = agents.selectedAgentId
         if (!agentId || !config.form) return
         const newForm = updateAgentToolProfile(config.form, agentId, profile, clearAllow)
         config.patchForm(newForm)
      },
      [agents.selectedAgentId, config.form, config.patchForm],
   )

   const handleToolsOverridesChange = useCallback(
      (alsoAllow: string[], deny: string[]) => {
         const agentId = agents.selectedAgentId
         if (!agentId || !config.form) return
         const newForm = updateAgentToolOverrides(config.form, agentId, alsoAllow, deny)
         config.patchForm(newForm)
      },
      [agents.selectedAgentId, config.form, config.patchForm],
   )

   // ── 业务回调: Skills ──

   const handleSkillToggle = useCallback(
      (skillName: string, enabled: boolean) => {
         const agentId = agents.selectedAgentId
         if (!agentId || !config.form) return

         const { entry } = resolveAgentConfig(config.form, agentId)
         const currentSkills = Array.isArray(
            (entry as Record<string, unknown> | undefined)?.skills,
         )
            ? [...((entry as Record<string, unknown>).skills as string[])]
            : null

         let newSkills: string[] | undefined
         if (enabled) {
            // 添加到允许列表 (如果是 null 表示全部允许, 不需要操作)
            if (currentSkills === null) return
            if (!currentSkills.includes(skillName)) {
               newSkills = [...currentSkills, skillName]
            } else {
               return // 已存在
            }
         } else {
            // 从允许列表移除
            if (currentSkills === null) {
               // 全部允许 → 需要先构建完整列表再移除
               const allNames =
                  skills.report?.skills?.map((s) => s.name).filter((n) => n !== skillName) ?? []
               newSkills = allNames.length > 0 ? allNames : undefined
            } else {
               newSkills = currentSkills.filter((n) => n !== skillName)
               if (newSkills.length === 0) newSkills = undefined
            }
         }
         const newForm = updateAgentSkillAllowlist(config.form, agentId, newSkills)
         config.patchForm(newForm)
      },
      [agents.selectedAgentId, config.form, config.patchForm, skills.report],
   )

   const handleSkillsClear = useCallback(() => {
      const agentId = agents.selectedAgentId
      if (!agentId || !config.form) return
      const newForm = updateAgentSkillAllowlist(config.form, agentId, undefined)
      config.patchForm(newForm)
   }, [agents.selectedAgentId, config.form, config.patchForm])

   const handleSkillsDisableAll = useCallback(() => {
      const agentId = agents.selectedAgentId
      if (!agentId || !config.form) return
      // 空数组 = 禁用全部
      const newForm = updateAgentSkillAllowlist(config.form, agentId, [])
      config.patchForm(newForm)
   }, [agents.selectedAgentId, config.form, config.patchForm])

   const handleRefreshSkills = useCallback(async () => {
      const agentId = agents.selectedAgentId
      if (agentId) skills.loadSkills(agentId)
   }, [agents.selectedAgentId, skills.loadSkills])

   // ── 业务回调: 设为默认 Agent ──

   const handleSetDefault = useCallback(
      async (agentId: string) => {
         if (!connected) return
         try {
            await rpc(RPC.AGENTS_UPDATE, { agentId, setDefault: true })
            log.log(`Set default agent: ${agentId}`)
            await agents.loadAgents()
         } catch (err) {
            log.error('Failed to set default agent:', err)
            throw err
         }
      },
      [rpc, connected, agents.loadAgents],
   )

   // ── 业务回调: 保存 + 重新加载受影响数据 ──

   const handleSave = useCallback(async () => {
      await config.saveConfig()
      const agentId = agents.selectedAgentId
      if (agentId) {
         tools.loadCatalog(agentId)
         skills.loadSkills(agentId)
      }
   }, [config.saveConfig, agents.selectedAgentId]) // eslint-disable-line react-hooks/exhaustive-deps

   // ── 业务回调: 刷新全部 ──

   const handleRefresh = useCallback(async () => {
      await agents.loadAgents()
      await config.reloadConfig()
      const agentId = agents.selectedAgentId
      if (agentId) {
         files.clearState()
         files.loadFiles(agentId)
         tools.loadCatalog(agentId)
         skills.loadSkills(agentId)
      }
      channelsLoadedRef.current = false
      cronLoadedRef.current = false
   }, [agents.loadAgents, config.reloadConfig, agents.selectedAgentId]) // eslint-disable-line react-hooks/exhaustive-deps

   // ── 当前选中 Agent 信息 ──
   const selectedAgent =
      agents.agentsList?.agents?.find((a) => a.id === agents.selectedAgentId) ?? null

   return {
      // 子状态
      agents,
      config,
      files,
      tools,
      skills,
      channels,
      cron,

      // 面板
      activePanel,
      setActivePanel,

      // 选中 Agent
      selectedAgent,

      // 业务回调
      handleModelChange,
      handleModelFallbacksChange,
      handleToolsProfileChange,
      handleToolsOverridesChange,
      handleSkillToggle,
      handleSkillsClear,
      handleSkillsDisableAll,
      handleRefreshSkills,
      handleSetDefault,
      handleSave,
      handleRefresh,
   }
}

export type AgentsPageState = ReturnType<typeof useAgentsPageState>
