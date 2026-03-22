import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { useGateway } from './GatewayContext'
import type {
   Snapshot,
   SessionDefaults,
   PresenceEntry,
   HelloOkPayload,
} from '../../shared/types/gateway-protocol'
import { createLogger } from '../../shared/logger'

const log = createLogger('SnapshotContext')

interface SnapshotContextValue {
   snapshot: Snapshot | null
   helloOk: HelloOkPayload | null
   presence: PresenceEntry[]
   sessionDefaults: SessionDefaults | null
   features: { methods: string[]; events: string[] } | null
   serverVersion: string | null
}

const SnapshotContext = createContext<SnapshotContextValue | undefined>(undefined)

export function SnapshotProvider(props: { children: React.ReactNode }) {
   const { subscribe, connected } = useGateway()
   const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
   const [helloOk, setHelloOk] = useState<HelloOkPayload | null>(null)
   const [presence, setPresence] = useState<PresenceEntry[]>([])

   // 监听 hello-ok 事件获取初始 snapshot
   useEffect(() => {
      const unsub = subscribe('hello-ok', (payload) => {
         const hello = payload as HelloOkPayload
         log.log(
            'hello-ok received: server=%s, hasSnapshot=%s',
            hello.server?.version ?? 'unknown',
            !!hello.snapshot,
         )
         setHelloOk(hello)
         if (hello.snapshot) {
            setSnapshot(hello.snapshot)
            const presenceList = hello.snapshot.presence ?? []
            log.log('Initial presence: %d entries', presenceList.length)
            setPresence(presenceList)
         }
      })
      return unsub
   }, [subscribe])

   // 监听 system-presence 事件更新在线状态
   useEffect(() => {
      const unsub = subscribe('system-presence', (payload) => {
         const entries = payload as PresenceEntry[]
         if (Array.isArray(entries)) {
            log.log('system-presence update: %d entries', entries.length)
            setPresence(entries)
         }
      })
      return unsub
   }, [subscribe])

   // 连接状态获取初始 snapshot
   useEffect(() => {
      if (connected) {
         log.log('Connected, fetching initial status...')
         window.clawAPI.gateway.getStatus().then((status) => {
            if (status.snapshot) {
               log.log('Initial snapshot loaded from status')
               setSnapshot(status.snapshot as Snapshot)
            }
         })
      } else {
         log.log('Disconnected, clearing state')
         setSnapshot(null)
         setHelloOk(null)
         setPresence([])
      }
   }, [connected])

   const sessionDefaults = snapshot?.sessionDefaults ?? null
   const features = helloOk?.features ?? null
   const serverVersion = helloOk?.server?.version ?? null

   const value = useMemo(
      () => ({ snapshot, helloOk, presence, sessionDefaults, features, serverVersion }),
      [snapshot, helloOk, presence, sessionDefaults, features, serverVersion],
   )

   return (
      <SnapshotContext.Provider value={value}>
         {props.children}
      </SnapshotContext.Provider>
   )
}

export function useSnapshot() {
   const ctx = useContext(SnapshotContext)
   if (!ctx) throw new Error('useSnapshot must be used within SnapshotProvider')
   return ctx
}
