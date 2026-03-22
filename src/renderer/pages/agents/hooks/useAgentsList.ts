import { useState, useEffect, useCallback } from 'react'
import { useGateway } from '../../../contexts/GatewayContext'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type { AgentsListResult, AgentIdentityResult } from '../../../../shared/types/gateway-protocol'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('AgentsList')

export function useAgentsList() {
   const { rpc, connected } = useGateway()
   const [agentsList, setAgentsList] = useState<AgentsListResult | null>(null)
   const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
   const [identityById, setIdentityById] = useState<Record<string, AgentIdentityResult>>({})
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)

   const loadAgents = useCallback(async () => {
      if (!connected) return
      setLoading(true)
      setError(null)
      try {
         const result = await rpc<AgentsListResult>(RPC.AGENTS_LIST, {})
         setAgentsList(result)
         if (result?.agents?.length) {
            setSelectedAgentId((prev) => {
               if (prev && result.agents.some((a) => a.id === prev)) return prev
               return result.defaultId ?? result.agents[0]?.id ?? null
            })
         }
      } catch (err) {
         log.error('Failed to load agents:', err)
         setError(err instanceof Error ? err.message : String(err))
      } finally {
         setLoading(false)
      }
   }, [rpc, connected])

   useEffect(() => {
      loadAgents()
   }, [loadAgents])

   const loadIdentity = useCallback(
      async (agentId: string) => {
         if (!connected || identityById[agentId]) return
         try {
            const result = await rpc<AgentIdentityResult>(RPC.AGENTS_IDENTITY, { agentId })
            if (result) {
               setIdentityById((prev) => ({ ...prev, [agentId]: result }))
            }
         } catch (err) {
            log.error(`Failed to load identity for ${agentId}:`, err)
         }
      },
      [rpc, connected, identityById],
   )

   useEffect(() => {
      if (selectedAgentId) {
         loadIdentity(selectedAgentId)
      }
   }, [selectedAgentId, loadIdentity])

   const selectAgent = useCallback((agentId: string) => {
      setSelectedAgentId(agentId)
   }, [])

   return {
      agentsList,
      selectedAgentId,
      identityById,
      loading,
      error,
      loadAgents,
      selectAgent,
   }
}
