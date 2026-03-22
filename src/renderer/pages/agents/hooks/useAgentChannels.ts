import { useState, useCallback } from 'react'
import { useGateway } from '../../../contexts/GatewayContext'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type { ChannelsStatusSnapshot } from '../../../../shared/types/gateway-protocol'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('AgentChannels')

export function useAgentChannels() {
   const { rpc } = useGateway()
   const [snapshot, setSnapshot] = useState<ChannelsStatusSnapshot | null>(null)
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState<string | null>(null)
   const [lastSuccess, setLastSuccess] = useState<number | null>(null)

   const loadChannels = useCallback(async () => {
      setLoading(true)
      setError(null)
      try {
         const res = await rpc<ChannelsStatusSnapshot>(RPC.CHANNELS_STATUS, {})
         setSnapshot(res ?? null)
         setLastSuccess(Date.now())
      } catch (err) {
         log.error('Failed to load channels:', err)
         setError(err instanceof Error ? err.message : String(err))
      } finally {
         setLoading(false)
      }
   }, [rpc])

   return { snapshot, loading, error, lastSuccess, loadChannels }
}
