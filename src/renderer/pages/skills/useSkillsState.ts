import { useState, useCallback, useEffect } from 'react'
import { useGateway } from '../../contexts/GatewayContext'
import { RPC } from '../../../shared/types/gateway-rpc'
import type { SkillStatusReport, SkillStatusEntry } from '../../../shared/types/gateway-protocol'
import type { SkillMessage } from './skills-utils'
import { createLogger } from '../../../shared/logger'

const log = createLogger('SkillsPage')

export interface SkillsPageState {
   report: SkillStatusReport | null
   loading: boolean
   globalError: string | null
   filter: string
   busyKey: string | null
   apiKeyEdits: Record<string, string>
   messages: Record<string, SkillMessage>
   loadSkills: () => Promise<void>
   setFilter: (value: string) => void
   toggleSkill: (skillKey: string, currentlyDisabled: boolean) => Promise<void>
   saveApiKey: (skillKey: string) => Promise<void>
   updateApiKeyEdit: (skillKey: string, value: string) => void
   installSkill: (skillKey: string, name: string, installId: string) => Promise<void>
}

/** 确保嵌套对象存在，防止 Gateway 返回不完整数据 */
function normalizeSkill(skill: SkillStatusEntry): SkillStatusEntry {
   return {
      ...skill,
      requirements: {
         bins: skill.requirements?.bins ?? [],
         env: skill.requirements?.env ?? [],
         config: skill.requirements?.config ?? [],
         os: skill.requirements?.os ?? [],
      },
      missing: {
         bins: skill.missing?.bins ?? [],
         env: skill.missing?.env ?? [],
         config: skill.missing?.config ?? [],
         os: skill.missing?.os ?? [],
      },
      configChecks: skill.configChecks ?? [],
      install: skill.install ?? [],
   }
}

function getErrorMessage(err: unknown): string {
   return err instanceof Error ? err.message : String(err)
}

export function useSkillsState(): SkillsPageState {
   const { rpc, connected } = useGateway()

   const [report, setReport] = useState<SkillStatusReport | null>(null)
   const [loading, setLoading] = useState(true)
   const [globalError, setGlobalError] = useState<string | null>(null)
   const [filter, setFilter] = useState('')
   const [busyKey, setBusyKey] = useState<string | null>(null)
   const [apiKeyEdits, setApiKeyEdits] = useState<Record<string, string>>({})
   const [messages, setMessages] = useState<Record<string, SkillMessage>>({})

   const setSkillMessage = useCallback((skillKey: string, msg: SkillMessage | null) => {
      setMessages((prev) => {
         const next = { ...prev }
         if (msg) {
            next[skillKey] = msg
         } else {
            delete next[skillKey]
         }
         return next
      })
   }, [])

   const loadSkills = useCallback(async () => {
      if (!connected) return
      setLoading(true)
      setGlobalError(null)
      try {
         const raw = await rpc<SkillStatusReport>(RPC.SKILLS_STATUS, {})
         if (!raw) {
            log.warn('skills.status returned null/undefined')
            setReport(null)
            return
         }
         const result: SkillStatusReport = {
            workspaceDir: raw.workspaceDir ?? '',
            managedSkillsDir: raw.managedSkillsDir ?? '',
            skills: (raw.skills ?? []).map(normalizeSkill),
         }
         log.log('skills.status loaded: count=%d', result.skills.length)
         setReport(result)
      } catch (err) {
         const msg = getErrorMessage(err)
         log.error('Load skills error:', msg)
         setGlobalError(msg)
      } finally {
         setLoading(false)
      }
   }, [rpc, connected])

   useEffect(() => {
      if (connected) {
         loadSkills()
      } else {
         setLoading(false)
      }
   }, [connected, loadSkills])

   const toggleSkill = useCallback(
      async (skillKey: string, currentlyDisabled: boolean) => {
         setBusyKey(skillKey)
         setGlobalError(null)
         try {
            // disabled=true 表示当前已禁用，点击"启用"时传 enabled=true
            await rpc(RPC.SKILLS_UPDATE, { skillKey, enabled: currentlyDisabled })
            setSkillMessage(skillKey, {
               kind: 'success',
               text: currentlyDisabled ? '技能已启用' : '技能已禁用',
            })
            await loadSkills()
         } catch (err) {
            const msg = getErrorMessage(err)
            setGlobalError(msg)
            setSkillMessage(skillKey, { kind: 'error', text: msg })
         } finally {
            setBusyKey(null)
         }
      },
      [rpc, loadSkills, setSkillMessage],
   )

   const saveApiKey = useCallback(
      async (skillKey: string) => {
         setBusyKey(skillKey)
         setGlobalError(null)
         try {
            const apiKey = apiKeyEdits[skillKey] ?? ''
            await rpc(RPC.SKILLS_UPDATE, { skillKey, apiKey })
            setSkillMessage(skillKey, { kind: 'success', text: 'API 密钥已保存' })
            await loadSkills()
         } catch (err) {
            const msg = getErrorMessage(err)
            setGlobalError(msg)
            setSkillMessage(skillKey, { kind: 'error', text: msg })
         } finally {
            setBusyKey(null)
         }
      },
      [rpc, apiKeyEdits, loadSkills, setSkillMessage],
   )

   const updateApiKeyEdit = useCallback((skillKey: string, value: string) => {
      setApiKeyEdits((prev) => ({ ...prev, [skillKey]: value }))
   }, [])

   const installSkill = useCallback(
      async (skillKey: string, name: string, installId: string) => {
         setBusyKey(skillKey)
         setGlobalError(null)
         try {
            const result = await rpc<{ message?: string }>(RPC.SKILLS_INSTALL, {
               name,
               installId,
               timeoutMs: 120000,
            })
            setSkillMessage(skillKey, {
               kind: 'success',
               text: result?.message ?? '安装完成',
            })
            await loadSkills()
         } catch (err) {
            const msg = getErrorMessage(err)
            setGlobalError(msg)
            setSkillMessage(skillKey, { kind: 'error', text: msg })
         } finally {
            setBusyKey(null)
         }
      },
      [rpc, loadSkills, setSkillMessage],
   )

   return {
      report,
      loading,
      globalError,
      filter,
      busyKey,
      apiKeyEdits,
      messages,
      loadSkills,
      setFilter,
      toggleSkill,
      saveApiKey,
      updateApiKeyEdit,
      installSkill,
   }
}
