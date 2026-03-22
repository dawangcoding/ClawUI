import React from 'react'
import { Collapse, Badge, Tag, Typography, Empty } from 'antd'
import type { EventLogEntry } from '../../stores/eventLogStore'
import { formatEventPayload } from './overview-utils'

const { Text } = Typography

export type { EventLogEntry }

interface EventLogPanelProps {
   events: EventLogEntry[]
}

export default function EventLogPanel({ events }: EventLogPanelProps) {
   const visible = events.slice(0, 20)

   return (
      <Collapse
         ghost
         defaultActiveKey={['event-log']}
         items={[
            {
               key: 'event-log',
               label: (
                  <span style={{ fontWeight: 500, letterSpacing: 0.3 }}>
                     事件日志{' '}
                     {events.length > 0 && (
                        <Badge
                           count={events.length}
                           overflowCount={999}
                           style={{ marginLeft: 6 }}
                        />
                     )}
                  </span>
               ),
               children: visible.length === 0 ? (
                  <Empty
                     image={Empty.PRESENTED_IMAGE_SIMPLE}
                     description="暂无事件"
                     style={{ margin: '12px 0' }}
                  />
               ) : (
                  <div
                     style={{
                        maxHeight: 360,
                        overflowY: 'auto',
                        fontSize: 12,
                        fontFamily: 'monospace',
                        padding: '4px 0',
                     }}
                  >
                     {visible.map((entry, idx) => (
                        <div
                           key={idx}
                           style={{
                              display: 'flex',
                              gap: 8,
                              alignItems: 'baseline',
                              padding: '5px 6px',
                              borderRadius: 4,
                              marginBottom: 1,
                              transition: 'background 0.15s',
                              borderBottom:
                                 '1px solid var(--ant-color-border-secondary, #f0f0f0)',
                           }}
                        >
                           <Text
                              type="secondary"
                              style={{
                                 fontSize: 11,
                                 flexShrink: 0,
                                 fontFamily: 'monospace',
                                 opacity: 0.6,
                              }}
                           >
                              {new Date(entry.ts).toLocaleTimeString()}
                           </Text>
                           <Tag
                              style={{
                                 fontSize: 11,
                                 margin: 0,
                                 lineHeight: '18px',
                                 borderRadius: 3,
                              }}
                           >
                              {entry.event}
                           </Tag>
                           {entry.payload != null && (
                              <Text
                                 type="secondary"
                                 ellipsis
                                 style={{
                                    fontSize: 11,
                                    flex: 1,
                                    minWidth: 0,
                                    fontFamily: 'monospace',
                                    opacity: 0.5,
                                 }}
                              >
                                 {formatEventPayload(entry.payload)}
                              </Text>
                           )}
                        </div>
                     ))}
                  </div>
               ),
            },
         ]}
      />
   )
}
