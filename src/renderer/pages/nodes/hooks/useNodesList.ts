import { useState, useCallback, useEffect } from 'react'
import { useGatewayEvent } from '../../../hooks/useGatewayEvent'
import { RPC } from '../../../../shared/types/gateway-rpc'

export function useNodesList(
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>,
   connected: boolean,
) {
   const [nodes, setNodes] = useState<Array<Record<string, unknown>>>([])
   const [loading, setLoading] = useState(false)

   const refresh = useCallback(async () => {
      if (!connected) return
      setLoading(true)
      try {
         const result = await rpc<{ nodes?: Record<string, unknown> | unknown[] }>(
            RPC.NODE_LIST,
            {},
         )
         if (result?.nodes) {
            if (Array.isArray(result.nodes)) {
               setNodes(result.nodes as Array<Record<string, unknown>>)
            } else {
               setNodes(
                  Object.entries(result.nodes).map(([id, data]) => ({
                     nodeId: id,
                     ...(typeof data === 'object' && data ? (data as Record<string, unknown>) : {}),
                  })),
               )
            }
         }
      } catch (err) {
         console.error('[NodesPage] Load nodes error:', err)
      } finally {
         setLoading(false)
      }
   }, [rpc, connected])

   useEffect(() => {
      refresh()
   }, [refresh])

   useGatewayEvent('node-pair-resolved', () => {
      refresh()
   })

   return { nodes, loading, refresh }
}
