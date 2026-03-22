import React from 'react'
import { Card, Button } from 'antd'
import { SaveOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import type { ExecApprovalsAllowlistEntry } from '../../../../shared/types/gateway-protocol'
import type {
   ExecApprovalsResolvedDefaults,
   ExecApprovalsAgentOption,
} from '../hooks/useExecApprovals'
import type { NodeTargetOption } from '../utils/nodesHelpers'
import { EXEC_APPROVALS_DEFAULT_SCOPE } from '../utils/nodesHelpers'
import ExecApprovalsTarget from './ExecApprovalsTarget'
import ExecApprovalsTabs from './ExecApprovalsTabs'
import ExecApprovalsPolicy from './ExecApprovalsPolicy'
import ExecApprovalsAllowlist from './ExecApprovalsAllowlist'
import styles from '../NodesPage.module.css'

interface ExecApprovalsCardProps {
   ready: boolean
   disabled: boolean
   dirty: boolean
   loading: boolean
   saving: boolean
   target: 'gateway' | 'node'
   targetNodeId: string | null
   targetNodes: NodeTargetOption[]
   targetReady: boolean
   defaults: ExecApprovalsResolvedDefaults
   agents: ExecApprovalsAgentOption[]
   selectedScope: string
   selectedAgentData: Record<string, unknown> | null
   allowlist: ExecApprovalsAllowlistEntry[]
   onLoad: () => void
   onSave: () => void
   onChangeTarget: (kind: 'gateway' | 'node', nodeId: string | null) => void
   onSelectScope: (agentId: string) => void
   onPatch: (path: Array<string | number>, value: unknown) => void
   onRemove: (path: Array<string | number>) => void
}

export default function ExecApprovalsCard({
   ready,
   disabled,
   dirty,
   loading,
   saving,
   target,
   targetNodeId,
   targetNodes,
   targetReady,
   defaults,
   agents,
   selectedScope,
   selectedAgentData,
   allowlist,
   onLoad,
   onSave,
   onChangeTarget,
   onSelectScope,
   onPatch,
   onRemove,
}: ExecApprovalsCardProps) {
   return (
      <Card
         title={
            <div className={styles.cardTitleRow}>
               <div
                  className={styles.cardTitleIcon}
                  style={{ '--card-icon-color': '#faad14' } as React.CSSProperties}
               >
                  <SafetyCertificateOutlined />
               </div>
               <span className={styles.cardTitleText}>执行审批</span>
               {dirty && <span className={styles.dirtyIndicator} />}
            </div>
         }
         extra={
            <Button
               icon={<SaveOutlined />}
               size="small"
               disabled={disabled || !dirty || !targetReady}
               loading={saving}
               onClick={onSave}
            >
               保存
            </Button>
         }
      >
         <div className={styles.cardSubtitle}>
            <code className={styles.mono}>exec host=gateway/node</code> 的白名单和审批策略。
         </div>

         <ExecApprovalsTarget
            target={target}
            targetNodeId={targetNodeId}
            targetNodes={targetNodes}
            disabled={disabled}
            onChangeTarget={onChangeTarget}
         />

         {!ready ? (
            <div className={styles.notLoadedBox}>
               <span className={styles.notLoadedText}>加载审批配置以编辑白名单。</span>
               <Button
                  onClick={onLoad}
                  loading={loading}
                  disabled={!targetReady}
                  size="small"
               >
                  {loading ? '加载中…' : '加载审批'}
               </Button>
            </div>
         ) : (
            <>
               <ExecApprovalsTabs
                  selectedScope={selectedScope}
                  agents={agents}
                  onSelectScope={onSelectScope}
               />
               <ExecApprovalsPolicy
                  selectedScope={selectedScope}
                  defaults={defaults}
                  selectedAgentData={selectedAgentData}
                  disabled={disabled}
                  onPatch={onPatch}
                  onRemove={onRemove}
               />
               {selectedScope !== EXEC_APPROVALS_DEFAULT_SCOPE && (
                  <ExecApprovalsAllowlist
                     selectedScope={selectedScope}
                     allowlist={allowlist}
                     disabled={disabled}
                     onPatch={onPatch}
                     onRemove={onRemove}
                  />
               )}
            </>
         )}
      </Card>
   )
}
