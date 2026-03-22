import React, { useMemo, lazy, Suspense } from 'react'
import { Tabs, Card, Spin, Alert } from 'antd'
import { useGateway } from '../../contexts/GatewayContext'
import EmptyState from '../../components/EmptyState'
import { useAgentsPageState } from './hooks/useAgentsPageState'
import { buildAgentContext } from './utils/agentHelpers'
import AgentToolbar from './components/AgentToolbar'
import AgentContextCard from './components/AgentContextCard'
import OverviewPanel from './components/OverviewPanel'
import type { AgentsPanel } from './types'
import styles from './AgentsPage.module.css'

const FilesPanel = lazy(() => import('./components/FilesPanel'))
const ToolsPanel = lazy(() => import('./components/ToolsPanel'))
const SkillsPanel = lazy(() => import('./components/SkillsPanel'))
const ChannelsPanel = lazy(() => import('./components/ChannelsPanel'))
const CronPanel = lazy(() => import('./components/CronPanel'))

const PANEL_FALLBACK = <Spin size="small" style={{ padding: 24 }} />

export default function AgentsPage() {
   const { connected } = useGateway()
   const state = useAgentsPageState()
   const {
      agents,
      config,
      files,
      tools,
      skills,
      channels,
      cron,
      selectedAgent,
      activePanel,
      setActivePanel
   } = state

   // ── 当前 Agent 上下文 ──
   const agentContext = useMemo(() => {
      if (!selectedAgent) return null
      const identity = agents.identityById[selectedAgent.id] ?? null
      return buildAgentContext(
         selectedAgent,
         config.form,
         files.list,
         agents.agentsList?.defaultId,
         identity
      )
   }, [selectedAgent, agents.identityById, config.form, files.list, agents.agentsList?.defaultId])

   if (!connected) return <EmptyState description="请先连接到 Gateway" />

   // ── Tab 配置 ──
   const fileCount = files.list?.files?.length ?? 0
   const toolCount = tools.result?.tools?.length ?? 0
   const skillCount = skills.report?.skills?.length ?? 0
   const channelCount = channels.snapshot?.channelOrder?.length ?? 0
   const cronCount = cron.jobs?.length ?? 0

   const tabItems = [
      {
         key: 'overview' as AgentsPanel,
         label: '概览',
         children: selectedAgent ? (
            <OverviewPanel
               state={state}
               context={agentContext}
               onSwitchPanel={(panel) => setActivePanel(panel)}
            />
         ) : null
      },
      {
         key: 'files' as AgentsPanel,
         label: `文件${fileCount > 0 ? ` (${fileCount})` : ''}`,
         children: selectedAgent ? (
            <Suspense fallback={PANEL_FALLBACK}>
               <FilesPanel state={state} />
            </Suspense>
         ) : null
      },
      {
         key: 'tools' as AgentsPanel,
         label: `工具${toolCount > 0 ? ` (${toolCount})` : ''}`,
         children: selectedAgent ? (
            <Suspense fallback={PANEL_FALLBACK}>
               <ToolsPanel state={state} />
            </Suspense>
         ) : null
      },
      {
         key: 'skills' as AgentsPanel,
         label: `技能${skillCount > 0 ? ` (${skillCount})` : ''}`,
         children: selectedAgent ? (
            <Suspense fallback={PANEL_FALLBACK}>
               <SkillsPanel state={state} />
            </Suspense>
         ) : null
      },
      {
         key: 'channels' as AgentsPanel,
         label: `频道${channelCount > 0 ? ` (${channelCount})` : ''}`,
         children: (
            <Suspense fallback={PANEL_FALLBACK}>
               <ChannelsPanel state={state} context={agentContext} />
            </Suspense>
         )
      },
      {
         key: 'cron' as AgentsPanel,
         label: `定时任务${cronCount > 0 ? ` (${cronCount})` : ''}`,
         children: (
            <Suspense fallback={PANEL_FALLBACK}>
               <CronPanel state={state} context={agentContext} />
            </Suspense>
         )
      }
   ]

   return (
      <div>
         <AgentToolbar state={state} />

         {selectedAgent ? (
            <>
               <AgentContextCard
                  agent={selectedAgent}
                  identity={agents.identityById[selectedAgent.id] ?? null}
                  context={agentContext}
               />
               <Card size="small">
                  <Tabs
                     activeKey={activePanel}
                     onChange={(key) => setActivePanel(key as AgentsPanel)}
                     items={tabItems}
                     size="small"
                  />
               </Card>
            </>
         ) : (
            <Card>
               <EmptyState description={agents.loading ? '加载中...' : '选择一个 Agent 查看详情'} />
            </Card>
         )}
      </div>
   )
}
