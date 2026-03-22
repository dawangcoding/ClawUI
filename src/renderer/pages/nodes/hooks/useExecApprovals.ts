import { useState, useCallback } from 'react'
import { message } from 'antd'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type {
   ExecApprovalsFile,
   ExecApprovalsSnapshot,
   ExecApprovalsAllowlistEntry,
} from '../../../../shared/types/gateway-protocol'
import { setPathValue, removePathValue, cloneConfigObject } from '../../../utils/formUtils'
import {
   resolveNodeTargets,
   resolveConfigAgents,
   EXEC_APPROVALS_DEFAULT_SCOPE,
} from '../utils/nodesHelpers'

type ExecSecurity = 'deny' | 'allowlist' | 'full'
type ExecAsk = 'off' | 'on-miss' | 'always'

export interface ExecApprovalsResolvedDefaults {
   security: ExecSecurity
   ask: ExecAsk
   askFallback: ExecSecurity
   autoAllowSkills: boolean
}

export interface ExecApprovalsAgentOption {
   id: string
   name?: string
   isDefault?: boolean
}

function normalizeSecurity(value?: string): ExecSecurity {
   if (value === 'allowlist' || value === 'full' || value === 'deny') return value
   return 'deny'
}

function normalizeAsk(value?: string): ExecAsk {
   if (value === 'always' || value === 'off' || value === 'on-miss') return value
   return 'on-miss'
}

function resolveDefaults(form: ExecApprovalsFile | null): ExecApprovalsResolvedDefaults {
   const defaults = form?.defaults ?? {}
   return {
      security: normalizeSecurity(defaults.security),
      ask: normalizeAsk(defaults.ask),
      askFallback: normalizeSecurity(defaults.askFallback ?? 'deny'),
      autoAllowSkills: Boolean(defaults.autoAllowSkills ?? false),
   }
}

function mergeAgents(
   configForm: Record<string, unknown> | null,
   form: ExecApprovalsFile | null,
): ExecApprovalsAgentOption[] {
   const configAgents = resolveConfigAgents(configForm).map((a) => ({
      id: a.id,
      name: a.name,
      isDefault: a.isDefault,
   }))
   const approvalsAgents = Object.keys(form?.agents ?? {})
   const merged = new Map<string, ExecApprovalsAgentOption>()
   configAgents.forEach((a) => merged.set(a.id, a))
   approvalsAgents.forEach((id) => {
      if (!merged.has(id)) merged.set(id, { id })
   })
   const agents = Array.from(merged.values())
   if (agents.length === 0) agents.push({ id: 'main', isDefault: true })
   agents.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1
      if (!a.isDefault && b.isDefault) return 1
      const aLabel = a.name?.trim() ? a.name : a.id
      const bLabel = b.name?.trim() ? b.name : b.id
      return aLabel.localeCompare(bLabel)
   })
   return agents
}

