import React from 'react'
import { EXEC_APPROVALS_DEFAULT_SCOPE } from '../utils/nodesHelpers'
import type { ExecApprovalsAgentOption } from '../hooks/useExecApprovals'
import styles from '../NodesPage.module.css'

interface ExecApprovalsTabsProps {
   selectedScope: string
   agents: ExecApprovalsAgentOption[]
   onSelectScope: (agentId: string) => void
}

export default function ExecApprovalsTabs({
   selectedScope,
   agents,
   onSelectScope,
}: ExecApprovalsTabsProps) {
   return (
      <div className={styles.scopeTabs}>
         <span className={styles.scopeLabel}>Scope</span>
         <div className={styles.scopeBtnGroup}>
            <button
               className={
                  selectedScope === EXEC_APPROVALS_DEFAULT_SCOPE
                     ? styles.scopeBtnActive
                     : styles.scopeBtn
               }
               onClick={() => onSelectScope(EXEC_APPROVALS_DEFAULT_SCOPE)}
            >
               Defaults
            </button>
            {agents.map((agent) => {
               const label = agent.name?.trim()
                  ? `${agent.name} (${agent.id})`
                  : agent.id
               return (
                  <button
                     key={agent.id}
                     className={
                        selectedScope === agent.id
                           ? styles.scopeBtnActive
                           : styles.scopeBtn
                     }
                     onClick={() => onSelectScope(agent.id)}
                  >
                     {label}
                  </button>
               )
            })}
         </div>
      </div>
   )
}
