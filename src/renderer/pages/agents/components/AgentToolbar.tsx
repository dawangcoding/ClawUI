import React, { useMemo } from 'react'
import { Select, Button, Dropdown, Tag } from 'antd'
import {
   ReloadOutlined,
   MoreOutlined,
   SaveOutlined,
   UndoOutlined,
   CopyOutlined,
   StarOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import type { AgentsPageState } from '../hooks/useAgentsPageState'
import { normalizeAgentLabel, resolveAgentEmoji } from '../utils/agentHelpers'
import styles from '../AgentsPage.module.css'

type Props = {
   state: AgentsPageState
}

export default function AgentToolbar({ state }: Props) {
   const { agents, config, handleSetDefault, handleSave, handleRefresh } = state
   const { agentsList, selectedAgentId, identityById } = agents

   const agentOptions = useMemo(() => {
      if (!agentsList?.agents) return []
      return agentsList.agents.map((agent) => {
         const identity = identityById[agent.id]
         const emoji = resolveAgentEmoji(agent, identity)
         const label = normalizeAgentLabel({ ...agent, identity: identity ?? agent.identity })
         const isDefault = agentsList.defaultId === agent.id
         return {
            value: agent.id,
            label: (
               <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {emoji && <span>{emoji}</span>}
                  <span>{label}</span>
                  {isDefault && (
                     <Tag
                        color="blue"
                        style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
                     >
                        默认
                     </Tag>
                  )}
               </span>
            ),
         }
      })
   }, [agentsList, identityById])

   const menuItems: MenuProps['items'] = useMemo(() => {
      const items: MenuProps['items'] = []
      if (selectedAgentId) {
         items.push({
            key: 'copy-id',
            icon: <CopyOutlined />,
            label: '复制 Agent ID',
            onClick: () => {
               navigator.clipboard.writeText(selectedAgentId)
            },
         })
         const isDefault = agentsList?.defaultId === selectedAgentId
         if (!isDefault) {
            items.push({
               key: 'set-default',
               icon: <StarOutlined />,
               label: '设为默认',
               onClick: () => handleSetDefault(selectedAgentId),
            })
         }
      }
      return items
   }, [selectedAgentId, agentsList?.defaultId, handleSetDefault])

   return (
      <div className={styles.toolbar}>
         <span className={styles.toolbarLabel}>Agent</span>
         <Select
            className={styles.toolbarSelect}
            value={selectedAgentId ?? undefined}
            onChange={(value) => agents.selectAgent(value)}
            options={agentOptions}
            placeholder="选择 Agent"
            loading={agents.loading}
            size="small"
         />
         {menuItems.length > 0 && (
            <Dropdown menu={{ items: menuItems }} trigger={['click']}>
               <Button type="text" size="small" icon={<MoreOutlined />} />
            </Dropdown>
         )}
         <div className={styles.toolbarActions}>
            {config.dirty && (
               <div className={styles.saveBtnGroup}>
                  <Button
                     size="small"
                     icon={<UndoOutlined />}
                     onClick={config.reloadConfig}
                  >
                     放弃
                  </Button>
                  <Button
                     type="primary"
                     size="small"
                     icon={<SaveOutlined />}
                     loading={config.saving}
                     onClick={handleSave}
                  >
                     保存
                  </Button>
               </div>
            )}
            <Button
               size="small"
               icon={<ReloadOutlined />}
               onClick={handleRefresh}
               loading={agents.loading}
            >
               刷新
            </Button>
         </div>
      </div>
   )
}
