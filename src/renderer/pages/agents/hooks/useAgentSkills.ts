import { useState, useCallback } from 'react'
import { useGateway } from '../../../contexts/GatewayContext'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type { SkillStatusReport } from '../../../../shared/types/gateway-protocol'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('AgentSkills')

export function useAgentSkills() {
   const { rpc } = useGateway()
   const [report, setReport] = useState<SkillStatusReport | null>(null)
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const [agentId, setAgentId] = useState<string | null>(null)
   const [filter, setFilter] = useState('')

   const loadSkills = useCallback(
      async (id: string) => {
         setLoading(true)
         setError(null)
         setAgentId(id)
         try {
            const res = await rpc<SkillStatusReport>(RPC.SKILLS_STATUS, { agentId: id })
            setReport(res ?? null)
         } catch (err) {
            log.error('Failed to load skills:', err)
            setError(err instanceof Error ? err.message : String(err))
         } finally {
            setLoading(false)
         }
      },
      [rpc],
   )

   return { report, loading, error, agentId, filter, loadSkills, setFilter }
}
