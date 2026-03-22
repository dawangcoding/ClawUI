import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { RPC } from '../../../../shared/types/gateway-rpc'
import type {
   AgentInfo,
   AgentsListResult,
   GatewaySessionRow,
   SessionsListResult,
} from '../../../../shared/types/gateway-protocol'
import { parseAgentSessionKey } from '../utils/sessionKeyUtils'
import { createLogger } from '../../../../shared/logger'

const log = createLogger('useAgentSessions')

interface UseAgentSessionsOptions {
   connected: boolean
   rpc: <T = unknown>(method: string, params?: unknown) => Promise<T>
   currentSessionKey: string
}

interface UseAgentSessionsResult {
   agents: AgentInfo[]
   agentsLoading: boolean
   defaultAgentId: string | null
   sessionsByAgent: Record<string, GatewaySessionRow[]>
   sessionsLoadingMap: Record<string, boolean>
   fetchSessionsForAgent: (agentId: string) => Promise<void>
   fetchAllSessions: () => Promise<void>
   currentAgent: AgentInfo | null
   currentSession: GatewaySessionRow | null
}

export function useAgentSessions({
   connected,
   rpc,
   currentSessionKey,
}: UseAgentSessionsOptions): UseAgentSessionsResult {
   const [agents, setAgents] = useState<AgentInfo[]>([])
   const [agentsLoading, setAgentsLoading] = useState(false)
   const [defaultAgentId, setDefaultAgentId] = useState<string | null>(null)
   const [sessionsByAgent, setSessionsByAgent] = useState<Record<string, GatewaySessionRow[]>>({})
   const [sessionsLoadingMap, setSessionsLoadingMap] = useState<Record<string, boolean>>({})

   const agentsRef = useRef<AgentInfo[]>([])

   // 加载 Agent 列表
   const fetchAgents = useCallback(async () => {
      if (!connected) return
      setAgentsLoading(true)
      try {
         log.log('Fetching agents list...')
         const result = await rpc<AgentsListResult>(RPC.AGENTS_LIST, {})
         const list = result?.agents ?? []
         log.log(
            'Agents loaded: count=%d, defaultId=%s',
            list.length,
            result?.defaultId ?? 'none',
         )
         setAgents(list)
         agentsRef.current = list
         setDefaultAgentId(result?.defaultId ?? null)
      } catch (err) {
         log.error('Failed to fetch agents:', err)
      } finally {
         setAgentsLoading(false)
      }
   }, [connected, rpc])

   // 加载某个 Agent 的 Session 列表
   const fetchSessionsForAgent = useCallback(
      async (agentId: string) => {
         if (!connected) return
         setSessionsLoadingMap((prev) => ({ ...prev, [agentId]: true }))
         try {
            log.log('Fetching sessions for agent: %s', agentId)
            const result = await rpc<SessionsListResult>(RPC.SESSIONS_LIST, {
               agentId,
               includeGlobal: false,
               includeUnknown: false,
               includeDerivedTitles: true,
               includeLastMessage: true,
               limit: 20,
            })
            const sessions = result?.sessions ?? []
            log.log('Sessions loaded for agent %s: count=%d', agentId, sessions.length)
            setSessionsByAgent((prev) => ({ ...prev, [agentId]: sessions }))
         } catch (err) {
            log.error('Failed to fetch sessions for agent %s:', agentId, err)
         } finally {
            setSessionsLoadingMap((prev) => ({ ...prev, [agentId]: false }))
         }
      },
      [connected, rpc],
   )

   // 并发加载所有 Agent 的 Sessions
   const fetchAllSessions = useCallback(async () => {
      const agentList = agentsRef.current
      if (!connected || agentList.length === 0) return
      log.log('Fetching sessions for all %d agents...', agentList.length)
      await Promise.all(agentList.map((agent) => fetchSessionsForAgent(agent.id)))
   }, [connected, fetchSessionsForAgent])

   // 连接建立时一次性加载 agents + 所有 sessions
   useEffect(() => {
      if (!connected) {
         setAgents([])
         agentsRef.current = []
         setDefaultAgentId(null)
         setSessionsByAgent({})
         setSessionsLoadingMap({})
         return
      }

      let cancelled = false

      const initData = async () => {
         // 1. 加载 Agent 列表
         setAgentsLoading(true)
         try {
            log.log('Init: fetching agents list...')
            const result = await rpc<AgentsListResult>(RPC.AGENTS_LIST, {})
            if (cancelled) return
            const list = result?.agents ?? []
            const defId = result?.defaultId ?? null
            log.log('Init: agents loaded: count=%d, defaultId=%s', list.length, defId ?? 'none')
            setAgents(list)
            agentsRef.current = list
            setDefaultAgentId(defId)

            // 2. 并发加载所有 Agent 的 Sessions
            if (list.length > 0) {
               log.log('Init: fetching sessions for all %d agents...', list.length)
               const loadingMap: Record<string, boolean> = {}
               for (const agent of list) loadingMap[agent.id] = true
               setSessionsLoadingMap(loadingMap)

               const results = await Promise.all(
                  list.map(async (agent) => {
                     try {
                        const res = await rpc<SessionsListResult>(RPC.SESSIONS_LIST, {
                           agentId: agent.id,
                           includeGlobal: false,
                           includeUnknown: false,
                           includeDerivedTitles: true,
                           includeLastMessage: true,
                           limit: 20,
                        })
                        return { agentId: agent.id, sessions: res?.sessions ?? [] }
                     } catch (err) {
                        log.error('Init: failed to fetch sessions for agent %s:', agent.id, err)
                        return { agentId: agent.id, sessions: [] }
                     }
                  }),
               )

               if (cancelled) return
               const sessionsMap: Record<string, GatewaySessionRow[]> = {}
               const doneMap: Record<string, boolean> = {}
               for (const r of results) {
                  sessionsMap[r.agentId] = r.sessions
                  doneMap[r.agentId] = false
               }
               setSessionsByAgent(sessionsMap)
               setSessionsLoadingMap(doneMap)
               log.log('Init: all sessions loaded')
            }
         } catch (err) {
            log.error('Init: failed to fetch agents:', err)
         } finally {
            if (!cancelled) setAgentsLoading(false)
         }
      }

      initData()
      return () => {
         cancelled = true
      }
   }, [connected, rpc])

   // 派生当前 Agent 和 Session
   const currentAgent = useMemo(() => {
      if (agents.length === 0) return null
      const parsed = parseAgentSessionKey(currentSessionKey)
      const agentId = parsed?.agentId ?? defaultAgentId
      if (!agentId) return null
      return agents.find((a) => a.id === agentId) ?? null
   }, [agents, currentSessionKey, defaultAgentId])

   const currentSession = useMemo(() => {
      if (!currentAgent) return null
      const sessions = sessionsByAgent[currentAgent.id]
      if (!sessions) return null
      const parsed = parseAgentSessionKey(currentSessionKey)
      const rest = parsed?.rest ?? currentSessionKey
      return (
         sessions.find((s) => s.key === currentSessionKey) ??
         sessions.find((s) => {
            const sp = parseAgentSessionKey(s.key)
            return (sp?.rest ?? s.key) === rest
         }) ??
         null
      )
   }, [currentAgent, sessionsByAgent, currentSessionKey])

   return {
      agents,
      agentsLoading,
      defaultAgentId,
      sessionsByAgent,
      sessionsLoadingMap,
      fetchSessionsForAgent,
      fetchAllSessions,
      currentAgent,
      currentSession,
   }
}
