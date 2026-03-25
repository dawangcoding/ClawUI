import React from 'react'
import { Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import { createStyles } from 'antd-style'
import {
   MessageOutlined,
   DashboardOutlined,
   GlobalOutlined,
   ApiOutlined,
   UnorderedListOutlined,
   BarChartOutlined,
   ClockCircleOutlined,
   ThunderboltOutlined,
   RobotOutlined,
   ToolOutlined,
   ClusterOutlined,
   SettingOutlined,
   SafetyOutlined,
   BugOutlined,
   FileTextOutlined,
   WifiOutlined,
   ExperimentOutlined,
   SoundOutlined,
} from '@ant-design/icons'
import {
   useNavigation,
   NAV_GROUPS,
   PAGE_LABELS,
   type NavPage,
} from '../contexts/NavigationContext'

const { Sider } = Layout

const useStyles = createStyles(() => ({
   sider: {},
}))

interface SidebarProps {
   collapsed: boolean
}

const PAGE_ICONS: Record<NavPage, React.ReactNode> = {
   chat: <MessageOutlined />,
   overview: <DashboardOutlined />,
   infrastructure: <GlobalOutlined />,
   channels: <ApiOutlined />,
   instances: <WifiOutlined />,
   sessions: <UnorderedListOutlined />,
   usage: <BarChartOutlined />,
   cron: <ClockCircleOutlined />,
   automation: <ThunderboltOutlined />,
   agents: <RobotOutlined />,
   skills: <ToolOutlined />,
   nodes: <ClusterOutlined />,
   config: <SettingOutlined />,
   'ai-agents': <ExperimentOutlined />,
   communication: <SoundOutlined />,
   'exec-approvals': <SafetyOutlined />,
   debug: <BugOutlined />,
   logs: <FileTextOutlined />,
}

export default React.memo(function Sidebar({ collapsed }: SidebarProps) {
   const { styles } = useStyles()
   const { currentPage, navigate } = useNavigation()

   const menuItems: MenuProps['items'] = NAV_GROUPS.map((group) => ({
      key: group.key,
      label: group.label,
      type: 'group' as const,
      children: group.pages.map((page) => ({
         key: page,
         icon: PAGE_ICONS[page],
         label: PAGE_LABELS[page],
      })),
   }))

   return (
      <Sider
         className={styles.sider}
         theme="dark"
         width={collapsed ? 0 : 200}
         style={{
            height: '100%',
            overflow: 'auto',
            borderRight: collapsed ? 'none' : '1px solid var(--ant-color-border-secondary, #f0f0f0)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.2s ease',
         }}
      >
         <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => navigate(key as NavPage)}
            style={{ flex: 1, borderRight: 0 }}
         />
      </Sider>
   )
})
