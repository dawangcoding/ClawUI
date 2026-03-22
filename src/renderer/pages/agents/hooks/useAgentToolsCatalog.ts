import { useState, useCallback } from 'react'
import { useGateway } from '../../../contexts/GatewayContext'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type { ToolsCatalogResult } from '../../../../shared/types/gateway-protocol'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('AgentToolsCatalog')

export function useAgentToolsCatalog() {
   const { rpc } = useGateway()
   const [result, setResult] = useState<ToolsCatalogResult | null>(null)
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)

   const loadCatalog = useCallback(
      async (agentId: string) => {
         setLoading(true)
         setError(null)
         try {
            const res = await rpc<ToolsCatalogResult>(RPC.TOOLS_CATALOG, {
               agentId,
               includePlugins: true,
            })
            setResult(res ?? null)
         } catch (err) {
            log.error('Failed to load tools catalog:', err)
            setError(err instanceof Error ? err.message : String(err))
         } finally {
            setLoading(false)
         }
      },
      [rpc],
   )

   return { result, loading, error, loadCatalog }
}
