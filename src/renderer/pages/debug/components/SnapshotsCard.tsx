import React from 'react'
import { Card, Button, Alert, Typography, Flex } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { CodeBlock } from '@agentscope-ai/design'
import styles from '../debug.module.css'

const { Text } = Typography

interface SnapshotsCardProps {
   status: Record<string, unknown> | null
   health: Record<string, unknown> | null
   heartbeat: unknown
   loading: boolean
   onRefresh: () => void
}

export default function SnapshotsCard({
   status,
   health,
   heartbeat,
   loading,
   onRefresh,
}: SnapshotsCardProps) {
   // 提取安全审计信息
   const securityAudit =
      status && typeof status === 'object'
         ? (status as { securityAudit?: { summary?: Record<string, number> } }).securityAudit
         : null
   const securitySummary = securityAudit?.summary ?? null
   const critical = securitySummary?.critical ?? 0
   const warn = securitySummary?.warn ?? 0
   const info = securitySummary?.info ?? 0
   const securityType = critical > 0 ? 'error' : warn > 0 ? 'warning' : 'success'
   const securityLabel =
      critical > 0
         ? `${critical} 个严重问题`
         : warn > 0
           ? `${warn} 个警告`
           : '无严重问题'

   return (
      <Card
         title="快照"
         extra={
            <Button
               icon={<ReloadOutlined />}
               disabled={loading}
               onClick={onRefresh}
               size="small"
            >
               {loading ? '刷新中...' : '刷新'}
            </Button>
         }
      >
         <Text type="secondary" className={styles.subtitle}>
            状态、健康检查、心跳数据。
         </Text>

         {securitySummary && (
            <Alert
               type={securityType as 'error' | 'warning' | 'success'}
               showIcon
               style={{ marginTop: 12 }}
               message={`安全审计: ${securityLabel}${info > 0 ? ` · ${info} 条信息` : ''}`}
               description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                     运行 <code>openclaw security audit --deep</code> 获取详细信息。
                  </Text>
               }
            />
         )}

         <Flex vertical gap={12} style={{ marginTop: 12 }}>
            <div>
               <div className={styles.sectionLabel}>Status</div>
               <div className={styles.codeWrap}>
                  <CodeBlock
                     language="json"
                     value={JSON.stringify(status ?? {}, null, 2)}
                     readOnly
                  />
               </div>
            </div>
            <div>
               <div className={styles.sectionLabel}>Health</div>
               <div className={styles.codeWrap}>
                  <CodeBlock
                     language="json"
                     value={JSON.stringify(health ?? {}, null, 2)}
                     readOnly
                  />
               </div>
            </div>
            <div>
               <div className={styles.sectionLabel}>Last heartbeat</div>
               <div className={styles.codeWrap}>
                  <CodeBlock
                     language="json"
                     value={JSON.stringify(heartbeat ?? {}, null, 2)}
                     readOnly
                  />
               </div>
            </div>
         </Flex>
      </Card>
   )
}
