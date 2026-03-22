import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'

export type NavPage =
   | 'chat'
   | 'overview'
   | 'infrastructure'
   | 'communication'
   | 'channels'
   | 'instances'
   | 'sessions'
   | 'usage'
   | 'cron'
   | 'automation'
   | 'agents'
   | 'skills'
   | 'nodes'
   | 'ai-agents'
   | 'config'
   | 'exec-approvals'
   | 'debug'
   | 'logs'

export type NavGroup = 'chat' | 'control' | 'agent' | 'settings'

export interface NavGroupDef {
   key: NavGroup
   label: string
   pages: NavPage[]
}

export const NAV_GROUPS: NavGroupDef[] = [
   { key: 'chat', label: '聊天', pages: ['chat'] },
   {
      key: 'control',
      label: '控制',
      pages: [
         'overview',
         'channels',
         'instances',
         'sessions',
         'usage',
         'cron',
      ],
   },
   { key: 'agent', label: 'Agent', pages: ['agents', 'skills', 'nodes'] },
   {
      key: 'settings',
      label: '设置',
      pages: [
         'config',
         'communication',
         'automation',
         'infrastructure',
         'ai-agents',
         'exec-approvals',
         'debug',
         'logs',
      ],
   },
]

export const PAGE_LABELS: Record<NavPage, string> = {
   chat: '对话',
   overview: '总览',
   infrastructure: '基础设施',
   communication: '通信',
   channels: '频道',
   instances: '实例',
   sessions: '会话',
   usage: '用量',
   cron: '定时任务',
   automation: '自动化',
   agents: 'Agent',
   skills: '技能',
   nodes: '节点',
   config: '配置',
   'ai-agents': 'AI与代理',
   'exec-approvals': '审批',
   debug: '调试',
   logs: '日志',
}

interface NavigationContextValue {
   currentPage: NavPage
   pageParams: Record<string, unknown>
   navigate: (page: NavPage, params?: Record<string, unknown>) => void
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined)

export function NavigationProvider(props: { children: React.ReactNode }) {
   const [currentPage, setCurrentPage] = useState<NavPage>('overview')
   const [pageParams, setPageParams] = useState<Record<string, unknown>>({})

   const navigate = useCallback((page: NavPage, params?: Record<string, unknown>) => {
      setCurrentPage(page)
      setPageParams(params ?? {})
   }, [])

   const value = useMemo(
      () => ({ currentPage, pageParams, navigate }),
      [currentPage, pageParams, navigate],
   )

   return (
      <NavigationContext.Provider value={value}>
         {props.children}
      </NavigationContext.Provider>
   )
}

export function useNavigation() {
   const ctx = useContext(NavigationContext)
   if (!ctx) throw new Error('useNavigation must be used within NavigationProvider')
   return ctx
}
