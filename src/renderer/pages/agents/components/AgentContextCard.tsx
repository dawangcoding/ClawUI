import React from 'react'
import { Tag } from 'antd'
import {
   FolderOutlined,
   RobotOutlined,
   ThunderboltOutlined,
} from '@ant-design/icons'
import type { AgentInfo, AgentIdentityResult } from '../../../../shared/types/gateway-protocol'
import type { AgentContext } from '../types'
import { resolveAgentEmoji, normalizeAgentLabel } from '../utils/agentHelpers'
import styles from '../AgentsPage.module.css'

type Props = {
   agent: AgentInfo
   identity?: AgentIdentityResult | null
   context: AgentContext | null
}

export default function AgentContextCard({ agent, identity, context }: Props) {
   const emoji = resolveAgentEmoji(agent, identity)
   const label = normalizeAgentLabel({ ...agent, identity: identity ?? agent.identity })

   return (
      <div className={styles.contextCard}>
         <div className={styles.contextAvatar}>{emoji || label[0]?.toUpperCase() || '?'}</div>
         <div className={styles.contextInfo}>
            <div className={styles.contextName}>
               {label}
               {context?.isDefault && (
                  <Tag
                     color="blue"
                     style={{ marginLeft: 8, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
                  >
                     默认
                  </Tag>
               )}
            </div>
            {context && (
               <div className={styles.contextMeta}>
                  <span className={styles.contextMetaItem}>
                     <FolderOutlined className={styles.contextMetaIcon} />
                     {context.workspace}
                  </span>
                  <span className={styles.contextMetaItem}>
                     <RobotOutlined className={styles.contextMetaIcon} />
                     {context.model}
                  </span>
                  <span className={styles.contextMetaItem}>
                     <ThunderboltOutlined className={styles.contextMetaIcon} />
                     {context.skillsLabel}
                  </span>
               </div>
            )}
         </div>
      </div>
   )
}
