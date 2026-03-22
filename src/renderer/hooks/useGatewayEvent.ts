import { useEffect, useRef } from 'react'
import { useGateway } from '../contexts/GatewayContext'
import { createLogger } from '../../shared/logger'

const log = createLogger('useGatewayEvent')

/**
 * 订阅 Gateway 事件的 hook
 * 自动在组件 unmount 时取消订阅
 */
export function useGatewayEvent(
   eventName: string,
   handler: (payload: unknown) => void,
): void {
   const { subscribe } = useGateway()
   const handlerRef = useRef(handler)
   handlerRef.current = handler

   useEffect(() => {
      log.debug('Subscribing to event: %s', eventName)
      const unsub = subscribe(eventName, (payload) => {
         handlerRef.current(payload)
      })
      return () => {
         log.debug('Unsubscribing from event: %s', eventName)
         unsub()
      }
   }, [eventName, subscribe])
}
