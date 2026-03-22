import React from 'react'
import { Collapse, Badge, Button, Empty } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { stripAnsi } from './overview-utils'

interface LogTailPanelProps {
   lines: string[]
   onRefresh: () => void
}

export default function LogTailPanel({ lines, onRefresh }: LogTailPanelProps) {
   const displayText = lines.length > 0
      ? lines.slice(-50).map((line) => stripAnsi(line)).join('\n')
      : ''

   return (
      <Collapse
         ghost
         defaultActiveKey={['log-tail']}
         items={[
            {
               key: 'log-tail',
               label: (
                  <span
                     style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 500,
                        letterSpacing: 0.3,
                     }}
                  >
                     服务日志
                     {lines.length > 0 && (
                        <Badge
                           count={lines.length}
                           overflowCount={999}
                           style={{ marginLeft: 2 }}
                        />
                     )}
                  </span>
               ),
               extra: (
                  <Button
                     type="text"
                     size="small"
                     icon={<ReloadOutlined />}
                     onClick={(e) => {
                        e.stopPropagation()
                        onRefresh()
                     }}
                  />
               ),
               children: lines.length === 0 ? (
                  <Empty
                     image={Empty.PRESENTED_IMAGE_SIMPLE}
                     description="暂无日志"
                     style={{ margin: '12px 0' }}
                  />
               ) : (
                  <pre
                     style={{
                        fontSize: 11,
                        fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', Menlo, monospace",
                        margin: 0,
                        padding: '10px 12px',
                        maxHeight: 360,
                        overflowY: 'auto',
                        overflowX: 'auto',
                        background: 'var(--ant-color-fill-quaternary)',
                        borderRadius: 6,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        lineHeight: 1.6,
                        color: 'var(--ant-color-text-secondary)',
                        border: '1px solid var(--ant-color-border-secondary)',
                     }}
                  >
                     {displayText}
                  </pre>
               ),
            },
         ]}
      />
   )
}
