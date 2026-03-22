import { useState, useCallback, useRef } from 'react'
import { message } from 'antd'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type { ConfigSnapshot } from '../../../../shared/types/gateway-protocol'
import { setPathValue, cloneConfigObject } from '../../../utils/formUtils'
import { resolveNodeTargets, resolveConfigAgents } from '../utils/nodesHelpers'

export function useNodeBindings(
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>,
   connected: boolean,
   nodes: Array<Record<string, unknown>>,
) {
   const [configForm, setConfigForm] = useState<Record<string, unknown> | null>(null)
   const [configLoading, setConfigLoading] = useState(false)
   const [configSaving, setConfigSaving] = useState(false)
   const [configDirty, setConfigDirty] = useState(false)
   const configHashRef = useRef('')
   const configOriginalRef = useRef<string>('')

   const execNodes = resolveNodeTargets(nodes, ['system.run'])
   const agents = configForm ? resolveConfigAgents(configForm) : []

   const defaultBinding = (() => {
      if (!configForm) return null
      const tools = (configForm.tools ?? {}) as Record<string, unknown>
      const exec = (tools.exec ?? {}) as Record<string, unknown>
      return typeof exec.node === 'string' && exec.node.trim() ? exec.node.trim() : null
   })()

   const agentBindings = agents.map((agent) => {
      const toolsEntry = (agent.record.tools ?? {}) as Record<string, unknown>
      const execEntry = (toolsEntry.exec ?? {}) as Record<string, unknown>
      const binding =
         typeof execEntry.node === 'string' && execEntry.node.trim()
            ? execEntry.node.trim()
            : null
      return {
         id: agent.id,
         name: agent.name,
         index: agent.index,
         isDefault: agent.isDefault,
         binding,
      }
   })

   const loadConfig = useCallback(async () => {
      if (!connected) return
      setConfigLoading(true)
      try {
         const result = await rpc<ConfigSnapshot>(RPC.CONFIG_GET, {})
         if (result?.parsed && typeof result.parsed === 'object') {
            const parsed = result.parsed as Record<string, unknown>
            setConfigForm(parsed)
            configOriginalRef.current = JSON.stringify(parsed)
            configHashRef.current = result.hash ?? ''
            setConfigDirty(false)
         }
      } catch (err) {
         message.error(`加载配置失败: ${err instanceof Error ? err.message : String(err)}`)
         console.error('[NodesPage] Load config error:', err)
      } finally {
         setConfigLoading(false)
      }
   }, [rpc, connected])

   const bindDefault = useCallback(
      (nodeId: string | null) => {
         setConfigForm((prev) => {
            if (!prev) return prev
            const next = setPathValue(
               cloneConfigObject(prev),
               ['tools', 'exec', 'node'],
               nodeId ?? undefined,
            )
            return next
         })
         setConfigDirty(true)
      },
      [],
   )

   const bindAgent = useCallback(
      (agentIndex: number, nodeId: string | null) => {
         setConfigForm((prev) => {
            if (!prev) return prev
            const next = setPathValue(
               cloneConfigObject(prev),
               ['agents', 'list', agentIndex, 'tools', 'exec', 'node'],
               nodeId ?? undefined,
            )
            return next
         })
         setConfigDirty(true)
      },
      [],
   )

   const saveBindings = useCallback(async () => {
      if (!connected || !configForm) return
      setConfigSaving(true)
      try {
         await rpc(RPC.CONFIG_SET, {
            raw: JSON.stringify(configForm, null, 2),
            baseHash: configHashRef.current,
         })
         message.success('绑定已保存')
         await loadConfig()
      } catch (err) {
         message.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
         console.error('[NodesPage] Save bindings error:', err)
      } finally {
         setConfigSaving(false)
      }
   }, [rpc, connected, configForm, loadConfig])

   return {
      configForm,
      configLoading,
      configSaving,
      configDirty,
      execNodes,
      agents: agentBindings.length > 0
         ? agentBindings
         : [{ id: 'main', name: undefined, index: 0, isDefault: true, binding: null as string | null }],
      defaultBinding,
      loadConfig,
      bindDefault,
      bindAgent,
      saveBindings,
   }
}
