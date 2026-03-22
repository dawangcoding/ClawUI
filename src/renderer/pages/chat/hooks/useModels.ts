import { useState, useEffect, useCallback } from 'react'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type { ModelChoice } from '../types'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('useModels')

interface UseModelsOptions {
   connected: boolean
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>
}

interface UseModelsResult {
   models: ModelChoice[]
   loading: boolean
   refetch: () => void
}

export function useModels({ connected, rpc }: UseModelsOptions): UseModelsResult {
   const [models, setModels] = useState<ModelChoice[]>([])
   const [loading, setLoading] = useState(false)

   const fetchModels = useCallback(async () => {
      if (!connected) return
      setLoading(true)
      try {
         log.log('Fetching models list...')
         const result = await rpc<{ models: ModelChoice[] }>(RPC.MODELS_LIST, {})
         const list = result?.models ?? []
         log.log('Models loaded: count=%d', list.length)
         setModels(list)
      } catch (err) {
         log.error('Failed to fetch models:', err)
      } finally {
         setLoading(false)
      }
   }, [connected, rpc])

   useEffect(() => {
      if (connected) {
         fetchModels()
      } else {
         setModels([])
      }
   }, [connected, fetchModels])

   return { models, loading, refetch: fetchModels }
}
