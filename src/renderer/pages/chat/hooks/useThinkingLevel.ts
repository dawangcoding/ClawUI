import { useState, useEffect, useCallback } from 'react'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type { GatewaySessionRow } from '../../../../shared/types/gateway-protocol'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('useThinkingLevel')

export type ThinkingLevelValue =
   | 'off'
   | 'minimal'
   | 'low'
   | 'medium'
   | 'high'
   | 'xhigh'
   | 'adaptive'

export const DEFAULT_THINKING_LEVEL: ThinkingLevelValue = 'medium'

const ALL_THINKING_LEVELS: ThinkingLevelValue[] = [
   'off',
   'minimal',
   'low',
   'medium',
   'high',
   'xhigh',
   'adaptive',
]

export const THINKING_LEVEL_OPTIONS: { value: ThinkingLevelValue; label: string }[] = [
   { value: 'off', label: '关闭' },
   { value: 'minimal', label: '最低' },
   { value: 'low', label: '低' },
   { value: 'medium', label: '中' },
   { value: 'high', label: '高' },
   { value: 'xhigh', label: '超高' },
   { value: 'adaptive', label: '自适应' },
]

interface UseThinkingLevelOptions {
   sessionInfo: GatewaySessionRow | null
   sessionKey: string
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>
   onSessionInfoRefresh: () => void
}

interface UseThinkingLevelResult {
   level: ThinkingLevelValue
   setLevel: (level: ThinkingLevelValue) => Promise<void>
   loading: boolean
}

export function useThinkingLevel({
   sessionInfo,
   sessionKey,
   rpc,
   onSessionInfoRefresh,
}: UseThinkingLevelOptions): UseThinkingLevelResult {
   const [level, setLevelState] = useState<ThinkingLevelValue>(DEFAULT_THINKING_LEVEL)
   const [loading, setLoading] = useState(false)

   useEffect(() => {
      const serverLevel = sessionInfo?.thinkingLevel
      if (
         serverLevel &&
         ALL_THINKING_LEVELS.includes(serverLevel as ThinkingLevelValue)
      ) {
         setLevelState(serverLevel as ThinkingLevelValue)
      } else {
         setLevelState(DEFAULT_THINKING_LEVEL)
      }
   }, [sessionInfo?.thinkingLevel])

   const setLevel = useCallback(
      async (newLevel: ThinkingLevelValue) => {
         if (newLevel === level) return
         setLoading(true)
         try {
            const patchValue = newLevel === 'off' ? null : newLevel
            log.log('Setting thinking level: %s -> %s', level, newLevel)
            await rpc(RPC.SESSIONS_PATCH, {
               key: sessionKey,
               thinkingLevel: patchValue,
            })
            setLevelState(newLevel)
            onSessionInfoRefresh()
            log.log('Thinking level updated to: %s', newLevel)
         } catch (err) {
            log.error('Failed to set thinking level:', err)
         } finally {
            setLoading(false)
         }
      },
      [level, sessionKey, rpc, onSessionInfoRefresh],
   )

   return { level, setLevel, loading }
}
