import React from 'react'
import { Select } from 'antd'
import type { NodeTargetOption } from '../utils/nodesHelpers'
import styles from '../NodesPage.module.css'

interface ExecApprovalsTargetProps {
   target: 'gateway' | 'node'
   targetNodeId: string | null
   targetNodes: NodeTargetOption[]
   disabled: boolean
   onChangeTarget: (kind: 'gateway' | 'node', nodeId: string | null) => void
}

export default function ExecApprovalsTarget({
   target,
   targetNodeId,
   targetNodes,
   disabled,
   onChangeTarget,
}: ExecApprovalsTargetProps) {
   const hasNodes = targetNodes.length > 0
   const nodeOptions = targetNodes.map((n) => ({ value: n.id, label: n.label }))

   return (
      <div className={styles.row} style={{ marginTop: 12 }}>
         <div>
            <span className={styles.rowTitle}>Target</span>
            <div className={styles.rowDesc}>
               Gateway 编辑本地审批配置；Node 编辑所选节点的配置。
            </div>
            {target === 'node' && !hasNodes && (
               <div className={styles.rowDesc} style={{ marginTop: 4 }}>
                  暂无支持 exec approvals 的节点。
               </div>
            )}
         </div>
         <div className={styles.rowRight}>
            <div>
               <span className={styles.fieldLabel}>Host</span>
               <Select
                  size="small"
                  style={{ width: 120 }}
                  disabled={disabled}
                  value={target}
                  onChange={(value) => {
                     if (value === 'node') {
                        const first = targetNodes[0]?.id ?? null
                        onChangeTarget('node', targetNodeId || first)
                     } else {
                        onChangeTarget('gateway', null)
                     }
                  }}
                  options={[
                     { value: 'gateway', label: 'Gateway' },
                     { value: 'node', label: 'Node' },
                  ]}
               />
            </div>
            {target === 'node' && (
               <div>
                  <span className={styles.fieldLabel}>Node</span>
                  <Select
                     size="small"
                     style={{ width: 200 }}
                     disabled={disabled || !hasNodes}
                     value={targetNodeId ?? ''}
                     onChange={(value) => {
                        onChangeTarget('node', value || null)
                     }}
                     options={[
                        { value: '', label: '选择节点' },
                        ...nodeOptions,
                     ]}
                  />
               </div>
            )}
         </div>
      </div>
   )
}
