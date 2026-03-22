import React from 'react'
import { Button, Input } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ExecApprovalsAllowlistEntry } from '../../../../shared/types/gateway-protocol'
import { formatRelativeTime } from '../../../utils/formatRelativeTime'
import styles from '../NodesPage.module.css'

interface ExecApprovalsAllowlistProps {
   selectedScope: string
   allowlist: ExecApprovalsAllowlistEntry[]
   disabled: boolean
   onPatch: (path: Array<string | number>, value: unknown) => void
   onRemove: (path: Array<string | number>) => void
}

export default function ExecApprovalsAllowlist({
   selectedScope,
   allowlist,
   disabled,
   onPatch,
   onRemove,
}: ExecApprovalsAllowlistProps) {
   const allowlistPath = ['agents', selectedScope, 'allowlist']

   const handleAdd = () => {
      const next = [...allowlist, { pattern: '' }]
      onPatch(allowlistPath, next)
   }

   const handleRemove = (index: number) => {
      if (allowlist.length <= 1) {
         onRemove(['agents', selectedScope, 'allowlist'])
      } else {
         onRemove(['agents', selectedScope, 'allowlist', index])
      }
   }

   const handlePatternChange = (index: number, value: string) => {
      onPatch(['agents', selectedScope, 'allowlist', index, 'pattern'], value)
   }

   return (
      <div style={{ marginTop: 18 }}>
         <div className={styles.row} style={{ border: 'none', padding: '0 0 8px' }}>
            <div>
               <span className={styles.rowTitle}>Allowlist</span>
               <div className={styles.rowDesc}>不区分大小写的 glob 模式匹配。</div>
            </div>
            <Button
               size="small"
               icon={<PlusOutlined />}
               disabled={disabled}
               onClick={handleAdd}
            >
               添加模式
            </Button>
         </div>

         <div className={styles.rowList}>
            {allowlist.length === 0 ? (
               <div className={styles.emptyText}>暂无白名单条目。</div>
            ) : (
               allowlist.map((entry, index) => {
                  const lastUsed = entry.lastUsedAt
                     ? formatRelativeTime(entry.lastUsedAt)
                     : 'never'
                  const lastCommand = entry.lastUsedCommand ?? null
                  const lastPath = entry.lastResolvedPath ?? null

                  return (
                     <div
                        key={index}
                        className={styles.row}
                        style={{ alignItems: 'flex-start' }}
                     >
                        <div style={{ flex: 1 }}>
                           <span className={styles.patternText}>
                              {entry.pattern?.trim() ? entry.pattern : '新模式'}
                           </span>
                           <div className={styles.tokenMeta} style={{ marginTop: 2 }}>
                              <span>Last used: {lastUsed}</span>
                           </div>
                           {lastCommand && (
                              <div className={styles.commandPreview}>
                                 {lastCommand.length > 120
                                    ? lastCommand.slice(0, 120) + '…'
                                    : lastCommand}
                              </div>
                           )}
                           {lastPath && (
                              <div className={styles.commandPreview}>
                                 {lastPath.length > 120
                                    ? lastPath.slice(0, 120) + '…'
                                    : lastPath}
                              </div>
                           )}
                        </div>
                        <div
                           style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              alignItems: 'flex-end',
                           }}
                        >
                           <div>
                              <span className={styles.fieldLabel}>Pattern</span>
                              <Input
                                 size="small"
                                 style={{ width: 200 }}
                                 disabled={disabled}
                                 value={entry.pattern ?? ''}
                                 onChange={(e) =>
                                    handlePatternChange(index, e.target.value)
                                 }
                              />
                           </div>
                           <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              disabled={disabled}
                              onClick={() => handleRemove(index)}
                           >
                              移除
                           </Button>
                        </div>
                     </div>
                  )
               })
            )}
         </div>
      </div>
   )
}
