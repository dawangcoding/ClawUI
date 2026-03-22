import React, { useState } from 'react'
import { Card, Badge, Tag, Typography, Empty } from 'antd'
import { CodeBlock } from '@agentscope-ai/design'
import type { EventLogEntry } from '../../../stores/eventLogStore'
import styles from '../debug.module.css'

const { Text } = Typography

const MAX_VISIBLE = 50

interface EventLogCardProps {
   events: EventLogEntry[]
}

function formatPayloadSummary(payload: unknown): string {
   if (payload == null) return ''
   try {
      const str = JSON.stringify(payload)
      return str.length > 200 ? str.slice(0, 200) + '…' : str
   } catch {
      return String(payload)
   }
}

export default function EventLogCard({ events }: EventLogCardProps) {
   const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
   const visible = events.slice(0, MAX_VISIBLE)

   return (
      <Card
         title="事件日志"
         extra={
            events.length > 0 ? (
               <Badge
                  count={events.length}
                  overflowCount={999}
                  style={{ backgroundColor: 'var(--ant-color-primary)' }}
               />
            ) : null
         }
      >
         <Text type="secondary" className={styles.subtitle}>
            最近的 Gateway 事件。
         </Text>

         {visible.length === 0 ? (
            <Empty
               image={Empty.PRESENTED_IMAGE_SIMPLE}
               description="暂无事件"
               style={{ margin: '24px 0' }}
            />
         ) : (
            <div className={styles.eventList} style={{ marginTop: 12 }}>
               {visible.map((entry, idx) => (
                  <div key={idx}>
                     <div
                        className={styles.eventItem}
                        onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                        style={{ cursor: 'pointer' }}
                     >
                        <Text className={styles.eventTime}>
                           {new Date(entry.ts).toLocaleTimeString()}
                        </Text>
                        <Tag style={{ fontSize: 11, margin: 0, lineHeight: '18px' }}>
                           {entry.event}
                        </Tag>
                        {entry.payload != null && (
                           <span className={styles.eventPayload}>
                              {formatPayloadSummary(entry.payload)}
                           </span>
                        )}
                     </div>
                     {expandedIdx === idx && entry.payload != null && (
                        <div className={styles.eventPayloadExpanded}>
                           <CodeBlock
                              language="json"
                              value={JSON.stringify(entry.payload, null, 2)}
                              readOnly
                           />
                        </div>
                     )}
                  </div>
               ))}
               {events.length > MAX_VISIBLE && (
                  <Text
                     type="secondary"
                     style={{ display: 'block', textAlign: 'center', padding: '8px 0' }}
                  >
                     还有 {events.length - MAX_VISIBLE} 条事件未显示
                  </Text>
               )}
            </div>
         )}
      </Card>
   )
}