export function useExecApprovals(
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>,
   connected: boolean,
   nodes: Array<Record<string, unknown>>,
   configForm: Record<string, unknown> | null,
) {
   const [snapshot, setSnapshot] = useState<ExecApprovalsSnapshot | null>(null)
   const [form, setForm] = useState<ExecApprovalsFile | null>(null)
   const [loading, setLoading] = useState(false)
   const [saving, setSaving] = useState(false)
   const [dirty, setDirty] = useState(false)
   const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
   const [target, setTarget] = useState<'gateway' | 'node'>('gateway')
   const [targetNodeId, setTargetNodeId] = useState<string | null>(null)

   const targetNodes = resolveNodeTargets(nodes, [
      'system.execApprovals.get',
      'system.execApprovals.set',
   ])
   const effectiveForm = form ?? snapshot?.file ?? null
   const defaults = resolveDefaults(effectiveForm)
   const agents = mergeAgents(configForm, effectiveForm)

   // 解析当前 scope
   const selectedScope = (() => {
      if (selectedAgent === EXEC_APPROVALS_DEFAULT_SCOPE) return EXEC_APPROVALS_DEFAULT_SCOPE
      if (selectedAgent && agents.some((a) => a.id === selectedAgent)) return selectedAgent
      return EXEC_APPROVALS_DEFAULT_SCOPE
   })()

   // 当前 agent 的数据
   const selectedAgentData: Record<string, unknown> | null =
      selectedScope !== EXEC_APPROVALS_DEFAULT_SCOPE
         ? (((effectiveForm?.agents ?? {})[selectedScope] as Record<string, unknown>) ?? null)
         : null

   const allowlist: ExecApprovalsAllowlistEntry[] = Array.isArray(
      (selectedAgentData as { allowlist?: unknown })?.allowlist,
   )
      ? ((selectedAgentData as { allowlist: ExecApprovalsAllowlistEntry[] }).allowlist ?? [])
      : []

   const load = useCallback(async () => {
      if (!connected) return
      setLoading(true)
      try {
         const method =
            target === 'node' ? RPC.EXEC_APPROVALS_NODE_GET : RPC.EXEC_APPROVALS_GET
         const params = target === 'node' ? { nodeId: targetNodeId } : {}
         const result = await rpc<ExecApprovalsSnapshot>(method, params)
         setSnapshot(result)
         if (result?.file) {
            setForm(cloneConfigObject(result.file as unknown as Record<string, unknown>) as unknown as ExecApprovalsFile)
         }
         setDirty(false)
      } catch (err) {
         message.error(`加载审批配置失败: ${err instanceof Error ? err.message : String(err)}`)
         console.error('[NodesPage] Load exec approvals error:', err)
      } finally {
         setLoading(false)
      }
   }, [rpc, connected, target, targetNodeId])

   const save = useCallback(async () => {
      if (!connected || !snapshot) return
      setSaving(true)
      try {
         const method =
            target === 'node' ? RPC.EXEC_APPROVALS_NODE_SET : RPC.EXEC_APPROVALS_SET
         const file = form ?? snapshot.file ?? {}
         const params =
            target === 'node'
               ? { nodeId: targetNodeId, file, baseHash: snapshot.hash }
               : { file, baseHash: snapshot.hash }
         await rpc(method, params)
         message.success('审批配置已保存')
         setDirty(false)
         await load()
      } catch (err) {
         message.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
         console.error('[NodesPage] Save exec approvals error:', err)
      } finally {
         setSaving(false)
      }
   }, [rpc, connected, target, targetNodeId, form, snapshot, load])

   const changeTarget = useCallback(
      (kind: 'gateway' | 'node', nodeId: string | null) => {
         setTarget(kind)
         setTargetNodeId(kind === 'node' ? nodeId : null)
         setSnapshot(null)
         setForm(null)
         setDirty(false)
      },
      [],
   )

   const selectAgent = useCallback((agentId: string) => {
      setSelectedAgent(agentId)
   }, [])

   const patch = useCallback(
      (path: Array<string | number>, value: unknown) => {
         setForm((prev) => {
            const base = prev ?? snapshot?.file ?? {}
            const next = setPathValue(
               base as unknown as Record<string, unknown>,
               path,
               value,
            )
            return next as unknown as ExecApprovalsFile
         })
         setDirty(true)
      },
      [snapshot],
   )

   const remove = useCallback(
      (path: Array<string | number>) => {
         setForm((prev) => {
            const base = prev ?? snapshot?.file ?? {}
            const next = removePathValue(
               base as unknown as Record<string, unknown>,
               path,
            )
            return next as unknown as ExecApprovalsFile
         })
         setDirty(true)
      },
      [snapshot],
   )

   const ready = Boolean(effectiveForm)
   const targetReady = target !== 'node' || Boolean(targetNodeId)
   const disabled = saving || loading

   return {
      ready,
      disabled,
      dirty,
      loading,
      saving,
      target,
      targetNodeId,
      targetNodes,
      defaults,
      agents,
      selectedScope,
      selectedAgentData,
      allowlist,
      targetReady,
      load,
      save,
      changeTarget,
      selectAgent,
      patch,
      remove,
   }
}
