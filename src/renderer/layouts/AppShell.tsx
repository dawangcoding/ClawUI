import React, { lazy, Suspense, useState } from 'react'
import { Layout, Spin } from 'antd'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import { useGateway } from '../contexts/GatewayContext'
import { useNavigation, type NavPage } from '../contexts/NavigationContext'
import ConnectionBanner from '../components/ConnectionBanner'

const { Content } = Layout

const PAGE_COMPONENTS: Record<NavPage, React.LazyExoticComponent<React.ComponentType>> = {
   chat: lazy(() => import('../pages/chat/ChatPage')),
   overview: lazy(() => import('../pages/overview/OverviewPage')),
   infrastructure: lazy(() => import('../pages/infrastructure/InfrastructurePage')),
   sessions: lazy(() => import('../pages/sessions/SessionsPage')),
   config: lazy(() => import('../pages/config/ConfigPage')),
   'ai-agents': lazy(() => import('../pages/ai-agents/AiAgentsPage')),
   communication: lazy(() => import('../pages/communication/CommunicationPage')),
   channels: lazy(() => import('../pages/channels/ChannelsPage')),
   instances: lazy(() => import('../pages/instances/InstancesPage')),
   agents: lazy(() => import('../pages/agents/AgentsPage')),
   skills: lazy(() => import('../pages/skills/SkillsPage')),
   cron: lazy(() => import('../pages/cron/CronPage')),
   automation: lazy(() => import('../pages/automation/AutomationPage')),
   usage: lazy(() => import('../pages/usage/UsagePage')),
   logs: lazy(() => import('../pages/logs/LogsPage')),
   nodes: lazy(() => import('../pages/nodes/NodesPage')),
   'exec-approvals': lazy(() => import('../pages/exec-approvals/ApprovalsPage')),
   debug: lazy(() => import('../pages/debug/DebugPage')),
}

export default React.memo(function AppShell() {
   const { connected } = useGateway()
   const { currentPage } = useNavigation()
   const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

   const PageComponent = PAGE_COMPONENTS[currentPage]

   return (
      <Layout style={{ height: '100vh', paddingTop: 40 }}>
         <TitleBar
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
         />
         <Layout style={{ flex: 1, overflow: 'hidden' }}>
            <Sidebar collapsed={sidebarCollapsed} />
            <Layout>
               {!connected && <ConnectionBanner />}
               <Content
                  style={{
                     padding: currentPage === 'chat' ? 0 : 24,
                     overflow: 'auto',
                     height: '100%',
                  }}
               >
                  <Suspense fallback={<Spin />}>
                     {PageComponent && <PageComponent />}
                  </Suspense>
               </Content>
            </Layout>
         </Layout>
      </Layout>
   )
})
